const localization = require('./OotLocalizer');
const joinWindow = require('./joinWindow');

class OotDiscord {
    constructor(config) {
        this._lang = localization.create("en_US");
        this._scebeNumberToLangKey = localization.create("scene_numbers");
        this.client = require('discord-rich-presence')('566152040711979019');
        this._config = config;
        console.log(this._config)
        this.client.on('join', (secret) => {
            console.log('we should join with', secret);
        });

        this.client.on('joinRequest', (user) => {
            let jw = new joinWindow(function (arg) {
                if (arg.accept) {
                    client.reply(user, 'YES');
                } else {
                    client.reply(user, 'IGNORE');
                }
            });
            jw.load(user);
        });

        this.client.on('connected', () => {
            this.onLauncher();
        });
    }

    onLauncher() {
        this.client.updatePresence({
            state: 'On the launcher',
            startTimestamp: Date.now(),
            largeImageKey: 'untitled-1_copy',
            instance: true,
        });
    }

    loadingGame() {
        this.client.updatePresence({
            state: 'Loading game',
            startTimestamp: Date.now(),
            largeImageKey: 'untitled-1_copy',
            instance: true,
        });
    }

    titleScreen() {
        this.client.updatePresence({
            state: 'On the title screen',
            details: 'In-game',
            startTimestamp: Date.now(),
            largeImageKey: 'untitled-1_copy',
            instance: true,
            matchSecret: this._config.cfg.CLIENT.game_room,
            joinSecret: this._config.cfg.CLIENT.game_password
        });
    }

    onSceneChange(num) {
        this.client.updatePresence({
            state: this._lang.getLocalizedString(this._scebeNumberToLangKey.getLocalizedString(num)),
            details: 'In-game',
            startTimestamp: Date.now(),
            largeImageKey: 'untitled-1_copy',
            instance: true,
            matchSecret: this._config.cfg.CLIENT.game_room,
            joinSecret: this._config.cfg.CLIENT.game_password
        });
    }
}

module.exports = OotDiscord;