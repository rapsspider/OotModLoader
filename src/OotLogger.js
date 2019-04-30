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

const util = require('util');
const chalk = require('chalk');
const rfs = require("rotating-file-stream");

const LEVEL = {
  DEBG: 0,
  INFO: 1,
  WARN: 2,
  ERRO: 3
}

if(global.logstream === undefined){
  console.log("INIT LOGSTREAM")
  global.logstream = rfs(util.format("ootmodloader.log"), {
    size: "1M", // rotate every 10 MegaBytes written
    interval: "1d", // rotate daily
    path: "logs/",
    maxFiles: 10
  });
}
if(global.gui_console_stack === undefined){
  global.gui_console_stack = [];
}

original_console = console;

class OotLogger {
    constructor(name, _stdout_console) {
      this._name = name;
    }

    stdout(str, color = "white") {
        if (typeof (str) === "string") {
            console.log("[" + this._name + "]: " + chalk[color](str));
        } else {
            console.log("[" + this._name + "]: " + chalk[color](JSON.stringify(str)));
        }
    }

    defaultlog(str, level, color){
      var time = new Date().toISOString();
      level = Object.keys(LEVEL).find(key => LEVEL[key] === level);

      if (typeof (str) === "object") {
        try {
          str = JSON.stringify(str);
        } catch (e) {
          str = toString(str);
        }
      }

      var color_level = "white";
      switch (level) {
        case "DEBG":
          color_level = "green"
          break;
        case "INFO":
          color_level = "blue"
          break;
        case "WARN":
          color_level = "orange"
          break;
        case "ERRO":
          color_level = "red"
          break;
        default:
          color_level = "white"
      }

      // Write to log file & gui-console, without colors
      let raw_msg = util.format("[%s] %s - (%s): %s", time, level, this._name, str);
      global.logstream.write(raw_msg + "\n\r");
      global.gui_console_stack.push(raw_msg);

      level = chalk[color_level](level);
      if(color !== undefined){
        str = chalk[color](str);
      }
      // Write to STDOUT with colors
      original_console.log(util.format("[%s] %s - (%s): %s", time, level, this._name, str));
    }


    debug(str, color){
      this.defaultlog(str, LEVEL.DEBG, color);
    }

    log(str, color){
      this.debug(str, color);
    }

    info(str, color){
      this.defaultlog(str, LEVEL.INFO, color);
    }

    warning(str, color){
      this.defaultlog(str, LEVEL.WARN, color);
    }

    error(str, color){
      this.defaultlog(str, LEVEL.ERRO, color);
    }


    // logQuietly(str, color = "white") {
    //     if (typeof (str) === "string") {
    //         console.log(chalk[color](str));
    //     } else {
    //         console.log(chalk[color](JSON.stringify(str)));
    //     }
    // }
}

module.exports = function (str) {
    return new OotLogger(str);
};

// Init OotLogger & overwrite default console
console = new OotLogger("CONSOLE");
