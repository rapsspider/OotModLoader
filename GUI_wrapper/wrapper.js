const path = require('path');

console.log(process.argv)
let asar = "";
for (let i = 0; i < process.argv.length; i++){
    if (process.argv[i].indexOf("--asar") > -1){
        asar = process.argv[i].split("=")[1];
    }
}

if (asar === ""){
    asar = "OotModLoader.asar";
}

global["OotModLoader"] = {};
global.OotModLoader["asar"] = path.dirname(process.execPath) + "/resources/" + asar;
require(global.OotModLoader.asar + "/main.js");