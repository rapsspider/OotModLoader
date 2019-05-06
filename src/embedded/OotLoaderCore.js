﻿/*
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

const server_logger = require(global.OotRunDir + "/OotLogger")("Server");
let logger = require(global.OotRunDir + "/OotLogger")('Core');
const CONFIG = require(global.OotRunDir + "/OotConfig");
const encoder = require(global.OotRunDir + "/OotEncoder");
let api = require(global.OotRunDir + "/OotAPI");
const emulator = require(global.OotRunDir + "/OotBizHawk");
const localization = require(global.OotRunDir + "/OotLocalizer");
const client = require(global.OotRunDir + "/OotClient");
const path = require('path');
const colors = require(global.OotRunDir + "/OotColors");
let tokens;

class OotLoaderCore {
    constructor() {
        this._name = "OotLoaderCore";
    }

    preinit() {
        tokens = require(this.ModLoader.base + '/versions/10/tokens').tokens;
        this._lastRoomPointer = 0;
        this._udpOk = false;
        this._stateTimer = null;
        this._udpPing = null;
        this._expectingPong = false;
        this._tunic_colors = [];
        api.registerEvent("onPlayerJoined");
        api.registerEvent("onPlayerJoined_ServerSide");
        // fix for discord shit.
        (function (inst) {
            inst.setupTunics();
            inst._fileSystem.readdirSync(inst.ModLoader.base + "/localization").forEach(function (file) {
                logger.log("Loading " + file + " into object " + path.parse(file).name + ".")
                localization.create(path.parse(file).name, inst._fileSystem.readFileSync(inst.ModLoader.base + "/localization/" + file))
            });
        })(this);
        Object.keys(tokens).forEach(function (key) {
            api.registerToken({
                token: key,
                replace: tokens[key]
            });
        });

        api.registerEvent("onSceneChange");
        api.registerEvent("onRoomChange");
        api.registerEvent("onLinkDespawn");
        api.registerEvent("onLinkRespawn");
        api.registerEvent("preSceneChange");
        api.registerEvent("onLinkBusy");
        api.registerEvent("onSoftReset");
        api.registerEvent("onSoftReset_Post");
        api.registerEvent("onAgeChanged");
        api.registerEvent("onStateChanged");
        api.registerEvent("onActorSpawned");
        api.registerEvent("onFrameCount");
        api.registerEvent("onLuaStart")

        api.registerPacket({
            packet_id: "scene",
            addr: "@scene@",
            offset: "0x0",
            readHandler: "81"
        });

        api.registerPacket({
            packet_id: "room",
            addr: "@room@",
            offset: "0x0",
            readHandler: "80"
        });

        api.registerPacket({
            packet_id: "link_door_check",
            addr: "@link_door@",
            offset: "0x0",
            readHandler: "80"
        });

        api.registerPacket({
            packet_id: "link_age",
            addr: "@link_instance@",
            offset: "0x0668",
            readHandler: "fourBytes"
        });

        api.registerPacket({
            packet_id: "link_state",
            addr: "@link_instance@",
            offset: "0x066C",
            readHandler: "80",
        });

        api.registerPacketRoute("scene", "scene");

        api.registerServerChannel("scene", function (server, data) {
            let scene = encoder.decompressData(data.payload).data;
            let r = data.room;
            if (!server.getRoomsArray().hasOwnProperty(r)) {
                return false;
            }
            let room = server.getRoomsArray()[r];
            if (!room.hasOwnProperty("scenes")) {
                room["scenes"] = {};
                server_logger.log("Created scene storage for room " + r + ".");
            }
            if (!room.scenes.hasOwnProperty(data.uuid)) {
                room.scenes[data.uuid] = -1;
            }
            room.scenes[data.uuid] = scene;
            server_logger.log(data.uuid + " " + room.scenes[data.uuid]);
            return true;
        });

        api.registerPacketTransformer("scene", function (data) {
            api.postEvent({
                id: "onSceneChange",
                scene: data.payload.data,
                player: { uuid: data.uuid, nickname: data.nickname, isMe: CONFIG.my_uuid === data.uuid }
            });
            data.payload.writeHandler = "null";
            return data;
        });

        api.registerClientSidePacketHook("scene", function (data) {
            api.postEvent({
                id: "onSceneChange",
                scene: data.data,
                player: { uuid: CONFIG.my_uuid, nickname: CONFIG.nickname, isMe: true }
            });
            return true;
        });

        api.registerClientSidePacketHook("link_age", function (data) {
            api.postEvent({
                id: "onAgeChanged",
                age: data.data,
                player: { uuid: CONFIG.my_uuid, nickname: CONFIG.nickname, isMe: CONFIG.my_uuid === CONFIG.my_uuid }
            });
            return false;
        });

        api.registerClientSidePacketHook("LinkGone", function (data) {
            emulator.sendViaSocket({ packet_id: "clearHooks", writeHandler: "clearFramehooks" });
            api.postEvent({ id: "onLinkDespawn", data: data });
            return false;
        });

        api.registerClientSidePacketHook("LinkBack", function (data) {
            api.postEvent({ id: "onLinkRespawn", data: data });
            return false;
        });

        api.registerClientSidePacketHook("FrameCountReset", function (data) {
            api.postEvent({ id: "onFrameCount", data: data });
            return false;
        });

        api.registerClientSidePacketHook("FrameCountStarted", function (data) {
            api.postEvent({ id: "onFrameCount", data: data });
            return false;
        });

        api.registerClientSidePacketHook("softReset", function (data) {
            api.postEvent({ id: "onSoftReset", data: true });
            return false;
        });

        api.registerClientSidePacketHook("softReset_Post", function (data) {
            setTimeout(function () {
                api.postEvent({ id: "onSoftReset_Post", data: true });
            }, 2000);
            return false;
        })

        api.registerClientSidePacketHook("room", function (data) {
            api.postEvent({
                id: "onRoomChange",
                room: data.data,
                player: { uuid: CONFIG.my_uuid, nickname: CONFIG.nickname, isMe: true }
            });
            return false;
        });

        api.registerClientSidePacketHook("link_loading", function (packet) {
            if (packet.data["link_loading"].data === 0x1) {
                api.postEvent({ id: "preSceneChange", data: packet });
            }
            return false;
        });

        api.registerClientSidePacketHook("link_state", function (packet) {
            if (this._stateTimer !== null) {
                clearTimeout(this._stateTimer);
                this._stateTimer = null;
            }
            this._stateTimer = setTimeout(function () {
                api.postEvent({ id: "onStateChanged", state: packet.data });
            }, 100)
            return false;
        });

        api.registerClientSidePacketHook("actorSpawned", function (packet) {
            api.postEvent({ id: "onActorSpawned", type: packet.data.data.type, pointer: packet.data.data.pointer, uuid: packet.data.data.uuid, actorID: packet.data.data.actorID });
            return false;
        });

        (function (inst) {
            api.registerClientSidePacketHook("link_door_check", function (packet) {
                if (packet.data === 0x0) {
                    api.postEvent({ id: "onLinkBusy", data: true });
                } else {
                    api.postEvent({ id: "onLinkBusy", data: false });
                }
                return false;
            });
        })(this);

        (function (inst) {
            api.registerPacketTransformer("udpPunch", function (packet) {
                logger.log("UDP hole punched on port " + packet.payload.port + ".", "green");
                CONFIG.master_server_udp = packet.payload.server;
                inst._udpOk = true;
                return packet;
            });

            api.registerEventHandler("onUDPTest", function (data) {
                setTimeout(function () {
                    if (CONFIG._tcp_mode) {
                        client.UDP_DISABLED = true;
                    } else {
                        if (!inst._udpOk) {
                            logger.log("Failed to punch hole.", "red");
                            logger.log("Switching to TCP mode.", "green");
                            client.UDP_DISABLED = true;
                        } else {
                            logger.log("Networking looks good.", "green");
                            logger.log("Setting up UDP keepalive...")
                            inst._udpPing = setInterval(function () {
                                if (inst._expectingPong) {
                                    logger.log("Failed to receieve UDP keepalive within specified interval.")
                                    logger.log("Switching to TCP mode.", "green");
                                    client.UDP_DISABLED = true;
                                    clearInterval(inst._udpPing);
                                    inst._udpPing = null;
                                } else {
                                    inst._expectingPong = true;
                                    client._udp.sendTo(CONFIG.master_server_ip, CONFIG.master_server_udp, { packet_id: "udpPing", data: "ping", room: CONFIG.GAME_ROOM, uuid: CONFIG._my_uuid });
                                }
                            }, 10 * 1000);
                        }
                    }
                }, 10 * 1000);
            });

            api.registerPacketTransformer("udpPong", function (packet) {
                if (inst._expectingPong) {
                    inst._expectingPong = false;
                }
                return packet;
            });

            api.registerEventHandler("GUI_ResetButton", function (event) {
                clearInterval(inst._udpPing);
                inst._udpPing = null;
            });

            api.registerClientSidePacketHook("onLuaStart", function (packet) {
                api.postEvent({ id: "onLuaStart", data: packet })
            });


            // Cap these off so if SaveSync isn't present we don't crash.
            api.registerClientSidePacketHook("save_update_status", function (packet) {
                return false;
            });

            api.registerClientSideChannelHandler("savesync", function (packet) {
                return null;
            });

            api.registerPacketTransformer("savesync_data", function (packet) {
                return null;
            });
        })(this);

    }

    setupTunics() {
        let temp = {};
        if (CONFIG.TunicColors.kokiri !== "") {
            logger.log("Setting Kokiri tunic color to " + CONFIG.TunicColors.kokiri + ".");
            temp = colors.toRBG(CONFIG.TunicColors.kokiri);
            this._tunic_colors[0] = [temp.red, temp.green, temp.blue];
            logger.log(this._tunic_colors[0]);
        }
        if (CONFIG.TunicColors.goron !== "") {
            logger.log("Setting Goron tunic color to " + CONFIG.TunicColors.goron + ".");
            temp = colors.toRBG(CONFIG.TunicColors.goron);
            this._tunic_colors[1] = [temp.red, temp.green, temp.blue];
            logger.log(this._tunic_colors[1]);
        }
        if (CONFIG.TunicColors.zora !== "") {
            logger.log("Setting Zora tunic color to " + CONFIG.TunicColors.zora + ".");
            temp = colors.toRBG(CONFIG.TunicColors.zora);
            this._tunic_colors[2] = [temp.red, temp.green, temp.blue];
            logger.log(this._tunic_colors[2]);
        }
    }

    init() {
        (function (inst) {
            api.registerEventHandler("onSoftReset_Post", function (event) {
                if (CONFIG._tunic_colors_enabled) {
                    Object.keys(inst._tunic_colors).forEach(function (index) {
                        emulator.sendViaSocket({ packet_id: "changeColor", data: inst._tunic_colors[index], writeHandler: "range", addr: "0x000F7AD8", offset: index * 3 });
                    });
                }
            });

            api.registerEventHandler("onLinkRespawn", function (event) {
                if (CONFIG._tunic_colors_enabled) {
                    Object.keys(inst._tunic_colors).forEach(function (index) {
                        emulator.sendViaSocket({ packet_id: "changeColor", data: inst._tunic_colors[index], writeHandler: "range", addr: "0x000F7AD8", offset: index * 3 });
                    });
                }
            });

            api.registerEventHandler("onFrameCount", function (event) {
                if (event.data.data.bool) {
                    if (CONFIG._tunic_colors_enabled) {
                        Object.keys(inst._tunic_colors).forEach(function (index) {
                            emulator.sendViaSocket({ packet_id: "changeColor", data: inst._tunic_colors[index], writeHandler: "range", addr: "0x000F7AD8", offset: index * 3 });
                        });
                    }
                }
            });

            api.registerEventHandler("onConfigUpdate", function (event) {
                if (CONFIG._tunic_colors_enabled) {
                    inst.setupTunics();
                    Object.keys(inst._tunic_colors).forEach(function (index) {
                        emulator.sendViaSocket({ packet_id: "changeColor", data: inst._tunic_colors[index], writeHandler: "range", addr: "0x000F7AD8", offset: index * 3 });
                    });
                }
            });
        })(this);
    }

    postinit() {
    }
}

module.exports = new OotLoaderCore();
