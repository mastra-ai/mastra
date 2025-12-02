"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Nfsv3Encoder = void 0;
const Writer_1 = require("@jsonjoy.com/util/lib/buffers/Writer");
const XdrEncoder_1 = require("../../xdr/XdrEncoder");
const errors_1 = require("./errors");
class Nfsv3Encoder {
    constructor(writer = new Writer_1.Writer()) {
        this.writer = writer;
        this.xdr = new XdrEncoder_1.XdrEncoder(writer);
    }
    encodeMessage(message, proc, isRequest) {
        if (isRequest)
            this.writeRequest(message, proc);
        else
            this.writeResponse(message, proc);
        return this.writer.flush();
    }
    writeMessage(message, proc, isRequest) {
        if (isRequest)
            this.writeRequest(message, proc);
        else
            this.writeResponse(message, proc);
    }
    writeRequest(request, proc) {
        switch (proc) {
            case 1:
                return this.writeGetattrRequest(request);
            case 2:
                return this.writeSetattrRequest(request);
            case 3:
                return this.writeLookupRequest(request);
            case 4:
                return this.writeAccessRequest(request);
            case 5:
                return this.writeReadlinkRequest(request);
            case 6:
                return this.writeReadRequest(request);
            case 7:
                return this.writeWriteRequest(request);
            case 8:
                return this.writeCreateRequest(request);
            case 9:
                return this.writeMkdirRequest(request);
            case 10:
                return this.writeSymlinkRequest(request);
            case 11:
                return this.writeMknodRequest(request);
            case 12:
                return this.writeRemoveRequest(request);
            case 13:
                return this.writeRmdirRequest(request);
            case 14:
                return this.writeRenameRequest(request);
            case 15:
                return this.writeLinkRequest(request);
            case 16:
                return this.writeReaddirRequest(request);
            case 17:
                return this.writeReaddirplusRequest(request);
            case 18:
                return this.writeFsstatRequest(request);
            case 19:
                return this.writeFsinfoRequest(request);
            case 20:
                return this.writePathconfRequest(request);
            case 21:
                return this.writeCommitRequest(request);
            default:
                throw new errors_1.Nfsv3EncodingError(`Unknown procedure: ${proc}`);
        }
    }
    writeResponse(response, proc) {
        switch (proc) {
            case 1:
                return this.writeGetattrResponse(response);
            case 2:
                return this.writeSetattrResponse(response);
            case 3:
                return this.writeLookupResponse(response);
            case 4:
                return this.writeAccessResponse(response);
            case 5:
                return this.writeReadlinkResponse(response);
            case 6:
                return this.writeReadResponse(response);
            case 7:
                return this.writeWriteResponse(response);
            case 8:
                return this.writeCreateResponse(response);
            case 9:
                return this.writeMkdirResponse(response);
            case 10:
                return this.writeSymlinkResponse(response);
            case 11:
                return this.writeMknodResponse(response);
            case 12:
                return this.writeRemoveResponse(response);
            case 13:
                return this.writeRmdirResponse(response);
            case 14:
                return this.writeRenameResponse(response);
            case 15:
                return this.writeLinkResponse(response);
            case 16:
                return this.writeReaddirResponse(response);
            case 17:
                return this.writeReaddirplusResponse(response);
            case 18:
                return this.writeFsstatResponse(response);
            case 19:
                return this.writeFsinfoResponse(response);
            case 20:
                return this.writePathconfResponse(response);
            case 21:
                return this.writeCommitResponse(response);
            default:
                throw new errors_1.Nfsv3EncodingError(`Unknown procedure: ${proc}`);
        }
    }
    writeFh(fh) {
        this.xdr.writeVarlenOpaque(fh.data);
    }
    writeFilename(filename) {
        this.xdr.writeStr(filename);
    }
    writeTime(time) {
        const xdr = this.xdr;
        xdr.writeUnsignedInt(time.seconds);
        xdr.writeUnsignedInt(time.nseconds);
    }
    writeSpecData(spec) {
        const xdr = this.xdr;
        xdr.writeUnsignedInt(spec.specdata1);
        xdr.writeUnsignedInt(spec.specdata2);
    }
    writeFattr(attr) {
        const xdr = this.xdr;
        xdr.writeUnsignedInt(attr.type);
        xdr.writeUnsignedInt(attr.mode);
        xdr.writeUnsignedInt(attr.nlink);
        xdr.writeUnsignedInt(attr.uid);
        xdr.writeUnsignedInt(attr.gid);
        xdr.writeUnsignedHyper(attr.size);
        xdr.writeUnsignedHyper(attr.used);
        this.writeSpecData(attr.rdev);
        xdr.writeUnsignedHyper(attr.fsid);
        xdr.writeUnsignedHyper(attr.fileid);
        this.writeTime(attr.atime);
        this.writeTime(attr.mtime);
        this.writeTime(attr.ctime);
    }
    writePostOpAttr(attr) {
        this.xdr.writeBoolean(attr.attributesFollow);
        if (attr.attributesFollow && attr.attributes) {
            this.writeFattr(attr.attributes);
        }
    }
    writeWccAttr(attr) {
        this.xdr.writeUnsignedHyper(attr.size);
        this.writeTime(attr.mtime);
        this.writeTime(attr.ctime);
    }
    writePreOpAttr(attr) {
        this.xdr.writeBoolean(attr.attributesFollow);
        if (attr.attributesFollow && attr.attributes) {
            this.writeWccAttr(attr.attributes);
        }
    }
    writeWccData(wcc) {
        this.writePreOpAttr(wcc.before);
        this.writePostOpAttr(wcc.after);
    }
    writePostOpFh(fh) {
        this.xdr.writeBoolean(fh.handleFollows);
        if (fh.handleFollows && fh.handle) {
            this.writeFh(fh.handle);
        }
    }
    writeSetMode(setMode) {
        const xdr = this.xdr;
        xdr.writeBoolean(setMode.set);
        if (setMode.set && setMode.mode !== undefined) {
            xdr.writeUnsignedInt(setMode.mode);
        }
    }
    writeSetUid(setUid) {
        const xdr = this.xdr;
        xdr.writeBoolean(setUid.set);
        if (setUid.set && setUid.uid !== undefined) {
            xdr.writeUnsignedInt(setUid.uid);
        }
    }
    writeSetGid(setGid) {
        const xdr = this.xdr;
        xdr.writeBoolean(setGid.set);
        if (setGid.set && setGid.gid !== undefined) {
            xdr.writeUnsignedInt(setGid.gid);
        }
    }
    writeSetSize(setSize) {
        const xdr = this.xdr;
        xdr.writeBoolean(setSize.set);
        if (setSize.set && setSize.size !== undefined) {
            xdr.writeUnsignedHyper(setSize.size);
        }
    }
    writeSetAtime(setAtime) {
        this.xdr.writeUnsignedInt(setAtime.how);
        if (setAtime.how === 2 && setAtime.atime) {
            this.writeTime(setAtime.atime);
        }
    }
    writeSetMtime(setMtime) {
        const xdr = this.xdr;
        xdr.writeUnsignedInt(setMtime.how);
        if (setMtime.how === 2 && setMtime.mtime) {
            this.writeTime(setMtime.mtime);
        }
    }
    writeSattr(sattr) {
        this.writeSetMode(sattr.mode);
        this.writeSetUid(sattr.uid);
        this.writeSetGid(sattr.gid);
        this.writeSetSize(sattr.size);
        this.writeSetAtime(sattr.atime);
        this.writeSetMtime(sattr.mtime);
    }
    writeSattrGuard(guard) {
        const xdr = this.xdr;
        xdr.writeBoolean(guard.check);
        if (guard.check && guard.objCtime) {
            this.writeTime(guard.objCtime);
        }
    }
    writeDirOpArgs(args) {
        this.writeFh(args.dir);
        this.writeFilename(args.name);
    }
    writeCreateHow(how) {
        const xdr = this.xdr;
        xdr.writeUnsignedInt(how.mode);
        switch (how.mode) {
            case 0:
            case 1:
                if (how.objAttributes) {
                    this.writeSattr(how.objAttributes);
                }
                break;
            case 2:
                if (how.verf) {
                    xdr.writeOpaque(how.verf);
                }
                break;
        }
    }
    writeMknodData(data) {
        this.xdr.writeUnsignedInt(data.type);
        switch (data.type) {
            case 4:
                if (data.chr) {
                    this.writeSattr(data.chr.devAttributes);
                    this.writeSpecData(data.chr.spec);
                }
                break;
            case 3:
                if (data.blk) {
                    this.writeSattr(data.blk.devAttributes);
                    this.writeSpecData(data.blk.spec);
                }
                break;
            case 6:
                if (data.sock) {
                    this.writeSattr(data.sock);
                }
                break;
            case 7:
                if (data.pipe) {
                    this.writeSattr(data.pipe);
                }
                break;
        }
    }
    writeEntry(entry) {
        const xdr = this.xdr;
        if (!entry) {
            xdr.writeBoolean(false);
            return;
        }
        xdr.writeBoolean(true);
        xdr.writeUnsignedHyper(entry.fileid);
        this.writeFilename(entry.name);
        xdr.writeUnsignedHyper(entry.cookie);
        this.writeEntry(entry.nextentry);
    }
    writeEntryPlus(entry) {
        const xdr = this.xdr;
        if (!entry) {
            xdr.writeBoolean(false);
            return;
        }
        xdr.writeBoolean(true);
        xdr.writeUnsignedHyper(entry.fileid);
        this.writeFilename(entry.name);
        xdr.writeUnsignedHyper(entry.cookie);
        this.writePostOpAttr(entry.nameAttributes);
        this.writePostOpFh(entry.nameHandle);
        this.writeEntryPlus(entry.nextentry);
    }
    writeDirList(dirList) {
        this.writeEntry(dirList.entries);
        this.xdr.writeBoolean(dirList.eof);
    }
    writeDirListPlus(dirList) {
        this.writeEntryPlus(dirList.entries);
        this.xdr.writeBoolean(dirList.eof);
    }
    writeGetattrRequest(req) {
        this.writeFh(req.object);
    }
    writeGetattrResponse(res) {
        this.xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writeFattr(res.resok.objAttributes);
        }
    }
    writeSetattrRequest(req) {
        this.writeFh(req.object);
        this.writeSattr(req.newAttributes);
        this.writeSattrGuard(req.guard);
    }
    writeSetattrResponse(res) {
        this.xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writeWccData(res.resok.objWcc);
        }
        else if (res.resfail) {
            this.writeWccData(res.resfail.objWcc);
        }
    }
    writeLookupRequest(req) {
        this.writeDirOpArgs(req.what);
    }
    writeLookupResponse(res) {
        this.xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writeFh(res.resok.object);
            this.writePostOpAttr(res.resok.objAttributes);
            this.writePostOpAttr(res.resok.dirAttributes);
        }
        else if (res.resfail) {
            this.writePostOpAttr(res.resfail.dirAttributes);
        }
    }
    writeAccessRequest(req) {
        this.writeFh(req.object);
        this.xdr.writeUnsignedInt(req.access);
    }
    writeAccessResponse(res) {
        const xdr = this.xdr;
        xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writePostOpAttr(res.resok.objAttributes);
            xdr.writeUnsignedInt(res.resok.access);
        }
        else if (res.resfail) {
            this.writePostOpAttr(res.resfail.objAttributes);
        }
    }
    writeReadlinkRequest(req) {
        this.writeFh(req.symlink);
    }
    writeReadlinkResponse(res) {
        this.xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writePostOpAttr(res.resok.symlinkAttributes);
            this.writeFilename(res.resok.data);
        }
        else if (res.resfail) {
            this.writePostOpAttr(res.resfail.symlinkAttributes);
        }
    }
    writeReadRequest(req) {
        this.writeFh(req.file);
        const xdr = this.xdr;
        xdr.writeUnsignedHyper(req.offset);
        xdr.writeUnsignedInt(req.count);
    }
    writeReadResponse(res) {
        const xdr = this.xdr;
        xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writePostOpAttr(res.resok.fileAttributes);
            xdr.writeUnsignedInt(res.resok.count);
            xdr.writeBoolean(res.resok.eof);
            xdr.writeVarlenOpaque(res.resok.data);
        }
        else if (res.resfail) {
            this.writePostOpAttr(res.resfail.fileAttributes);
        }
    }
    writeWriteRequest(req) {
        this.writeFh(req.file);
        const xdr = this.xdr;
        xdr.writeUnsignedHyper(req.offset);
        xdr.writeUnsignedInt(req.count);
        xdr.writeUnsignedInt(req.stable);
        xdr.writeVarlenOpaque(req.data);
    }
    writeWriteResponse(res) {
        const xdr = this.xdr;
        xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writeWccData(res.resok.fileWcc);
            xdr.writeUnsignedInt(res.resok.count);
            xdr.writeUnsignedInt(res.resok.committed);
            xdr.writeOpaque(res.resok.verf);
        }
        else if (res.resfail) {
            this.writeWccData(res.resfail.fileWcc);
        }
    }
    writeCreateRequest(req) {
        this.writeDirOpArgs(req.where);
        this.writeCreateHow(req.how);
    }
    writeCreateResponse(res) {
        this.xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writePostOpFh(res.resok.obj);
            this.writePostOpAttr(res.resok.objAttributes);
            this.writeWccData(res.resok.dirWcc);
        }
        else if (res.resfail) {
            this.writeWccData(res.resfail.dirWcc);
        }
    }
    writeMkdirRequest(req) {
        this.writeDirOpArgs(req.where);
        this.writeSattr(req.attributes);
    }
    writeMkdirResponse(res) {
        this.xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writePostOpFh(res.resok.obj);
            this.writePostOpAttr(res.resok.objAttributes);
            this.writeWccData(res.resok.dirWcc);
        }
        else if (res.resfail) {
            this.writeWccData(res.resfail.dirWcc);
        }
    }
    writeSymlinkRequest(req) {
        this.writeDirOpArgs(req.where);
        this.writeSattr(req.symlinkAttributes);
        this.writeFilename(req.symlinkData);
    }
    writeSymlinkResponse(res) {
        this.xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writePostOpFh(res.resok.obj);
            this.writePostOpAttr(res.resok.objAttributes);
            this.writeWccData(res.resok.dirWcc);
        }
        else if (res.resfail) {
            this.writeWccData(res.resfail.dirWcc);
        }
    }
    writeMknodRequest(req) {
        this.writeDirOpArgs(req.where);
        this.writeMknodData(req.what);
    }
    writeMknodResponse(res) {
        this.xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writePostOpFh(res.resok.obj);
            this.writePostOpAttr(res.resok.objAttributes);
            this.writeWccData(res.resok.dirWcc);
        }
        else if (res.resfail) {
            this.writeWccData(res.resfail.dirWcc);
        }
    }
    writeRemoveRequest(req) {
        this.writeDirOpArgs(req.object);
    }
    writeRemoveResponse(res) {
        this.xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writeWccData(res.resok.dirWcc);
        }
        else if (res.resfail) {
            this.writeWccData(res.resfail.dirWcc);
        }
    }
    writeRmdirRequest(req) {
        this.writeDirOpArgs(req.object);
    }
    writeRmdirResponse(res) {
        this.xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writeWccData(res.resok.dirWcc);
        }
        else if (res.resfail) {
            this.writeWccData(res.resfail.dirWcc);
        }
    }
    writeRenameRequest(req) {
        this.writeDirOpArgs(req.from);
        this.writeDirOpArgs(req.to);
    }
    writeRenameResponse(res) {
        this.xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writeWccData(res.resok.fromDirWcc);
            this.writeWccData(res.resok.toDirWcc);
        }
        else if (res.resfail) {
            this.writeWccData(res.resfail.fromDirWcc);
            this.writeWccData(res.resfail.toDirWcc);
        }
    }
    writeLinkRequest(req) {
        this.writeFh(req.file);
        this.writeDirOpArgs(req.link);
    }
    writeLinkResponse(res) {
        this.xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writePostOpAttr(res.resok.fileAttributes);
            this.writeWccData(res.resok.linkDirWcc);
        }
        else if (res.resfail) {
            this.writePostOpAttr(res.resfail.fileAttributes);
            this.writeWccData(res.resfail.linkDirWcc);
        }
    }
    writeReaddirRequest(req) {
        this.writeFh(req.dir);
        const xdr = this.xdr;
        xdr.writeUnsignedHyper(req.cookie);
        xdr.writeOpaque(req.cookieverf);
        xdr.writeUnsignedInt(req.count);
    }
    writeReaddirResponse(res) {
        const xdr = this.xdr;
        xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writePostOpAttr(res.resok.dirAttributes);
            xdr.writeOpaque(res.resok.cookieverf);
            this.writeDirList(res.resok.reply);
        }
        else if (res.resfail) {
            this.writePostOpAttr(res.resfail.dirAttributes);
        }
    }
    writeReaddirplusRequest(req) {
        this.writeFh(req.dir);
        const xdr = this.xdr;
        xdr.writeUnsignedHyper(req.cookie);
        xdr.writeOpaque(req.cookieverf);
        xdr.writeUnsignedInt(req.dircount);
        xdr.writeUnsignedInt(req.maxcount);
    }
    writeReaddirplusResponse(res) {
        const xdr = this.xdr;
        xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writePostOpAttr(res.resok.dirAttributes);
            xdr.writeOpaque(res.resok.cookieverf);
            this.writeDirListPlus(res.resok.reply);
        }
        else if (res.resfail) {
            this.writePostOpAttr(res.resfail.dirAttributes);
        }
    }
    writeFsstatRequest(req) {
        this.writeFh(req.fsroot);
    }
    writeFsstatResponse(res) {
        const xdr = this.xdr;
        xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writePostOpAttr(res.resok.objAttributes);
            xdr.writeUnsignedHyper(res.resok.tbytes);
            xdr.writeUnsignedHyper(res.resok.fbytes);
            xdr.writeUnsignedHyper(res.resok.abytes);
            xdr.writeUnsignedHyper(res.resok.tfiles);
            xdr.writeUnsignedHyper(res.resok.ffiles);
            xdr.writeUnsignedHyper(res.resok.afiles);
            xdr.writeUnsignedInt(res.resok.invarsec);
        }
        else if (res.resfail) {
            this.writePostOpAttr(res.resfail.objAttributes);
        }
    }
    writeFsinfoRequest(req) {
        this.writeFh(req.fsroot);
    }
    writeFsinfoResponse(res) {
        const xdr = this.xdr;
        xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writePostOpAttr(res.resok.objAttributes);
            xdr.writeUnsignedInt(res.resok.rtmax);
            xdr.writeUnsignedInt(res.resok.rtpref);
            xdr.writeUnsignedInt(res.resok.rtmult);
            xdr.writeUnsignedInt(res.resok.wtmax);
            xdr.writeUnsignedInt(res.resok.wtpref);
            xdr.writeUnsignedInt(res.resok.wtmult);
            xdr.writeUnsignedInt(res.resok.dtpref);
            xdr.writeUnsignedHyper(res.resok.maxfilesize);
            xdr.writeUnsignedInt(res.resok.timeDelta.seconds);
            xdr.writeUnsignedInt(res.resok.timeDelta.nseconds);
            xdr.writeUnsignedInt(res.resok.properties);
        }
        else if (res.resfail) {
            this.writePostOpAttr(res.resfail.objAttributes);
        }
    }
    writePathconfRequest(req) {
        this.writeFh(req.object);
    }
    writePathconfResponse(res) {
        const xdr = this.xdr;
        xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writePostOpAttr(res.resok.objAttributes);
            xdr.writeUnsignedInt(res.resok.linkmax);
            xdr.writeUnsignedInt(res.resok.namemax);
            xdr.writeBoolean(res.resok.noTrunc);
            xdr.writeBoolean(res.resok.chownRestricted);
            xdr.writeBoolean(res.resok.caseInsensitive);
            xdr.writeBoolean(res.resok.casePreserving);
        }
        else if (res.resfail) {
            this.writePostOpAttr(res.resfail.objAttributes);
        }
    }
    writeCommitRequest(req) {
        this.writeFh(req.file);
        const xdr = this.xdr;
        xdr.writeUnsignedHyper(req.offset);
        xdr.writeUnsignedInt(req.count);
    }
    writeCommitResponse(res) {
        const xdr = this.xdr;
        xdr.writeUnsignedInt(res.status);
        if (res.status === 0 && res.resok) {
            this.writeWccData(res.resok.fileWcc);
            xdr.writeOpaque(res.resok.verf);
        }
        else if (res.resfail) {
            this.writeWccData(res.resfail.fileWcc);
        }
    }
}
exports.Nfsv3Encoder = Nfsv3Encoder;
//# sourceMappingURL=Nfsv3Encoder.js.map