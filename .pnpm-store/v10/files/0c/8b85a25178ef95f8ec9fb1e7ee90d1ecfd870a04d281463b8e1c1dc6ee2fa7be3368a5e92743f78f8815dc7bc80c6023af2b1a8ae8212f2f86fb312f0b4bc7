"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MountDecoder = void 0;
const tslib_1 = require("tslib");
const Reader_1 = require("@jsonjoy.com/buffers/lib/Reader");
const XdrDecoder_1 = require("../../../xdr/XdrDecoder");
const errors_1 = require("../errors");
const msg = tslib_1.__importStar(require("./messages"));
const structs = tslib_1.__importStar(require("./structs"));
class MountDecoder {
    constructor(reader = new Reader_1.Reader()) {
        this.xdr = new XdrDecoder_1.XdrDecoder(reader);
    }
    decodeMessage(reader, proc, isRequest) {
        this.xdr.reader = reader;
        const startPos = reader.x;
        try {
            if (isRequest) {
                return this.decodeRequest(proc);
            }
            else {
                return this.decodeResponse(proc);
            }
        }
        catch (err) {
            if (err instanceof RangeError) {
                reader.x = startPos;
                return undefined;
            }
            throw err;
        }
    }
    decodeRequest(proc) {
        switch (proc) {
            case 0:
                return undefined;
            case 1:
                return this.decodeMntRequest();
            case 2:
                return new msg.MountDumpRequest();
            case 3:
                return this.decodeUmntRequest();
            case 4:
                return new msg.MountUmntallRequest();
            case 5:
                return new msg.MountExportRequest();
            default:
                throw new errors_1.Nfsv3DecodingError(`Unknown MOUNT procedure: ${proc}`);
        }
    }
    decodeResponse(proc) {
        switch (proc) {
            case 0:
                return undefined;
            case 1:
                return this.decodeMntResponse();
            case 2:
                return this.decodeDumpResponse();
            case 3:
                return undefined;
            case 4:
                return undefined;
            case 5:
                return this.decodeExportResponse();
            default:
                throw new errors_1.Nfsv3DecodingError(`Unknown MOUNT procedure: ${proc}`);
        }
    }
    readFhandle3() {
        const data = this.xdr.readVarlenOpaque();
        return new structs.MountFhandle3(new Reader_1.Reader(data));
    }
    readDirpath() {
        return this.xdr.readString();
    }
    readMountBody() {
        const valueFollows = this.xdr.readBoolean();
        if (!valueFollows)
            return undefined;
        const hostname = this.xdr.readString();
        const directory = this.readDirpath();
        const next = this.readMountBody();
        return new structs.MountBody(hostname, directory, next);
    }
    readGroupNode() {
        const valueFollows = this.xdr.readBoolean();
        if (!valueFollows)
            return undefined;
        const name = this.xdr.readString();
        const next = this.readGroupNode();
        return new structs.MountGroupNode(name, next);
    }
    readExportNode() {
        const valueFollows = this.xdr.readBoolean();
        if (!valueFollows)
            return undefined;
        const dir = this.readDirpath();
        const groups = this.readGroupNode();
        const next = this.readExportNode();
        return new structs.MountExportNode(dir, groups, next);
    }
    decodeMntRequest() {
        const dirpath = this.readDirpath();
        return new msg.MountMntRequest(dirpath);
    }
    decodeMntResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        if (status !== 0) {
            return new msg.MountMntResponse(status);
        }
        const fhandle = this.readFhandle3();
        const authFlavorsCount = xdr.readUnsignedInt();
        const authFlavors = [];
        for (let i = 0; i < authFlavorsCount; i++) {
            authFlavors.push(xdr.readUnsignedInt());
        }
        const mountinfo = new msg.MountMntResOk(fhandle, authFlavors);
        return new msg.MountMntResponse(status, mountinfo);
    }
    decodeDumpResponse() {
        const mountlist = this.readMountBody();
        return new msg.MountDumpResponse(mountlist);
    }
    decodeUmntRequest() {
        const dirpath = this.readDirpath();
        return new msg.MountUmntRequest(dirpath);
    }
    decodeExportResponse() {
        const exports = this.readExportNode();
        return new msg.MountExportResponse(exports);
    }
}
exports.MountDecoder = MountDecoder;
//# sourceMappingURL=MountDecoder.js.map