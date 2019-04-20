const CONFIG = require("./OotConfig");
const logger = require("./OotLogger")("LobbyBrowser");

class OotLobbyBrowser {
    constructor() {

    }

    setup() {
        let express = require("express");
        let app = express();
        let http = require("http").Server(app);
        let bodyParser = require("body-parser");
        let master = require('./OotMasterServer');
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));
        app.get("/", function (req, res) {
        });
        app.get("/LobbyBrowser", function (req, res) {
            res.status(200).send(JSON.stringify(master._roomInfoCache));
        });
        http.listen(Number(Number(CONFIG.master_server_port) + 1), function () {
            logger.log(
                "Lobby data hosted on port ".concat(Number(CONFIG.master_server_port) + 1)
            );
        });
    }
}

module.exports = new OotLobbyBrowser();