const localization = require('../OotLocalizer');
const joinWindow = require('./joinWindow');
const clientId = "566152040711979019";
const RPC = require('discord-rpc')
RPC.register(clientId);
const client = new RPC.Client({ transport: 'ipc' });
let lang = localization.getLoadedObject("en_US");
let sceneNumberToLangKey = localization.getLoadedObject("scene_numbers");
let config;
let ooto;
const jpack = require('jsonpack');
const zlib = require('zlib');
let max_players = 4;
let current_players = 1;
let CURRENT_STATUS = { fn: function () { } };
let getJson = require('get-json');

function addPlayer() {
    current_players++;
    if (CURRENT_STATUS.hasOwnProperty("arg")) {
        CURRENT_STATUS.fn(CURRENT_STATUS.arg)
    } else {
        CURRENT_STATUS.fn()
    }
}

function removePlayer() {
    current_players--;
    if (CURRENT_STATUS.hasOwnProperty("arg")) {
        CURRENT_STATUS.fn(CURRENT_STATUS.arg)
    } else {
        CURRENT_STATUS.fn()
    }
}

function createSecret(obj) {
    let temp = jpack.pack(obj);
    let comp = zlib.deflateSync(temp);
    let base = Buffer.from(comp).toString('base64');
    return base;
}

function parseSecret(secret) {
    let buf = Buffer.from(secret, 'base64');
    let decomp = zlib.inflateSync(buf).toString();
    let unpack = jpack.unpack(decomp);
    return unpack;
}

function setup(_ooto) {
    config = _ooto.config;
    ooto = _ooto;
    if (config.cfg.hasOwnProperty("PLUGINS")) {
        if (config.cfg.PLUGINS.hasOwnProperty("OotOnline")) {
            max_players = config.cfg.PLUGINS.OotOnline.max_players;
        }
    }
    client.on('ready', () => {
        onLauncher();
        client.on('RPC_MESSAGE_RECEIVED', (event) => {
            if (event.cmd === "DISPATCH") {
                console.log(event.evt);
                if (event.evt === "ACTIVITY_JOIN") {
                    try {
                        let parse = parseSecret(event.data.secret);
                        global.OotModLoader["OVERRIDE_IP"] = parse.server;
                        global.OotModLoader["OVERRIDE_PORT"] = parse.port;
                        global.OotModLoader["OVERRIDE_ROOM"] = parse.room;
                        global.OotModLoader["OVERRIDE_PASSWORD"] = parse.password;
                        config._isMaster = false;
                        config._isClient = true;
                        ooto.api.postEvent({ id: "GUI_DiscordJoin" });
                    } catch (err) {
                        console.log(err.stack);
                    }
                }
            }
        });
        client.subscribe('ACTIVITY_JOIN', function (stuff) {
        });
        client.subscribe('ACTIVITY_JOIN_REQUEST', function (stuff) {
        });
        client.subscribe('GAME_JOIN', function (stuff) {
        });
    });
    client.login({ clientId });
}

function onLauncher() {
    client.setActivity({
        state: 'On the launcher',
        startTimestamp: Date.now(),
        largeImageKey: 'untitled-1_copy',
        instance: true,
    });
    CURRENT_STATUS = { fn: onLauncher };
}

function loadingGame() {
    client.setActivity({
        state: 'Loading game',
        startTimestamp: Date.now(),
        largeImageKey: 'untitled-1_copy',
        instance: true,
    });
    CURRENT_STATUS = { fn: loadingGame };
    if (config._isMaster) {
        getJson('https://api.ipify.org/?format=json', function (error, response) {
            console.log("Setting ip to " + response.ip);
            config.cfg.SERVER.master_server_ip = response.ip;
            config._master_server_ip = response.ip;
        });
    }
}

function titleScreen() {
    client.setActivity({
        state: 'In-game',
        details: 'On the title screen',
        startTimestamp: Date.now(),
        largeImageKey: 'untitled-1_copy',
        instance: true,
        partyId: config.cfg.CLIENT.game_room,
        partySize: current_players,
        partyMax: max_players,
        joinSecret: createSecret({ server: config.cfg.SERVER.master_server_ip, port: config.cfg.SERVER.master_server_port, room: config.cfg.CLIENT.game_room, password: config.cfg.CLIENT.game_password })
    });
    CURRENT_STATUS = { fn: titleScreen };
}

function onSceneChange(num) {
    client.setActivity({
        state: 'In-game',
        details: lang.getLocalizedString(sceneNumberToLangKey.getLocalizedString(num)),
        startTimestamp: Date.now(),
        largeImageKey: 'untitled-1_copy',
        instance: true,
        partyId: config.cfg.CLIENT.game_room,
        partySize: current_players,
        partyMax: max_players,
        joinSecret: createSecret({ server: config.cfg.SERVER.master_server_ip, port: config.cfg.SERVER.master_server_port, room: config.cfg.CLIENT.game_room, password: config.cfg.CLIENT.game_password })
    });
    CURRENT_STATUS = { fn: onSceneChange, arg: num };
}

module.exports = { onLauncher: onLauncher, loadingGame: loadingGame, titleScreen: titleScreen, onSceneChange: onSceneChange, setup: setup, client: client, rmPlayer: removePlayer, addPlayer: addPlayer };