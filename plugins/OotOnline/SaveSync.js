/*
    SaveSync - Share your save data with other players.
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

const emulator = require(global.OotRunDir + "/OotBizHawk");
const api = require(global.OotRunDir + "/OotAPI");
const logger = require(global.OotRunDir + "/OotLogger")("SaveSync");
const localization = require(global.OotRunDir + "/OotLocalizer");
const encoder = require(global.OotRunDir + "/OotEncoder");
const CONFIG = require(global.OotRunDir + "/OotConfig");
const client = require(global.OotRunDir + "/OotClient");
const bits = require(global.OotRunDir + "/OotBitwise");

function default_int_check(inst, data) {
    let value = inst._int;
    if (value === 255) {
        value = -1;
    }
    let v2 = data;
    if (v2 === 255) {
        v2 = -1;
    }
    return v2 > value;
}

function item_int_check(inst, data) {
    let value = inst._int;
    if (value === 255 || value === 0x4D) {
        value = -1;
    }
    let v2 = data;
    if (v2 === 255 || value === 0x4D) {
        v2 = -1;
    }
    return v2 > value;
}

class GenericBitPackHandler {
    constructor(table_id) {
        this._table_id = table_id;
    }

    handle(server, room, id, data, tag) {
        if (!server.getRoomsArray().hasOwnProperty(room)) {
            return;
        }
        if (!server.getRoomsArray()[room].hasOwnProperty(this._table_id)) {
            server.getRoomsArray()[room][this._table_id] = {};
        }
        if (!server.getRoomsArray()[room][this._table_id].hasOwnProperty(id)) {
            server.getRoomsArray()[room][this._table_id][id] = new IntegerArrayStorage(tag);
        }
        return server.getRoomsArray()[room][this._table_id][id].update(bits.read(data));
    }
}

class IntegerStorage {
    constructor(name) {
        this._int = 255;
        this._check = default_int_check;
    }

    update(data) {
        let bool = false;
        if (data !== 255) {
            if (this._check(this, data)) {
                bool = data !== this._int;
                this._int = data;
            }
        }
        return { int: this._int, bool: bool };
    }
}

class IntegerArrayStorage {
    constructor(name) {
        this._byte = bits.write([0, 0, 0, 0, 0, 0, 0, 0]);
    }

    update(data) {
        let array = bits.read(this._byte);
        for (let i = 0; i < array.length; i++) {
            if (array[i] === 0 && data[i] === 1) {
                array[i] = 1;
            }
        }
        this._byte = bits.write(array);
        return array;
    }
}

class SaveSync {
    constructor() {
        this._name = "SaveSync";
        this._download = true;
        //
        this._savePacketHandlers = {};
        this._packetNameCache = [];
        this._packetNameCache_reverse = {};
        this._packetNameToHandlerMap = {};
        this._collectData = false;
        this._dataCache = { packet_id: "savesync_data", writeHandler: "Null", data: {}, addr: 0, offset: 0, ignoreBuffer: true };
        this._exceptionStorage = {};
    }

    preinit() {
        this._lang = localization.getLoadedObject("en_US");
        this._inventorySlotToLangKey = localization.getLoadedObject("item_numbers");
        this._icons = localization.getLoadedObject("icon_coordinates");
        this._small_key_scenes = localization.getLoadedObject("small_key_scenes");
        (function (inst) {
            api.registerPacketRoute("requestSaveData", "savesync");
            api.registerPacketRoute("savesync_data", "savesync");
            let temp = function (text, handler) {
                let original = inst._fileSystem.readFileSync(__dirname + '/packet_txt/' + text, "utf8");
                let items = original.split(/\r?\n/);
                Object.keys(items).forEach(function (key) {
                    api.registerPacketRoute(items[key], "savesync");
                    inst._packetNameCache.push(items[key]);
                    inst._packetNameToHandlerMap[items[key]] = handler;
                });
            };
            temp("item_packets.txt", "inventory");
            temp("equipment_packets.txt", "equipment");
            temp("quest_packets.txt", "quest");
            temp("biggoron_packets.txt", "biggoron");
            temp("heart_packets.txt", "heart_containers");
            temp("death_packets.txt", "NYI");
            temp("magicbeans_packets.txt", "NYI");
            temp("defense_packets.txt", "double_defense");
            temp("poe_packets.txt", "NYI");
            temp("magic1_packets.txt", "magic_bool");
            temp("magic2_packets.txt", "magic_size");
            temp("magic3_packets.txt", "Obsolete");
            temp("upgrade_packets.txt", "upgrade");
            temp("event_flag_packets.txt", "events");
            temp("inf_flag_packets.txt", "inf_flags");
            temp("skulltula_packets.txt", "skulltula_flag");
            temp("skulltula_count_packets.txt", "skulltula_count");
            temp("item_flag_packets.txt", "item_flags");
            temp("scene_packets.txt", "scene");
            temp("dungeon_packets.txt", "dungeon_items");
            temp("small_key_packets.txt", "small_keys");
            for (let i = 0; i < inst._packetNameCache.length; i++) {
                inst._packetNameCache_reverse[inst._packetNameCache[i]] = i;
            }
            inst._exceptionStorage["_inventory"] = {};
            inst._exceptionStorage["_inventory"]["bottle_slots"] = ["inventory_slot_18", "inventory_slot_19", "inventory_slot_20", "inventory_slot_21"];
            inst._exceptionStorage["_inventory"]["trade_slots"] = ["inventory_slot_23"];
            inst._exceptionStorage["_inventory"]["check"] = {};
            inst._exceptionStorage["_inventory"]["check"]["bottle_slots"] = function (inst, data) {
                let value = inst._int;
                if (value === 255) {
                    value = -1;
                }
                let v2 = data;
                if (v2 === 255) {
                    v2 = -1;
                }
                return v2 !== value;
            };
            inst._exceptionStorage["_heart_containers"] = {};
            inst._exceptionStorage["_heart_containers"]["check"] = {};
            inst._exceptionStorage["_heart_containers"]["check"]["default"] = function (inst, data) {
                let value = inst._int;
                if (value === 0xFFFF) {
                    value = -1;
                }
                let v2 = data;
                if (v2 === 0xFFFF) {
                    v2 = -1;
                }
                return v2 > value;
            }
        })(this);
    }

    init() {
        (function (inst) {
            inst._savePacketHandlers["inventory_slot_"] = function (server, room, id, data, tag) {
                if (!server.getRoomsArray().hasOwnProperty(room)) {
                    return;
                }
                if (!server.getRoomsArray()[room].hasOwnProperty("_inventory")) {
                    server.getRoomsArray()[room]["_inventory"] = {};
                }
                if (!server.getRoomsArray()[room]["_inventory"].hasOwnProperty(id)) {
                    server.getRoomsArray()[room]["_inventory"][id] = new IntegerStorage(id);
                    server.getRoomsArray()[room]["_inventory"][id]._check = item_int_check;
                    if (inst._exceptionStorage._inventory.bottle_slots.includes(tag)) {
                        server.getRoomsArray()[room]["_inventory"][id]._check = inst._exceptionStorage._inventory.check.bottle_slots;
                    } else if (inst._exceptionStorage._inventory.trade_slots.includes(tag)) {
                        server.getRoomsArray()[room]["_inventory"][id]._check = inst._exceptionStorage._inventory.check.bottle_slots;
                    }
                }
                let u = server.getRoomsArray()[room]["_inventory"][id].update(data);
                if (u.int !== 255) {

                    if (u.bool) {
                        try {
                            let key = inst._inventorySlotToLangKey.getLocalizedString(u.int);
                            let icon = inst._icons.getLocalizedString(key);
                            let str = inst._lang.getLocalizedString(key);
                            server._ws_server.sockets.to(room).emit('msg', { packet_id: "inventory_msg", payload: encoder.compressData({ packet_id: "inventory_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                        } catch (err) {

                        }
                    }
                    return u.int;
                }
            }
            inst._savePacketHandlers["upgrade_"] = function (server, room, id, data, tag) {
                if (!server.getRoomsArray().hasOwnProperty(room)) {
                    return;
                }
                if (!server.getRoomsArray()[room].hasOwnProperty("_upgrades")) {
                    server.getRoomsArray()[room]["_upgrades"] = {};
                }
                if (!server.getRoomsArray()[room]["_upgrades"].hasOwnProperty(id)) {
                    server.getRoomsArray()[room]["_upgrades"][id] = new IntegerStorage(tag);
                }
                let u = server.getRoomsArray()[room]["_upgrades"][id].update(data);
                try {
                    if (u.int !== 255) {
                        if (u.bool) {
                            try {
                                let icon = inst._icons.getLocalizedString(tag + "_" + data.toString());
                                let str = inst._lang.getLocalizedString(tag + "_" + data.toString());
                                server._ws_server.sockets.to(room).emit('msg', { packet_id: "upgrade_msg", payload: encoder.compressData({ packet_id: "upgrade_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                            } catch (err) {

                            }
                        }
                        return u.int;
                    }
                } catch (err) {
                    logger.log(err, "red");
                }
            };
            inst._savePacketHandlers["equipment_slot_"] = function (server, room, id, data, tag) {
                if (!server.getRoomsArray().hasOwnProperty(room)) {
                    return;
                }
                if (!server.getRoomsArray()[room].hasOwnProperty("_equipment")) {
                    server.getRoomsArray()[room]["_equipment"] = {};
                }
                if (!server.getRoomsArray()[room]["_equipment"].hasOwnProperty(id)) {
                    server.getRoomsArray()[room]["_equipment"][id] = new IntegerStorage(tag);
                }
                let u = server.getRoomsArray()[room]["_equipment"][id].update(data);
                try {
                    if (u.int !== 255) {
                        if (u.bool) {
                            try {
                                let icon = inst._icons.getLocalizedString(tag);
                                let str = inst._lang.getLocalizedString(tag);
                                server._ws_server.sockets.to(room).emit('msg', { packet_id: "equipment_msg", payload: encoder.compressData({ packet_id: "equipment_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                            } catch (err) {

                            }
                        }
                        return u.int;
                    }
                } catch (err) {
                    logger.log(err.message, "red");
                }
            }
            inst._savePacketHandlers["quest_slot_"] = function (server, room, id, data, tag) {
                if (!server.getRoomsArray().hasOwnProperty(room)) {
                    return;
                }
                if (!server.getRoomsArray()[room].hasOwnProperty("_quest")) {
                    server.getRoomsArray()[room]["_quest"] = {};
                }
                if (!server.getRoomsArray()[room]["_quest"].hasOwnProperty(id)) {
                    server.getRoomsArray()[room]["_quest"][id] = new IntegerStorage(tag);
                }
                let u = server.getRoomsArray()[room]["_quest"][id].update(data);
                try {
                    if (u.int !== 255) {
                        if (u.bool) {
                            try {
                                let icon = inst._icons.getLocalizedString(tag);
                                let str = inst._lang.getLocalizedString(tag);
                                server._ws_server.sockets.to(room).emit('msg', { packet_id: "quest_msg", payload: encoder.compressData({ packet_id: "quest_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                            } catch (err) {

                            }
                        }
                        return u.int;
                    }
                } catch (err) {
                    logger.log(err.message, "red");
                }
            }
            inst._savePacketHandlers["biggoron"] = function (server, room, id, data, tag) {
                if (!server.getRoomsArray().hasOwnProperty(room)) {
                    return;
                }
                if (!server.getRoomsArray()[room].hasOwnProperty("_quest")) {
                    server.getRoomsArray()[room]["_quest"] = {};
                }
                if (!server.getRoomsArray()[room]["_quest"].hasOwnProperty(id)) {
                    server.getRoomsArray()[room]["_quest"][id] = new IntegerStorage(tag);
                }
                let u = server.getRoomsArray()[room]["_quest"][id].update(data);
                try {
                    if (u.int !== 255) {
                        if (u.bool) {
                            try {
                                let icon = inst._icons.getLocalizedString("equipment_slot_12");
                                let str = inst._lang.getLocalizedString("equipment_slot_12_quest");
                                server._ws_server.sockets.to(room).emit('msg', { packet_id: "biggoron_msg", payload: encoder.compressData({ packet_id: "biggoron_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                            } catch (err) {

                            }
                        }
                        return u.int;
                    }
                } catch (err) {
                    logger.log(err.message, "red");
                }
            }
            inst._savePacketHandlers["heart_containers"] = function (server, room, id, data, tag) {
                if (!server.getRoomsArray().hasOwnProperty(room)) {
                    return;
                }
                if (!server.getRoomsArray()[room].hasOwnProperty("_heart_containers")) {
                    server.getRoomsArray()[room]["_heart_containers"] = {};
                }
                if (!server.getRoomsArray()[room].hasOwnProperty(id)) {
                    server.getRoomsArray()[room]["_heart_containers"][id] = new IntegerStorage(tag);
                    server.getRoomsArray()[room]["_heart_containers"][id]._check = inst._exceptionStorage._heart_containers.check.default;
                    server.getRoomsArray()[room]["_heart_containers"][id]._int = 0xFFFF;
                }
                let u = server.getRoomsArray()[room]["_heart_containers"][id].update(data);
                try {
                    if (u.int !== 0xFFFF) {
                        if (u.bool) {
                            try {
                                let icon = inst._icons.getLocalizedString("item_piece_of_heart");
                                let str = inst._lang.getLocalizedString("item_heart_container");
                                server._ws_server.sockets.to(room).emit('msg', { packet_id: "heart_msg", payload: encoder.compressData({ packet_id: "heart_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                            } catch (err) {

                            }
                        }
                        return u.int;
                    }
                } catch (err) {
                    logger.log(err, "red");
                }
            }
            inst._savePacketHandlers["double_defense"] = function (server, room, id, data, tag) {
                if (!server.getRoomsArray().hasOwnProperty(room)) {
                    return;
                }
                if (!server.getRoomsArray()[room].hasOwnProperty("_heart_containers")) {
                    server.getRoomsArray()[room]["_heart_containers"] = {};
                }
                if (!server.getRoomsArray()[room]["_heart_containers"].hasOwnProperty(id)) {
                    server.getRoomsArray()[room]["_heart_containers"][id] = new IntegerStorage(tag);
                }
                let u = server.getRoomsArray()[room]["_heart_containers"][id].update(data);
                try {
                    if (u.int !== 255) {
                        if (u.bool) {
                            try {
                                let icon = inst._icons.getLocalizedString(tag);
                                let str = inst._lang.getLocalizedString(tag);
                                server._ws_server.sockets.to(room).emit('msg', { packet_id: "dd_msg", payload: encoder.compressData({ packet_id: "dd_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                            } catch (err) {

                            }
                        }
                        return u.int;
                    }
                } catch (err) {
                    logger.log(err, "red");
                }
            }
            inst._savePacketHandlers["magic_bool"] = function (server, room, id, data, tag) {
                if (!server.getRoomsArray().hasOwnProperty(room)) {
                    return;
                }
                if (!server.getRoomsArray()[room].hasOwnProperty("_magic")) {
                    server.getRoomsArray()[room]["_magic"] = {};
                }
                if (!server.getRoomsArray()[room]["_magic"].hasOwnProperty(id)) {
                    server.getRoomsArray()[room]["_magic"][id] = new IntegerStorage(tag);
                }
                let u = server.getRoomsArray()[room]["_magic"][id].update(data);
                try {
                    if (u.int !== 255) {
                        if (u.bool) {
                            try {
                                let icon = inst._icons.getLocalizedString("item_small_magic_jar");
                                let str = inst._lang.getLocalizedString("item_small_magic_jar");
                                server._ws_server.sockets.to(room).emit('msg', { packet_id: "magic_msg", payload: encoder.compressData({ packet_id: "magic_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                            } catch (err) {

                            }
                        }
                        return u.int;
                    }
                } catch (err) {
                    logger.log(err, "red");
                }
            }
            inst._savePacketHandlers["magic_size"] = function (server, room, id, data, tag) {
                if (!server.getRoomsArray().hasOwnProperty(room)) {
                    return;
                }
                if (!server.getRoomsArray()[room].hasOwnProperty("_magic")) {
                    server.getRoomsArray()[room]["_magic"] = {};
                }
                if (!server.getRoomsArray()[room]["_magic"].hasOwnProperty(id)) {
                    server.getRoomsArray()[room]["_magic"][id] = new IntegerStorage(tag);
                }
                let u = server.getRoomsArray()[room]["_magic"][id].update(data);
                try {
                    if (u.int !== 255) {
                        if (u.bool) {
                            try {
                                let icon = inst._icons.getLocalizedString("item_large_magic_jar");
                                let str = inst._lang.getLocalizedString("item_large_magic_jar");
                                server._ws_server.sockets.to(room).emit('msg', { packet_id: "magic_msg", payload: encoder.compressData({ packet_id: "magic_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                            } catch (err) {

                            }
                        }
                        return u.int;
                    }
                } catch (err) {
                    logger.log(err, "red");
                }
            }
            inst._savePacketHandlers["scene_"] = new GenericBitPackHandler("_scene").handle;
            inst._savePacketHandlers["event_flag_"] = new GenericBitPackHandler("_events").handle;
            inst._savePacketHandlers["item_flag_"] = new GenericBitPackHandler("_item_flags").handle;
            inst._savePacketHandlers["inf_table_"] = new GenericBitPackHandler("_inf_flags").handle;
            inst._savePacketHandlers["dungeon_items_"] = new GenericBitPackHandler("_dungeon_items").handle;
            inst._savePacketHandlers["skulltula_flag_"] = new GenericBitPackHandler("_skulltulas").handle;
            inst._savePacketHandlers["skulltula_count"] = function (server, room, id, data, tag) {
                if (!server.getRoomsArray().hasOwnProperty(room)) {
                    return;
                }
                if (!server.getRoomsArray()[room].hasOwnProperty("_skulltulas")) {
                    server.getRoomsArray()[room]["_skulltulas"] = {};
                }
                if (!server.getRoomsArray()[room]["_skulltulas"].hasOwnProperty(id)) {
                    server.getRoomsArray()[room]["_skulltulas"][id] = new IntegerStorage(tag);
                    server.getRoomsArray()[room]["_skulltulas"][id]._check = inst._exceptionStorage._heart_containers.check.default;
                    server.getRoomsArray()[room]["_skulltulas"][id]._int = 0xFFFF;
                }
                let u = server.getRoomsArray()[room]["_skulltulas"][id].update(data);
                try {
                    if (u.int !== 0xFFFF) {
                        if (u.bool) {
                            try {
                                let key = "item_gold_skulltula_token";
                                let icon = inst._icons.getLocalizedString(key);
                                let str = inst._lang.getLocalizedString(key);
                                server._ws_server.sockets.to(room).emit('msg', { packet_id: "inventory_msg", payload: encoder.compressData({ packet_id: "inventory_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4843" }) });
                            } catch (err) {

                            }
                        }
                        return u.int;
                    }
                } catch (err) {
                    logger.log(err, "red");
                }
            }
            inst._savePacketHandlers["death_counter"] = function (server, room, id, data, tag, packet) {
                if (!server.getRoomsArray().hasOwnProperty(room)) {
                    return;
                }
                if (!server.getRoomsArray()[room].hasOwnProperty("_death_counter")) {
                    server.getRoomsArray()[room]["_death_counter"] = {};
                }
                if (!server.getRoomsArray()[room]["_death_counter"].hasOwnProperty(id)) {
                    server.getRoomsArray()[room]["_death_counter"][id] = new IntegerStorage(tag);
                    server.getRoomsArray()[room]["_death_counter"][id]._check = inst._exceptionStorage._heart_containers.check.default;
                }
                let u = server.getRoomsArray()[room]["_death_counter"][id].update(data);
                try {
                    if (u.int !== 0xFFFF) {
                        if (u.bool) {
                            try {
                                let str = packet.nickname + " has died!";
                                server._ws_server.sockets.to(room).emit('msg', { packet_id: "death_msg", payload: encoder.compressData({ packet_id: "death_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: 11 * 16, sy: 19 * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                            } catch (err) {

                            }
                        }
                        return u.int;
                    }
                } catch (err) {
                    logger.log(err, "red");
                }
            }
            inst._savePacketHandlers["small_keys"] = function (server, room, id, data, tag, packet) {
                if (!server.getRoomsArray().hasOwnProperty(room)) {
                    return;
                }
                if (!server.getRoomsArray()[room].hasOwnProperty("_small_keys")) {
                    server.getRoomsArray()[room]["_small_keys"] = {};
                }
                if (!server.getRoomsArray()[room]["_small_keys"].hasOwnProperty(id)) {
                    server.getRoomsArray()[room]["_small_keys"][id] = new IntegerStorage(tag);
                    server.getRoomsArray()[room]["_small_keys"][id]._check = inst._exceptionStorage["_inventory"]["check"]["bottle_slots"];
                }
                let u = server.getRoomsArray()[room]["_small_keys"][id].update(data);
                try {
                    if (u.int !== 255) {
                        if (u.bool) {
                            try {
                                if (u.int > data) {
                                    let index = parseInt(tag.replace("small_keys_", ""));
                                    let key = inst._small_key_scenes.getLocalizedString(index);
                                    let icon = inst._icons.getLocalizedString("item_small_key");
                                    let str = inst._lang.getLocalizedString("item_small_key") + " (" + inst._lang.getLocalizedString(key) + ")";
                                    server._ws_server.sockets.to(room).emit('msg', { packet_id: "key_msg", payload: encoder.compressData({ packet_id: "key_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                                }
                            } catch (err) {
                                logger.log(err.stack, "red")
                            }
                        }
                        return u.int;
                    }
                } catch (err) {
                    logger.log(err, "red");
                }
            }
            api.registerServerChannel("savesync", function (server, packet) {
                let decompress = encoder.decompressData(packet.payload);
                var r = {};
                //logger.log(packet);
                Object.keys(decompress.data).forEach(function (key) {
                    let id = inst._packetNameCache[key];
                    Object.keys(inst._savePacketHandlers).forEach(function (t) {
                        if (id.indexOf(t) > -1) {
                            r[key] = inst._savePacketHandlers[t](server, packet.room, key, decompress.data[key], id, packet);
                            if (r[key] === undefined) {
                                delete r[key];
                            }
                        }
                    });
                });
                decompress.data = r;
                packet.payload = encoder.compressData(decompress);
                if (packet.payload.addr === true) {
                    server._ws_server.sockets.to(packet.uuid).emit('msg', packet);
                }
                return true;
            });

            api.registerClientSidePacketHook("save_update_status", function (packet) {
                if (packet.data.data.bool) {
                    logger.log("Collecting save data...");
                    inst._collectData = true;
                    inst._dataCache.data = {};
                    inst._dataCache.addr = packet.data.data.flag;
                } else {
                    logger.log("Sending save data.");
                    inst._collectData = false;
                    client.sendDataToMasterOnChannel("savesync", inst._dataCache);
                }
                return false;
            });

            api.registerPacketTransformer("savesync_data", function (packet) {
                Object.keys(packet.payload.data).forEach(function (key) {
                    let packet_id = inst._packetNameCache[key];
                    emulator.sendViaSocket({ packet_id: packet_id, writeHandler: "saveData", typeHandler: inst._packetNameToHandlerMap[packet_id], data: packet.payload.data[key] });
                });
                return null;
            });

            api.registerClientSideChannelHandler("savesync", function (packet) {
                if (inst._collectData) {
                    inst._dataCache.data[inst._packetNameCache_reverse[packet.packet_id]] = packet.data.data;
                }
                return null;
            });
        })(this);
    }

    postinit() {
        (function (inst) {
            api.registerEventHandler("onSceneContextUpdate", function (event) {
                let start = 0x00D4;
                let target = start + (event.scene * 0x1C);
                emulator.sendViaSocket({ packet_id: "forceUpdateScene", data: event.data.chests._raw, writeHandler: "rangeCache", addr: api.getTokenStorage()["@save_data@"], offset: target });
                let perm_switch = [];
                for (let i = 0; i < 4; i++) {
                    perm_switch[i] = event.data.switches._raw[i];
                }
                emulator.sendViaSocket({ packet_id: "forceUpdateScene2", data: perm_switch, writeHandler: "rangeCache", addr: api.getTokenStorage()["@save_data@"], offset: target + 4 });
                perm_switch = [];
                for (let i = 0; i < 4; i++) {
                    perm_switch[i] = event.data.collect._raw[i];
                }
                emulator.sendViaSocket({ packet_id: "forceUpdateScene3", data: perm_switch, writeHandler: "rangeCache", addr: api.getTokenStorage()["@save_data@"], offset: target + 0xC });
                emulator.sendViaSocket({ packet_id: "forceSceneUpdate", data: 0, writeHandler: "sceneTrigger", addr: 0, offset: 0 });
            });
        })(this);
    }
}

var ss = new SaveSync();

module.exports = ss;