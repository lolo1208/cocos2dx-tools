/**
 * Created by limylee on 2017/8/23.
 */


var http = require("http");
var url = require("url");
var path = require("path");
var fs = require("fs");
var os = require("os");
var args = require("./node_modules/commander");


// 解析命令行参数
args.port = 0;
args.dir = null;
args
    .version('0.1.0')
    .option('-p, --port <n>', '端口号', parseInt)
    .option('-d, --dir <string>', '虚拟目录路径')
    .parse(process.argv);

var PORT = args.port;
var DIR = args.dir;


var server = http.createServer(function (request, response) {
    var pathname = url.parse(request.url).pathname;
    var realPath = path.join(DIR, pathname);
    var ext = path.extname(realPath);
    ext = ext ? ext.slice(1) : 'unknown';
    fs.exists(realPath, function (exists) {
        if (exists) {
            fs.readFile(realPath, "binary", function (err, file) {
                if (err) {
                    response.writeHead(500, {'Content-Type': 'text/plain'});
                    response.end(err.toString());
                }
                else {
                    var contentType = MIME[ext] || "application/octet-stream";
                    response.writeHead(200, {'Content-Type': contentType});
                    response.write(file, "binary");
                    response.end();
                }
            });
        }

        // 文件不存在
        else {
            response.writeHead(404, {'Content-Type': 'text/plain'});
            response.end("=-> 404 <-=");
        }
    });
});


// 启动服务
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
console.log("HTTP服务器启动成功，访问地址：");
console.log("http://" + IP + ":" + PORT + "/");


// MIME类型
var MIME = {
    "gif": "image/gif",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "swf": "application/x-shockwave-flash",
    "html": "text/html",
    "ico": "image/x-icon",
    "css": "text/css",
    "js": "text/javascript",
    "json": "application/json",
    "xml": "text/xml",
    "pdf": "application/pdf",
    "txt": "text/plain",
    "wav": "audio/x-wav",
    "wma": "audio/x-ms-wma",
    "wmv": "video/x-ms-wmv",
    "mp3": "audio/mpeg",

    "ani": "image/png",
    "ui": "image/png",
    "plist": "text/xml"
};