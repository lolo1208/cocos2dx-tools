/**
 * 开启更新服务器
 * Created by LOLO on 2016/8/26.
 */



var http = require("http");
var url = require("url");
var path = require("path");
var query = require("querystring");
var os = require("os");
var fs = require("fs");
var crypto = require('crypto');

require("./createPatch");


var PORT = 8010;
var PATCH_DIR = "../patch/";

var config = JSON.parse(fs.readFileSync("./config.json", "utf8"));


// 结束掉正在运行的更新程序
if (config.pid > 0) {
    try {
        if (config.pid !== 0) process.kill(config.pid);
    }
    catch (error) {
    }
}
config.pid = process.pid;
fs.writeFileSync("./config.json", JSON.stringify(config), "utf8");


var server = http.createServer(function (request, response) {
    var pathname = url.parse(request.url).pathname;

    // response.setHeader("Access-Control-Allow-Origin", "*");
    // response.setHeader("Access-Control-Allow-Headers", "X-Requested-With");
    // response.setHeader("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");

    // 只做更新服务
    if (pathname !== "/update") {
        responseError(response);
        return;
    }

    var postData = "";
    request.on("data", function (chunk) {
        postData += chunk;
    });
    request.on("end", function () {
        var params = query.parse(postData);
        var version = params.version;
        switch (params.action) {

            // 获取最新版本号
            case "getVersion":
                var coreVersion = params.coreVersion;
                if (version == null || coreVersion == null)
                    responseError(response);
                else {
                    getVersion(response, version, coreVersion);
                }
                break;

            // 获取补丁
            case "getPatch":
                var range = request.headers.range;
                if (version == null) {
                    responseError(response);
                }
                else {
                    getPatch(response, version, range);
                }
                break;

            default:
                responseError(response);
        }
    });
});


//


/**
 * 响应action:获取版本号
 */
function getVersion(response, version, coreVersion) {
    var md5 = "";

    // 需要重新下载app
    if (coreVersion !== config.coreVersion) {
    }
    // 需要下载补丁包
    else if (version !== config.version) {
        if (createPatch(version, config.version)) {
            var zipPath = PATCH_DIR + version + "-" + config.version + ".zip";
            if (!fs.existsSync(zipPath)) {// 创建补丁包失败
                responseError(response);
                return;
            }
            md5 = getFileMD5(zipPath);
        }
        // 创建补丁包失败
        else {
            responseError(response);
            return;
        }
    }

    response.writeHead(200, {"Content-Type": "text/plain"});
    response.write(JSON.stringify({version: config.version, coreVersion: config.coreVersion, md5: md5}));
    response.end();
}


//


/**
 * 响应action:获取补丁包
 */
function getPatch(response, version, range) {

    // 创建补丁包成功
    if (createPatch(version, config.version)) {
    }
    else {
        responseError(response);
        return;
    }

    var zipPath = PATCH_DIR + version + "-" + config.version + ".zip";
    var size = fs.statSync(zipPath).size;

    var pos = parseInt(/^bytes=([0-9]+)-$/.exec(range)[1]);
    if (pos === 0) {
        response.setHeader("Accept-Ranges", "bytes");
        response.setHeader("Content-Length", size);
    }
    else {
        response.setHeader("Content-Range", "bytes " + pos + "-" + (size - 1) + "/" + size);
        response.setHeader("Content-Length", size - pos);
    }
    // response.setHeader("Connection", "keep-alive");
    response.writeHead(206, "Partial Content", {"Content-Type": "application/octet-stream"});

    var stream = fs.createReadStream(zipPath, {
        encoding: "binary",
        bufferSize: 1024 * 1024,
        start: pos,
        end: size
    });
    stream.on("data", function (chunk) {
        response.write(chunk, "binary");
    });
    stream.on("end", function () {
        response.end();
    });
}


//


/**
 * 返回错误响应
 * @param response
 */
function responseError(response) {
    response.writeHead(400);
    response.end();
}


//


//


/**
 * 获取文件的MD5码
 * @param pathOrBuffer 文件路径或内容buffer
 * @return {string|*}
 */
function getFileMD5(pathOrBuffer) {
    // 传入的是路径
    if (typeof pathOrBuffer === 'string' && pathOrBuffer.constructor === String) {
        pathOrBuffer = fs.readFileSync(pathOrBuffer);
    }
    var hash = crypto.createHash('md5');
    hash.update(pathOrBuffer);
    return hash.digest('hex');
}


//


//


var IP = "";
var interfaces = os.networkInterfaces();
for (var devName in interfaces) {
    var iface = interfaces[devName];
    for (var i = 0; i < iface.length; i++) {
        var alias = iface[i];
        if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
            IP = alias.address;
        }
    }
}

server.listen(PORT);
console.log("程序启动成功，访问地址：");
console.log("http://" + IP + ":" + PORT);
console.log(" app version : " + config.version);
console.log("core version : " + config.coreVersion);