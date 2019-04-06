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
const unzip = require('unzip');
var ncp = require('ncp').ncp;
var path = require("path");
const spawn = require('cross-spawn');

let packetTransformers = {};
let packetRoutes = {};
let clientsideHooks = {};
let rom = "";
let console_log = [];

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

fs.readdirSync("./rom").forEach(file => {
    if (file.indexOf(".z64") > -1) {
        rom = "./rom/" + file;
    }
    if (file.indexOf(".n64") > -1) {
        rom = "./rom/" + file;
    }
    if (file.indexOf(".v64") > -1) {
        rom = "./rom/" + file;
    }
});

if (rom !== "") {
    logger.log(rom);
}

api.registerEvent("BPSPatchDownloaded");
api.registerEvent("onBizHawkInstall");
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
        }
        if (CONFIG.isClient) {
            client.setProcessFn(processData);
            client.setup();
        }
    } else {
        var LUA_LOC = ".";
        ncp.limit = 16;
        if (!fs.existsSync("./BizHawk")) {
            api.postEvent({ id: "onBizHawkInstall", done: false });
            fs.mkdirSync("./BizHawk");
            fs.createReadStream('./bizhawk_prereqs_v2.1.zip').pipe(unzip.Extract({ path: './BizHawk' })).on('close', function () {
            });
            logger.log("Unzipping BizHawk...");
            fs.createReadStream('./BizHawk-2.3.1.zip').pipe(unzip.Extract({ path: './BizHawk' })).on('close', function () {
            });
            if (!fs.existsSync("./BizHawk/config.ini")) {
                fs.copyFileSync(LUA_LOC + "/config.ini", "./BizHawk/config.ini");
            }
            api.postEvent({ id: "onBizHawkInstall", done: true });
        }
        api.registerEvent("GUI_StartButtonPressed");
        api.registerEvent("GUI_StartFailed");
        logger.log("Awaiting start command from GUI.");
        api.registerEventHandler("GUI_StartButtonPressed", function (event) {
            if (CONFIG.isMaster) {
                master.setup();
            }
            if (CONFIG.isClient) {
                client.setProcessFn(processData);
                client.setup();
            }
            logger.log("Starting BizHawk...");
            try {
                let lobby_path = "./temp/" + CONFIG.GAME_ROOM + path.extname(rom);
                let clean_rom_data = fs.readFileSync(path.resolve(rom));
                let buf = Buffer.from("544845204C4547454E44204F46204F4E4C494E4500", "hex");
                buf.copy(clean_rom_data, 0x20, 0x0, buf.length);
                fs.writeFileSync(path.resolve(lobby_path), clean_rom_data);
                logger.log("Loading " + path.resolve(lobby_path) + ".");
                var child = spawn('./BizHawk/EmuHawk.exe', ['--lua=' + path.resolve("./BizHawk/Lua/OotModLoader.lua"), path.resolve(lobby_path)], { stdio: 'inherit' });
            } catch (err) {
                api.postEvent({ id: "GUI_StartFailed" });
                logger.log(err.message);
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
function parseData(data) {
    try {
        let sendToMaster = true;
        let incoming = data;
        if (clientsideHooks.hasOwnProperty(incoming.packet_id)) {
            sendToMaster = clientsideHooks[incoming.packet_id](incoming);
        }
        if (sendToMaster) {
            if (packetRoutes.hasOwnProperty(incoming.packet_id)) {
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
        if (api._clientSideChannelHandlers.hasOwnProperty(data.channel)){
            data = api._clientSideChannelHandlers[data.channel](data);
        }
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

api.registerEventHandler("BPSPatchDownloaded", function (event) {
    fs.writeFileSync("./temp/temp.bps", event.data);
    let bps_class = require('./OotBPS');
    let bps = new bps_class();
    try {
        var newRom = bps.tryPatch(rom, "./temp/temp.bps");
        emu.sendViaSocket({ packet_id: "loadrom", writeHandler: "loadRom", rom: path.resolve(newRom), override: true });
    } catch (err) {
        logger.log(JSON.stringify(err));
    }
});

module.exports = { api: api, config: CONFIG, console: console_log };