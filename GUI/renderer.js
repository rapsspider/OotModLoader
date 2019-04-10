// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
var ipcRenderer = require('electron').ipcRenderer;

const RENDER_OBJ = {};
let allow_lobby_refresh = false;
let lobby_browser_loaded = false;
let CONNECTED = false;
var $ = global.jQuery = require('./js/jquery-3.3.1.min.js');
var SERVER_URL = "http://localhost:8083/LobbyBrowser"

onTabOpen["Lobby Browser"] = {
    tag: "Lobby Browser", callback: function () {
        allow_lobby_refresh = true;
        if (!lobby_browser_loaded) {
            console.log("Refreshing lobby list...");
            lobby_browser_loaded = true;
            $.getJSON(SERVER_URL, function (data) {
                RENDER_OBJ.lobby_browser(data);
            });
        }
    }
};

onTabClosed["Lobby Browser"] = {
    tag: "Lobby Browser", callback: function () {
        allow_lobby_refresh = false;
        lobby_browser_loaded = false;
    }
};

setInterval(function () {
    if (allow_lobby_refresh && CONNECTED) {
        $.getJSON(SERVER_URL, function (data) {
            RENDER_OBJ.lobby_browser(data);
        });
    }
}, 30 * 1000);

RENDER_OBJ["console"] = function (msg) {
    console.log(msg);
}

RENDER_OBJ["romhacks"] = function (data) {
}

RENDER_OBJ["roms"] = function (data) {
}

ipcRenderer.on('GUI_ConfigLoaded', function (wtfisthis, event) {
    processConfigObject(event.config);
    RENDER_OBJ.romhacks(event.mods);
    SERVER_URL = "http://" + event.config._master_server_ip + ":8083/LobbyBrowser"
    console.log(SERVER_URL);
    RENDER_OBJ.roms(event.roms);
});

ipcRenderer.on('argv', function (wtfisthis, event) {
    console.log(event);
});

ipcRenderer.on('onConsoleMessage', function (wtfisthis, event) {
    RENDER_OBJ.console(event.msg);
});

ipcRenderer.on('GUI_StartFailed', function (wtfisthis, event) {
    document.getElementById("connect").disabled = true;
    document.getElementById("connect").textContent = "Failed to start! :(";
});

ipcRenderer.on('GUI_ResetButton', function (wtfisthis, event) {
    document.getElementById("connect").disabled = false;
    document.getElementById("connect").textContent = "Connect to Server";
});

RENDER_OBJ["lobby_browser"] = function (data) {
}

ipcRenderer.on('GUI_updateLobbyBrowser_Reply', function (wtfisthis, event) {
    RENDER_OBJ.lobby_browser(event.table);
});

ipcRenderer.on('onBizHawkInstall', function (wtfisthis, event) {
    console.log(event);
    if (!event.done) {
        document.getElementById("connect").disabled = true;
        document.getElementById("connect").textContent = "Installing BizHawk...";
    } else {
        document.getElementById("connect").disabled = false;
        document.getElementById("connect").textContent = "Connect to Server";
    }
});

ipcRenderer.on('GUI_BadVersion', function (wtfisthis, event) {
    document.getElementById("connect").disabled = true;
    document.getElementById("connect").textContent = "Version mismatch! :(";
});

ipcRenderer.on('onServerConnection', function (wtfisthis, event) {
    document.getElementById("connection_status").innerHTML = "Connected.";
    document.getElementById("current_lobby").innerHTML = event.room;
    CONNECTED = true;
});

ipcRenderer.on('onPlayerJoined', function (wtfisthis, event) {
    var ul = document.getElementById("player_list");
    var li = document.createElement("li");
    li.appendChild(document.createTextNode(event.player.nickname));
    ul.appendChild(li);
    li.setAttribute("id", event.player.uuid);
});

ipcRenderer.on('onPlayerDisconnected', function (wtfisthis, event) {
    let elem = document.getElementById(event.player.uuid);
    elem.parentNode.removeChild(elem);
});

let config_to_element_map = {};

function processConfigObject(config) {
    console.log(config);
    Object.keys(config).forEach(function (key) {
        console.log(key);
        let ele = document.getElementById(key);
        if (ele) {
            if (typeof config[key] === "boolean") {
                ele.checked = config[key];
                config_to_element_map[key] = { ele: ele, isBoolean: true };
            } else {
                ele.value = config[key];
                config_to_element_map[key] = { ele: ele, isBoolean: false };
            }
        }
        if (key === "_tunic_colors") {
            processConfigObject(config[key]);
        }
    });
}

function sendToMainProcess(id, event) {
    ipcRenderer.send(id, event);
}

function configChanged() {
    let cfg = {};
    Object.keys(config_to_element_map).forEach(function (key) {
        if (config_to_element_map[key].isBoolean) {
            cfg[key] = config_to_element_map[key].ele.checked;
        } else {
            cfg[key] = config_to_element_map[key].ele.value;
        }
    });
    console.log(cfg);
    sendToMainProcess("postEvent", { id: "GUI_ConfigChanged", config: cfg });
}

function startClient() {
    let rom = document.getElementById('rom').value;
    console.log(rom);
    if (rom === "None"){
        alert("You can't start the client without a rom!")
        return;
    }
    configChanged();
    document.getElementById("connect").textContent = "Starting client, please wait...";
    setTimeout(function () {
        document.getElementById("connect").textContent = "Client Started.";
    }, 10000);
    document.getElementById("connect").disabled = true;
    sendToMainProcess("postEvent", { id: "GUI_StartButtonPressed", start: true, rom: ""})
}

function onIPChange() {
    SERVER_URL = "http://" + document.getElementById("_master_server_ip").value + ":8083/LobbyBrowser"
    console.log(SERVER_URL);
}

RENDER_OBJ["onIPChange"] = onIPChange;

RENDER_OBJ["onConfigChanged"] = configChanged;
RENDER_OBJ["onStartClient"] = startClient;
RENDER_OBJ["onWindowReady"] = function(){
    sendToMainProcess("onWindowReady", { id: "onWindowReady", start: true})
}

module.exports = RENDER_OBJ;