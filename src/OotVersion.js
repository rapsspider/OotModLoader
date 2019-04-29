/*
    OotModLoader - Adding networking functions and mod loading capability to Ocarina of Time.
    Copyright (C) 2019  Team Ooto

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

const logger = require('./OotLogger')("Core");

class Version {
    constructor() {
        this._VERSION = "@major@.@minor@.@buildNumber@.@release_type@";
        logger.info("==================================", "green");
        logger.info("Oot Mod Loader", "green");
        logger.info("v" + this._VERSION + " loading...", "green");
        logger.info("Coded by: denoflions, MelonSpeedruns, Ideka, and glank", "green");
        logger.info("Testers: Psi-Hate.", "green");
        logger.info("Notification icons drawn by: Nikki.", "green");
        logger.info("==================================", "green");
    }

    get VERSION() {
        return this._VERSION;
    }
}

module.exports = new Version().VERSION;
