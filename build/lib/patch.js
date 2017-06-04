/**
 * 调用 packager 命令产出完整包
 * 拷到 updateServer 并调用 unpack 命令解压
 * 重启 updateServer
 * Created by LOLO on 2017/4/15.
 */


var child = require("child_process");
var fs = require("fs");

var args = require("./node_modules/commander");


args.projectName = null;
args.projectVersion = null;
args.projectDir = null;
args.updateServer = null;
args
    .version('0.0.1')
    .option('-n, --projectName <string>', '项目名称')
    .option('-p, --projectDir <string>', '项目根目录')
    .option('-v, --projectVersion <string>', '3位版本号')
    .option('-u, --updateServer <string>', '更新服务器路径')
    .parse(process.argv);


var P_NAME = args.projectName;
var P_VER = args.projectVersion;
var P_DIR = args.projectDir;
var US_DIR = formatDirPath(args.updateServer);
var BIN_UNPACK = US_DIR + "bin/unpack";
var BIN_STARTUP = US_DIR + "bin/startup";
var NODE_PATH;
if (process.platform == "win32") {
    NODE_PATH = "../bin/node";
    BIN_UNPACK += ".cmd";
    BIN_STARTUP += ".cmd";
}
else {
    NODE_PATH = "node";
    BIN_UNPACK += ".sh";
    BIN_STARTUP += ".sh";
}


var zipPath = null;// 打出来的zip包路径
var version = null;// 四位版本号
packager();


////////////////////////////////
//
// 产出完整包
//
////////////////////////////////
function packager() {
    var args = ["packager.js"];
    args.push("-n", P_NAME);
    args.push("-p", P_DIR);
    args.push("-v", P_VER);
    var p_packager = child.spawn(NODE_PATH, args, ["cwd"]);
    p_packager.stdout.setEncoding('utf8');
    p_packager.stdout.on("data", function (data) {
        var index = data.lastIndexOf(".zip");
        if (index != -1) {
            var path = data.substr(0, index).replace(/\\/g, "/");
            index = path.lastIndexOf("\n");
            if (index != -1) path = path.substr(index + 1);

            index = path.lastIndexOf("/");
            zipPath = path + ".zip";
            version = path.substr(index + 1);
        }
        console.log(data);
    });
    p_packager.on("exit", function (code/*, signal*/) {
        console.log("packager finished. exit code:" + code);
        console.log("\n-------------------------------------------------");
        console.log("zip path : " + zipPath);
        console.log(" version : " + version);
        console.log("-------------------------------------------------\n");
        unpack();
    });
}


////////////////////////////////
//
// 拷贝到 updateServer/package 目录，并解压
//
////////////////////////////////
function unpack() {
    console.log("copy to updateServer");
    var packageDir = US_DIR + "package/";
    createDir(packageDir);
    fs.writeFileSync(packageDir + version + ".zip", fs.readFileSync(zipPath));
    console.log("unpack");

    var args = [];
    args.push("-v", version);
    var p_unpack = child.spawn(BIN_UNPACK, args);
    p_unpack.on("exit", function (code/*, signal*/) {
        console.log("unpack finished. exit code:" + code);
        startup();
    });
}


////////////////////////////////
//
// 启动 updateServer
//
////////////////////////////////
function startup() {
    console.log("\n\nstartup updateServer");
    console.log("-------------------------------------------------");

    var p_startup = child.spawn(BIN_STARTUP);
    p_startup.stdout.setEncoding('utf8');
    p_startup.stdout.on("data", function (data) {
        console.log(data);
    });
}


//


//


/**
 * 格式化文件夹路径
 * @param dirPath
 */
function formatDirPath(dirPath) {
    if (dirPath == null) return null;
    dirPath = dirPath.replace(/\\/g, "/");
    if (dirPath.substring(dirPath.length - 1) != "/") dirPath += "/";
    return dirPath;
}


/**
 * 创建文件夹，包括父目录
 * @param path
 */
function createDir(path) {
    path = path.replace(/\\/g, "/");
    var arr = path.split("/");
    path = arr[0];
    for (var i = 1; i < arr.length; i++) {
        if (arr[i] == "") continue;
        path += "/" + arr[i];
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
        }
    }
}

