"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Nfsv4Encoder = void 0;
const Writer_1 = require("@jsonjoy.com/util/lib/buffers/Writer");
const XdrEncoder_1 = require("../../xdr/XdrEncoder");
class Nfsv4Encoder {
    constructor(writer = new Writer_1.Writer()) {
        this.writer = writer;
        this.xdr = new XdrEncoder_1.XdrEncoder(writer);
    }
    encodeCompound(compound, isRequest) {
        compound.encode(this.xdr);
        return this.writer.flush();
    }
    writeCompound(compound, isRequest) {
        compound.encode(this.xdr);
    }
    encodeCbCompound(compound, isRequest) {
        compound.encode(this.xdr);
        return this.writer.flush();
    }
    writeCbCompound(compound, isRequest) {
        compound.encode(this.xdr);
    }
}
exports.Nfsv4Encoder = Nfsv4Encoder;
//# sourceMappingURL=Nfsv4Encoder.js.map