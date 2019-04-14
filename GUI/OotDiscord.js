const localization = require('./OotLocalizer');
const joinWindow = require('./joinWindow');
const clientId = "566152040711979019";
const RPC = require('discord-rpc')
RPC.register(clientId);
const client = new RPC.Client({ transport: 'ipc' });
let lang = localization.create("en_US");
let sceneNumberToLangKey = localization.create("scene_numbers");
let config;
let ooto;

function setup(_ooto) {
    config = _ooto.config;
    ooto = _ooto;
    client.on('ready', () => {
        onLauncher();
        client.on('RPC_MESSAGE_RECEIVED', (event) => {
            console.log(event);
            if (event.cmd === "DISPATCH") {
                if (event.evt === "ACTIVITY_JOIN_REQUEST") {
                    let jw = new joinWindow(function (arg) {
                        if (arg.accept) {
                            client.sendJoinInvite(event.data.user);
                        } else {
                            client.closeJoinRequest(event.data.user);
                        }
                    });
                    jw.load(event.data.user);
                } else if (event.evt === "ACTIVITY_JOIN") {
                    let parse = event.data.secret.split(",");
                    global.OotModLoader["OVERRIDE_IP"] = parse[0];
                    global.OotModLoader["OVERRIDE_PORT"] = parse[1];
                    global.OotModLoader["OVERRIDE_ROOM"] = parse[2];
                    global.OotModLoader["OVERRIDE_PASSWORD"] = parse[3];
                    ooto.api.postEvent({id: "GUI_DiscordJoin"});
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
}

function loadingGame() {
    client.setActivity({
        state: 'Loading game',
        startTimestamp: Date.now(),
        largeImageKey: 'untitled-1_copy',
        instance: true,
    });
}

function titleScreen() {
    client.setActivity({
        state: 'On the title screen',
        details: 'In-game',
        startTimestamp: Date.now(),
        largeImageKey: 'untitled-1_copy',
        instance: true,
        partyId: config.cfg.CLIENT.game_room,
        joinSecret: config.cfg.CLIENT.game_room + "," + config.cfg.CLIENT.game_password
    });
}

function onSceneChange(num) {
    client.setActivity({
        state: lang.getLocalizedString(sceneNumberToLangKey.getLocalizedString(num)),
        details: 'In-game',
        startTimestamp: Date.now(),
        largeImageKey: 'untitled-1_copy',
        instance: true,
        partyId: config.cfg.CLIENT.game_room,
        joinSecret: config.cfg.SERVER.master_server_ip + "," + config.cfg.SERVER.master_server_port + "," + config.cfg.CLIENT.game_room + "," + config.cfg.CLIENT.game_password
    });
}

module.exports = { onLauncher: onLauncher, loadingGame: loadingGame, titleScreen: titleScreen, onSceneChange: onSceneChange, setup: setup, client: client };