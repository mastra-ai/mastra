"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NfsFsDir = void 0;
const NfsFsDirent_1 = require("./NfsFsDirent");
const builder_1 = require("../builder");
const Reader_1 = require("@jsonjoy.com/buffers/lib/Reader");
const XdrDecoder_1 = require("../../../xdr/XdrDecoder");
class NfsFsDir {
    constructor(path, nfs, operations) {
        this.path = path;
        this.nfs = nfs;
        this.operations = operations;
        this.entries = [];
        this.position = 0;
        this.closed = false;
    }
    async ensureLoaded() {
        if (this.entries.length > 0 || this.closed)
            return;
        const attrNums = [1];
        const attrMask = [];
        for (const attrNum of attrNums) {
            const wordIndex = Math.floor(attrNum / 32);
            const bitIndex = attrNum % 32;
            while (attrMask.length <= wordIndex)
                attrMask.push(0);
            attrMask[wordIndex] |= 1 << bitIndex;
        }
        const operations = [...this.operations];
        operations.push(builder_1.nfs.READDIR(attrMask));
        const response = await this.nfs.compound(operations);
        if (response.status !== 0)
            throw new Error(`Failed to read directory: ${response.status}`);
        const readdirRes = response.resarray[response.resarray.length - 1];
        if (readdirRes.status !== 0 || !readdirRes.resok)
            throw new Error(`Failed to read directory: ${readdirRes.status}`);
        const entryList = readdirRes.resok.entries;
        for (let i = 0; i < entryList.length; i++) {
            const entry = entryList[i];
            const name = entry.name;
            const fattr = entry.attrs;
            const reader = new Reader_1.Reader();
            reader.reset(fattr.attrVals);
            const xdr = new XdrDecoder_1.XdrDecoder(reader);
            let fileType = 1;
            const returnedMask = fattr.attrmask.mask;
            for (let i = 0; i < returnedMask.length; i++) {
                const word = returnedMask[i];
                if (!word)
                    continue;
                for (let bit = 0; bit < 32; bit++) {
                    if (!(word & (1 << bit)))
                        continue;
                    const attrNum = i * 32 + bit;
                    if (attrNum === 1) {
                        fileType = xdr.readUnsignedInt();
                    }
                }
            }
            this.entries.push(new NfsFsDirent_1.NfsFsDirent(name, fileType));
        }
    }
    async close(callback) {
        this.closed = true;
        this.entries = [];
        this.position = 0;
        if (callback) {
            try {
                callback();
            }
            catch (err) {
                callback(err);
            }
        }
    }
    closeSync() {
        this.closed = true;
        this.entries = [];
        this.position = 0;
    }
    async read(callback) {
        try {
            if (this.closed) {
                const err = new Error('Directory is closed');
                if (callback) {
                    callback(err, null);
                    return null;
                }
                throw err;
            }
            await this.ensureLoaded();
            if (this.position >= this.entries.length) {
                if (callback) {
                    callback(null, null);
                }
                return null;
            }
            const entry = this.entries[this.position++];
            if (callback) {
                callback(null, entry);
            }
            return entry;
        }
        catch (err) {
            if (callback) {
                callback(err, null);
                return null;
            }
            throw err;
        }
    }
    readSync() {
        if (this.closed) {
            throw new Error('Directory is closed');
        }
        if (this.position >= this.entries.length) {
            return null;
        }
        return this.entries[this.position++];
    }
    async *[Symbol.asyncIterator]() {
        await this.ensureLoaded();
        for (const entry of this.entries) {
            yield entry;
        }
    }
}
exports.NfsFsDir = NfsFsDir;
//# sourceMappingURL=NfsFsDir.js.map