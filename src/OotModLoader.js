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

const original_console = console.log;
let console_hook = function (msg) { };

console.log = function (msg) {
    original_console(msg);
    console_hook(msg);
}

const CONFIG = require('./OotConfig');

let master = require('./OotMasterServer');
let client = require('./OotClient');
let emu = require('./OotBizHawk');
let api = require('./OotAPI');
let plugins = require('./OotPluginLoader');
const encoder = require('./OotEncoder');
let gs = require('./GamesharkToInjectConverter');
let logger = require('./OotLogger')('Core');
const fs = require("fs");
const colors = require('./OotColors');
const localizer = require('./OotLocalizer');
const BUILD_TYPE = "@BUILD_TYPE@";
var ncp = require('ncp').ncp;
var path = require("path");
const spawn = require('cross-spawn');
const lb = require("./OotLobbyBrowser");
const byte = require('./OotBitwise');

let packetTransformers = {};
let packetRoutes = {};
let clientsideHooks = {};
let rom = "";
let console_log = [];
let isMasterSetup = false;
let isClientSetup = false;

console_hook = function (msg) {
    if (typeof (str) === "string") {
        console_log.push(msg)
    } else {
        console_log.push(JSON.stringify(msg))
    }
};

let rom_dir = "./rom";

if (!fs.existsSync("./temp")) {
    fs.mkdirSync("./temp");
}

if (!fs.existsSync(rom_dir)) {
    logger.log("Failed to find rom directory at " + path.resolve(rom_dir));
    rom_dir = __dirname + "/rom";
    logger.log("Trying " + path.resolve(rom_dir) + " instead.");
}

let roms_list = [];

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

if (rom !== "") {
    logger.log(rom);
}

let mods = [];

fs.readdirSync("./mods").forEach(file => {
    if (file.indexOf(".bps") > -1) {
        mods.push(file);
    }
});

logger.log("Mods list:");
logger.log(mods);

api.registerEvent("BPSPatchDownloaded");
api.registerEvent("GUI_BadVersion");

emu.setDataParseFn(parseData);
client.setProcessFn(processData);
api.setRouteFn(registerPacketRoute);
api.setTransformerFn(registerPacketTransformer);
api.setClientHookFn(registerClientSidePacketHook);
client.setOnPlayerConnected(onPlayerConnected);

master.preSetup();
logger.log(process.cwd());
logger.log("Loading plugins...");
plugins.load(function () {
    CONFIG.save();
    if (BUILD_TYPE !== "GUI") {
        if (CONFIG.isMaster) {
            master.setup();
            lb.setup();
        }
        if (CONFIG.isClient) {
            client.setProcessFn(processData);
            client.setup();
        }
    } else {
        var LUA_LOC = ".";
        ncp.limit = 16;
        api.registerEvent("GUI_StartButtonPressed");
        api.registerEvent("GUI_StartFailed");
        api.registerEvent("GUI_ResetButton");

        logger.log("Awaiting start command from GUI.");
        api.registerEventHandler("GUI_StartButtonPressed", function (event) {
            if (global.OotModLoader.OVERRIDE_IP !== "") {
                CONFIG._master_server_ip = global.OotModLoader.OVERRIDE_IP;
                CONFIG._master_server_port = global.OotModLoader.OVERRIDE_PORT;
                CONFIG._GAME_ROOM = global.OotModLoaderOVERRIDE_ROOM;
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

function mangleRomHeader(rom, out) {
    let lobby_path = out;
    let clean_rom_data = fs.readFileSync(path.resolve(rom));
    let buf = Buffer.from("4F4F544D4F444C4F414445525F424554415631", "hex");
    buf.copy(clean_rom_data, 0x20, 0x0, buf.length);
    fs.writeFileSync(path.resolve(lobby_path), clean_rom_data);
    return lobby_path;
}

function startBizHawk(lobby_path) {
    if (BUILD_TYPE === "GUI") {
        logger.log("Starting BizHawk...");
        try {
            logger.log("Loading " + path.resolve(lobby_path) + ".");
            var child = spawn('./BizHawk/EmuHawk.exe', ['--lua=' + path.resolve("./BizHawk/Lua/OotModLoader.lua"), path.resolve(lobby_path)], { stdio: 'inherit' });
            child.on('close', function (code, signal) {
                logger.log("BizHawk has closed!");
                api.postEvent({ id: "GUI_ResetButton", code: code });
                isClientSetup = false;
            });
        } catch (err) {
            api.postEvent({ id: "GUI_StartFailed" });
            logger.log(err.message);
        }
    }
}

api.registerEventHandler("onServerConnection", function (event) {
    if (BUILD_TYPE === "GUI") {
        let lobby_path = "./temp/" + event.room + path.extname(rom);
        if (!event.isModdedLobby) {
            mangleRomHeader(rom, lobby_path);
            startBizHawk(lobby_path);
        }
    }
});

api.registerEventHandler("BPSPatchDownloaded", function (event) {
    let bps_name = "./temp/" + CONFIG.GAME_ROOM + ".bps";
    fs.writeFileSync(bps_name, event.data);
    let bps_class = require('./OotBPS');
    let bps = new bps_class();
    try {
        var newRom = bps.tryPatch(rom, bps_name);
        mangleRomHeader(newRom, newRom);
        startBizHawk(newRom);
    } catch (err) {
        logger.log(JSON.stringify(err));
    }
});

module.exports = { api: api, config: CONFIG, console: console_log, mods: mods, roms: roms_list };