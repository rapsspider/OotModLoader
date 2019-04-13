const CONFIG = require('./OotConfig');
const localization = require('./OotLocalizer');

class OotDiscord {
    constructor() {
        this._lang = localization.create("en_US");
        this._scebeNumberToLangKey = localization.create("scene_numbers");
        this.client = require('discord-rich-presence')('566152040711979019');

        this.client.on('join', (secret) => {
            console.log('we should join with', secret);
        });

        this.client.on('joinRequest', (user) => {
            console.log(user);
            if (user.discriminator === '1337') {
                client.reply(user, 'YES');
            } else {
                client.reply(user, 'IGNORE');
            }
        });

        this.client.on('connected', () => {
            this.onLauncher();
        });
    }

    onLauncher() {
        this.client.updatePresence({
            state: '🤔',
            details: 'On the launcher',
            startTimestamp: Date.now(),
            largeImageKey: 'untitled-1_copy',
            instance: true,
        });
    }

    loadingGame(){
        this.client.updatePresence({
            state: '🤔',
            details: 'Loading game',
            startTimestamp: Date.now(),
            largeImageKey: 'untitled-1_copy',
            instance: true,
        });
    }

    titleScreen(){
        this.client.updatePresence({
            state: 'On the title screen',
            details: 'In-game',
            startTimestamp: Date.now(),
            largeImageKey: 'untitled-1_copy',
            instance: true,
            matchSecret: CONFIG.GAME_ROOM,
            joinSecret: 'boop'
        });
    }

    onSceneChange(num){
        this.client.updatePresence({
            state: this._lang.getLocalizedString(this._scebeNumberToLangKey.getLocalizedString(num)),
            details: 'In-game',
            startTimestamp: Date.now(),
            largeImageKey: 'untitled-1_copy',
            instance: true,
            matchSecret: CONFIG.GAME_ROOM,
            joinSecret: 'boop'
        });
    }
}

module.exports = new OotDiscord();