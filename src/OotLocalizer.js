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

const loaded_files = {};

class OotLocalizer {

    constructor(str) {
        this._data = JSON.parse(str);
    }

    getLocalizedString(key) {
        return this._data[key];
    }

}

module.exports = {
    create: function (id, file) {
        loaded_files[id] = new OotLocalizer(file)
        return loaded_files[id];
    }, getLoadedObject: function (id) {
        return loaded_files[id];
    }
};