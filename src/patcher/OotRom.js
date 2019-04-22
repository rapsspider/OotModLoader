const spawn = require('cross-spawn');
const fs = require('fs');
const path = require('path');

function byteswap(bs) {
    let length = bs.byteLength / 4;
    for (let i = 0; i < length; i++) {
        let word_start = i * 4;
        let temp = Buffer.alloc(4);
        let temp2 = Buffer.alloc(4);
        bs.copy(temp, 0, word_start, word_start + 4)
        let backwards = 3;
        for (let k = 0; k < temp.byteLength; k++) {
            temp2.writeUInt8(temp.readUInt8(backwards), k);
            backwards--;
        }
        temp2.copy(bs, word_start, 0, temp2.byteLength);
    }
    return bs;
}

class OotRom {
    constructor(file) {
        this._file = file;
        if (path.extname(file).indexOf("n64") > -1) {
            console.log("This rom needs to be byteswapped. One moment...")
            this._bs = fs.readFileSync(this._file);
            this._bs = byteswap(this._bs);
            fs.writeFileSync(global.OotMPatcher.dir + "/temp/" + path.parse(this._file).name + "_byteswap.z64", this._bs);
            this._file = global.OotMPatcher.dir + "/temp/" + path.parse(this._file).name + "_byteswap.z64";
        }
    }
}

module.exports = OotRom;