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

// DON'T MIND THIS CLASS I'M RIPPING IT APART. COME BACK LATER.

const zlib = require('zlib');
const VERSION = require('./OotVersion');
const jpack = require('jsonpack');
const logger = require('./OotLogger')("Encoder");

class VersionMismatchError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

class Encoder {

    compressData(data) {
        let pack = jpack.pack(data);
        let compress = zlib.deflateSync(pack);
        let base = Buffer.from(compress).toString('base64');
        return base;
    }

    decompressData(data) {
        let buffer = Buffer.from(data, 'base64');
        let decompress = zlib.inflateSync(buffer).toString();
        let unpack = jpack.unpack(decompress);
        return unpack;
    }

}

module.exports = new Encoder();