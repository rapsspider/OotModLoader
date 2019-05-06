const CONFIG = require("./OotConfig");
const logger = require("./OotLogger")("Endpoint");

class OotEndPoint {
    constructor() {
        this._endpoint = null;
    }

    setup() {
        let express = require("express");
        this._endpoint = express();
        let http = require("http").Server(this._endpoint);
        let expressWs = require('express-ws')(this._endpoint, http);
        let bodyParser = require("body-parser");
        let master = require('./OotMasterServer');
        this._endpoint.use(bodyParser.json());
        this._endpoint.use(bodyParser.urlencoded({ extended: true }));
        this._endpoint.get("/", function (req, res) {
        });
        this._endpoint.get("/LobbyBrowser", function (req, res) {
            res.status(200).send(master._roomInfoCache);
        });
        http.listen(Number(Number(CONFIG.master_server_port) + 1), function () {
            logger.log(
                "endpoint hosted on port ".concat(Number(CONFIG.master_server_port) + 1)
            );
        });
    }
}

module.exports = new OotEndPoint();