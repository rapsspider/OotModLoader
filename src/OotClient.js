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

const IO_Client = require('socket.io-client');
const CONFIG = require('./OotConfig');
const encoder = require('./OotEncoder');
const logger = require('./OotLogger')("Client");
const api = require('./OotAPI');
const udp = require('./OotUDP');
const fs = require('fs');
const version = require('./OotVersion');
let websocket;
const natUpnp = require('nat-upnp');
var https = require('https');
var url = require('url');

function isEmptyObject(obj) {
    return !Object.keys(obj).length;
}

class Client {
    constructor() {
        api.registerEvent("onUDPTest");
        api.registerEvent("bandwidthUpdate");
        logger.log("Setting up client...");
        logger.log("Master Server IP: " + CONFIG.master_server_ip + ":" + CONFIG.master_server_port);
        this._processCallback = function () { };
        this._onPlayerConnected = function () { };
        api.registerEvent("onServerConnection");
        api.registerEvent("onPlayerDisconnected");
        this._udp = udp.client({}, "ClientUDP");
        this._packetBuffer = {};
        this._packetTick = {};
        this._upnp_client = natUpnp.createClient();
        this.UDP_DISABLED = false;
        this._bandwidth = 0;
        this._bandwidth_tick = {};
        this._disconnectEventHandlerId;
        this._udpIP;
        this._udpPort;

        (function (inst) {
            inst._packetTick = setInterval(function () {
                if (!isEmptyObject(inst._packetBuffer)) {
                    Object.keys(inst._packetBuffer).forEach(function (key) {
                        inst._bandwidth += Buffer.byteLength(JSON.stringify(inst._packetBuffer[key]), 'utf8');
                        if (inst._packetBuffer[key].protocol === "tcp") {
                            inst.websocket().emit('msg', inst._packetBuffer[key]);
                        } else if (inst._packetBuffer[key].protocol === "udp") {
                            if (inst.UDP_DISABLED) {
                                inst.websocket().emit('msg', inst._packetBuffer[key]);
                            } else {
                                inst._udp.sendTo(inst._udpIP, inst._udpPort, inst._packetBuffer[key]);
                            }
                        }
                        delete inst._packetBuffer[key];
                    });
                }
            }, 50);
            inst._bandwidth_tick = setInterval(function () {
                api.postEvent({ id: "bandwidthUpdate", bandwidth: inst._bandwidth })
                inst._bandwidth = 0;
            }, 1000);
        })(this);
    }

    websocket() {
        return websocket;
    }

    setProcessFn(value) {
        this._processCallback = value;
    }

    setOnPlayerConnected(fn) {
        this._onPlayerConnected = fn;
    }

    sendDataToMaster(data) {
        let protocol = "tcp";
        if (data.hasOwnProperty("protocol")) {
            protocol = data.protocol;
        }
        delete data.protocol;
        this._packetBuffer[data.packet_id] = {
            channel: "msg",
            room: CONFIG.GAME_ROOM,
            uuid: CONFIG.my_uuid,
            nickname: CONFIG.nickname,
            protocol: protocol,
            payload: encoder.compressData(data)
        };
    }

    sendDataToMasterOnChannel(channel, data) {
        let protocol = "tcp";
        if (data.hasOwnProperty("protocol")) {
            protocol = data.protocol;
        }
        delete data.protocol;
        this._packetBuffer[data["packet_id"]] = {
            channel: channel,
            room: CONFIG.GAME_ROOM,
            uuid: CONFIG.my_uuid,
            nickname: CONFIG.nickname,
            protocol: protocol,
            payload: encoder.compressData(data)
        };
    }

    setup() {
        (function (inst) {
            if (CONFIG.isMaster){
                CONFIG.master_server_ip = "127.0.0.1";
            }
            inst._udpIP = CONFIG.master_server_ip;
            inst._udpPort = CONFIG.master_server_udp;
            inst._disconnectEventHandlerId = api.registerEventHandler("GUI_ResetButton", function(event){
                websocket.disconnect();
                inst._udp.close();
                inst._packetBuffer = {};
                api.unregisterEventHandler("GUI_ResetButton", inst._disconnectEventHandlerId);
            });
            websocket = IO_Client.connect("http://" + CONFIG.master_server_ip + ":" + CONFIG.master_server_port);
            websocket.on('connect', function () {
                websocket.emit('version', {version: version});
            });
            websocket.on('left', function (data) {
                api.postEvent({ id: "onPlayerDisconnected", player: { uuid: data.uuid } });
            });
            websocket.on('versionMisMatch', function(data){
                logger.log("Your version does not match the server!", "red");
                logger.log(data, "red");
                api.postEvent({id: "GUI_BadVersion", data: data});
            })
            websocket.on('id', function (data) {
                data = encoder.decompressData(data);
                CONFIG.my_uuid = data.id;
                logger.log("My UUID: " + CONFIG.my_uuid);
                let p = { room: CONFIG.GAME_ROOM, nickname: CONFIG.nickname, patchFile: CONFIG._patchFile, password: CONFIG.getPasswordHash() };
                if (p.patchFile !== ""){
                    p["patchData"] = fs.readFileSync("./mods/" + p.patchFile);
                }
                websocket.emit('room', encoder.compressData(p));
            });
            websocket.on('room', function (data) {
                logger.log(data.msg);
                let e = { id: "onServerConnection", ip: CONFIG.master_server_ip, port: CONFIG.master_server_port, room: CONFIG.GAME_ROOM, isModdedLobby: data.isModdedLobby };
                if (data.hasOwnProperty("patchFile")){
                    e["patchFile"] = data.patchFile;
                }
                api.postEvent(e);
                websocket.emit('room_ping', encoder.compressData({ room: CONFIG.GAME_ROOM, uuid: CONFIG.my_uuid, nickname: CONFIG.nickname, patchFile: CONFIG.patchFile }));
            });
            websocket.on('receivePatch', function (data) {
                logger.log("Loading patch from server.");
                api.postEvent({ id: "BPSPatchDownloaded", data: data.data })
            });
            websocket.on('joined', function (data) {
                inst._onPlayerConnected(data.nickname, data.uuid);
            });
            websocket.on('room_ping', function (data) {
                data = encoder.decompressData(data);
                websocket.emit('room_pong', encoder.compressData({ room: CONFIG.GAME_ROOM, uuid: CONFIG.my_uuid, nickname: CONFIG.nickname, target: data }));
            });
            websocket.on('room_pong', function (data) {
                data = encoder.decompressData(data);
                inst._onPlayerConnected(data.nickname, data.uuid);
            });
            websocket.on('BAD_PASSWORD', function(data){
                logger.log("Lobby join rejected. Bad password", "red");
            });
            websocket.on('msg', function (data) {
                if (data !== undefined && data !== null) {
                    data.payload = encoder.decompressData(data.payload);
                    inst._processCallback(data);
                }
            });
            inst._udp.setDataFn(inst._processCallback);
            inst._udp.setup();
            websocket.on('udp', function (data) {
                logger.log("TCP connection to server established. Trying to punch a UDP hole...", "yellow");
                inst._upnp_client.portMapping({
                    public: inst._udp.port,
                    private: inst._udp.port,
                    ttl: 10
                }, function (err) {
                    if (err) {
                        logger.log("Failed to punch hole.", "red");
                        logger.log("Switching to TCP mode.", "green");
                        inst.UDP_DISABLED = true;
                    } else {
                        logger.log("UPNP returned OK", "yellow");
                        logger.log("Sending UDP test to " + CONFIG.master_server_ip + ".")
                        inst._udp.sendTo(CONFIG.master_server_ip, data.port, { packet_id: "udpPunch", room: CONFIG.GAME_ROOM, uuid: CONFIG.my_uuid, nickname: CONFIG.nickname, punchthrough: inst._udp.port });
                        api.postEvent({ id: "onUDPTest", data: inst._udp.port });
                        // This is intentional. Disabling UDP mode for now.
                        inst.UDP_DISABLED = true;
                    }
                });
            });
        })(this);
    }
}

module.exports = new Client();