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
const gameshark = require(global.OotRunDir + "/GamesharkToInjectConverter");
const emulator = require(global.OotRunDir + "/OotBizHawk");
const path = require('path');
const api = require(global.OotRunDir + "/OotAPI");
const Volume = require('memfs').Volume;
const real_fs = require('fs');
const Union = require('unionfs').Union;
const monkey_patch = require('fs-monkey');
const virtual_fs = new Union().use(real_fs);
const AdmZip = require('adm-zip');
monkey_patch.patchRequire(virtual_fs, true);

class PluginSystem {
    constructor() {
        this._plugins = [];
        this._payloads = [];
        api.registerEvent("onPluginPreinit");
        api.registerEvent("onPluginInit");
        api.registerEvent("onPluginPostinit");
    }

    loadPlugins(params) {
        (function (inst) {
            for (let i = 0; i < params.paths.length; i++) {
                // Do first pass.
                real_fs.readdirSync(params.paths[i]).forEach(function (file) {
                    if (file.indexOf(".zip") > -1) {
                        logger.log("Loading " + file + " to virtual file system.")
                        let pluginFS = new Volume();
                        virtual_fs.use(pluginFS);
                        monkey_patch.patchRequire(virtual_fs, true);
                        // Copy this file into our virtual space.
                        let buf = real_fs.readFileSync(params.paths[i] + file);
                        pluginFS.writeFileSync("/" + file, buf);
                        let revert = monkey_patch.patchFs(pluginFS);
                        var zip = new AdmZip("/" + file);
                        zip.extractAllTo("/", true);
                        revert();
                        pluginFS.readdirSync("/").forEach(function (vfile) {
                            logger.log(vfile);
                            if (vfile.indexOf(".js") > -1) {
                                try {
                                    let plugin = require("/" + vfile);
                                    plugin["_fileSystem"] = pluginFS;
                                    inst._plugins.push(plugin);
                                } catch (err) {
                                    logger.log(err.stack);
                                }
                            }
                        });
                        let payloads_path = path.join(params.paths[i], file, "/payloads");
                        if (pluginFS.existsSync("/payloads")) {
                            let payloads = pluginFS.readdirSync("/payloads");
                            Object.keys(payloads).forEach(function (key) {
                                if (payloads[key].indexOf(".payload") > -1) {
                                    logger.log("Loading payload: " + payloads[key] + ".");
                                    let j = gameshark.read(pluginFS.readFileSync('/payloads/' + payloads[key]).toString());
                                    inst._payloads.push(j);
                                }
                            });
                        }
                    }
                });
                real_fs.readdirSync(params.paths[i]).forEach(function (file) {
                    if (real_fs.lstatSync(path.join(params.paths[i], file)).isDirectory()) {
                        real_fs.readdirSync(path.join(params.paths[i], file)).forEach(function (file2) {
                            if (file2.indexOf(".js") > -1) {
                                let plugin = require(path.join(params.paths[i], file, file2));
                                plugin["_fileSystem"] = real_fs;
                                plugin["_payloads"] = [];
                                inst._plugins.push(plugin);
                            }
                        });
                        let payloads_path = path.join(params.paths[i], file, "/payloads");
                        if (real_fs.existsSync(payloads_path)) {
                            let payloads = real_fs.readdirSync(payloads_path);
                            Object.keys(payloads).forEach(function (key) {
                                if (payloads[key].indexOf(".payload") > -1) {
                                    logger.log("Loading payload: " + payloads[key] + ".");
                                    let j = gameshark.read(real_fs.readFileSync(path.join(payloads_path, payloads[key])).toString());
                                    inst._payloads.push(j);
                                }
                            });
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
    constructor(pluginSystem) {
        this._pluginSystem = pluginSystem;
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
                    api.registerPlugin(plugins[i]);
                    logger.log("Plugin Preinit: " + plugins[i]._name);
                    plugins[i].preinit();
                    api.postEvent({ id: "onPluginPreinit", plugin: plugins[i] });
                }
                logger.log("Starting init phase.", "green");
                for (let i = 0; i < plugins.length; i++) {
                    logger.log("Plugin Init: " + plugins[i]._name);
                    plugins[i].init();
                    api.postEvent({ id: "onPluginInit", plugin: plugins[i] });
                }
                logger.log("Starting postinit phase.", "green");
                for (let i = 0; i < plugins.length; i++) {
                    logger.log("Plugin Postinit: " + plugins[i]._name);
                    plugins[i].postinit();
                    api.postEvent({ id: "onPluginPostinit", plugin: plugins[i] });
                }
                logger.log("Plugin loading complete.", "green");
                callback();
            })
        let p = this._pluginSystem._payloads;
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

module.exports = new PluginLoader(pluginSystem);