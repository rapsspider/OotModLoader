var ipcRenderer = require('electron').ipcRenderer;
const remote = require('electron').remote;

// cdn https://cdn.discordapp.com/
ipcRenderer.on('player', function (wtfisthis, event) {
    console.log(event);
    let n = document.getElementById("player_name");
    let d = document.getElementById("player_desc");
    let a = document.getElementById("player_avatar");
    n.innerHTML = event.username;
    d.innerHTML = event.discriminator;
    a.src = "https://cdn.discordapp.com/avatars/" + event.id + "/" + event.avatar + ".png"
});

function onAccept() {
    sendToMainProcess("onJoinClicked", { accept: true })
    var window = remote.getCurrentWindow();
    window.close();
}

function onReject() {
    sendToMainProcess("onJoinClicked", { accept: false })
    var window = remote.getCurrentWindow();
    window.close();
}

function sendToMainProcess(id, event) {
    ipcRenderer.send(id, event);
}