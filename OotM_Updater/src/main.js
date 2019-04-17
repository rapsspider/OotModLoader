const { app, BrowserWindow, ipcMain } = require('electron')

const fs = require('fs');
const AdmZip = require('adm-zip');

console.log("--------------------------")
console.log("OotModLoader Updater 0.0.1")
console.log("--------------------------")

function patch() {
    var zip = new AdmZip("./update.zip");
    console.log("Applying patch...")
    zip.extractAllTo("./", true);
    fs.unlinkSync("./update.zip");
    app.relaunch({ args: [] })
    app.exit()
}

app.on('ready', function () {
    createWindow();
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 400,
        height: 300,
        webPreferences: {
            nodeIntegration: true
        },
        icon: "",
        show: false
    })

    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
        setTimeout(function () {
            patch();
        }, 5000);
    })

    // and load the index.html of the app.
    mainWindow.loadFile(__dirname + '/index.html')

    // Open the DevTools.
    //mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })

}