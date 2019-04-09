/*
    OotModLoader - Adding networking functions and mod loading capability to Ocarina of Time.
    Copyright (C) 2019  Team Ooto

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

const logger = require('./OotLogger')("PluginManager");
const fs = require("fs");
const gameshark = require(global.OotRunDir + "/GamesharkToInjectConverter");
const emulator = require(global.OotRunDir + "/OotBizHawk");
var util = require('util');
const path = require('path');
const api = require(global.OotRunDir + "/OotAPI");
const asar = require('asar/lib/disk');
var requireFromString = require('require-from-string');
let fs_protos = { readFileSync: {}, readdirSync: {} };

class PluginSystem {
    constructor() {
        this._plugins = [];
        this._asar_plugins = [];

        (function (inst) {
            fs_protos.readFileSync = fs.readFileSync;
            fs_protos.readdirSync = fs.readdirSync;
            fs.readFileSync = function (_path, options) {
                let f;
                let id;
                let relPath = _path.replace("./", "");
                for (let i = 0; i < inst._asar_plugins.length; i++) {
                    try {
                        f = inst._asar_plugins[i].getFile(relPath);
                    } catch (err) {
                        f = null;
                    }
                    if (f) {
                        id = i;
                        break;
                    }
                }
                if (f) {
                    return asar.readFileSync(inst._asar_plugins[id], _path, f);
                } else {
                    return fs_protos.readFileSync(_path, options);
                }
            }

            fs.readdirSync = function (_path, options) {
                let f = [];
                let id;
                let relPath = _path.replace("./", "");
                let search = relPath.replace("/", "\\");
                for (let i = 0; i < inst._asar_plugins.length; i++) {
                    let list = inst._asar_plugins[i].listFiles();
                    for (let j = 0; j < list.length; j++) {
                        if (list[j].indexOf(search) > -1 && list[j].indexOf(".") > -1) {
                            let k = list[j].replace("/\\/", "/");
                            k = k.substring(1, k.length);
                            f.push(path.basename(k));
                        }
                    }
                }
                if (f.length > 0){
                    return f;
                }else{
                    return fs_protos.readdirSync(_path, options);
                }
            }

            function pluginRequire(_path) {
                let f;
                let id;
                let relPath = path.relative(api._plugindir, _path);
                relPath = relPath.replace("..\\", "");
                relPath = relPath.replace("/\\/", "/");
                for (let i = 0; i < inst._asar_plugins.length; i++) {
                    try {
                        f = inst._asar_plugins[i].getFile(relPath);
                    } catch (err) {
                        f = null;
                    }
                    if (f) {
                        id = i;
                        break;
                    }
                }
                if (f) {
                    return requireFromString(asar.readFileSync(inst._asar_plugins[id], _path, f).toString());
                } else {
                    return require(path.resolve(api._plugindir, _path));
                }
            };

            global["pluginRequire"] = pluginRequire;
        })(this)
    }

    loadPlugins(params) {
        (function (inst) {
            for (let i = 0; i < params.paths.length; i++) {
                fs.readdirSync(params.paths[i]).forEach(function (file) {
                    if (file.indexOf(".js") > -1) {
                        inst._plugins.push(require(path.join(params.paths[i], file)));
                    } else if (file.indexOf(".asar") > -1) {
                        logger.log(file);
                        inst._asar_plugins.push(asar.readFilesystemSync(path.join(params.paths[i], file)));
                        logger.log(inst._asar_plugins[inst._asar_plugins.length - 1].listFiles());
                        let manifest = inst._asar_plugins[inst._asar_plugins.length - 1].getFile("manifest.json");
                        if (manifest) {
                            let parse_manifest = JSON.parse(asar.readFileSync(inst._asar_plugins[inst._asar_plugins.length - 1], path.join("manifest.json"), manifest).toString());
                            logger.log(parse_manifest);
                            inst._plugins.push(pluginRequire(parse_manifest.mainFile));
                        }
                    }
                });
            }
        })(this);
        return this;
    }

    then(fn) {
        try {
            fn(this._plugins)
        } catch (err) {
            logger.log(err, "red");
            logger.log(err.stack, "red");
        }
    }
}

pluginSystem = new PluginSystem();

class PluginLoader {
    constructor() {
    }

    load(callback) {
        pluginSystem.loadPlugins(
            {
                paths: [
                    process.cwd() + '/plugins/',
                ],
                custom: [],
            })
            .then(function onSuccess(plugins) {
                logger.log("Starting preinit phase.", "green");
                for (let i = 0; i < plugins.length; i++) {
                    logger.log("Plugin Preinit: " + plugins[i]._name);
                    plugins[i].preinit();
                }
                logger.log("Starting init phase.", "green");
                for (let i = 0; i < plugins.length; i++) {
                    logger.log("Plugin Init: " + plugins[i]._name);
                    plugins[i].init();
                }
                logger.log("Starting postinit phase.", "green");
                for (let i = 0; i < plugins.length; i++) {
                    logger.log("Plugin Postinit: " + plugins[i]._name);
                    plugins[i].postinit();
                }
                logger.log("Plugin loading complete.", "green");
                callback();
            })
        let payloads = fs.readdirSync(process.cwd() + '/plugins/payloads_10');
        let p = [];
        logger.log("Starting payload loading phase.", "green");
        Object.keys(payloads).forEach(function (key) {
            if (payloads[key].indexOf(".payload") > -1) {
                logger.log("Loading payload: " + payloads[key] + ".");
                let j = gameshark.read(process.cwd() + '/plugins/payloads_10/' + payloads[key]);
                p.push(j);
            }
        });
        emulator.setConnectedFn(function () {
            for (let i = 0; i < p.length; i++) {
                if (p[i].params.event !== undefined) {
                    api.registerEventHandler(p[i].params.event, function (event) {
                        emulator.sendViaSocket({ packet_id: "gs", codes: p[i].codes });
                    });
                } else {
                    if (p[i].params.delay !== undefined) {
                        emulator.sendViaSocket({ packet_id: "gs", codes: p[i].codes, delay: Number(p[i].params.delay) });
                    } else {
                        emulator.sendViaSocket({ packet_id: "gs", codes: p[i].codes });
                    }
                    api.registerEventHandler("onSoftReset_Post", function (event) {
                        if (p[i].params.delay !== undefined) {
                            emulator.sendViaSocket({ packet_id: "gs", codes: p[i].codes, delay: Number(p[i].params.delay) });
                        } else {
                            emulator.sendViaSocket({ packet_id: "gs", codes: p[i].codes });
                        }
                    });
                }
            }
        });
    }
}

module.exports = new PluginLoader();