/**
 * 打补丁包
 * Created by LOLO on 2017/4/11.
 */


var fs = require("fs");
var zipper = require("./node_modules/zip-local");


// 地区-语种
var LOCALE = "zh_CN";


var ASSETS_DIR = "../assets/";
var MD5_DIR = ASSETS_DIR + "md5/";
var VER_DIR = ASSETS_DIR + "version/";
var PATCH_DIR = "../patch/";

var mainResList = ["main.jsc", "Launcher.jsc", "Updater.jsc", "project.json"];


//


/**
 * 产出补丁包
 * @param fromVer 从这个版本
 * @param toVer 到这个版本
 */
createPatch = function (fromVer, toVer) {
    if (fromVer === toVer) return true;

    // 补丁包已经存在了
    var zipPath = PATCH_DIR + fromVer + "-" + toVer + ".zip";
    if (fs.existsSync(zipPath)) return true;

    // md5映射文件不存在
    var fromFile = MD5_DIR + fromVer + ".md5";
    var toFile = MD5_DIR + toVer + ".md5";
    if (!fs.existsSync(fromFile) || !fs.existsSync(toFile)) return false;

    // 准备打包的临时目录
    var packDir = "../temp/" + fromVer + "-" + toVer + "/";
    // 临时目录存在，表示正在打这个补丁
    if (fs.existsSync(packDir)) return false;
    createDir(packDir);

    // 读取md5映射
    var fromMD5 = JSON.parse(fs.readFileSync(fromFile));
    var toMD5 = JSON.parse(fs.readFileSync(toFile));


    // 将有差异的 资源 和 代码jsc 拷贝到准备打包的目录中
    var fRes = fromMD5.resList;
    var tRes = toMD5.resList;
    for (var key in tRes) {
        if (tRes[key] !== fRes[key]) {

            var index = key.lastIndexOf("/");
            var path = key.substr(0, index);// 资源路径
            var fileName = key.substr(index + 1);// 文件名
            index = fileName.lastIndexOf(".");
            var extname = fileName.substr(index + 1);// 后缀名
            fileName = fileName.substr(0, index);

            var isModule = path === "module";// [ true:代码模块，false:资源文件 ]
            if (isModule) path = "bin-release";
            else path = "res/" + LOCALE + "/" + path;
            createDir(packDir + path);

            path += "/" + fileName + "." + tRes[key] + "." + extname;
            if (isModule) path += "c";
            copyFile(ASSETS_DIR + path, packDir + path);
        }
    }


    // 拷贝根目录下的几个资源（Updater.jsc 肯定会被拷贝）
    var i = 0, len = mainResList.length;
    for (; i < len; i++) {
        var mainRes = mainResList[i];
        if (toMD5[mainRes] !== fromMD5[mainRes]) {
            copyFile(ASSETS_DIR + mainRes, packDir + mainRes);
        }
    }


    // 拷贝 版本号.jsc
    var packVerDir = packDir + "version/";
    createDir(packVerDir);
    var fn = toVer + ".jsc";
    copyFile(VER_DIR + fn, packVerDir + fn);


    // 生成zip包
    createDir(PATCH_DIR);
    zipper.sync.zip(packDir).compress().save(zipPath);


    // 移除临时打包目录
    removeDir(packDir);


    console.log("generates patch : " + fromVer + " -> " + toVer);
    return true;
};


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
        if (arr[i] === "") continue;
        path += "/" + arr[i];
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
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
 * 拷贝一个文件
 * @param oldFile
 * @param newFile
 */
function copyFile(oldFile, newFile) {
    var buffer = fs.readFileSync(oldFile);
    fs.writeFileSync(newFile, buffer);
}
