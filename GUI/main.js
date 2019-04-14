// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path');
let ooto = null;
let discord;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
app.disableHardwareAcceleration()
function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 740,
    webPreferences: {
      nodeIntegration: true
    },
    icon: "",
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    setupModLoader();
    mainWindow.show()
  })

  // and load the index.html of the app.
  mainWindow.loadFile(path.resolve(global.OotModLoader.asar, 'index.html'))

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })

}

function setupModLoader() {
  // Tell computers that are trying to start us in appdata to fuck off.
  process.chdir(path.dirname(process.argv[0]));
  ooto = require('./OotModLoader')
  discord = require('./OotDiscord');
  discord.setup(ooto);
  let event_reg = function (id) {
    ooto.api.registerEventHandler(id, function (event) {
      console.log(event)
      if (mainWindow !== null) {
        mainWindow.webContents.send(event.id, event);
      }
    });
  }
  event_reg("GUI_StartFailed");
  event_reg("GUI_BadVersion");
  event_reg("onServerConnection");
  event_reg("onPlayerJoined");
  event_reg("onPlayerDisconnected");
  event_reg("GUI_updateLobbyBrowser_Reply");
  event_reg("GUI_ResetButton");
  event_reg("GUI_DiscordJoin")
  ooto.api.registerEventHandler("GUI_StartButtonPressed", function(event){
    discord.loadingGame();
  })
  ooto.api.registerEventHandler("onLuaStart", function(event){
    discord.titleScreen();
  })
  ooto.api.registerEventHandler("GUI_ResetButton", function(event){
    discord.onLauncher();
  })
  ooto.api.registerEventHandler("onSceneChange", function(event){
    if (event.player.isMe){
      //discord.onSceneChange(event.scene);
    }
  })
  ipcMain.on('postEvent', (event, arg) => {
    ooto.api.postEvent(arg);
  })
  ipcMain.on('setGlobal', (event, arg) => {
    global.OotModLoader[arg.id] = arg.value;
    console.log(arg);
  });
  if (ooto !== null) {
    if (mainWindow !== null) {
      mainWindow.webContents.send("GUI_ConfigLoaded", ooto);
      mainWindow.webContents.send("argv", process.argv)
    }
  }
  setInterval(function () {
    if (ooto.console.length > 0) {
      if (mainWindow !== null) {
        mainWindow.webContents.send("onConsoleMessage", { id: "onConsoleMessage", msg: ooto.console.shift() })
      }
    }
  }, 100);
  mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
