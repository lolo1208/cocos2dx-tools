/**
 * - 打包项目，产出完整zip包。
 * - 将打包目录完整拷贝到正在打包的APP目录中
 * Created by LOLO on 2017/4/7.
 */


var START_TIME = new Date().getTime();


var os = require('os');
var fs = require("fs");
var child = require("child_process");
var crypto = require('crypto');
var path = require('path');

var args = require("./node_modules/commander");
var zipper = require("./node_modules/zip-local");

require("./packager.config");


args.projectName = null;
args.projectVersion = null;
args.projectDir = null;
args.appDir = null;
args.ignoreZip = false;
args
    .version('0.1.0')
    .option('-n, --projectName <string>', '项目名称')
    .option('-v, --projectVersion <string>', '3位版本号')
    .option('-p, --projectDir <string>', '项目根目录')
    .option('-a, --appDir <string>', '正在打包的APP目录（打补丁包无需传入）')
    .option('-i, --ignoreZip', '是否无需生成zip包')
    .parse(process.argv);


var P_NAME = args.projectName;// 项目名称
var P_DIR = formatDirPath(args.projectDir);
var APP_DIR = formatDirPath(args.appDir);
var isApp = APP_DIR !== null;// 是否在打app包
var ignoreZip = args.ignoreZip;// 无需生成zip包

var COCOS2D_CONSOLE_PATH = config.cocos2dConsolePath;
if (os.platform() === "win32") COCOS2D_CONSOLE_PATH += ".bat";

var NODE_PATH = (process.platform === "win32") ? "../bin/node" : "node";
var RELEASE = "bin-release/";

var V_3 = args.projectVersion;// 传入的3位版本号
var V_4 = null;// 4位版本号
var PACK_DIR = null;// 打包根目录
var BUILD_DIR = null;// 构建目录
var resList = {};// 资源映射列表


createVersion();


////////////////////////////////
//
// 创建或读取对应的打包目录，得到4位版本号
//
////////////////////////////////
function createVersion() {
    var projectPath = "../packager/" + P_NAME + "/";
    var verFile = projectPath + "version";
    var versionInfo = {};
    if (fs.existsSync(verFile)) {
        try {
            versionInfo = JSON.parse(fs.readFileSync(verFile, "utf-8"));
        } catch (error) {
        }
    }
    if (versionInfo[V_3] == null) versionInfo[V_3] = 0;// 没有打过这三位版本的包

    // 得出4位版本号 和 打包目录
    V_4 = V_3 + "." + (++versionInfo[V_3]);
    PACK_DIR = projectPath + V_3 + "/" + V_4 + "/";
    BUILD_DIR = PACK_DIR + "build/";

    // 保存到文件中
    createDir(projectPath);
    fs.writeFileSync(verFile, JSON.stringify(versionInfo, null, 4));

    build();
}


////////////////////////////////
//
// 编译到 bin-release
//
////////////////////////////////
function build() {
    console.log("build...");

    var args = ["build.js"];
    args.push("-p", P_DIR);
    args.push("-r");
    var p_build = child.spawn(NODE_PATH, args, ["cwd"]);
    p_build.stdout.setEncoding('utf8');
    p_build.stdout.on("data", function (data) {
        console.log(data.replace(/\n/g, ""));
    });
    p_build.on("exit", function (code/*, signal*/) {
        console.log("build finished. exit code:" + code);

        toJSC();
    });
}


////////////////////////////////
//
// 生成 jsc
//
////////////////////////////////
function toJSC() {
    console.log("generates jsc...");

    var args = ["jscompile"];
    args.push("-s", P_DIR + RELEASE);
    args.push("-d", BUILD_DIR + RELEASE);
    var p_jsc = child.spawn(COCOS2D_CONSOLE_PATH, args);
    p_jsc.on("exit", function (code/*, signal*/) {
        console.log("generates jsc finished. exit code:" + code);

        renameJSC();
    });
}


////////////////////////////////
//
// 重命名 jsc 文件，加入 md5 字符串
//
////////////////////////////////
function renameJSC() {
    console.log("rename jsc...");

    var files = fs.readdirSync(BUILD_DIR + RELEASE);
    for (var i = 0; i < files.length; i++) {
        var jscPath = BUILD_DIR + RELEASE + files[i];
        var md5 = getFileMD5(jscPath);
        var newPath = jscPath.substr(0, jscPath.length - 3) + md5 + ".jsc";
        fs.renameSync(jscPath, newPath);

        // 映射 module/js名称 -> md5码
        var jsName = jscPath.substring(jscPath.lastIndexOf("/") + 1, jscPath.length - 1);
        resList["module/" + jsName] = md5;
    }
    console.log("rename jsc finished.");

    copyRes();
}


////////////////////////////////
//
// 拷贝 res 目录
//
////////////////////////////////
function copyRes() {
    console.log("copy res...");
    copyResDir(P_DIR + "res/", BUILD_DIR + "res/");
    console.log("copy res finished.");

    copyMainAndConfig();
}

function copyResDir(oldDir, newDir) {
    oldDir = formatDirPath(oldDir);
    newDir = formatDirPath(newDir);

    var files = fs.readdirSync(oldDir);
    if (files.length == 0) return;

    createDir(newDir);
    for (var i = 0; i < files.length; i++) {
        var oldFile = oldDir + files[i];
        var newFile = newDir + files[i];
        if (fs.statSync(oldFile).isDirectory())
            copyResDir(oldFile, newFile);
        else
            copyResFile(oldFile, newFile);
    }
}

function copyResFile(oldFile, newFile) {
    var arr = oldFile.substr(P_DIR.length).split("/");
    arr.shift();
    arr.shift();

    var path = "";// 文件路径
    for (var i = 0; i < arr.length - 1; i++) {
        path += arr[i] + "/";
    }

    var resType = arr[0];// 文件类型
    var fileName = arr[arr.length - 1];// 文件名称
    if (fileName === undefined) return;

    var extname = fileName.substr(fileName.lastIndexOf(".") + 1);// 后缀名
    switch (resType) {
        case "xml":
            return;
        case "ui":
            if (extname !== "ui") return;
            break;
        case "ani":
            if (extname !== "ani") return;
            break;
        case "map":
            if (extname === "txt" || extname === "zip") return;
            break;

        // 字体文件名必须和字体名称一致，不能添加md5字符串，直接拷贝
        case "font":
            fs.writeFileSync(newFile, fs.readFileSync(oldFile));
            return;
    }
    var buffer = fs.readFileSync(oldFile);
    var md5 = getFileMD5(buffer);
    var md5FileName = fileName.substr(0, fileName.length - extname.length) + md5 + "." + extname;
    newFile = newFile.replace(fileName, md5FileName);
    fs.writeFileSync(newFile, buffer);

    // 添加资源的映射关系
    resList[path + fileName] = md5;
}


////////////////////////////////
//
// 拷贝 main.js / Launcher.js / Updater.js / project.json
// js文件先拷贝到 coreScript 目录，编译成 jsc，再删除 coreScript 目录
//
////////////////////////////////
function copyMainAndConfig() {
    var dir = "../packager/" + P_NAME + "/coreScript/";
    createDir(dir);

    // project.json
    var buffer = fs.readFileSync(P_DIR + "project.json");
    fs.writeFileSync(BUILD_DIR + "project.json", buffer);

    // main.js
    buffer = fs.readFileSync(P_DIR + "main.js");
    fs.writeFileSync(dir + "main.js", buffer);

    // Launcher.js
    buffer = fs.readFileSync(P_DIR + "Launcher.js");
    fs.writeFileSync(dir + "Launcher.js", buffer);

    // Updater.js 写入 lolo.version
    var data = fs.readFileSync(P_DIR + "Updater.js", "utf8");
    data += 'lolo.version="' + V_4 + '";';// 写入当前版本号
    fs.writeFileSync(dir + "Updater.js", data);

    // 编译成 jsc
    var args = ["jscompile"];
    args.push("-s", dir);
    args.push("-d", BUILD_DIR);
    var p_jsc = child.spawn(COCOS2D_CONSOLE_PATH, args);
    p_jsc.on("exit", function (code/*, signal*/) {
        fs.unlinkSync(dir + "main.js");
        fs.unlinkSync(dir + "Launcher.js");
        fs.unlinkSync(dir + "Updater.js");
        fs.rmdirSync(dir);
        console.log("copy main and config finished. exit code:" + code);

        saveResList();
    });
}


////////////////////////////////
//
// 写入 version/V_4.jsc 文件（resList）
//
////////////////////////////////
function saveResList() {
    var dir = BUILD_DIR + "version/";
    var verFile = dir + V_4 + ".js";
    createDir(dir);
    fs.writeFileSync(verFile, "lolo.resList=" + JSON.stringify(resList) + ";");

    // 生成对应的jsc文件
    var args = ["jscompile"];
    args.push("-s", dir);
    args.push("-d", dir);
    var p_jsc = child.spawn(COCOS2D_CONSOLE_PATH, args);
    p_jsc.on("exit", function (code/*, signal*/) {
        fs.unlinkSync(verFile);
        console.log("save res list finished. exit code:" + code);
        // 删除 js文件

        buildFinish();
    });
}


////////////////////////////////
//
// 构建项目、拷贝资源和项目代码完成
//
////////////////////////////////
function buildFinish() {
    removeEmptyDir(BUILD_DIR + "res/");
    removeEmptyDir(BUILD_DIR + "res/");
    removeEmptyDir(BUILD_DIR + "res/");
    removeEmptyDir(BUILD_DIR + "res/");

    createZip();
}


////////////////////////////////
//
// 产出完整zip包
//
////////////////////////////////
function createZip() {
    if (!ignoreZip) console.log("generates zip...");
    var zipPath = PACK_DIR + V_4 + ".zip";

    // 记录 main.js、Launcher.js、project.json MD5，以及 resList
    var md5List = {};
    md5List["main.jsc"] = getFileMD5(BUILD_DIR + "main.jsc");
    md5List["Launcher.jsc"] = getFileMD5(BUILD_DIR + "Launcher.jsc");
    md5List["Updater.jsc"] = getFileMD5(BUILD_DIR + "Updater.jsc");
    md5List["project.json"] = getFileMD5(BUILD_DIR + "project.json");
    md5List.resList = resList;

    // 保存到md5文件夹
    var md5Dir = BUILD_DIR + "md5/";
    var md5File = md5Dir + V_4 + ".md5";
    createDir(md5Dir);
    fs.writeFileSync(md5File, JSON.stringify(md5List));

    // 生成zip文件
    if (!ignoreZip) {
        zipper.sync.zip(BUILD_DIR).compress().save(zipPath);
        console.log("generates zip finished. path:");
        console.log(path.resolve(zipPath));
    }

    // 删除md5文件夹
    fs.unlinkSync(md5File);
    fs.rmdirSync(md5Dir);

    if (isApp) copyScript();
    else allFinish();
}


////////////////////////////////
//
// 拷贝 script 目录，生成 jsc
//
////////////////////////////////
function copyScript() {
    console.log("copy script...");

    var pScriptDir = "../packager/" + P_NAME + "/script/";// 项目对应的 script目录（只生成一次）
    if (!fs.existsSync(pScriptDir)) {
        console.log("generates script jsc...");
        var args = ["jscompile"];
        args.push("-s", P_DIR + "frameworks/cocos2d-x/cocos/scripting/js-bindings/script/");
        args.push("-d", pScriptDir);
        var p_jsc = child.spawn(COCOS2D_CONSOLE_PATH, args);
        p_jsc.on("exit", function (code/*, signal*/) {
            console.log("generates script finished. exit code:" + code);
            doCopyScript();
        });
    }
    else {
        doCopyScript();
    }
}

function doCopyScript() {
    copyDir(
        "../packager/" + P_NAME + "/script/",
        BUILD_DIR + "script/"
    );
    console.log("copy script finished.");

    copyToApp();
}


////////////////////////////////
//
// 拷贝到app目录下
//
////////////////////////////////
function copyToApp() {
    console.log("copy to app...");
    copyDir(BUILD_DIR, APP_DIR);
    console.log("copy to app finished.");

    allFinish();
}


////////////////////////////////
//
// 全部结束
//
////////////////////////////////
function allFinish() {
    console.log("completed!");
    console.log("version : " + V_4);
    console.log("total time : " + (new Date().getTime() - START_TIME) / 1000 + " sec");
}


//


//


/**
 * 获取文件的16位MD5码
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
    var md5 = hash.digest('hex');
    return md5.substring(8, 24);
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
        if (arr[i] === "") continue;
        path += "/" + arr[i];
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
        }
    }
}


/**
 * 删除空文件夹（会检索子文件夹）
 * @param path
 */
function removeEmptyDir(path) {
    path = formatDirPath(path);

    var files = fs.readdirSync(path);
    if (files.length === 0) {
        fs.rmdirSync(path);
    }
    else {
        for (var i = 0; i < files.length; i++) {
            var dir = path + files[i];
            var stat = fs.statSync(dir);
            if (stat.isDirectory()) {
                removeEmptyDir(dir);
            }
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
    if (files.length === 0) return;
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


/**
 * 格式化文件夹路径
 * @param dirPath
 */
function formatDirPath(dirPath) {
    if (dirPath == null) return null;
    dirPath = dirPath.replace(/\\/g, "/");
    if (dirPath.substring(dirPath.length - 1) !== "/") dirPath += "/";
    return dirPath;
}


