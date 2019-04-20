// Modules to control application life and create native browser window
const { BrowserWindow, ipcMain } = require('electron')
let ooto = null;
let discord;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
function createWindow(instance) {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true
    },
    icon: "",
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    setup(instance);
    mainWindow.show()
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

function setup(instance){
  ooto = instance;
  discord = require('./OotDiscord');
  discord.setup(ooto);
  let event_reg = function (id) {
    ooto.api.registerEventHandler(id, function (event) {
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

  ooto.api.registerEventHandler("onPlayerJoined", function(event){
    discord.addPlayer();
  })

  ooto.api.registerEventHandler("onPlayerDisconnected", function(event){
    discord.rmPlayer();
  })

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
      discord.onSceneChange(event.scene);
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
}

function setupModLoader(instance) {
  createWindow(instance);
}

module.exports = {setupModLoader: setupModLoader};