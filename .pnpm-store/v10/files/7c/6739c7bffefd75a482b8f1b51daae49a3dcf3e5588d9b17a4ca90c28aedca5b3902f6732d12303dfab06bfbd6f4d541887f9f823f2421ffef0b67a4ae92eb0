"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Nfsv4FsClient = void 0;
const tslib_1 = require("tslib");
const builder_1 = require("../builder");
const structs = tslib_1.__importStar(require("../structs"));
const Writer_1 = require("@jsonjoy.com/buffers/lib/Writer");
const Reader_1 = require("@jsonjoy.com/buffers/lib/Reader");
const XdrEncoder_1 = require("../../../xdr/XdrEncoder");
const XdrDecoder_1 = require("../../../xdr/XdrDecoder");
const NfsFsStats_1 = require("./NfsFsStats");
const NfsFsDir_1 = require("./NfsFsDir");
const NfsFsDirent_1 = require("./NfsFsDirent");
const NfsFsFileHandle_1 = require("./NfsFsFileHandle");
class Nfsv4FsClient {
    constructor(fs) {
        this.fs = fs;
        this.openOwnerSeqids = new Map();
        this.defaultOpenOwnerId = new Uint8Array([1, 2, 3, 4]);
        this.closeStateid = async (openOwner, stateid) => {
            const key = this.makeOpenOwnerKey(openOwner);
            const previousSeqid = this.openOwnerSeqids.get(key);
            const seqid = this.nextOpenOwnerSeqid(openOwner);
            const response = await this.fs.compound([builder_1.nfs.CLOSE(seqid, stateid)]);
            if (response.status !== 0) {
                if (previousSeqid !== undefined) {
                    this.openOwnerSeqids.set(key, previousSeqid);
                }
                else {
                    this.openOwnerSeqids.delete(key);
                }
                throw new Error(`Failed to close file: ${response.status}`);
            }
        };
        this.readFile = async (id, options) => {
            const encoding = typeof options === 'string' ? options : options?.encoding;
            const path = typeof id === 'string' ? id : id.toString();
            const parts = this.parsePath(path);
            const operations = this.navigateToParent(parts);
            const filename = parts[parts.length - 1];
            const openOwner = this.createDefaultOpenOwner();
            const claim = builder_1.nfs.OpenClaimNull(filename);
            const openSeqid = this.nextOpenOwnerSeqid(openOwner);
            operations.push(builder_1.nfs.OPEN(openSeqid, 1, 0, openOwner, builder_1.nfs.OpenHowNoCreate(), claim));
            const openResponse = await this.fs.compound(operations);
            if (openResponse.status !== 0) {
                throw new Error(`Failed to open file: ${openResponse.status}`);
            }
            const openRes = openResponse.resarray[openResponse.resarray.length - 1];
            if (openRes.status !== 0 || !openRes.resok) {
                throw new Error(`Failed to open file: ${openRes.status}`);
            }
            const stateid = openRes.resok.stateid;
            const chunks = [];
            let offset = BigInt(0);
            const chunkSize = 65536;
            try {
                while (true) {
                    const readResponse = await this.fs.compound([builder_1.nfs.READ(offset, chunkSize, stateid)]);
                    if (readResponse.status !== 0) {
                        throw new Error(`Failed to read file: ${readResponse.status}`);
                    }
                    const readRes = readResponse.resarray[0];
                    if (readRes.status !== 0 || !readRes.resok) {
                        throw new Error(`Failed to read file: ${readRes.status}`);
                    }
                    if (readRes.resok.data.length > 0) {
                        chunks.push(readRes.resok.data);
                        offset += BigInt(readRes.resok.data.length);
                    }
                    if (readRes.resok.eof)
                        break;
                }
            }
            finally {
                await this.closeStateid(openOwner, stateid);
            }
            const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const result = new Uint8Array(totalLength);
            let position = 0;
            for (const chunk of chunks) {
                result.set(chunk, position);
                position += chunk.length;
            }
            return this.decodeData(result, encoding);
        };
        this.writeFile = async (id, data, options) => {
            const path = typeof id === 'string' ? id : id.toString();
            const parts = this.parsePath(path);
            const operations = this.navigateToParent(parts);
            const filename = parts[parts.length - 1];
            const openOwner = this.createDefaultOpenOwner();
            const claim = builder_1.nfs.OpenClaimNull(filename);
            const openSeqid = this.nextOpenOwnerSeqid(openOwner);
            operations.push(builder_1.nfs.OPEN(openSeqid, 2, 0, openOwner, builder_1.nfs.OpenHowCreateUnchecked(), claim));
            const writer = new Writer_1.Writer(16);
            const xdr = new XdrEncoder_1.XdrEncoder(writer);
            xdr.writeUnsignedHyper(BigInt(0));
            const attrVals = writer.flush();
            const truncateAttrs = builder_1.nfs.Fattr([4], attrVals);
            const stateid = builder_1.nfs.Stateid(0, new Uint8Array(12));
            operations.push(builder_1.nfs.SETATTR(stateid, truncateAttrs));
            const openResponse = await this.fs.compound(operations);
            if (openResponse.status !== 0) {
                throw new Error(`Failed to open file: ${openResponse.status}`);
            }
            const openRes = openResponse.resarray[openResponse.resarray.length - 2];
            if (openRes.status !== 0 || !openRes.resok) {
                throw new Error(`Failed to open file: ${openRes.status}`);
            }
            const openStateid = openRes.resok.stateid;
            const buffer = this.encodeData(data);
            const chunkSize = 65536;
            try {
                let offset = BigInt(0);
                for (let i = 0; i < buffer.length; i += chunkSize) {
                    const chunk = buffer.slice(i, Math.min(i + chunkSize, buffer.length));
                    const writeResponse = await this.fs.compound([
                        builder_1.nfs.WRITE(openStateid, offset, 2, chunk),
                    ]);
                    if (writeResponse.status !== 0) {
                        throw new Error(`Failed to write file: ${writeResponse.status}`);
                    }
                    const writeRes = writeResponse.resarray[0];
                    if (writeRes.status !== 0 || !writeRes.resok) {
                        throw new Error(`Failed to write file: ${writeRes.status}`);
                    }
                    offset += BigInt(writeRes.resok.count);
                }
            }
            finally {
                await this.closeStateid(openOwner, openStateid);
            }
        };
        this.stat = async (path, options) => {
            const pathStr = typeof path === 'string' ? path : path.toString();
            const parts = this.parsePath(pathStr);
            const operations = this.navigateToPath(parts);
            const attrNums = [
                1,
                4,
                20,
                33,
                35,
                45,
                47,
                53,
                52,
            ];
            const attrMask = this.attrNumsToBitmap(attrNums);
            operations.push(builder_1.nfs.GETATTR(attrMask));
            const response = await this.fs.compound(operations);
            if (response.status !== 0) {
                throw new Error(`Failed to stat file: ${response.status}`);
            }
            const getattrRes = response.resarray[response.resarray.length - 1];
            if (getattrRes.status !== 0 || !getattrRes.resok) {
                throw new Error(`Failed to get attributes: ${getattrRes.status}`);
            }
            const fattr = getattrRes.resok.objAttributes;
            const reader = new Reader_1.Reader();
            reader.reset(fattr.attrVals);
            const xdr = new XdrDecoder_1.XdrDecoder(reader);
            let fileType = 1;
            let size = 0;
            let fileid = 0;
            let mode = 0;
            let nlink = 1;
            let spaceUsed = 0;
            let atime = new Date(0);
            let mtime = new Date(0);
            let ctime = new Date(0);
            const returnedMask = fattr.attrmask.mask;
            for (let i = 0; i < returnedMask.length; i++) {
                const word = returnedMask[i];
                if (!word)
                    continue;
                for (let bit = 0; bit < 32; bit++) {
                    if (!(word & (1 << bit)))
                        continue;
                    const attrNum = i * 32 + bit;
                    switch (attrNum) {
                        case 1:
                            fileType = xdr.readUnsignedInt();
                            break;
                        case 4:
                            size = Number(xdr.readUnsignedHyper());
                            break;
                        case 20:
                            fileid = Number(xdr.readUnsignedHyper());
                            break;
                        case 33:
                            mode = xdr.readUnsignedInt();
                            break;
                        case 35:
                            nlink = xdr.readUnsignedInt();
                            break;
                        case 45:
                            spaceUsed = Number(xdr.readUnsignedHyper());
                            break;
                        case 47: {
                            const seconds = Number(xdr.readHyper());
                            const nseconds = xdr.readUnsignedInt();
                            atime = new Date(seconds * 1000 + nseconds / 1000000);
                            break;
                        }
                        case 53: {
                            const seconds = Number(xdr.readHyper());
                            const nseconds = xdr.readUnsignedInt();
                            mtime = new Date(seconds * 1000 + nseconds / 1000000);
                            break;
                        }
                        case 52: {
                            const seconds = Number(xdr.readHyper());
                            const nseconds = xdr.readUnsignedInt();
                            ctime = new Date(seconds * 1000 + nseconds / 1000000);
                            break;
                        }
                    }
                }
            }
            const blocks = Math.ceil(spaceUsed / 512);
            return new NfsFsStats_1.NfsFsStats(0, 0, 0, 4096, fileid, size, blocks, atime, mtime, ctime, mtime, atime.getTime(), mtime.getTime(), ctime.getTime(), mtime.getTime(), 0, mode, nlink, fileType);
        };
        this.lstat = async (path, options) => {
            return this.stat(path, options);
        };
        this.mkdir = async (path, options) => {
            const pathStr = typeof path === 'string' ? path : path.toString();
            const parts = this.parsePath(pathStr);
            if (parts.length === 0) {
                throw new Error('Cannot create root directory');
            }
            const operations = this.navigateToParent(parts);
            const dirname = parts[parts.length - 1];
            const createType = builder_1.nfs.CreateTypeDir();
            const emptyAttrs = builder_1.nfs.Fattr([], new Uint8Array(0));
            operations.push(builder_1.nfs.CREATE(createType, dirname, emptyAttrs));
            const response = await this.fs.compound(operations);
            if (response.status !== 0) {
                throw new Error(`Failed to create directory: ${response.status}`);
            }
            const createRes = response.resarray[response.resarray.length - 1];
            if (createRes.status !== 0) {
                throw new Error(`Failed to create directory: ${createRes.status}`);
            }
            return undefined;
        };
        this.readdir = async (path, options) => {
            const pathStr = typeof path === 'string' ? path : path.toString();
            const withFileTypes = typeof options === 'object' && options?.withFileTypes;
            const encoding = typeof options === 'string' ? options : options?.encoding;
            const parts = this.parsePath(pathStr);
            const operations = this.navigateToPath(parts);
            const attrNums = withFileTypes ? [1] : [];
            const attrMask = this.attrNumsToBitmap(attrNums);
            operations.push(builder_1.nfs.READDIR(attrMask));
            const response = await this.fs.compound(operations);
            if (response.status !== 0) {
                throw new Error(`Failed to read directory: ${response.status}`);
            }
            const readdirRes = response.resarray[response.resarray.length - 1];
            if (readdirRes.status !== 0 || !readdirRes.resok) {
                throw new Error(`Failed to read directory: ${readdirRes.status}`);
            }
            const entries = [];
            const dirents = [];
            const entryList = readdirRes.resok.entries;
            for (let i = 0; i < entryList.length; i++) {
                const entry = entryList[i];
                const name = entry.name;
                if (withFileTypes) {
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
                    dirents.push(new NfsFsDirent_1.NfsFsDirent(name, fileType));
                }
                else {
                    entries.push(name);
                }
            }
            if (withFileTypes) {
                return dirents;
            }
            if (encoding && encoding !== 'utf8') {
                return entries.map((name) => Buffer.from(name, 'utf8'));
            }
            return entries;
        };
        this.appendFile = async (path, data, options) => {
            const pathStr = typeof path === 'string' ? path : path.toString();
            const parts = this.parsePath(pathStr);
            const operations = this.navigateToParent(parts);
            const filename = parts[parts.length - 1];
            const openOwner = this.createDefaultOpenOwner();
            const claim = builder_1.nfs.OpenClaimNull(filename);
            const openSeqid = this.nextOpenOwnerSeqid(openOwner);
            operations.push(builder_1.nfs.OPEN(openSeqid, 2, 0, openOwner, builder_1.nfs.OpenHowNoCreate(), claim));
            const attrNums = [4];
            const attrMask = this.attrNumsToBitmap(attrNums);
            operations.push(builder_1.nfs.GETATTR(attrMask));
            const openResponse = await this.fs.compound(operations);
            if (openResponse.status !== 0) {
                throw new Error(`Failed to open file: ${openResponse.status}`);
            }
            const openRes = openResponse.resarray[openResponse.resarray.length - 2];
            if (openRes.status !== 0 || !openRes.resok) {
                throw new Error(`Failed to open file: ${openRes.status}`);
            }
            const getattrRes = openResponse.resarray[openResponse.resarray.length - 1];
            if (getattrRes.status !== 0 || !getattrRes.resok) {
                throw new Error(`Failed to get attributes: ${getattrRes.status}`);
            }
            const fattr = getattrRes.resok.objAttributes;
            const reader = new Reader_1.Reader();
            reader.reset(fattr.attrVals);
            const xdr = new XdrDecoder_1.XdrDecoder(reader);
            const currentSize = Number(xdr.readUnsignedHyper());
            const openStateid = openRes.resok.stateid;
            const buffer = this.encodeData(data);
            const chunkSize = 65536;
            try {
                let offset = BigInt(currentSize);
                for (let i = 0; i < buffer.length; i += chunkSize) {
                    const chunk = buffer.slice(i, Math.min(i + chunkSize, buffer.length));
                    const writeResponse = await this.fs.compound([
                        builder_1.nfs.WRITE(openStateid, offset, 2, chunk),
                    ]);
                    if (writeResponse.status !== 0) {
                        throw new Error(`Failed to write file: ${writeResponse.status}`);
                    }
                    const writeRes = writeResponse.resarray[0];
                    if (writeRes.status !== 0 || !writeRes.resok) {
                        throw new Error(`Failed to write file: ${writeRes.status}`);
                    }
                    offset += BigInt(writeRes.resok.count);
                }
            }
            finally {
                await this.closeStateid(openOwner, openStateid);
            }
        };
        this.truncate = async (path, len = 0) => {
            const pathStr = typeof path === 'string' ? path : path.toString();
            const parts = this.parsePath(pathStr);
            const operations = this.navigateToPath(parts);
            const writer = new Writer_1.Writer(16);
            const xdr = new XdrEncoder_1.XdrEncoder(writer);
            xdr.writeUnsignedHyper(BigInt(len));
            const attrVals = writer.flush();
            const sizeAttrs = builder_1.nfs.Fattr([4], attrVals);
            const stateid = builder_1.nfs.Stateid(0, new Uint8Array(12));
            operations.push(builder_1.nfs.SETATTR(stateid, sizeAttrs));
            const response = await this.fs.compound(operations);
            if (response.status !== 0) {
                throw new Error(`Failed to truncate file: ${response.status}`);
            }
            const setattrRes = response.resarray[response.resarray.length - 1];
            if (setattrRes.status !== 0) {
                throw new Error(`Failed to truncate file: ${setattrRes.status}`);
            }
        };
        this.unlink = async (path) => {
            const pathStr = typeof path === 'string' ? path : path.toString();
            const parts = this.parsePath(pathStr);
            if (parts.length === 0) {
                throw new Error('Cannot unlink root directory');
            }
            const operations = this.navigateToParent(parts);
            const filename = parts[parts.length - 1];
            operations.push(builder_1.nfs.REMOVE(filename));
            const response = await this.fs.compound(operations);
            if (response.status !== 0) {
                throw new Error(`Failed to unlink file: ${response.status}`);
            }
            const removeRes = response.resarray[response.resarray.length - 1];
            if (removeRes.status !== 0) {
                throw new Error(`Failed to unlink file: ${removeRes.status}`);
            }
        };
        this.rmdir = async (path, options) => {
            const pathStr = typeof path === 'string' ? path : path.toString();
            const parts = this.parsePath(pathStr);
            if (parts.length === 0) {
                throw new Error('Cannot remove root directory');
            }
            const operations = this.navigateToParent(parts);
            const dirname = parts[parts.length - 1];
            operations.push(builder_1.nfs.REMOVE(dirname));
            const response = await this.fs.compound(operations);
            if (response.status !== 0) {
                throw new Error(`Failed to remove directory: ${response.status}`);
            }
            const removeRes = response.resarray[response.resarray.length - 1];
            if (removeRes.status !== 0) {
                throw new Error(`Failed to remove directory: ${removeRes.status}`);
            }
        };
        this.rm = async (path, options) => {
            const pathStr = typeof path === 'string' ? path : path.toString();
            const parts = this.parsePath(pathStr);
            if (parts.length === 0) {
                throw new Error('Cannot remove root directory');
            }
            const force = options?.force ?? false;
            const recursive = options?.recursive ?? false;
            if (recursive) {
                try {
                    const stats = await this.stat(path);
                    if (stats.isDirectory()) {
                        const entries = await this.readdir(path);
                        for (const entry of entries) {
                            const entryPath = pathStr + '/' + entry;
                            await this.rm(entryPath, options);
                        }
                    }
                }
                catch (err) {
                    if (!force)
                        throw err;
                    return;
                }
            }
            try {
                const operations = this.navigateToParent(parts);
                const name = parts[parts.length - 1];
                operations.push(builder_1.nfs.REMOVE(name));
                const response = await this.fs.compound(operations);
                if (response.status !== 0) {
                    if (!force)
                        throw new Error(`Failed to remove: ${response.status}`);
                    return;
                }
                const removeRes = response.resarray[response.resarray.length - 1];
                if (removeRes.status !== 0) {
                    if (!force)
                        throw new Error(`Failed to remove: ${removeRes.status}`);
                }
            }
            catch (err) {
                if (!force)
                    throw err;
            }
        };
        this.access = async (path, mode = 0) => {
            const pathStr = typeof path === 'string' ? path : path.toString();
            const parts = this.parsePath(pathStr);
            const operations = this.navigateToPath(parts);
            let accessMask = 0;
            if (mode === 0) {
                accessMask = 1;
            }
            else {
                if (mode & 4)
                    accessMask |= 1;
                if (mode & 2)
                    accessMask |= 4;
                if (mode & 1)
                    accessMask |= 32;
            }
            operations.push(builder_1.nfs.ACCESS(accessMask));
            const response = await this.fs.compound(operations);
            if (response.status !== 0) {
                throw new Error(`Access denied: ${response.status}`);
            }
            const accessRes = response.resarray[response.resarray.length - 1];
            if (accessRes.status !== 0) {
                throw new Error(`Access denied: ${accessRes.status}`);
            }
        };
        this.rename = async (oldPath, newPath) => {
            const oldPathStr = typeof oldPath === 'string' ? oldPath : oldPath.toString();
            const newPathStr = typeof newPath === 'string' ? newPath : newPath.toString();
            const oldParts = this.parsePath(oldPathStr);
            const newParts = this.parsePath(newPathStr);
            if (oldParts.length === 0 || newParts.length === 0) {
                throw new Error('Cannot rename root directory');
            }
            const operations = [];
            operations.push(builder_1.nfs.PUTROOTFH());
            for (const part of oldParts.slice(0, -1)) {
                operations.push(builder_1.nfs.LOOKUP(part));
            }
            operations.push(builder_1.nfs.SAVEFH());
            operations.push(builder_1.nfs.PUTROOTFH());
            for (const part of newParts.slice(0, -1)) {
                operations.push(builder_1.nfs.LOOKUP(part));
            }
            const oldname = oldParts[oldParts.length - 1];
            const newname = newParts[newParts.length - 1];
            operations.push(builder_1.nfs.RENAME(oldname, newname));
            const response = await this.fs.compound(operations);
            if (response.status !== 0) {
                throw new Error(`Failed to rename: ${response.status}`);
            }
            const renameRes = response.resarray[response.resarray.length - 1];
            if (renameRes.status !== 0) {
                throw new Error(`Failed to rename: ${renameRes.status}`);
            }
        };
        this.copyFile = async (src, dest, flags) => {
            const data = await this.readFile(src);
            await this.writeFile(dest, data);
        };
        this.realpath = async (path, options) => {
            const encoding = typeof options === 'string' ? options : options?.encoding;
            const pathStr = typeof path === 'string' ? path : path.toString();
            const normalized = '/' + this.parsePath(pathStr).join('/');
            if (!encoding || encoding === 'utf8') {
                return normalized;
            }
            return Buffer.from(normalized, 'utf8');
        };
        this.link = async (existingPath, newPath) => {
            const existingPathStr = typeof existingPath === 'string' ? existingPath : existingPath.toString();
            const newPathStr = typeof newPath === 'string' ? newPath : newPath.toString();
            const existingParts = this.parsePath(existingPathStr);
            const newParts = this.parsePath(newPathStr);
            if (newParts.length === 0) {
                throw new Error('Cannot create link at root');
            }
            const operations = this.navigateToPath(existingParts);
            operations.push(builder_1.nfs.SAVEFH());
            operations.push(builder_1.nfs.PUTROOTFH());
            for (const part of newParts.slice(0, -1)) {
                operations.push(builder_1.nfs.LOOKUP(part));
            }
            const newname = newParts[newParts.length - 1];
            operations.push(builder_1.nfs.LINK(newname));
            const response = await this.fs.compound(operations);
            if (response.status !== 0) {
                throw new Error(`Failed to create link: ${response.status}`);
            }
            const linkRes = response.resarray[response.resarray.length - 1];
            if (linkRes.status !== 0) {
                throw new Error(`Failed to create link: ${linkRes.status}`);
            }
        };
        this.symlink = async (target, path, type) => {
            const targetStr = typeof target === 'string' ? target : target.toString();
            const pathStr = typeof path === 'string' ? path : path.toString();
            const parts = this.parsePath(pathStr);
            if (parts.length === 0) {
                throw new Error('Cannot create symlink at root');
            }
            const operations = this.navigateToParent(parts);
            const linkname = parts[parts.length - 1];
            const createType = new structs.Nfsv4CreateType(5, new structs.Nfsv4CreateTypeLink(targetStr));
            const emptyAttrs = builder_1.nfs.Fattr([], new Uint8Array(0));
            operations.push(builder_1.nfs.CREATE(createType, linkname, emptyAttrs));
            const response = await this.fs.compound(operations);
            if (response.status !== 0) {
                throw new Error(`Failed to create symlink: ${response.status}`);
            }
            const createRes = response.resarray[response.resarray.length - 1];
            if (createRes.status !== 0) {
                throw new Error(`Failed to create symlink: ${createRes.status}`);
            }
        };
        this.utimes = async (path, atime, mtime) => {
            const pathStr = typeof path === 'string' ? path : path.toString();
            const parts = this.parsePath(pathStr);
            const operations = this.navigateToPath(parts);
            const atimeMs = typeof atime === 'number' ? atime : atime instanceof Date ? atime.getTime() : Date.now();
            const mtimeMs = typeof mtime === 'number' ? mtime : mtime instanceof Date ? mtime.getTime() : Date.now();
            const writer = new Writer_1.Writer(64);
            const xdr = new XdrEncoder_1.XdrEncoder(writer);
            xdr.writeUnsignedInt(1);
            xdr.writeHyper(BigInt(Math.floor(atimeMs / 1000)));
            xdr.writeUnsignedInt((atimeMs % 1000) * 1000000);
            xdr.writeUnsignedInt(1);
            xdr.writeHyper(BigInt(Math.floor(mtimeMs / 1000)));
            xdr.writeUnsignedInt((mtimeMs % 1000) * 1000000);
            const attrVals = writer.flush();
            const timeAttrs = builder_1.nfs.Fattr([48, 54], attrVals);
            const stateid = builder_1.nfs.Stateid(0, new Uint8Array(12));
            operations.push(builder_1.nfs.SETATTR(stateid, timeAttrs));
            const response = await this.fs.compound(operations);
            if (response.status !== 0) {
                throw new Error(`Failed to set times: ${response.status}`);
            }
            const setattrRes = response.resarray[response.resarray.length - 1];
            if (setattrRes.status !== 0) {
                throw new Error(`Failed to set times: ${setattrRes.status}`);
            }
        };
        this.readlink = async (path, options) => {
            const encoding = typeof options === 'string' ? options : options?.encoding;
            const pathStr = typeof path === 'string' ? path : path.toString();
            const parts = this.parsePath(pathStr);
            const operations = this.navigateToPath(parts);
            operations.push(builder_1.nfs.READLINK());
            const response = await this.fs.compound(operations);
            if (response.status !== 0) {
                throw new Error(`Failed to read link: ${response.status}`);
            }
            const readlinkRes = response.resarray[response.resarray.length - 1];
            if (readlinkRes.status !== 0 || !readlinkRes.resok) {
                throw new Error(`Failed to read link: ${readlinkRes.status}`);
            }
            if (!encoding || encoding === 'utf8') {
                return readlinkRes.resok.link;
            }
            return Buffer.from(readlinkRes.resok.link, 'utf8');
        };
        this.opendir = async (path, options) => {
            const pathStr = typeof path === 'string' ? path : path.toString();
            const parts = this.parsePath(pathStr);
            const operations = this.navigateToPath(parts);
            return new NfsFsDir_1.NfsFsDir(pathStr, this.fs, operations);
        };
        this.mkdtemp = async (prefix, options) => {
            const encoding = typeof options === 'string' ? options : options?.encoding;
            const randomSuffix = Math.random().toString(36).substring(2, 8);
            const dirName = prefix + randomSuffix;
            await this.mkdir(dirName);
            if (!encoding || encoding === 'utf8')
                return dirName;
            return Buffer.from(dirName, 'utf8');
        };
        this.chmod = async (path, mode) => {
            const pathStr = typeof path === 'string' ? path : path.toString();
            const parts = this.parsePath(pathStr);
            const operations = this.navigateToPath(parts);
            const modeValue = typeof mode === 'number' ? mode : parseInt(mode.toString(), 8);
            const writer = new Writer_1.Writer(8);
            const xdr = new XdrEncoder_1.XdrEncoder(writer);
            xdr.writeUnsignedInt(modeValue);
            const attrVals = writer.flush();
            const attrs = builder_1.nfs.Fattr([33], attrVals);
            const stateid = builder_1.nfs.Stateid(0, new Uint8Array(12));
            operations.push(builder_1.nfs.SETATTR(stateid, attrs));
            const response = await this.fs.compound(operations);
            if (response.status !== 0) {
                throw new Error(`Failed to chmod: ${response.status}`);
            }
            const setattrRes = response.resarray[response.resarray.length - 1];
            if (setattrRes.status !== 0) {
                throw new Error(`Failed to chmod: ${setattrRes.status}`);
            }
        };
        this.chown = async (path, uid, gid) => {
            const pathStr = typeof path === 'string' ? path : path.toString();
            const parts = this.parsePath(pathStr);
            const operations = this.navigateToPath(parts);
            const writer = new Writer_1.Writer(64);
            const xdr = new XdrEncoder_1.XdrEncoder(writer);
            xdr.writeStr(uid.toString());
            xdr.writeStr(gid.toString());
            const attrVals = writer.flush();
            const attrs = builder_1.nfs.Fattr([36, 37], attrVals);
            const stateid = builder_1.nfs.Stateid(0, new Uint8Array(12));
            operations.push(builder_1.nfs.SETATTR(stateid, attrs));
            const response = await this.fs.compound(operations);
            if (response.status !== 0) {
                throw new Error(`Failed to chown: ${response.status}`);
            }
            const setattrRes = response.resarray[response.resarray.length - 1];
            if (setattrRes.status !== 0) {
                throw new Error(`Failed to chown: ${setattrRes.status}`);
            }
        };
        this.lchmod = async (path, mode) => {
            return this.chmod(path, mode);
        };
        this.lchown = async (path, uid, gid) => {
            return this.chown(path, uid, gid);
        };
        this.lutimes = async (path, atime, mtime) => {
            return this.utimes(path, atime, mtime);
        };
        this.open = async (path, flags, mode) => {
            const pathStr = typeof path === 'string' ? path : path.toString();
            const parts = this.parsePath(pathStr);
            const operations = this.navigateToParent(parts);
            const filename = parts[parts.length - 1];
            const openOwner = this.createDefaultOpenOwner();
            const claim = builder_1.nfs.OpenClaimNull(filename);
            let access = 1;
            const openSeqid = this.nextOpenOwnerSeqid(openOwner);
            if (typeof flags === 'string') {
                if (flags.includes('r') && flags.includes('+')) {
                    access = 3;
                }
                else if (flags.includes('w') || flags.includes('a')) {
                    access = 2;
                    if (flags.includes('+')) {
                        access = 3;
                    }
                }
            }
            else if (typeof flags === 'number') {
                const O_RDONLY = 0;
                const O_WRONLY = 1;
                const O_RDWR = 2;
                const O_ACCMODE = 3;
                const accessMode = flags & O_ACCMODE;
                switch (accessMode) {
                    case O_RDONLY:
                        access = 1;
                        break;
                    case O_WRONLY:
                        access = 2;
                        break;
                    case O_RDWR:
                        access = 3;
                        break;
                }
            }
            operations.push(builder_1.nfs.OPEN(openSeqid, access, 0, openOwner, builder_1.nfs.OpenHowNoCreate(), claim));
            const openResponse = await this.fs.compound(operations);
            if (openResponse.status !== 0) {
                throw new Error(`Failed to open file: ${openResponse.status}`);
            }
            const openRes = openResponse.resarray[openResponse.resarray.length - 1];
            if (openRes.status !== 0 || !openRes.resok) {
                throw new Error(`Failed to open file: ${openRes.status}`);
            }
            const stateid = openRes.resok.stateid;
            const fd = Math.floor(Math.random() * 1000000);
            return new NfsFsFileHandle_1.NfsFsFileHandle(fd, pathStr, this, stateid, openOwner);
        };
        this.statfs = (path, options) => {
            throw new Error('Not implemented.');
        };
        this.watch = (filename, options) => {
            throw new Error('Not implemented.');
        };
        this.glob = (pattern, options) => {
            throw new Error('Not implemented.');
        };
    }
    makeOpenOwnerKey(owner) {
        return `${owner.clientid}:${Buffer.from(owner.owner).toString('hex')}`;
    }
    nextOpenOwnerSeqid(owner) {
        const key = this.makeOpenOwnerKey(owner);
        const last = this.openOwnerSeqids.get(key);
        const next = last === undefined ? 0 : last === 0xffffffff ? 1 : (last + 1) >>> 0;
        this.openOwnerSeqids.set(key, next);
        return next;
    }
    createDefaultOpenOwner() {
        return builder_1.nfs.OpenOwner(BigInt(1), new Uint8Array(this.defaultOpenOwnerId));
    }
    attrNumsToBitmap(attrNums) {
        const bitmap = [];
        for (const attrNum of attrNums) {
            const wordIndex = Math.floor(attrNum / 32);
            const bitIndex = attrNum % 32;
            while (bitmap.length <= wordIndex) {
                bitmap.push(0);
            }
            bitmap[wordIndex] |= 1 << bitIndex;
        }
        return bitmap;
    }
    parsePath(path) {
        const normalized = path.replace(/^\/+/, '').replace(/\/+$/, '');
        if (!normalized)
            return [];
        return normalized.split('/').filter((part) => part.length > 0);
    }
    navigateToParent(parts) {
        const operations = [builder_1.nfs.PUTROOTFH()];
        for (const part of parts.slice(0, -1)) {
            operations.push(builder_1.nfs.LOOKUP(part));
        }
        return operations;
    }
    navigateToPath(parts) {
        const operations = [builder_1.nfs.PUTROOTFH()];
        for (const part of parts) {
            operations.push(builder_1.nfs.LOOKUP(part));
        }
        return operations;
    }
    encodeData(data) {
        if (data instanceof Uint8Array)
            return data;
        if (data instanceof ArrayBuffer)
            return new Uint8Array(data);
        if (typeof data === 'string')
            return new TextEncoder().encode(data);
        if (Buffer.isBuffer(data))
            return new Uint8Array(data);
        throw new Error('Unsupported data type');
    }
    decodeData(data, encoding) {
        if (!encoding || encoding === 'buffer')
            return Buffer.from(data);
        return new TextDecoder(encoding).decode(data);
    }
}
exports.Nfsv4FsClient = Nfsv4FsClient;
//# sourceMappingURL=Nfsv4FsClient.js.map