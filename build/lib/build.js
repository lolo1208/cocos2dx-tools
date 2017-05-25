/**
 * - 传入有更改的ts文件路径，将对应的模块标记为已改变。
 * - 编译项目中有改变的模块（bin-debug）。
 * - 清理项目，重新生成所有模块（bin-debug）。
 * - 生成所有模块（bin-release）。
 * Created by LOLO on 2017/1/18.
 */


var fs = require("fs");
var child = require("child_process");
var path = require('path');

var args = require("./node_modules/commander");

require("./build.config");


args.projectDir = null;
args.file = null;
args.build = false;
args.clean = false;
args.release = false;
args
    .version('0.0.1')
    .option('-p, --projectDir <string>', '项目根目录')
    .option('-f, --file <string>', '传入文件有变动，将所属的模块标记为有改变')
    .option('-b, --build', '编译有改变的模块')
    .option('-c, --clean', '清理项目，重新编译所有模块')
    .option('-r, --release', '是否构建 release 版本，默认 false')
    .parse(process.argv);

var NODE_PATH = "../bin/node";
var P_DIR = formatDirPath(args.projectDir);

var OUT_DIR = "bin-" + (args.release ? "release" : "debug") + "/";

// 获取项目对应的配置文件
if (config[P_DIR] == null) config[P_DIR] = {changedModules: [], pid: 0};
var pConfig = config[P_DIR];

var M_LIST = [
    "src/app/module/",
    "src/app/",
    "src/"
];

var moduleName, cArgs, p_tsc, jsFile;
var i, file;


////////////////////////////////
//
// 标记有改变的模块
//
////////////////////////////////
if (args.file) {
    file = args.file.replace(/\\/g, "/");
    if (file.substring(0, 4) == "src/") {
        for (i = 0; i < M_LIST.length; i++) {
            if (file.indexOf(M_LIST[i]) != -1) {
                var matcher = new RegExp(M_LIST[i] + "(.*?)" + "/");
                moduleName = file.match(matcher)[0];
                addChangedModule(moduleName);
                saveConfig();
                break;
            }
        }
    }
}


////////////////////////////////
//
// 清理 或 发布
//
////////////////////////////////
if (args.clean || args.release) {
    var files, n;
    for (i = 0; i < M_LIST.length; i++) {
        files = fs.readdirSync(P_DIR + M_LIST[i]);
        for (n = 0; n < files.length; n++) {
            file = files[n];
            if (i == 1 && file == "module") continue;
            if (i == 2 && (file == "app" || file == "js")) continue;
            addChangedModule(M_LIST[i] + file + "/");
        }
    }
    removeDir(P_DIR + OUT_DIR);
    args.build = true;
}


////////////////////////////////
//
// 编译所有有改变的模块
//
////////////////////////////////
if (args.build) {
    // 杀掉之前正在编译的进程
    try {
        if (pConfig.pid != 0) process.kill(pConfig.pid);
    }
    catch (error) {
    }
    pConfig.pid = process.pid;
    buildNextModule();
}


//


/**
 * 编译下一个模块
 */
function buildNextModule() {

    // 全部编译完成
    if (pConfig.changedModules.length == 0) {
        delete config[P_DIR];
        saveConfig();
        console.log("compile completed!");
        return;
    }

    moduleName = pConfig.changedModules[0];
    cArgs = ["node_modules/typescript/bin/tsc"];
    findTS(P_DIR + moduleName);

    moduleName = moduleName.substring(4, moduleName.length - 1);
    moduleName = moduleName.replace(/\//g, ".");
    jsFile = P_DIR + OUT_DIR + moduleName + ".js";
    cArgs.push("--outFile", jsFile);
    cArgs.push("--target", "ES5");
    if (args.release) {
        cArgs.push("--removeComments");
    }
    else {
        cArgs.push("--sourceMap");
    }

    p_tsc = child.spawn(NODE_PATH, cArgs);
    p_tsc.on("exit", function (/*code, signal*/) {
        console.log("[compiled] " + jsFile);
        pConfig.changedModules.shift();
        saveConfig();
        buildNextModule();
    });
}


/**
 * 添加一个需要编译的模块
 * @param moduleName
 */
function addChangedModule(moduleName) {
    if (pConfig.changedModules.indexOf(moduleName) == -1) {
        pConfig.changedModules.push(moduleName);
    }
}


/**
 * 保存配置文件
 */
function saveConfig() {
    fs.writeFileSync("build.config.js", "config = " + JSON.stringify(config, null, 4) + ";");
}


/**
 * 查找文件夹下的ts文件，并添加到 cArgs 中
 * @param dir
 */
function findTS(dir) {
    var files = fs.readdirSync(dir);
    for (var i = 0; i < files.length; i++) {
        var file = dir + files[i];
        var stat = fs.lstatSync(file);
        if (stat.isDirectory()) {
            findTS(file + "/");
        }
        else {
            if (file.substring(file.length - 3) == ".ts") {
                cArgs.push(file);
            }
        }
    }
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
 * 格式化文件夹路径
 * @param dirPath
 * @return {null}
 */
function formatDirPath(dirPath) {
    if (dirPath == null) return null;
    dirPath = dirPath.replace(/\\/g, "/");
    if (dirPath.substring(dirPath.length - 1) != "/") dirPath += "/";
    return dirPath;
}