/**
 * 解压更新包
 * Created by LOLO on 2016/8/26.
 */



var fs = require("fs");

var args = require("./node_modules/commander");
var zipper = require("./node_modules/zip-local");

require("./createPatch");


args.projectVersion = null;
args
    .version('0.0.1')
    .option('-v, --projectVersion <string>', '4位版本号')
    .parse(process.argv);


var VERSION = args.projectVersion;
if (VERSION == null) process.exit(1);// 必须要传入版本号

var ASSETS_DIR = "../assets/";
var MD5_DIR = ASSETS_DIR + "md5/";
var PACKAGE_DIR = "../package/";


var packagePath = PACKAGE_DIR + VERSION + ".zip";
if (!fs.existsSync(packagePath)) process.exit(1);// 指定的压缩包不存在


// 解压到assets目录
createDir(ASSETS_DIR);
zipper.sync.unzip(packagePath).save(ASSETS_DIR);


// 读取 config.json 结束掉正在运行的更新程序
var config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
if (config.pid > 0) {
    try {
        if (config.pid != 0) process.kill(config.pid);
        console.log("update process killed");
    }
    catch (error) {
    }
    config.pid = 0;
}


// 读取 assets/project.json 中的 coreVersion，记录到 config.json 中
var projectJson = JSON.parse(fs.readFileSync(ASSETS_DIR + "project.json", "utf8"));
config.version = VERSION;
config.coreVersion = projectJson.coreVersion;
fs.writeFileSync("./config.json", JSON.stringify(config), "utf8");


console.log("current version : " + config.version);
console.log("   core version : " + config.coreVersion);


// 获取最近几次更新的版本，产出对应的patch包
var md5FileList = fs.readdirSync(MD5_DIR);
var md5FileNum = md5FileList.length;
for (var i = 0; i < 2; i++) {
    if (i == md5FileNum) break;
    var md5File = md5FileList[md5FileNum - i - 1];
    var md5FileName = md5File.substr(0, md5File.length - 4);
    createPatch(md5FileName, VERSION);
}


//


//


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


