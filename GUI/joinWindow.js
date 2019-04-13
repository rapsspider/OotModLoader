const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path');

class JoinWindow {
    constructor() {
        this.window = null;
        ipcMain.on("onJoinClicked", (event, arg) => {

        });
    }

    load(user) {
        this.window = new BrowserWindow({
            width: 300,
            height: 250,
            webPreferences: {
                nodeIntegration: true
            },
            icon: "",
            show: false
        });
        (function (inst) {
            inst.window.loadFile(path.resolve(global.OotModLoader.asar, 'joinWindow.html'))
            inst.window.once('ready-to-show', () => {
                inst.window.webContents.send("player", user);
                inst.window.show()
            })
        })(this);
    }
}

module.exports = JoinWindow;