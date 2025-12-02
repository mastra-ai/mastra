"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Nfsv3Decoder = void 0;
const tslib_1 = require("tslib");
const Reader_1 = require("@jsonjoy.com/buffers/lib/Reader");
const XdrDecoder_1 = require("../../xdr/XdrDecoder");
const errors_1 = require("./errors");
const msg = tslib_1.__importStar(require("./messages"));
const structs = tslib_1.__importStar(require("./structs"));
class Nfsv3Decoder {
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
            case 1:
                return this.decodeGetattrRequest();
            case 2:
                return this.decodeSetattrRequest();
            case 3:
                return this.decodeLookupRequest();
            case 4:
                return this.decodeAccessRequest();
            case 5:
                return this.decodeReadlinkRequest();
            case 6:
                return this.decodeReadRequest();
            case 7:
                return this.decodeWriteRequest();
            case 8:
                return this.decodeCreateRequest();
            case 9:
                return this.decodeMkdirRequest();
            case 10:
                return this.decodeSymlinkRequest();
            case 11:
                return this.decodeMknodRequest();
            case 12:
                return this.decodeRemoveRequest();
            case 13:
                return this.decodeRmdirRequest();
            case 14:
                return this.decodeRenameRequest();
            case 15:
                return this.decodeLinkRequest();
            case 16:
                return this.decodeReaddirRequest();
            case 17:
                return this.decodeReaddirplusRequest();
            case 18:
                return this.decodeFsstatRequest();
            case 19:
                return this.decodeFsinfoRequest();
            case 20:
                return this.decodePathconfRequest();
            case 21:
                return this.decodeCommitRequest();
            default:
                throw new errors_1.Nfsv3DecodingError(`Unknown procedure: \${proc}`);
        }
    }
    decodeResponse(proc) {
        switch (proc) {
            case 1:
                return this.decodeGetattrResponse();
            case 2:
                return this.decodeSetattrResponse();
            case 3:
                return this.decodeLookupResponse();
            case 4:
                return this.decodeAccessResponse();
            case 5:
                return this.decodeReadlinkResponse();
            case 6:
                return this.decodeReadResponse();
            case 7:
                return this.decodeWriteResponse();
            case 8:
                return this.decodeCreateResponse();
            case 9:
                return this.decodeMkdirResponse();
            case 10:
                return this.decodeSymlinkResponse();
            case 11:
                return this.decodeMknodResponse();
            case 12:
                return this.decodeRemoveResponse();
            case 13:
                return this.decodeRmdirResponse();
            case 14:
                return this.decodeRenameResponse();
            case 15:
                return this.decodeLinkResponse();
            case 16:
                return this.decodeReaddirResponse();
            case 17:
                return this.decodeReaddirplusResponse();
            case 18:
                return this.decodeFsstatResponse();
            case 19:
                return this.decodeFsinfoResponse();
            case 20:
                return this.decodePathconfResponse();
            case 21:
                return this.decodeCommitResponse();
            default:
                throw new errors_1.Nfsv3DecodingError(`Unknown procedure: \${proc}`);
        }
    }
    readFh() {
        const data = this.xdr.readVarlenOpaque();
        return new structs.Nfsv3Fh(data);
    }
    readFilename() {
        return this.xdr.readString();
    }
    readTime() {
        const xdr = this.xdr;
        const seconds = xdr.readUnsignedInt();
        const nseconds = xdr.readUnsignedInt();
        return new structs.Nfsv3Time(seconds, nseconds);
    }
    readSpecData() {
        const xdr = this.xdr;
        const specdata1 = xdr.readUnsignedInt();
        const specdata2 = xdr.readUnsignedInt();
        return new structs.Nfsv3SpecData(specdata1, specdata2);
    }
    readFattr() {
        const xdr = this.xdr;
        const type = xdr.readUnsignedInt();
        const mode = xdr.readUnsignedInt();
        const nlink = xdr.readUnsignedInt();
        const uid = xdr.readUnsignedInt();
        const gid = xdr.readUnsignedInt();
        const size = xdr.readUnsignedHyper();
        const used = xdr.readUnsignedHyper();
        const rdev = this.readSpecData();
        const fsid = xdr.readUnsignedHyper();
        const fileid = xdr.readUnsignedHyper();
        const atime = this.readTime();
        const mtime = this.readTime();
        const ctime = this.readTime();
        return new structs.Nfsv3Fattr(type, mode, nlink, uid, gid, size, used, rdev, fsid, fileid, atime, mtime, ctime);
    }
    readPostOpAttr() {
        const attributesFollow = this.xdr.readBoolean();
        const attributes = attributesFollow ? this.readFattr() : undefined;
        return new structs.Nfsv3PostOpAttr(attributesFollow, attributes);
    }
    readWccAttr() {
        const size = this.xdr.readUnsignedHyper();
        const mtime = this.readTime();
        const ctime = this.readTime();
        return new structs.Nfsv3WccAttr(size, mtime, ctime);
    }
    readPreOpAttr() {
        const attributesFollow = this.xdr.readBoolean();
        const attributes = attributesFollow ? this.readWccAttr() : undefined;
        return new structs.Nfsv3PreOpAttr(attributesFollow, attributes);
    }
    readWccData() {
        const before = this.readPreOpAttr();
        const after = this.readPostOpAttr();
        return new structs.Nfsv3WccData(before, after);
    }
    readPostOpFh() {
        const handleFollows = this.xdr.readBoolean();
        const handle = handleFollows ? this.readFh() : undefined;
        return new structs.Nfsv3PostOpFh(handleFollows, handle);
    }
    readSetMode() {
        const set = this.xdr.readBoolean();
        const mode = set ? this.xdr.readUnsignedInt() : undefined;
        return new structs.Nfsv3SetMode(set, mode);
    }
    readSetUid() {
        const set = this.xdr.readBoolean();
        const uid = set ? this.xdr.readUnsignedInt() : undefined;
        return new structs.Nfsv3SetUid(set, uid);
    }
    readSetGid() {
        const set = this.xdr.readBoolean();
        const gid = set ? this.xdr.readUnsignedInt() : undefined;
        return new structs.Nfsv3SetGid(set, gid);
    }
    readSetSize() {
        const set = this.xdr.readBoolean();
        const size = set ? this.xdr.readUnsignedHyper() : undefined;
        return new structs.Nfsv3SetSize(set, size);
    }
    readSetAtime() {
        const how = this.xdr.readUnsignedInt();
        const atime = how === 2 ? this.readTime() : undefined;
        return new structs.Nfsv3SetAtime(how, atime);
    }
    readSetMtime() {
        const how = this.xdr.readUnsignedInt();
        const mtime = how === 2 ? this.readTime() : undefined;
        return new structs.Nfsv3SetMtime(how, mtime);
    }
    readSattr() {
        const mode = this.readSetMode();
        const uid = this.readSetUid();
        const gid = this.readSetGid();
        const size = this.readSetSize();
        const atime = this.readSetAtime();
        const mtime = this.readSetMtime();
        return new structs.Nfsv3Sattr(mode, uid, gid, size, atime, mtime);
    }
    readSattrGuard() {
        const check = this.xdr.readBoolean();
        const objCtime = check ? this.readTime() : undefined;
        return new structs.Nfsv3SattrGuard(check, objCtime);
    }
    readDirOpArgs() {
        const dir = this.readFh();
        const name = this.readFilename();
        return new structs.Nfsv3DirOpArgs(dir, name);
    }
    readCreateHow() {
        const xdr = this.xdr;
        const mode = xdr.readUnsignedInt();
        let objAttributes;
        let verf;
        if (mode === 0 || mode === 1) {
            objAttributes = this.readSattr();
        }
        else if (mode === 2) {
            const verfData = xdr.readOpaque(8);
            verf = verfData;
        }
        return new structs.Nfsv3CreateHow(mode, objAttributes, verf);
    }
    readMknodData() {
        const type = this.xdr.readUnsignedInt();
        let chr;
        let blk;
        let sock;
        let pipe;
        switch (type) {
            case 4:
                chr = new structs.Nfsv3DeviceData(this.readSattr(), this.readSpecData());
                break;
            case 3:
                blk = new structs.Nfsv3DeviceData(this.readSattr(), this.readSpecData());
                break;
            case 6:
                sock = this.readSattr();
                break;
            case 7:
                pipe = this.readSattr();
                break;
        }
        return new structs.Nfsv3MknodData(type, chr, blk, sock, pipe);
    }
    readEntry() {
        const xdr = this.xdr;
        const valueFollows = xdr.readBoolean();
        if (!valueFollows)
            return undefined;
        const fileid = xdr.readUnsignedHyper();
        const name = this.readFilename();
        const cookie = xdr.readUnsignedHyper();
        const nextentry = this.readEntry();
        return new structs.Nfsv3Entry(fileid, name, cookie, nextentry);
    }
    readEntryPlus() {
        const xdr = this.xdr;
        const valueFollows = xdr.readBoolean();
        if (!valueFollows)
            return undefined;
        const fileid = xdr.readUnsignedHyper();
        const name = this.readFilename();
        const cookie = xdr.readUnsignedHyper();
        const nameAttributes = this.readPostOpAttr();
        const nameHandle = this.readPostOpFh();
        const nextentry = this.readEntryPlus();
        return new structs.Nfsv3EntryPlus(fileid, name, cookie, nameAttributes, nameHandle, nextentry);
    }
    readDirList() {
        const entries = this.readEntry();
        const eof = this.xdr.readBoolean();
        return new structs.Nfsv3DirList(eof, entries);
    }
    readDirListPlus() {
        const entries = this.readEntryPlus();
        const eof = this.xdr.readBoolean();
        return new structs.Nfsv3DirListPlus(eof, entries);
    }
    decodeGetattrRequest() {
        const object = this.readFh();
        return new msg.Nfsv3GetattrRequest(object);
    }
    decodeGetattrResponse() {
        const status = this.xdr.readUnsignedInt();
        let resok;
        if (status === 0) {
            const objAttributes = this.readFattr();
            resok = new msg.Nfsv3GetattrResOk(objAttributes);
        }
        return new msg.Nfsv3GetattrResponse(status, resok);
    }
    decodeSetattrRequest() {
        const object = this.readFh();
        const newAttributes = this.readSattr();
        const guard = this.readSattrGuard();
        return new msg.Nfsv3SetattrRequest(object, newAttributes, guard);
    }
    decodeSetattrResponse() {
        const status = this.xdr.readUnsignedInt();
        let resok;
        let resfail;
        const objWcc = this.readWccData();
        if (status === 0) {
            resok = new msg.Nfsv3SetattrResOk(objWcc);
        }
        else {
            resfail = new msg.Nfsv3SetattrResFail(objWcc);
        }
        return new msg.Nfsv3SetattrResponse(status, resok, resfail);
    }
    decodeLookupRequest() {
        const what = this.readDirOpArgs();
        return new msg.Nfsv3LookupRequest(what);
    }
    decodeLookupResponse() {
        const status = this.xdr.readUnsignedInt();
        let resok;
        let resfail;
        if (status === 0) {
            const object = this.readFh();
            const objAttributes = this.readPostOpAttr();
            const dirAttributes = this.readPostOpAttr();
            resok = new msg.Nfsv3LookupResOk(object, objAttributes, dirAttributes);
        }
        else {
            const dirAttributes = this.readPostOpAttr();
            resfail = new msg.Nfsv3LookupResFail(dirAttributes);
        }
        return new msg.Nfsv3LookupResponse(status, resok, resfail);
    }
    decodeAccessRequest() {
        const object = this.readFh();
        const access = this.xdr.readUnsignedInt();
        return new msg.Nfsv3AccessRequest(object, access);
    }
    decodeAccessResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        let resok;
        let resfail;
        const objAttributes = this.readPostOpAttr();
        if (status === 0) {
            const access = xdr.readUnsignedInt();
            resok = new msg.Nfsv3AccessResOk(objAttributes, access);
        }
        else {
            resfail = new msg.Nfsv3AccessResFail(objAttributes);
        }
        return new msg.Nfsv3AccessResponse(status, resok, resfail);
    }
    decodeReadlinkRequest() {
        const symlink = this.readFh();
        return new msg.Nfsv3ReadlinkRequest(symlink);
    }
    decodeReadlinkResponse() {
        const status = this.xdr.readUnsignedInt();
        let resok;
        let resfail;
        const symlinkAttributes = this.readPostOpAttr();
        if (status === 0) {
            const data = this.readFilename();
            resok = new msg.Nfsv3ReadlinkResOk(symlinkAttributes, data);
        }
        else {
            resfail = new msg.Nfsv3ReadlinkResFail(symlinkAttributes);
        }
        return new msg.Nfsv3ReadlinkResponse(status, resok, resfail);
    }
    decodeReadRequest() {
        const file = this.readFh();
        const xdr = this.xdr;
        const offset = xdr.readUnsignedHyper();
        const count = xdr.readUnsignedInt();
        return new msg.Nfsv3ReadRequest(file, offset, count);
    }
    decodeReadResponse() {
        const status = this.xdr.readUnsignedInt();
        let resok;
        let resfail;
        const fileAttributes = this.readPostOpAttr();
        if (status === 0) {
            const xdr = this.xdr;
            const count = xdr.readUnsignedInt();
            const eof = xdr.readBoolean();
            const data = xdr.readVarlenOpaque();
            resok = new msg.Nfsv3ReadResOk(fileAttributes, count, eof, data);
        }
        else {
            resfail = new msg.Nfsv3ReadResFail(fileAttributes);
        }
        return new msg.Nfsv3ReadResponse(status, resok, resfail);
    }
    decodeWriteRequest() {
        const file = this.readFh();
        const xdr = this.xdr;
        const offset = xdr.readUnsignedHyper();
        const count = xdr.readUnsignedInt();
        const stable = xdr.readUnsignedInt();
        const data = xdr.readVarlenOpaque();
        return new msg.Nfsv3WriteRequest(file, offset, count, stable, data);
    }
    decodeWriteResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        let resok;
        let resfail;
        const fileWcc = this.readWccData();
        if (status === 0) {
            const count = xdr.readUnsignedInt();
            const committed = xdr.readUnsignedInt();
            const verf = xdr.readOpaque(8);
            resok = new msg.Nfsv3WriteResOk(fileWcc, count, committed, verf);
        }
        else {
            resfail = new msg.Nfsv3WriteResFail(fileWcc);
        }
        return new msg.Nfsv3WriteResponse(status, resok, resfail);
    }
    decodeCreateRequest() {
        const where = this.readDirOpArgs();
        const how = this.readCreateHow();
        return new msg.Nfsv3CreateRequest(where, how);
    }
    decodeCreateResponse() {
        const status = this.xdr.readUnsignedInt();
        let resok;
        let resfail;
        if (status === 0) {
            const obj = this.readPostOpFh();
            const objAttributes = this.readPostOpAttr();
            const dirWcc = this.readWccData();
            resok = new msg.Nfsv3CreateResOk(obj, objAttributes, dirWcc);
        }
        else {
            const dirWcc = this.readWccData();
            resfail = new msg.Nfsv3CreateResFail(dirWcc);
        }
        return new msg.Nfsv3CreateResponse(status, resok, resfail);
    }
    decodeMkdirRequest() {
        const where = this.readDirOpArgs();
        const attributes = this.readSattr();
        return new msg.Nfsv3MkdirRequest(where, attributes);
    }
    decodeMkdirResponse() {
        const status = this.xdr.readUnsignedInt();
        let resok;
        let resfail;
        if (status === 0) {
            const obj = this.readPostOpFh();
            const objAttributes = this.readPostOpAttr();
            const dirWcc = this.readWccData();
            resok = new msg.Nfsv3MkdirResOk(obj, objAttributes, dirWcc);
        }
        else {
            const dirWcc = this.readWccData();
            resfail = new msg.Nfsv3MkdirResFail(dirWcc);
        }
        return new msg.Nfsv3MkdirResponse(status, resok, resfail);
    }
    decodeSymlinkRequest() {
        const where = this.readDirOpArgs();
        const symlinkAttributes = this.readSattr();
        const symlinkData = this.readFilename();
        return new msg.Nfsv3SymlinkRequest(where, symlinkAttributes, symlinkData);
    }
    decodeSymlinkResponse() {
        const status = this.xdr.readUnsignedInt();
        let resok;
        let resfail;
        if (status === 0) {
            const obj = this.readPostOpFh();
            const objAttributes = this.readPostOpAttr();
            const dirWcc = this.readWccData();
            resok = new msg.Nfsv3SymlinkResOk(obj, objAttributes, dirWcc);
        }
        else {
            const dirWcc = this.readWccData();
            resfail = new msg.Nfsv3SymlinkResFail(dirWcc);
        }
        return new msg.Nfsv3SymlinkResponse(status, resok, resfail);
    }
    decodeMknodRequest() {
        const where = this.readDirOpArgs();
        const what = this.readMknodData();
        return new msg.Nfsv3MknodRequest(where, what);
    }
    decodeMknodResponse() {
        const status = this.xdr.readUnsignedInt();
        let resok;
        let resfail;
        if (status === 0) {
            const obj = this.readPostOpFh();
            const objAttributes = this.readPostOpAttr();
            const dirWcc = this.readWccData();
            resok = new msg.Nfsv3MknodResOk(obj, objAttributes, dirWcc);
        }
        else {
            const dirWcc = this.readWccData();
            resfail = new msg.Nfsv3MknodResFail(dirWcc);
        }
        return new msg.Nfsv3MknodResponse(status, resok, resfail);
    }
    decodeRemoveRequest() {
        const object = this.readDirOpArgs();
        return new msg.Nfsv3RemoveRequest(object);
    }
    decodeRemoveResponse() {
        const status = this.xdr.readUnsignedInt();
        let resok;
        let resfail;
        const dirWcc = this.readWccData();
        if (status === 0) {
            resok = new msg.Nfsv3RemoveResOk(dirWcc);
        }
        else {
            resfail = new msg.Nfsv3RemoveResFail(dirWcc);
        }
        return new msg.Nfsv3RemoveResponse(status, resok, resfail);
    }
    decodeRmdirRequest() {
        const object = this.readDirOpArgs();
        return new msg.Nfsv3RmdirRequest(object);
    }
    decodeRmdirResponse() {
        const status = this.xdr.readUnsignedInt();
        let resok;
        let resfail;
        const dirWcc = this.readWccData();
        if (status === 0) {
            resok = new msg.Nfsv3RmdirResOk(dirWcc);
        }
        else {
            resfail = new msg.Nfsv3RmdirResFail(dirWcc);
        }
        return new msg.Nfsv3RmdirResponse(status, resok, resfail);
    }
    decodeRenameRequest() {
        const from = this.readDirOpArgs();
        const to = this.readDirOpArgs();
        return new msg.Nfsv3RenameRequest(from, to);
    }
    decodeRenameResponse() {
        const status = this.xdr.readUnsignedInt();
        let resok;
        let resfail;
        const fromDirWcc = this.readWccData();
        const toDirWcc = this.readWccData();
        if (status === 0) {
            resok = new msg.Nfsv3RenameResOk(fromDirWcc, toDirWcc);
        }
        else {
            resfail = new msg.Nfsv3RenameResFail(fromDirWcc, toDirWcc);
        }
        return new msg.Nfsv3RenameResponse(status, resok, resfail);
    }
    decodeLinkRequest() {
        const file = this.readFh();
        const link = this.readDirOpArgs();
        return new msg.Nfsv3LinkRequest(file, link);
    }
    decodeLinkResponse() {
        const status = this.xdr.readUnsignedInt();
        let resok;
        let resfail;
        const fileAttributes = this.readPostOpAttr();
        const linkDirWcc = this.readWccData();
        if (status === 0) {
            resok = new msg.Nfsv3LinkResOk(fileAttributes, linkDirWcc);
        }
        else {
            resfail = new msg.Nfsv3LinkResFail(fileAttributes, linkDirWcc);
        }
        return new msg.Nfsv3LinkResponse(status, resok, resfail);
    }
    decodeReaddirRequest() {
        const dir = this.readFh();
        const xdr = this.xdr;
        const cookie = xdr.readUnsignedHyper();
        const cookieverf = xdr.readOpaque(8);
        const count = xdr.readUnsignedInt();
        return new msg.Nfsv3ReaddirRequest(dir, cookie, cookieverf, count);
    }
    decodeReaddirResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        let resok;
        let resfail;
        const dirAttributes = this.readPostOpAttr();
        if (status === 0) {
            const cookieverf = xdr.readOpaque(8);
            const reply = this.readDirList();
            resok = new msg.Nfsv3ReaddirResOk(dirAttributes, cookieverf, reply);
        }
        else {
            resfail = new msg.Nfsv3ReaddirResFail(dirAttributes);
        }
        return new msg.Nfsv3ReaddirResponse(status, resok, resfail);
    }
    decodeReaddirplusRequest() {
        const dir = this.readFh();
        const xdr = this.xdr;
        const cookie = xdr.readUnsignedHyper();
        const cookieverf = xdr.readOpaque(8);
        const dircount = xdr.readUnsignedInt();
        const maxcount = xdr.readUnsignedInt();
        return new msg.Nfsv3ReaddirplusRequest(dir, cookie, cookieverf, dircount, maxcount);
    }
    decodeReaddirplusResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        let resok;
        let resfail;
        const dirAttributes = this.readPostOpAttr();
        if (status === 0) {
            const cookieverf = xdr.readOpaque(8);
            const reply = this.readDirListPlus();
            resok = new msg.Nfsv3ReaddirplusResOk(dirAttributes, cookieverf, reply);
        }
        else {
            resfail = new msg.Nfsv3ReaddirplusResFail(dirAttributes);
        }
        return new msg.Nfsv3ReaddirplusResponse(status, resok, resfail);
    }
    decodeFsstatRequest() {
        const fsroot = this.readFh();
        return new msg.Nfsv3FsstatRequest(fsroot);
    }
    decodeFsstatResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        let resok;
        let resfail;
        const objAttributes = this.readPostOpAttr();
        if (status === 0) {
            const tbytes = xdr.readUnsignedHyper();
            const fbytes = xdr.readUnsignedHyper();
            const abytes = xdr.readUnsignedHyper();
            const tfiles = xdr.readUnsignedHyper();
            const ffiles = xdr.readUnsignedHyper();
            const afiles = xdr.readUnsignedHyper();
            const invarsec = xdr.readUnsignedInt();
            resok = new msg.Nfsv3FsstatResOk(objAttributes, tbytes, fbytes, abytes, tfiles, ffiles, afiles, invarsec);
        }
        else {
            resfail = new msg.Nfsv3FsstatResFail(objAttributes);
        }
        return new msg.Nfsv3FsstatResponse(status, resok, resfail);
    }
    decodeFsinfoRequest() {
        const fsroot = this.readFh();
        return new msg.Nfsv3FsinfoRequest(fsroot);
    }
    decodeFsinfoResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        let resok;
        let resfail;
        const objAttributes = this.readPostOpAttr();
        if (status === 0) {
            const rtmax = xdr.readUnsignedInt();
            const rtpref = xdr.readUnsignedInt();
            const rtmult = xdr.readUnsignedInt();
            const wtmax = xdr.readUnsignedInt();
            const wtpref = xdr.readUnsignedInt();
            const wtmult = xdr.readUnsignedInt();
            const dtpref = xdr.readUnsignedInt();
            const maxfilesize = xdr.readUnsignedHyper();
            const timeDelta = { seconds: xdr.readUnsignedInt(), nseconds: xdr.readUnsignedInt() };
            const properties = xdr.readUnsignedInt();
            resok = new msg.Nfsv3FsinfoResOk(objAttributes, rtmax, rtpref, rtmult, wtmax, wtpref, wtmult, dtpref, maxfilesize, timeDelta, properties);
        }
        else {
            resfail = new msg.Nfsv3FsinfoResFail(objAttributes);
        }
        return new msg.Nfsv3FsinfoResponse(status, resok, resfail);
    }
    decodePathconfRequest() {
        const object = this.readFh();
        return new msg.Nfsv3PathconfRequest(object);
    }
    decodePathconfResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        let resok;
        let resfail;
        const objAttributes = this.readPostOpAttr();
        if (status === 0) {
            const linkmax = xdr.readUnsignedInt();
            const namemax = xdr.readUnsignedInt();
            const noTrunc = xdr.readBoolean();
            const chownRestricted = xdr.readBoolean();
            const caseInsensitive = xdr.readBoolean();
            const casePreserving = xdr.readBoolean();
            resok = new msg.Nfsv3PathconfResOk(objAttributes, linkmax, namemax, noTrunc, chownRestricted, caseInsensitive, casePreserving);
        }
        else {
            resfail = new msg.Nfsv3PathconfResFail(objAttributes);
        }
        return new msg.Nfsv3PathconfResponse(status, resok, resfail);
    }
    decodeCommitRequest() {
        const file = this.readFh();
        const xdr = this.xdr;
        const offset = xdr.readUnsignedHyper();
        const count = xdr.readUnsignedInt();
        return new msg.Nfsv3CommitRequest(file, offset, count);
    }
    decodeCommitResponse() {
        const xdr = this.xdr;
        const status = xdr.readUnsignedInt();
        let resok;
        let resfail;
        const fileWcc = this.readWccData();
        if (status === 0) {
            const verf = xdr.readOpaque(8);
            resok = new msg.Nfsv3CommitResOk(fileWcc, verf);
        }
        else {
            resfail = new msg.Nfsv3CommitResFail(fileWcc);
        }
        return new msg.Nfsv3CommitResponse(status, resok, resfail);
    }
}
exports.Nfsv3Decoder = Nfsv3Decoder;
//# sourceMappingURL=Nfsv3Decoder.js.map