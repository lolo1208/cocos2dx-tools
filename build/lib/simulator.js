/**
 * 删除 ../packager/P_NAME 文件夹
 * 清除 simulator 所有资源文件夹
 * 清除 writablePath 所有资源和补丁文件
 * 清除 updateServer 所有资源和补丁文件
 * 调用 packager 命令产出完整包（并拷到模拟器的debug目录）
 * 拷到 updateServer 并调用 unpack 命令解压
 * 重启 updateServer
 *
 * Created by LOLO on 2017/5/12.
 */


var child = require("child_process");
var fs = require("fs");

var args = require("./node_modules/commander");


args.projectName = null;
args.projectVersion = null;
args.projectDir = null;
args.updateServer = null;
args.writablePath = null;
args
    .version('0.0.1')
    .option('-n, --projectName <string>', '项目名称')
    .option('-p, --projectDir <string>', '项目根目录')
    .option('-v, --projectVersion <string>', '3位版本号')
    .option('-u, --updateServer <string>', '更新服务器根目录')
    .option('-w, --writablePath <string>', 'writablePath')
    .parse(process.argv);


var P_NAME = args.projectName;// 项目名称
var P_VER = args.projectVersion;// 3位版本号
var P_DIR = args.projectDir;// 项目根目录
var US_DIR = formatDirPath(args.updateServer);// 更新服务器根目录
var WP_DIR = formatDirPath(args.writablePath);// writablePath
var BIN_UNPACK = US_DIR + "bin/unpack";// unpack 脚本
var BIN_STARTUP = US_DIR + "bin/startup";// startup 脚本
var S_DIR = null;// 模拟器资源根目录
if (process.platform == "win32") {
    BIN_UNPACK += ".cmd";
    BIN_STARTUP += ".cmd";
    S_DIR = P_DIR + "frameworks/runtime-src/proj.win32/Debug.win32/";
}


var zipPath = null;// 打出来的zip包路径
var version = null;// 四位版本号
clearDir();


////////////////////////////////
//
// 清空各种目录
//
////////////////////////////////
function clearDir() {
    console.log("clear packager directory");
    removeDir("../packager/" + P_NAME);

    console.log("clear simulator res directory");
    removeDir(S_DIR + "script");
    removeDir(S_DIR + "version");
    removeDir(S_DIR + "bin-release");
    removeDir(S_DIR + "res");

    console.log("clear writablePath");
    removeDir(WP_DIR + "assets");
    removeDir(WP_DIR + "patch");

    console.log("clear updateServer");
    removeDir(US_DIR + "assets");
    removeDir(US_DIR + "package");
    removeDir(US_DIR + "patch");
    removeDir(US_DIR + "temp");
    createDir(US_DIR + "package");

    packager();
}


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
    args.push("-a", S_DIR);
    var p_packager = child.spawn("../bin/node", args, ["cwd"]);
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
    fs.writeFileSync(US_DIR + "package/" + version + ".zip", fs.readFileSync(zipPath));
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
 * 删除一个目录下的所有文件和子文件夹
 * @param path
 */
function removeDir(path) {
    var files = [];
    if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach(function (file/*, index*/) {
            var curPath = path + "/" + file;
            if (fs.statSync(curPath).isDirectory()) { // recurse
                removeDir(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
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


/**
 * 拷贝一个文件夹，包括子文件和子目录
 * @param oldDir
 * @param newDir
 */
function copyDir(oldDir, newDir) {
    oldDir = formatDirPath(oldDir);
    newDir = formatDirPath(newDir);
    var files = fs.readdirSync(oldDir);
    if (files.length == 0) return;
    createDir(newDir);
    for (var i = 0; i < files.length; i++) {
        var oldFile = oldDir + files[i];
        var newFile = newDir + files[i];
        if (fs.statSync(oldFile).isDirectory())
            copyDir(oldFile, newFile);
        else
            copyFile(oldFile, newFile);
    }
}

/**
 * 拷贝一个文件
 * @param oldFile
 * @param newFile
 */
function copyFile(oldFile, newFile) {
    var buffer = fs.readFileSync(oldFile);
    fs.writeFileSync(newFile, buffer);
}


