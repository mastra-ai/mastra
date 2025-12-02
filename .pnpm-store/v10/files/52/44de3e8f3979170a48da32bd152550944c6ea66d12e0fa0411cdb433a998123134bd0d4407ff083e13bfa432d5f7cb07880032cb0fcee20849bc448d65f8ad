"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeAttrs = void 0;
const tslib_1 = require("tslib");
const Writer_1 = require("@jsonjoy.com/buffers/lib/Writer");
const XdrEncoder_1 = require("../../../../../xdr/XdrEncoder");
const struct = tslib_1.__importStar(require("../../../structs"));
const attributes_1 = require("../../../attributes");
const encodeAttrs = (requestedAttrs, stats, path, fh, leaseTime, fsStats) => {
    const writer = new Writer_1.Writer(512);
    const xdr = new XdrEncoder_1.XdrEncoder(writer);
    const supportedMask = [];
    const requested = requestedAttrs.mask;
    for (let i = 0; i < requested.length; i++) {
        const word = requested[i];
        if (!word)
            continue;
        const wordIndex = i;
        for (let bit = 0; bit < 32; bit++) {
            if (!(word & (1 << bit)))
                continue;
            const attrNum = wordIndex * 32 + bit;
            switch (attrNum) {
                case 0: {
                    const implementedAttrs = [];
                    (0, attributes_1.setBit)(implementedAttrs, 0);
                    (0, attributes_1.setBit)(implementedAttrs, 1);
                    (0, attributes_1.setBit)(implementedAttrs, 2);
                    (0, attributes_1.setBit)(implementedAttrs, 3);
                    (0, attributes_1.setBit)(implementedAttrs, 4);
                    (0, attributes_1.setBit)(implementedAttrs, 5);
                    (0, attributes_1.setBit)(implementedAttrs, 6);
                    (0, attributes_1.setBit)(implementedAttrs, 7);
                    (0, attributes_1.setBit)(implementedAttrs, 8);
                    (0, attributes_1.setBit)(implementedAttrs, 9);
                    (0, attributes_1.setBit)(implementedAttrs, 10);
                    (0, attributes_1.setBit)(implementedAttrs, 11);
                    (0, attributes_1.setBit)(implementedAttrs, 19);
                    (0, attributes_1.setBit)(implementedAttrs, 20);
                    (0, attributes_1.setBit)(implementedAttrs, 33);
                    (0, attributes_1.setBit)(implementedAttrs, 35);
                    (0, attributes_1.setBit)(implementedAttrs, 45);
                    (0, attributes_1.setBit)(implementedAttrs, 42);
                    (0, attributes_1.setBit)(implementedAttrs, 43);
                    (0, attributes_1.setBit)(implementedAttrs, 44);
                    (0, attributes_1.setBit)(implementedAttrs, 21);
                    (0, attributes_1.setBit)(implementedAttrs, 22);
                    (0, attributes_1.setBit)(implementedAttrs, 23);
                    (0, attributes_1.setBit)(implementedAttrs, 47);
                    (0, attributes_1.setBit)(implementedAttrs, 52);
                    (0, attributes_1.setBit)(implementedAttrs, 53);
                    xdr.writeUnsignedInt(implementedAttrs.length);
                    for (let j = 0; j < implementedAttrs.length; j++) {
                        xdr.writeUnsignedInt(implementedAttrs[j]);
                    }
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 1: {
                    if (!stats)
                        break;
                    let type;
                    if (stats.isFile())
                        type = 1;
                    else if (stats.isDirectory())
                        type = 2;
                    else if (stats.isSymbolicLink())
                        type = 5;
                    else if (stats.isBlockDevice())
                        type = 3;
                    else if (stats.isCharacterDevice())
                        type = 4;
                    else if (stats.isFIFO())
                        type = 7;
                    else if (stats.isSocket())
                        type = 6;
                    else
                        type = 1;
                    xdr.writeUnsignedInt(type);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 4: {
                    if (!stats)
                        break;
                    xdr.writeUnsignedHyper(BigInt(stats.size));
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 20: {
                    if (!stats)
                        break;
                    xdr.writeUnsignedHyper(BigInt(stats.ino));
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 33: {
                    if (!stats)
                        break;
                    xdr.writeUnsignedInt(stats.mode & 0o7777);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 35: {
                    if (!stats)
                        break;
                    xdr.writeUnsignedInt(stats.nlink);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 45: {
                    if (!stats)
                        break;
                    xdr.writeUnsignedHyper(BigInt(stats.blocks * 512));
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 42: {
                    if (!fsStats)
                        break;
                    xdr.writeUnsignedHyper(fsStats.spaceAvail);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 43: {
                    if (!fsStats)
                        break;
                    xdr.writeUnsignedHyper(fsStats.spaceFree);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 44: {
                    if (!fsStats)
                        break;
                    xdr.writeUnsignedHyper(fsStats.spaceTotal);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 21: {
                    if (!fsStats)
                        break;
                    xdr.writeUnsignedHyper(fsStats.filesAvail);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 22: {
                    if (!fsStats)
                        break;
                    xdr.writeUnsignedHyper(fsStats.filesFree);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 23: {
                    if (!fsStats)
                        break;
                    xdr.writeUnsignedHyper(fsStats.filesTotal);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 47: {
                    if (!stats)
                        break;
                    const atime = stats.atimeMs;
                    const seconds = Math.floor(atime / 1000);
                    const nseconds = Math.floor((atime % 1000) * 1000000);
                    xdr.writeHyper(BigInt(seconds));
                    xdr.writeUnsignedInt(nseconds);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 53: {
                    if (!stats)
                        break;
                    const mtime = stats.mtimeMs;
                    const seconds = Math.floor(mtime / 1000);
                    const nseconds = Math.floor((mtime % 1000) * 1000000);
                    xdr.writeHyper(BigInt(seconds));
                    xdr.writeUnsignedInt(nseconds);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 52: {
                    if (!stats)
                        break;
                    const ctime = stats.ctimeMs;
                    const seconds = Math.floor(ctime / 1000);
                    const nseconds = Math.floor((ctime % 1000) * 1000000);
                    xdr.writeHyper(BigInt(seconds));
                    xdr.writeUnsignedInt(nseconds);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 3: {
                    if (!stats)
                        break;
                    const changeTime = BigInt(Math.floor(stats.mtimeMs * 1000000));
                    xdr.writeUnsignedHyper(changeTime);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 10: {
                    if (leaseTime !== undefined) {
                        xdr.writeUnsignedInt(leaseTime);
                        (0, attributes_1.setBit)(supportedMask, attrNum);
                    }
                    break;
                }
                case 2: {
                    xdr.writeUnsignedInt(2);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 5: {
                    xdr.writeUnsignedInt(1);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 6: {
                    xdr.writeUnsignedInt(1);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 7: {
                    xdr.writeUnsignedInt(0);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 8: {
                    xdr.writeUnsignedHyper(BigInt(0));
                    xdr.writeUnsignedHyper(BigInt(0));
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 9: {
                    xdr.writeUnsignedInt(1);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 11: {
                    xdr.writeUnsignedInt(0);
                    (0, attributes_1.setBit)(supportedMask, attrNum);
                    break;
                }
                case 19: {
                    if (fh) {
                        xdr.writeVarlenOpaque(fh);
                        (0, attributes_1.setBit)(supportedMask, attrNum);
                    }
                    break;
                }
                default: {
                    if (attributes_1.SET_ONLY_ATTRS.has(attrNum))
                        throw 22;
                }
            }
        }
    }
    const attrVals = writer.flush();
    return new struct.Nfsv4Fattr(new struct.Nfsv4Bitmap(supportedMask), attrVals);
};
exports.encodeAttrs = encodeAttrs;
//# sourceMappingURL=attrs.js.map