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

const { app } = require('electron')
var path = require("path");
//const BUILD_TYPE = "GUI";
const BUILD_TYPE = "@BUILD_TYPE@";
const IS_DEV = true;
const base_dir = path.dirname(app.getPath("exe"));
const originalFs = require('original-fs')

if (BUILD_TYPE === "GUI") {
    if (app.getPath("exe").indexOf("node_modules") === -1) {
        process.chdir(base_dir);
    }
}

const CONFIG = require('./OotConfig');

let master = require('./OotMasterServer');
let client = require('./OotClient');
let emu = require('./OotBizHawk');
let api = require('./OotAPI');
let plugins = require('./OotPluginLoader');
let logger = require('./OotLogger')('Core');
const fs = require("fs");
var ncp = require('ncp').ncp;
const spawn = require('cross-spawn');
const lb = require("./OotEndpoint");
const VERSION = require('./OotVersion');

let packetTransformers = {};
let packetRoutes = {};
let clientsideHooks = {};
let rom = "";
let isMasterSetup = false;
let isClientSetup = false;
let rom_dir = "./rom";
let roms_list = [];
let mods = [];

global.OotRunDir = __dirname;

if (!global.hasOwnProperty("OotModLoader")) {
    global["OotModLoader"] = {};
}
global.OotModLoader["OVERRIDE_PATCH_FILE"] = "";
global.OotModLoader["OVERRIDE_ROM_FILE"] = "";

global.OotModLoader["OVERRIDE_IP"] = "";
global.OotModLoader["OVERRIDE_PORT"] = "";
global.OotModLoader["OVERRIDE_ROOM"] = "";
global.OotModLoader["OVERRIDE_PASSWORD"] = "";

global["OotMPatcher"] = {};
global.OotMPatcher["dir"] = "./";

app.on('ready', function () {
    if (BUILD_TYPE === "GUI") {
        if (!IS_DEV) {
            var getJSON = require('get-json');
            try {
                getJSON('https://nexus.inpureprojects.info/OotOnline/update.json', function (error, response) {
                    if (error) {
                        logger.log("Failed to get info from update server!", "red")
                    } else {
                        logger.log("Server says: " + response.version)
                        if (response.version !== VERSION) {
                            var download = require('download-file')
                            var url = response.url;
                            var options = {
                                directory: "./",
                                filename: "update.zip"
                            }
                            download(url, options, function (err) {
                                if (err) throw err
                                options.filename = "update.sig";
                                download(response.sig, options, function (err) {
                                    if (err) throw err
                                    if (fs.existsSync(process.cwd() + "/update.zip") && fs.existsSync(process.cwd() + "/update.sig")) {
                                        let crypto = require('crypto');
                                        let hasher = crypto.createHash('sha256');
                                        let pathname = path.resolve("./update.zip");
                                        let rs = fs.createReadStream(pathname);
                                        let signature = fs.readFileSync("./update.sig", 'base64');
                                        rs.on('data', data => hasher.update(data))
                                        rs.on('end', () => {
                                            let digest = hasher.digest('hex');
                                            let publicKey = fs.readFileSync('./public_key.pem');
                                            let verifier = crypto.createVerify('RSA-SHA256');
                                            verifier.update(digest);
                                            let testSignature = verifier.verify(publicKey, signature, 'base64');
                                            if (testSignature) {
                                                app.relaunch({ args: process.argv.slice(1).concat(['--asar=updater.asar']) })
                                                app.exit()
                                            }
                                        });
                                    }
                                });
                            });
                        }
                    }
                });
            } catch (err) {
                if (err) {
                    logger.log("Failed to get info from Hylian Modding!", "red")
                }
            }
        }
    }

    if (!fs.existsSync("./temp")) {
        fs.mkdirSync("./temp");
    }

    if (!fs.existsSync(rom_dir)) {
        logger.log("Failed to find rom directory at " + path.resolve(rom_dir));
        rom_dir = __dirname + "/rom";
        logger.log("Trying " + path.resolve(rom_dir) + " instead.");
    }

    fs.readdirSync("./rom").forEach(file => {
        if (file.indexOf(".z64") > -1) {
            roms_list.push("./rom/" + file);
        }
        if (file.indexOf(".n64") > -1) {
            roms_list.push("./rom/" + file);
        }
        if (file.indexOf(".v64") > -1) {
            roms_list.push("./rom/" + file);
        }
    });

    rom = roms_list[roms_list.length - 1];
    if (CONFIG._rom !== "") {
        rom = CONFIG._rom;
    } else {
        CONFIG._rom = rom;
        CONFIG.save();
    }

    if (rom !== undefined) {
        logger.log(rom);
    }

    originalFs.readdirSync("./mods").forEach(file => {
        if (file.indexOf(".asar") > -1) {
            mods.push(file);
        } else if (file.indexOf(".bps") > -1) {
            mods.push(file);
        }
    });

    if (mods.length > 0) {
        logger.log("Mods list:");
        logger.log(mods);
    }

    api.registerEvent("BPSPatchDownloaded");
    api.registerEvent("GUI_BadVersion");
    api.registerEvent("BizHawkPreLoad");

    emu.setDataParseFn(parseData);
    client.setProcessFn(processData);
    api.setRouteFn(registerPacketRoute);
    api.setTransformerFn(registerPacketTransformer);
    api.setClientHookFn(registerClientSidePacketHook);
    client.setOnPlayerConnected(onPlayerConnected);

    master.preSetup();
    logger.log(process.cwd());
    logger.log("Loading plugins...");
    if (CONFIG.isMaster) {
        lb.setup();
    }
    plugins.load(function () {
        CONFIG.save();
        if (BUILD_TYPE !== "GUI") {
            if (CONFIG.isMaster) {
                master.setup();
            }
            if (CONFIG.isClient) {
                client.setProcessFn(processData);
                client.setup();
            }
        } else {
            let gui = require('./gui/OotGUI');
            gui.setupModLoader({ api: api, config: CONFIG, console: global.gui_console_stack, mods: mods, roms: roms_list });
            var LUA_LOC = ".";
            ncp.limit = 16;
            api.registerEvent("GUI_StartButtonPressed");
            api.registerEvent("GUI_StartFailed");
            api.registerEvent("GUI_ResetButton");
            logger.log("Awaiting start command from GUI.");
            api.registerEvent("GUI_ConfigChanged");
            api.registerEvent("onConfigUpdate");
            api.registerEventHandler("GUI_ConfigChanged", function (event) {
                logger.log(event);
                Object.keys(event.config).forEach(function (key) {
                    if (CONFIG.hasOwnProperty(key)) {
                        if (event.config[key] == 'on') {
                            event.config[key] = true;
                        }
                        if (event.config[key] == "off") {
                            event.config[key] = false;
                        }
                        CONFIG[key] = event.config[key];
                    } else if (CONFIG._tunic_colors.hasOwnProperty(key)) {
                        CONFIG._tunic_colors[key] = event.config[key];
                    }
                });
                CONFIG.save();
                setTimeout(function () {
                    api.postEvent({ id: "onConfigUpdate", config: CONFIG });
                }, 1000);
            });
            api.registerEventHandler("GUI_StartButtonPressed", function (event) {
                logger.log(event);
                if (global.OotModLoader.OVERRIDE_IP !== "") {
                    CONFIG._master_server_ip = global.OotModLoader.OVERRIDE_IP;
                    CONFIG._master_server_port = global.OotModLoader.OVERRIDE_PORT;
                    CONFIG._GAME_ROOM = global.OotModLoader.OVERRIDE_ROOM;
                    CONFIG._game_password = global.OotModLoader.OVERRIDE_PASSWORD;
                    global.OotModLoader["OVERRIDE_IP"] = "";
                    global.OotModLoader["OVERRIDE_PORT"] = "";
                    global.OotModLoader["OVERRIDE_ROOM"] = "";
                    global.OotModLoader["OVERRIDE_PASSWORD"] = "";
                    CONFIG.save();
                }
                if (global.OotModLoader.OVERRIDE_ROM_FILE !== "") {
                    rom = global.OotModLoader.OVERRIDE_ROM_FILE;
                    CONFIG._rom = global.OotModLoader.OVERRIDE_ROM_FILE;
                    CONFIG.save();
                }
                CONFIG._patchFile = global.OotModLoader.OVERRIDE_PATCH_FILE;
                CONFIG.save();
                if (CONFIG.isMaster) {
                    if (!isMasterSetup) {
                        master.setup();
                        lb.setup();
                        isMasterSetup = true;
                    }
                }
                if (CONFIG.isClient) {
                    if (!isClientSetup) {
                        client.setProcessFn(processData);
                        client.setup();
                        isClientSetup = true;
                    }
                }
            });
            ncp(LUA_LOC + "/Lua", "./BizHawk/Lua", function (err) {
                if (err) {
                    return console.error(err);
                }
                logger.log("Installed Lua files!");
                fs.writeFileSync("./BizHawk/Lua/OotModLoader-data.json", JSON.stringify(CONFIG._localPort));
                if (!fs.existsSync("./BizHawk/config.ini")) {
                    fs.copyFileSync(LUA_LOC + "/config.ini", "./BizHawk/config.ini");
                }
            });
            ncp(LUA_LOC + "/mime", "./BizHawk/mime", function (err) {
                if (err) {
                    return console.error(err);
                }
            });
            ncp(LUA_LOC + "/socket", "./BizHawk/socket", function (err) {
                if (err) {
                    return console.error(err);
                }
            });
        }
    });

    api.registerEventHandler("onServerConnection", function (event) {
        if (BUILD_TYPE === "GUI") {
            if (child === null) {
                if (event.hasOwnProperty("patchFile")) {
                    // Mod detected. Load it.
                    if (event.patchFile.name.indexOf(".bps") > -1) {
                        let bps = require('./OotBPS');
                        let patch = new bps();
                        fs.writeFileSync("./temp/" + event.patchFile.name, Buffer.from(event.patchFile.data));
                        rom = patch.tryPatch(path.resolve(rom), path.resolve("./temp/" + event.patchFile.name));
                        startBizHawk(rom);
                    } else if (event.patchFile.name.indexOf(".asar") > -1) {
                        let ootmrom = require('./patcher/OotRom');
                        let cur_rom = new ootmrom(path.resolve(rom));
                        rom = cur_rom._file;
                        originalFs.writeFileSync(path.join("./temp/", event.patchFile.name), Buffer.from(event.patchFile.data));
                        let bps = require('./OotBPS');
                        let patch = new bps();
                        fs.readdirSync(path.join("./temp/", event.patchFile.name, "/payloads")).forEach(function (payload) {
                            plugins._pluginSystem.injectTemporaryPayload(path.join("./temp/", event.patchFile.name, "/payloads", payload));
                        });
                        rom = patch.tryPatch(path.resolve(rom), path.join("./temp/", event.patchFile.name, "/bin/main.bps"));
                    }
                }
                startBizHawk(rom);
            }
        }
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

function registerPacketRoute(packet_id, route) {
    packetRoutes[packet_id] = route;
}

function registerPacketTransformer(packet_id, fn) {
    packetTransformers[packet_id] = fn;
}

function registerClientSidePacketHook(packet_id, hook) {
    clientsideHooks[packet_id] = hook;
}

// Going out to server.
function parseData(incoming) {
    try {
        let sendToMaster = true;
        if (clientsideHooks.hasOwnProperty(incoming.packet_id)) {
            sendToMaster = clientsideHooks[incoming.packet_id](incoming);
        }
        if (sendToMaster) {
            if (packetRoutes.hasOwnProperty(incoming.packet_id)) {
                if (api._clientSideChannelHandlers.hasOwnProperty(packetRoutes[incoming.packet_id])) {
                    incoming = api._clientSideChannelHandlers[packetRoutes[incoming.packet_id]](incoming);
                    if (incoming === null) {
                        return;
                    }
                }
                client.sendDataToMasterOnChannel(packetRoutes[incoming.packet_id], incoming);
            } else {
                client.sendDataToMaster(incoming);
            }
        }
    } catch (err) {
        if (err) {
            logger.log(err.toString(), "red");
            logger.log(err.stack, "red");
            logger.log("---------------------", "red");
            logger.log("Something went wrong!", "red");
            logger.log("---------------------", "red");
            logger.log(data, "red");
        }
    }
}

function writeToFile(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Coming in from server.
function processData(data) {
    try {
        if (packetTransformers.hasOwnProperty(data["payload"]["packet_id"])) {
            data = packetTransformers[data["payload"]["packet_id"]](data);
        }
        if (data !== null) {
            emu.sendViaSocket(data.payload);
        }
    } catch (err) {
        if (err) {
            logger.log(err.toString(), "red");
            logger.log(err.stack, "red");
            logger.log("---------------------", "red");
            logger.log("Something went wrong!", "red");
            logger.log("---------------------", "red");
            logger.log(data, "red");
        }
    }
}

function onPlayerConnected(nickname, uuid) {
    api.postEvent({ id: "onPlayerJoined", player: { nickname: nickname, uuid: uuid } });
}

var child = null;

function startBizHawk(lobby_path) {
    if (BUILD_TYPE === "GUI") {
        logger.log("Starting BizHawk...");
        try {
            if (!fs.existsSync("./Saves")) {
                fs.mkdirSync("./Saves");
            }
            if (!fs.existsSync("./Saves/" + CONFIG.GAME_ROOM)) {
                fs.mkdirSync("./Saves/" + CONFIG.GAME_ROOM);
            }
            let biz_config = JSON.parse(fs.readFileSync("./BizHawk/config.ini"));
            for (let i = 0; i < biz_config.PathEntries.Paths.length; i++) {
                if (biz_config.PathEntries.Paths[i].SystemDisplayName === "N64" && biz_config.PathEntries.Paths[i].Ordinal === 3) {
                    biz_config.PathEntries.Paths[i].Path = path.join(base_dir, "./Saves/" + CONFIG.GAME_ROOM);
                    break;
                }
            }
            fs.writeFileSync("./BizHawk/config.ini", JSON.stringify(biz_config, null, 2));
            let evt = { id: "BizHawkPreLoad", rom: path.resolve(lobby_path) };
            api.postEvent(evt);
            logger.log("Loading " + evt.rom + ".");
            child = spawn('./BizHawk/EmuHawk.exe', ['--lua=' + path.resolve("./BizHawk/Lua/OotModLoader.lua"), evt.rom], { stdio: 'inherit' });
            child.on('close', function (code, signal) {
                logger.log("BizHawk has closed!");
                api.postEvent({ id: "GUI_ResetButton", code: code });
                isClientSetup = false;
                child = null;
                plugins._pluginSystem.clearTemporaryPayloads();
                logger.log("Cleared BizHawk data.")
            });
        } catch (err) {
            api.postEvent({ id: "GUI_StartFailed" });
            logger.log(err.message);
        }
    }
}

module.exports = { api: api, config: CONFIG, console: global.gui_console_stack, mods: mods, roms: roms_list };
