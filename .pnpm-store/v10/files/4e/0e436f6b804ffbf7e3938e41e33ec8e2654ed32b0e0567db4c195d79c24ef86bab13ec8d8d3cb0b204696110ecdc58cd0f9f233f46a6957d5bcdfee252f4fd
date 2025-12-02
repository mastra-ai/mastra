"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Nfsv4OperationsNode = void 0;
const tslib_1 = require("tslib");
const NodePath = tslib_1.__importStar(require("node:path"));
const node_crypto_1 = require("node:crypto");
const msg = tslib_1.__importStar(require("../../../messages"));
const struct = tslib_1.__importStar(require("../../../structs"));
const cmpUint8Array_1 = require("@jsonjoy.com/buffers/lib/cmpUint8Array");
const ClientRecord_1 = require("../ClientRecord");
const OpenFileState_1 = require("../OpenFileState");
const OpenOwnerState_1 = require("../OpenOwnerState");
const LockOwnerState_1 = require("../LockOwnerState");
const ByteRangeLock_1 = require("../ByteRangeLock");
const LockStateid_1 = require("../LockStateid");
const FilesystemStats_1 = require("../FilesystemStats");
const fh_1 = require("./fh");
const util_1 = require("./util");
const attrs_1 = require("./attrs");
const attributes_1 = require("../../../attributes");
const Writer_1 = require("@jsonjoy.com/buffers/lib/Writer");
const XdrEncoder_1 = require("../../../../../xdr/XdrEncoder");
const XdrDecoder_1 = require("../../../../../xdr/XdrDecoder");
class Nfsv4OperationsNode {
    constructor(opts) {
        this.leaseTime = 90;
        this.clients = new Map();
        this.pendingClients = new Map();
        this.nextClientId = 1n;
        this.bootStamp = Math.round(Math.random() * 0xffff);
        this.nextStateidSeqid = 1;
        this.openFiles = new Map();
        this.openOwners = new Map();
        this.locks = new Map();
        this.lockOwners = new Map();
        this.lockStateids = new Map();
        this.changeCounter = 0n;
        this.defaultFsStats = async () => {
            const twoTB = BigInt(2 * 1024 * 1024 * 1024 * 1024);
            const twoM = BigInt(2 * 1000 * 1000);
            return new FilesystemStats_1.FilesystemStats(twoTB, twoTB, twoTB * 2n, twoM, twoM, twoM * 2n);
        };
        this.fs = opts.fs;
        this.promises = this.fs.promises;
        this.dir = opts.dir;
        this.fh = new fh_1.FileHandleMapper(this.bootStamp, this.dir);
        this.maxClients = opts.maxClients ?? 1000;
        this.maxPendingClients = opts.maxPendingClients ?? 1000;
        this.fsStats = opts.fsStats ?? this.defaultFsStats;
    }
    findClientByIdString(map, clientIdString) {
        for (const entry of map.entries())
            if ((0, cmpUint8Array_1.cmpUint8Array)(entry[1].clientIdString, clientIdString))
                return entry;
        return;
    }
    enforceClientLimit() {
        if (this.clients.size <= this.maxClients)
            return;
        const firstKey = this.clients.keys().next().value;
        if (firstKey !== undefined)
            this.clients.delete(firstKey);
    }
    enforcePendingClientLimit() {
        if (this.pendingClients.size < this.maxPendingClients)
            return;
        const firstKey = this.pendingClients.keys().next().value;
        if (firstKey !== undefined)
            this.pendingClients.delete(firstKey);
    }
    makeOpenOwnerKey(clientid, owner) {
        return `${clientid}:${Buffer.from(owner).toString('hex')}`;
    }
    validateSeqid(requestSeqid, ownerSeqid) {
        const nextSeqid = ownerSeqid === 0xffffffff ? 1 : ownerSeqid + 1;
        if (requestSeqid === nextSeqid)
            return 'valid';
        if (requestSeqid === ownerSeqid)
            return 'replay';
        return 'invalid';
    }
    renewClientLease(clientid) {
        const client = this.clients.get(clientid);
        if (client) {
            client.lastRenew = Date.now();
        }
    }
    makeStateidKey(stateid) {
        return `${stateid.seqid}:${Buffer.from(stateid.other).toString('hex')}`;
    }
    createStateid() {
        const seqid = this.nextStateidSeqid++;
        const other = (0, node_crypto_1.randomBytes)(12);
        return new struct.Nfsv4Stateid(seqid, other);
    }
    canAccessFile(path, shareAccess, shareDeny) {
        for (const openFile of this.openFiles.values()) {
            if (openFile.path !== path)
                continue;
            if ((openFile.shareDeny & shareAccess) !== 0)
                return false;
            if ((shareDeny & openFile.shareAccess) !== 0)
                return false;
        }
        return true;
    }
    makeLockOwnerKey(clientid, owner) {
        return `${clientid}:${Buffer.from(owner).toString('hex')}`;
    }
    makeOpenRequestKey(ownerKey, currentPath, request) {
        const writer = new Writer_1.Writer(256);
        const encoder = new XdrEncoder_1.XdrEncoder(writer);
        request.encode(encoder);
        const requestBytes = writer.flush();
        const requestHex = Buffer.from(requestBytes).toString('hex');
        return `OPEN:${ownerKey}:${currentPath}:${requestHex}`;
    }
    makeLockRequestKey(lockOwnerKey, filePath, locktype, offset, length, seqid) {
        return `LOCK:${lockOwnerKey}:${filePath}:${locktype}:${offset.toString()}:${length.toString()}:${seqid}`;
    }
    makeLockuRequestKey(lockOwnerKey, stateid, offset, length, seqid) {
        const stateidKey = this.makeStateidKey(stateid);
        return `LOCKU:${lockOwnerKey}:${stateidKey}:${offset.toString()}:${length.toString()}:${seqid}`;
    }
    makeLockKey(stateid, offset, length) {
        return `${this.makeStateidKey(stateid)}:${offset}:${length}`;
    }
    makeLockStateidKey(lockOwnerKey, path) {
        return `${lockOwnerKey}:${path}`;
    }
    getOrCreateLockStateid(lockOwnerKey, path) {
        const key = this.makeLockStateidKey(lockOwnerKey, path);
        let lockStateid = this.lockStateids.get(key);
        if (!lockStateid) {
            const other = (0, node_crypto_1.randomBytes)(12);
            lockStateid = new LockStateid_1.LockStateid(other, 1, lockOwnerKey, path);
            this.lockStateids.set(key, lockStateid);
            const otherKey = Buffer.from(other).toString('hex');
            this.lockStateids.set(otherKey, lockStateid);
        }
        return lockStateid;
    }
    findLockStateidByOther(other) {
        const otherKey = Buffer.from(other).toString('hex');
        return this.lockStateids.get(otherKey);
    }
    hasConflictingLock(path, locktype, offset, length, ownerKey) {
        const isWriteLock = locktype === 2;
        for (const lock of this.locks.values()) {
            if (lock.path !== path)
                continue;
            if (!lock.overlaps(offset, length))
                continue;
            if (lock.lockOwnerKey === ownerKey)
                continue;
            if (isWriteLock || lock.locktype === 2)
                return true;
        }
        return false;
    }
    async SETCLIENTID(request, ctx) {
        const principal = ctx.getPrincipal();
        const verifier = request.client.verifier.data;
        const clientIdString = request.client.id;
        const callback = request.callback;
        const callbackIdent = request.callbackIdent;
        const confirmedClientEntry = this.findClientByIdString(this.clients, clientIdString);
        let clientid = 0n;
        if (confirmedClientEntry) {
            const existingRecord = confirmedClientEntry[1];
            if (existingRecord.principal !== principal)
                return new msg.Nfsv4SetclientidResponse(10017);
            this.pendingClients.delete(clientid);
            clientid = confirmedClientEntry[0];
            const verifierMatch = (0, cmpUint8Array_1.cmpUint8Array)(existingRecord.verifier, verifier);
            if (verifierMatch) {
            }
            else {
                clientid = this.nextClientId++;
            }
        }
        else {
            const pendingClientEntry = this.findClientByIdString(this.pendingClients, clientIdString);
            if (pendingClientEntry) {
                const existingRecord = pendingClientEntry[1];
                if (existingRecord.principal !== principal)
                    return new msg.Nfsv4SetclientidResponse(10017);
                const verifierMatch = (0, cmpUint8Array_1.cmpUint8Array)(existingRecord.verifier, verifier);
                if (verifierMatch && existingRecord.cache) {
                    return existingRecord.cache;
                }
            }
            clientid = this.nextClientId++;
        }
        const setclientidConfirm = (0, node_crypto_1.randomBytes)(8);
        const verifierStruct = new struct.Nfsv4Verifier(setclientidConfirm);
        const body = new msg.Nfsv4SetclientidResOk(clientid, verifierStruct);
        const response = new msg.Nfsv4SetclientidResponse(0, body);
        const newRecord = new ClientRecord_1.ClientRecord(principal, verifier, clientIdString, callback, callbackIdent, setclientidConfirm, response);
        for (const [id, entry] of this.pendingClients.entries())
            if ((0, cmpUint8Array_1.cmpUint8Array)(entry.clientIdString, clientIdString))
                this.pendingClients.delete(id);
        this.enforcePendingClientLimit();
        this.pendingClients.set(clientid, newRecord);
        return response;
    }
    async SETCLIENTID_CONFIRM(request, ctx) {
        const { clients, pendingClients } = this;
        const clientid = request.clientid;
        const setclientidConfirm = request.setclientidConfirm.data;
        const pendingRecord = pendingClients.get(clientid);
        if (!pendingRecord) {
            const confirmedRecord = this.clients.get(clientid);
            if (confirmedRecord && (0, cmpUint8Array_1.cmpUint8Array)(confirmedRecord.setclientidConfirm, setclientidConfirm))
                return new msg.Nfsv4SetclientidConfirmResponse(0);
            return new msg.Nfsv4SetclientidConfirmResponse(10022);
        }
        const principal = ctx.getPrincipal();
        if (pendingRecord.principal !== principal)
            return new msg.Nfsv4SetclientidConfirmResponse(10017);
        if (!(0, cmpUint8Array_1.cmpUint8Array)(pendingRecord.setclientidConfirm, setclientidConfirm))
            return new msg.Nfsv4SetclientidConfirmResponse(10022);
        const oldConfirmed = this.findClientByIdString(this.clients, pendingRecord.clientIdString);
        if (oldConfirmed) {
            const clientid2 = oldConfirmed[0];
            this.clients.delete(clientid2);
            pendingClients.delete(clientid2);
        }
        this.clients.delete(clientid);
        pendingClients.delete(clientid);
        const clientIdString = pendingRecord.clientIdString;
        for (const [id, entry] of pendingClients.entries())
            if ((0, cmpUint8Array_1.cmpUint8Array)(entry.clientIdString, clientIdString))
                pendingClients.delete(id);
        for (const [id, entry] of clients.entries())
            if ((0, cmpUint8Array_1.cmpUint8Array)(entry.clientIdString, clientIdString))
                clients.delete(id);
        this.enforceClientLimit();
        clients.set(clientid, pendingRecord);
        return new msg.Nfsv4SetclientidConfirmResponse(0);
    }
    async ILLEGAL(request, ctx) {
        ctx.connection.logger.log('ILLEGAL', request);
        return new msg.Nfsv4IllegalResponse(10044);
    }
    async PUTROOTFH(request, ctx) {
        ctx.cfh = fh_1.ROOT_FH;
        return new msg.Nfsv4PutrootfhResponse(0);
    }
    async PUTPUBFH(request, ctx) {
        ctx.cfh = fh_1.ROOT_FH;
        return new msg.Nfsv4PutpubfhResponse(0);
    }
    async PUTFH(request, ctx) {
        const fh = request.object.data;
        if (fh.length > 128)
            throw 10001;
        const valid = this.fh.validate(fh);
        if (!valid)
            throw 10001;
        ctx.cfh = fh;
        return new msg.Nfsv4PutfhResponse(0);
    }
    async GETFH(request, ctx) {
        const cfh = ctx.cfh;
        if (!cfh)
            throw 10020;
        const fh = new struct.Nfsv4Fh(cfh);
        const body = new msg.Nfsv4GetfhResOk(fh);
        return new msg.Nfsv4GetfhResponse(0, body);
    }
    async RESTOREFH(request, ctx) {
        if (!ctx.sfh)
            throw 10030;
        ctx.cfh = ctx.sfh;
        return new msg.Nfsv4RestorefhResponse(0);
    }
    async SAVEFH(request, ctx) {
        if (!ctx.cfh)
            throw 10020;
        ctx.sfh = ctx.cfh;
        return new msg.Nfsv4SavefhResponse(0);
    }
    absolutePath(path) {
        const dir = this.dir;
        if (path === dir)
            return dir;
        if (path.startsWith(dir + NodePath.sep) || path.startsWith(dir + '/'))
            return path;
        const absolutePath = NodePath.join(dir, path);
        if (absolutePath.length < dir.length)
            throw 2;
        if (!absolutePath.startsWith(dir))
            throw 2;
        return absolutePath;
    }
    async LOOKUP(request, ctx) {
        const fh = this.fh;
        const currentPath = fh.currentPath(ctx);
        const currentPathAbsolute = this.absolutePath(currentPath);
        const component = request.objname;
        if (component.length === 0)
            throw 22;
        const promises = this.promises;
        let stats;
        try {
            stats = await promises.stat(currentPathAbsolute);
        }
        catch (err) {
            if ((0, util_1.isErrCode)('ENOENT', err))
                throw 2;
            throw 5;
        }
        if (stats.isSymbolicLink())
            throw 10029;
        if (!stats.isDirectory())
            throw 20;
        const targetAbsolutePath = NodePath.join(currentPathAbsolute, component);
        try {
            const targetStats = await promises.stat(targetAbsolutePath);
            if (!targetStats)
                throw 2;
        }
        catch (err) {
            if ((0, util_1.isErrCode)('ENOENT', err))
                throw 2;
            if ((0, util_1.isErrCode)('EACCES', err))
                throw 13;
            throw 5;
        }
        fh.setCfh(ctx, targetAbsolutePath);
        return new msg.Nfsv4LookupResponse(0);
    }
    async LOOKUPP(request, ctx) {
        const fh = this.fh;
        const currentPath = fh.currentPath(ctx);
        const currentPathAbsolute = this.absolutePath(currentPath);
        const promises = this.promises;
        let stats;
        try {
            stats = await promises.stat(currentPathAbsolute);
        }
        catch (err) {
            if ((0, util_1.isErrCode)('ENOENT', err))
                throw 2;
            throw 5;
        }
        if (!stats.isDirectory())
            throw 20;
        const parentAbsolutePath = NodePath.dirname(currentPathAbsolute);
        if (parentAbsolutePath.length < this.dir.length)
            throw 2;
        fh.setCfh(ctx, parentAbsolutePath);
        return new msg.Nfsv4LookuppResponse(0);
    }
    async GETATTR(request, ctx) {
        const currentPath = this.fh.currentPath(ctx);
        const currentPathAbsolute = this.absolutePath(currentPath);
        const requestedAttrNums = (0, attributes_1.parseBitmask)(request.attrRequest.mask);
        let stats;
        if ((0, attributes_1.requiresLstat)(requestedAttrNums)) {
            try {
                if (ctx.connection.debug)
                    ctx.connection.logger.log('lstat', currentPathAbsolute);
                stats = await this.promises.lstat(currentPathAbsolute);
            }
            catch (error) {
                throw (0, util_1.normalizeNodeFsError)(error, ctx.connection.logger);
            }
        }
        let fsStats;
        if ((0, attributes_1.requiresFsStats)(requestedAttrNums)) {
            try {
                fsStats = await this.fsStats();
            }
            catch (error) {
                ctx.connection.logger.error(error);
            }
        }
        const attrs = (0, attrs_1.encodeAttrs)(request.attrRequest, stats, currentPath, ctx.cfh, this.leaseTime, fsStats);
        return new msg.Nfsv4GetattrResponse(0, new msg.Nfsv4GetattrResOk(attrs));
    }
    async ACCESS(request, ctx) {
        const currentPath = this.fh.currentPath(ctx);
        const currentPathAbsolute = this.absolutePath(currentPath);
        const promises = this.promises;
        let stats;
        try {
            stats = await promises.lstat(currentPathAbsolute);
        }
        catch (error) {
            throw (0, util_1.normalizeNodeFsError)(error, ctx.connection.logger);
        }
        const requestedAccess = request.access;
        const isDirectory = stats.isDirectory();
        const mode = stats.mode;
        let supported = 0;
        let access = 0;
        if (requestedAccess & 1) {
            supported |= 1;
            if (mode & 0o444)
                access |= 1;
        }
        if (requestedAccess & 2) {
            supported |= 2;
            if (isDirectory && mode & 0o111)
                access |= 2;
        }
        if (requestedAccess & 4) {
            supported |= 4;
            if (mode & 0o222)
                access |= 4;
        }
        if (requestedAccess & 8) {
            supported |= 8;
            if (mode & 0o222)
                access |= 8;
        }
        if (requestedAccess & 16) {
            if (!isDirectory) {
                supported |= 0;
            }
            else {
                supported |= 16;
                if (mode & 0o222)
                    access |= 16;
            }
        }
        if (requestedAccess & 32) {
            supported |= 32;
            if (!isDirectory && mode & 0o111)
                access |= 32;
        }
        const body = new msg.Nfsv4AccessResOk(supported, access);
        return new msg.Nfsv4AccessResponse(0, body);
    }
    async READDIR(request, ctx) {
        const fh = this.fh;
        const currentPath = fh.currentPath(ctx);
        const currentPathAbsolute = this.absolutePath(currentPath);
        const promises = this.promises;
        let stats;
        try {
            stats = await promises.lstat(currentPathAbsolute);
        }
        catch (error) {
            throw (0, util_1.normalizeNodeFsError)(error, ctx.connection.logger);
        }
        if (!stats.isDirectory())
            throw 20;
        const cookie = request.cookie;
        const requestedCookieverf = request.cookieverf.data;
        const maxcount = request.maxcount;
        const attrRequest = request.attrRequest;
        let cookieverf;
        if (cookie === 0n) {
            cookieverf = new Uint8Array(8);
            const changeTime = BigInt(Math.floor(stats.mtimeMs * 1000000));
            const view = new DataView(cookieverf.buffer);
            view.setBigUint64(0, changeTime, false);
        }
        else {
            cookieverf = new Uint8Array(8);
            const changeTime = BigInt(Math.floor(stats.mtimeMs * 1000000));
            const view = new DataView(cookieverf.buffer);
            view.setBigUint64(0, changeTime, false);
            if (!(0, cmpUint8Array_1.cmpUint8Array)(requestedCookieverf, cookieverf))
                throw 10027;
        }
        let dirents;
        try {
            dirents = await promises.readdir(currentPathAbsolute, { withFileTypes: true });
        }
        catch (error) {
            throw (0, util_1.normalizeNodeFsError)(error, ctx.connection.logger);
        }
        const entries = [];
        let totalBytes = 0;
        const overheadPerEntry = 32;
        let startIndex = 0;
        if (cookie > 0n) {
            startIndex = Number(cookie) - 2;
            if (startIndex < 0)
                startIndex = 0;
            if (startIndex > dirents.length)
                startIndex = dirents.length;
        }
        let eof = true;
        const fsStats = await this.fsStats();
        for (let i = startIndex; i < dirents.length; i++) {
            const dirent = dirents[i];
            const name = dirent.name;
            const entryCookie = BigInt(i + 3);
            const entryPath = NodePath.join(currentPathAbsolute, name);
            let entryStats;
            try {
                entryStats = await promises.lstat(entryPath);
            }
            catch (error) {
                continue;
            }
            const entryFh = fh.encode(entryPath);
            const attrs = (0, attrs_1.encodeAttrs)(attrRequest, entryStats, entryPath, entryFh, this.leaseTime, fsStats);
            const nameBytes = Buffer.byteLength(name, 'utf8');
            const attrBytes = attrs.attrVals.length;
            const entryBytes = overheadPerEntry + nameBytes + attrBytes;
            if (totalBytes + entryBytes > maxcount && entries.length > 0) {
                eof = false;
                break;
            }
            const entry = new struct.Nfsv4Entry(entryCookie, name, attrs);
            entries.push(entry);
            totalBytes += entryBytes;
        }
        const cookieverf2 = new struct.Nfsv4Verifier(cookieverf);
        const body = new msg.Nfsv4ReaddirResOk(cookieverf2, entries, eof);
        return new msg.Nfsv4ReaddirResponse(0, body);
    }
    async OPEN(request, ctx) {
        const currentPath = this.fh.currentPath(ctx);
        const currentPathAbsolute = this.absolutePath(currentPath);
        const ownerKey = this.makeOpenOwnerKey(request.owner.clientid, request.owner.owner);
        this.renewClientLease(request.owner.clientid);
        let ownerState = this.openOwners.get(ownerKey);
        let replayCandidate = false;
        let previousSeqid = ownerState?.seqid ?? 0;
        if (!ownerState) {
            ownerState = new OpenOwnerState_1.OpenOwnerState(request.owner.clientid, request.owner.owner, 0);
            this.openOwners.set(ownerKey, ownerState);
            previousSeqid = 0;
        }
        else {
            const seqidValidation = this.validateSeqid(request.seqid, ownerState.seqid);
            if (seqidValidation === 'invalid') {
                if (request.seqid === 0) {
                    ownerState.seqid = 0;
                    previousSeqid = 0;
                }
                else {
                    return new msg.Nfsv4OpenResponse(10026);
                }
            }
            else if (seqidValidation === 'replay') {
                replayCandidate = true;
            }
        }
        if (request.claim.claimType !== 0) {
            return new msg.Nfsv4OpenResponse(10004);
        }
        const claimNull = request.claim.claim;
        const filename = claimNull.file;
        const filePath = NodePath.join(currentPathAbsolute, filename);
        const requestKey = this.makeOpenRequestKey(ownerKey, filePath, request);
        if (replayCandidate) {
            if (ownerState.lastRequestKey === requestKey && ownerState.lastResponse) {
                return ownerState.lastResponse;
            }
            return new msg.Nfsv4OpenResponse(10026);
        }
        ownerState.seqid = request.seqid;
        const opentype = request.openhow.opentype;
        const isCreate = opentype === 1;
        let fileExists = false;
        try {
            const stats = await this.promises.lstat(filePath);
            if (!stats.isFile()) {
                const response = new msg.Nfsv4OpenResponse(21);
                ownerState.lastResponse = response;
                ownerState.lastRequestKey = requestKey;
                return response;
            }
            fileExists = true;
        }
        catch (err) {
            if ((0, util_1.isErrCode)('ENOENT', err)) {
                if (!isCreate) {
                    const response = new msg.Nfsv4OpenResponse(2);
                    ownerState.lastResponse = response;
                    ownerState.lastRequestKey = requestKey;
                    return response;
                }
            }
            else {
                const status = (0, util_1.normalizeNodeFsError)(err, ctx.connection.logger);
                const response = new msg.Nfsv4OpenResponse(status);
                ownerState.lastResponse = response;
                ownerState.lastRequestKey = requestKey;
                return response;
            }
        }
        if (fileExists && !this.canAccessFile(filePath, request.shareAccess, request.shareDeny)) {
            ownerState.seqid = previousSeqid;
            const response = new msg.Nfsv4OpenResponse(10015);
            ownerState.lastResponse = response;
            ownerState.lastRequestKey = requestKey;
            return response;
        }
        let flags = 0;
        const isWrite = (request.shareAccess & 2) !== 0;
        const isRead = (request.shareAccess & 1) !== 0;
        if (isCreate) {
            flags = this.fs.constants.O_CREAT;
            const createHow = request.openhow.how;
            if (createHow && createHow.mode === 2) {
                flags |= this.fs.constants.O_EXCL;
            }
        }
        if (isRead && isWrite) {
            flags |= this.fs.constants.O_RDWR;
        }
        else if (isWrite) {
            flags |= this.fs.constants.O_WRONLY;
        }
        else {
            flags |= this.fs.constants.O_RDONLY;
        }
        try {
            const fd = await this.promises.open(filePath, flags, 0o644);
            const stateid = this.createStateid();
            const stateidKey = this.makeStateidKey(stateid);
            const openFile = new OpenFileState_1.OpenFileState(stateid, filePath, fd, request.shareAccess, request.shareDeny, ownerKey, ownerState.seqid, false);
            this.openFiles.set(stateidKey, openFile);
            ownerState.opens.add(stateidKey);
            const fh = this.fh.encode(filePath);
            ctx.cfh = fh;
            const before = this.changeCounter;
            const after = ++this.changeCounter;
            const cinfo = new struct.Nfsv4ChangeInfo(true, before, after);
            const attrset = new struct.Nfsv4Bitmap([]);
            const delegation = new struct.Nfsv4OpenDelegation(0);
            const resok = new msg.Nfsv4OpenResOk(stateid, cinfo, 0, attrset, delegation);
            const response = new msg.Nfsv4OpenResponse(0, resok);
            ownerState.lastResponse = response;
            ownerState.lastRequestKey = requestKey;
            return response;
        }
        catch (err) {
            const status = (0, util_1.normalizeNodeFsError)(err, ctx.connection.logger);
            const response = new msg.Nfsv4OpenResponse(status);
            ownerState.lastResponse = response;
            ownerState.lastRequestKey = requestKey;
            return response;
        }
    }
    async OPENATTR(request, ctx) {
        return new msg.Nfsv4OpenattrResponse(10004);
    }
    async OPEN_CONFIRM(request, ctx) {
        const stateidKey = this.makeStateidKey(request.openStateid);
        const openFile = this.openFiles.get(stateidKey);
        if (!openFile)
            throw 10025;
        const ownerState = this.openOwners.get(openFile.openOwnerKey);
        if (!ownerState)
            throw 10025;
        const seqidValidation = this.validateSeqid(request.seqid, ownerState.seqid);
        if (seqidValidation === 'invalid')
            throw 10026;
        if (seqidValidation === 'replay') {
            const newStateid = new struct.Nfsv4Stateid(openFile.stateid.seqid, openFile.stateid.other);
            const resok = new msg.Nfsv4OpenConfirmResOk(newStateid);
            return new msg.Nfsv4OpenConfirmResponse(0, resok);
        }
        ownerState.seqid = request.seqid;
        openFile.confirmed = true;
        const newSeqid = this.nextStateidSeqid++;
        const newStateid = new struct.Nfsv4Stateid(newSeqid, openFile.stateid.other);
        const oldKey = stateidKey;
        const newKey = this.makeStateidKey(newStateid);
        const updatedOpenFile = new OpenFileState_1.OpenFileState(newStateid, openFile.path, openFile.fd, openFile.shareAccess, openFile.shareDeny, openFile.openOwnerKey, ownerState.seqid, true);
        this.openFiles.delete(oldKey);
        this.openFiles.set(newKey, updatedOpenFile);
        ownerState.opens.delete(oldKey);
        ownerState.opens.add(newKey);
        const resok = new msg.Nfsv4OpenConfirmResOk(newStateid);
        return new msg.Nfsv4OpenConfirmResponse(0, resok);
    }
    async OPEN_DOWNGRADE(request, ctx) {
        const stateidKey = this.makeStateidKey(request.openStateid);
        const openFile = this.openFiles.get(stateidKey);
        if (!openFile)
            throw 10025;
        const ownerState = this.openOwners.get(openFile.openOwnerKey);
        if (!ownerState)
            throw 10025;
        const seqidValidation = this.validateSeqid(request.seqid, ownerState.seqid);
        if (seqidValidation === 'invalid')
            throw 10026;
        if (seqidValidation === 'replay') {
            const newStateid = new struct.Nfsv4Stateid(openFile.stateid.seqid, openFile.stateid.other);
            const resok = new msg.Nfsv4OpenDowngradeResOk(newStateid);
            return new msg.Nfsv4OpenDowngradeResponse(0, resok);
        }
        ownerState.seqid = request.seqid;
        if ((request.shareAccess & ~openFile.shareAccess) !== 0)
            throw 22;
        if ((request.shareDeny & ~openFile.shareDeny) !== 0)
            throw 22;
        const newSeqid = this.nextStateidSeqid++;
        const newStateid = new struct.Nfsv4Stateid(newSeqid, openFile.stateid.other);
        const oldKey = stateidKey;
        const newKey = this.makeStateidKey(newStateid);
        const updatedOpenFile = new OpenFileState_1.OpenFileState(newStateid, openFile.path, openFile.fd, request.shareAccess, request.shareDeny, openFile.openOwnerKey, ownerState.seqid, openFile.confirmed);
        this.openFiles.delete(oldKey);
        this.openFiles.set(newKey, updatedOpenFile);
        ownerState.opens.delete(oldKey);
        ownerState.opens.add(newKey);
        const resok = new msg.Nfsv4OpenDowngradeResOk(newStateid);
        return new msg.Nfsv4OpenDowngradeResponse(0, resok);
    }
    async CLOSE(request, ctx) {
        const stateidKey = this.makeStateidKey(request.openStateid);
        const openFile = this.openFiles.get(stateidKey);
        if (!openFile) {
            return new msg.Nfsv4CloseResponse(0, new msg.Nfsv4CloseResOk(request.openStateid));
        }
        const ownerState = this.openOwners.get(openFile.openOwnerKey);
        if (!ownerState) {
            return new msg.Nfsv4CloseResponse(10025);
        }
        this.renewClientLease(ownerState.clientid);
        const seqidValidation = this.validateSeqid(request.seqid, ownerState.seqid);
        if (seqidValidation === 'invalid') {
            return new msg.Nfsv4CloseResponse(10026);
        }
        if (seqidValidation === 'replay') {
            const newStateid = new struct.Nfsv4Stateid(openFile.stateid.seqid, openFile.stateid.other);
            const resok = new msg.Nfsv4CloseResOk(newStateid);
            return new msg.Nfsv4CloseResponse(0, resok);
        }
        ownerState.seqid = request.seqid;
        try {
            const handle = openFile.fd;
            if (handle && typeof handle.close === 'function') {
                await handle.close();
            }
        }
        catch (err) {
            const status = (0, util_1.normalizeNodeFsError)(err, ctx.connection.logger);
            if (status !== 2) {
                return new msg.Nfsv4CloseResponse(status);
            }
        }
        ownerState.opens.delete(stateidKey);
        if (ownerState.opens.size === 0) {
            this.openOwners.delete(openFile.openOwnerKey);
        }
        this.openFiles.delete(stateidKey);
        const newSeqid = this.nextStateidSeqid++;
        const newStateid = new struct.Nfsv4Stateid(newSeqid, openFile.stateid.other);
        const resok = new msg.Nfsv4CloseResOk(newStateid);
        return new msg.Nfsv4CloseResponse(0, resok);
    }
    async SECINFO(request, ctx) {
        const currentPath = this.fh.currentPath(ctx);
        const currentPathAbsolute = this.absolutePath(currentPath);
        const filePath = NodePath.join(currentPathAbsolute, request.name);
        try {
            await this.promises.lstat(filePath);
        }
        catch (err) {
            if ((0, util_1.isErrCode)(err, 'ENOENT')) {
                return new msg.Nfsv4SecinfoResponse(2);
            }
            const status = (0, util_1.normalizeNodeFsError)(err, ctx.connection.logger);
            return new msg.Nfsv4SecinfoResponse(status);
        }
        const flavors = [new struct.Nfsv4SecInfoFlavor(1)];
        const resok = new msg.Nfsv4SecinfoResOk(flavors);
        return new msg.Nfsv4SecinfoResponse(0, resok);
    }
    async LOCK(request, ctx) {
        const currentPath = this.fh.currentPath(ctx);
        const { locktype, offset, length, locker } = request;
        if (!locker.newLockOwner) {
            const existingOwner = locker.owner;
            const stateidKey = this.makeStateidKey(existingOwner.lockStateid);
            let existingLockOwnerKey;
            for (const lock of this.locks.values()) {
                if (this.makeStateidKey(lock.stateid) === stateidKey) {
                    existingLockOwnerKey = lock.lockOwnerKey;
                    break;
                }
            }
            if (!existingLockOwnerKey) {
                return new msg.Nfsv4LockResponse(10025);
            }
            const lockOwnerState = this.lockOwners.get(existingLockOwnerKey);
            if (!lockOwnerState) {
                return new msg.Nfsv4LockResponse(10025);
            }
            this.renewClientLease(lockOwnerState.clientid);
            const seqidValidation = this.validateSeqid(existingOwner.lockSeqid, lockOwnerState.seqid);
            const requestKey = this.makeLockRequestKey(existingLockOwnerKey, currentPath, locktype, offset, length, existingOwner.lockSeqid);
            if (seqidValidation === 'invalid') {
                return new msg.Nfsv4LockResponse(10026);
            }
            if (seqidValidation === 'replay') {
                if (lockOwnerState.lastRequestKey !== requestKey) {
                    return new msg.Nfsv4LockResponse(10026);
                }
                if (lockOwnerState.lastResponse)
                    return lockOwnerState.lastResponse;
                return new msg.Nfsv4LockResponse(10026);
            }
            lockOwnerState.seqid = existingOwner.lockSeqid;
            if (this.hasConflictingLock(currentPath, locktype, offset, length, existingLockOwnerKey)) {
                const conflictOwner = new struct.Nfsv4LockOwner(BigInt(0), new Uint8Array());
                const denied = new msg.Nfsv4LockResDenied(offset, length, locktype, conflictOwner);
                return new msg.Nfsv4LockResponse(10010, undefined, denied);
            }
            const lockStateid = this.getOrCreateLockStateid(existingLockOwnerKey, currentPath);
            const stateid = lockStateid.incrementAndGetStateid();
            const lock = new ByteRangeLock_1.ByteRangeLock(stateid, currentPath, locktype, offset, length, existingLockOwnerKey);
            const lockKey = this.makeLockKey(stateid, offset, length);
            this.locks.set(lockKey, lock);
            lockOwnerState.locks.add(lockKey);
            const resok = new msg.Nfsv4LockResOk(stateid);
            const response = new msg.Nfsv4LockResponse(0, resok);
            lockOwnerState.lastResponse = response;
            lockOwnerState.lastRequestKey = requestKey;
            return response;
        }
        const newOwner = locker.owner;
        const openToLock = newOwner.openToLockOwner;
        const lockOwnerData = openToLock.lockOwner;
        const openStateidKey = this.makeStateidKey(openToLock.openStateid);
        const openFile = this.openFiles.get(openStateidKey);
        if (!openFile) {
            return new msg.Nfsv4LockResponse(10025);
        }
        const openOwnerKey = openFile.openOwnerKey;
        const openOwnerState = this.openOwners.get(openOwnerKey);
        if (!openOwnerState) {
            return new msg.Nfsv4LockResponse(10025);
        }
        this.renewClientLease(lockOwnerData.clientid);
        const seqidValidation = this.validateSeqid(openToLock.openSeqid, openOwnerState.seqid);
        if (seqidValidation === 'invalid') {
            return new msg.Nfsv4LockResponse(10026);
        }
        if (seqidValidation === 'replay') {
            for (const [key, lock] of this.locks.entries()) {
                if (lock.lockOwnerKey === this.makeLockOwnerKey(lockOwnerData.clientid, lockOwnerData.owner) &&
                    lock.path === currentPath &&
                    lock.offset === offset &&
                    lock.length === length) {
                    const resok = new msg.Nfsv4LockResOk(lock.stateid);
                    return new msg.Nfsv4LockResponse(0, resok);
                }
            }
        }
        openOwnerState.seqid = openToLock.openSeqid;
        const lockOwnerKey = this.makeLockOwnerKey(lockOwnerData.clientid, lockOwnerData.owner);
        const lockRequestKey = this.makeLockRequestKey(lockOwnerKey, currentPath, locktype, offset, length, openToLock.lockSeqid);
        if (this.hasConflictingLock(currentPath, locktype, offset, length, lockOwnerKey)) {
            const conflictOwner = new struct.Nfsv4LockOwner(BigInt(0), new Uint8Array());
            const denied = new msg.Nfsv4LockResDenied(offset, length, locktype, conflictOwner);
            return new msg.Nfsv4LockResponse(10010, undefined, denied);
        }
        let lockOwnerState = this.lockOwners.get(lockOwnerKey);
        if (!lockOwnerState) {
            if (openToLock.lockSeqid !== 0) {
                return new msg.Nfsv4LockResponse(10026);
            }
            lockOwnerState = new LockOwnerState_1.LockOwnerState(lockOwnerData.clientid, lockOwnerData.owner, 0);
            this.lockOwners.set(lockOwnerKey, lockOwnerState);
        }
        else {
            const lockSeqidValidation = this.validateSeqid(openToLock.lockSeqid, lockOwnerState.seqid);
            if (lockSeqidValidation === 'invalid') {
                return new msg.Nfsv4LockResponse(10026);
            }
            if (lockSeqidValidation === 'replay') {
                if (lockOwnerState.lastRequestKey === lockRequestKey && lockOwnerState.lastResponse) {
                    return lockOwnerState.lastResponse;
                }
                return new msg.Nfsv4LockResponse(10026);
            }
        }
        lockOwnerState.seqid = openToLock.lockSeqid;
        const lockStateid = this.getOrCreateLockStateid(lockOwnerKey, currentPath);
        const stateid = lockStateid.incrementAndGetStateid();
        const lock = new ByteRangeLock_1.ByteRangeLock(stateid, currentPath, locktype, offset, length, lockOwnerKey);
        const lockKey = this.makeLockKey(stateid, offset, length);
        this.locks.set(lockKey, lock);
        lockOwnerState.locks.add(lockKey);
        const resok = new msg.Nfsv4LockResOk(stateid);
        const response = new msg.Nfsv4LockResponse(0, resok);
        lockOwnerState.lastResponse = response;
        lockOwnerState.lastRequestKey = lockRequestKey;
        return response;
    }
    async LOCKT(request, ctx) {
        const currentPath = this.fh.currentPath(ctx);
        const { locktype, offset, length, owner } = request;
        const ownerKey = this.makeLockOwnerKey(owner.clientid, owner.owner);
        if (this.hasConflictingLock(currentPath, locktype, offset, length, ownerKey)) {
            const conflictOwner = new struct.Nfsv4LockOwner(BigInt(0), new Uint8Array());
            const denied = new msg.Nfsv4LocktResDenied(offset, length, locktype, conflictOwner);
            return new msg.Nfsv4LocktResponse(10010, denied);
        }
        return new msg.Nfsv4LocktResponse(0);
    }
    async LOCKU(request, ctx) {
        const { lockStateid, offset, length, seqid } = request;
        const lockStateidState = this.findLockStateidByOther(lockStateid.other);
        if (!lockStateidState)
            throw 10025;
        const ownerKey = lockStateidState.lockOwnerKey;
        const lockOwnerState = this.lockOwners.get(ownerKey);
        if (!lockOwnerState)
            throw 10025;
        this.renewClientLease(lockOwnerState.clientid);
        const currentPath = this.fh.currentPath(ctx);
        if (lockStateidState.path !== currentPath)
            throw 10025;
        const requestKey = this.makeLockuRequestKey(ownerKey, lockStateid, offset, length, seqid);
        const seqidValidation = this.validateSeqid(seqid, lockOwnerState.seqid);
        if (seqidValidation === 'invalid') {
            throw 10026;
        }
        if (seqidValidation === 'replay') {
            if (lockOwnerState.lastRequestKey === requestKey && lockOwnerState.lastResponse) {
                return lockOwnerState.lastResponse;
            }
            throw 10026;
        }
        lockOwnerState.seqid = seqid;
        const lockKey = this.makeLockKey(lockStateid, offset, length);
        const lock = this.locks.get(lockKey);
        if (lock) {
            this.locks.delete(lockKey);
            lockOwnerState.locks.delete(lockKey);
        }
        const stateid = lockStateidState.incrementAndGetStateid();
        const resok = new msg.Nfsv4LockuResOk(stateid);
        const response = new msg.Nfsv4LockuResponse(0, resok);
        lockOwnerState.lastResponse = response;
        lockOwnerState.lastRequestKey = requestKey;
        return response;
    }
    async RELEASE_LOCKOWNER(request, ctx) {
        const { lockOwner } = request;
        const ownerKey = this.makeLockOwnerKey(lockOwner.clientid, lockOwner.owner);
        const lockOwnerState = this.lockOwners.get(ownerKey);
        if (!lockOwnerState)
            throw 10025;
        for (const lockKey of lockOwnerState.locks)
            this.locks.delete(lockKey);
        this.lockOwners.delete(ownerKey);
        return new msg.Nfsv4ReleaseLockOwnerResponse(0);
    }
    async RENEW(request, ctx) {
        const clientid = request.clientid;
        const client = this.clients.get(clientid);
        if (!client)
            throw 10022;
        return new msg.Nfsv4RenewResponse(0);
    }
    async READ(request, ctx) {
        const stateidKey = this.makeStateidKey(request.stateid);
        const openFile = this.openFiles.get(stateidKey);
        if (!openFile)
            return new msg.Nfsv4ReadResponse(10025);
        const fdHandle = openFile.fd;
        let fd = undefined;
        let openedHere = false;
        try {
            if (fdHandle && typeof fdHandle.read === 'function') {
                fd = fdHandle;
            }
            else {
                fd = await this.promises.open(openFile.path, this.fs.constants.O_RDONLY);
                openedHere = true;
            }
            const buf = Buffer.alloc(request.count);
            const { bytesRead } = await fd.read(buf, 0, request.count, Number(request.offset));
            const eof = bytesRead < request.count;
            const data = buf.slice(0, bytesRead);
            const resok = new msg.Nfsv4ReadResOk(eof, data);
            return new msg.Nfsv4ReadResponse(0, resok);
        }
        catch (err) {
            const status = (0, util_1.normalizeNodeFsError)(err, ctx.connection.logger);
            return new msg.Nfsv4ReadResponse(status);
        }
        finally {
            try {
                if (openedHere && fd && typeof fd.close === 'function')
                    await fd.close();
            }
            catch (e) {
            }
        }
    }
    async READLINK(request, ctx) {
        const currentPath = this.fh.currentPath(ctx);
        const currentPathAbsolute = this.absolutePath(currentPath);
        try {
            const target = await this.promises.readlink(currentPathAbsolute);
            const resok = new msg.Nfsv4ReadlinkResOk(target);
            return new msg.Nfsv4ReadlinkResponse(0, resok);
        }
        catch (err) {
            const status = (0, util_1.normalizeNodeFsError)(err, ctx.connection.logger);
            return new msg.Nfsv4ReadlinkResponse(status);
        }
    }
    async REMOVE(request, ctx) {
        const currentPath = this.fh.currentPath(ctx);
        const targetPath = this.absolutePath(NodePath.join(currentPath, request.target));
        try {
            const stats = await this.promises.lstat(targetPath);
            if (stats.isDirectory()) {
                await this.promises.rmdir(targetPath);
            }
            else {
                await this.promises.unlink(targetPath);
            }
            this.fh.remove(targetPath);
            const before = this.changeCounter;
            const after = ++this.changeCounter;
            const cinfo = new struct.Nfsv4ChangeInfo(true, before, after);
            const resok = new msg.Nfsv4RemoveResOk(cinfo);
            return new msg.Nfsv4RemoveResponse(0, resok);
        }
        catch (err) {
            const status = (0, util_1.normalizeNodeFsError)(err, ctx.connection.logger);
            return new msg.Nfsv4RemoveResponse(status);
        }
    }
    async RENAME(request, ctx) {
        const savedPath = this.fh.savedPath(ctx);
        const currentPath = this.fh.currentPath(ctx);
        const savedPathAbsolute = this.absolutePath(savedPath);
        const currentPathAbsolute = this.absolutePath(currentPath);
        const oldFull = NodePath.join(savedPathAbsolute, request.oldname);
        const newFull = NodePath.join(currentPathAbsolute, request.newname);
        if (oldFull.length < this.dir.length || newFull.length < this.dir.length)
            throw 2;
        if (!oldFull.startsWith(this.dir))
            return new msg.Nfsv4RenameResponse(2);
        if (!newFull.startsWith(this.dir))
            return new msg.Nfsv4RenameResponse(2);
        let oldPath;
        let newPath;
        try {
            oldPath = this.absolutePath(oldFull);
            newPath = this.absolutePath(newFull);
        }
        catch (e) {
            const status = typeof e === 'number' ? e : 2;
            return new msg.Nfsv4RenameResponse(status);
        }
        try {
            await this.promises.rename(oldPath, newPath);
            this.fh.rename(oldPath, newPath);
            const before = this.changeCounter;
            const after = ++this.changeCounter;
            const sourceCinfo = new struct.Nfsv4ChangeInfo(true, before, after);
            const targetCinfo = new struct.Nfsv4ChangeInfo(true, before, after);
            const resok = new msg.Nfsv4RenameResOk(sourceCinfo, targetCinfo);
            return new msg.Nfsv4RenameResponse(0, resok);
        }
        catch (err) {
            if ((0, util_1.isErrCode)('EXDEV', err))
                return new msg.Nfsv4RenameResponse(18);
            const status = (0, util_1.normalizeNodeFsError)(err, ctx.connection.logger);
            return new msg.Nfsv4RenameResponse(status);
        }
    }
    async WRITE(request, ctx) {
        const stateidKey = this.makeStateidKey(request.stateid);
        const openFile = this.openFiles.get(stateidKey);
        if (!openFile)
            return new msg.Nfsv4WriteResponse(10025);
        const fdHandle = openFile.fd;
        let fd = undefined;
        let openedHere = false;
        try {
            if (fdHandle && typeof fdHandle.write === 'function') {
                fd = fdHandle;
            }
            else {
                fd = await this.promises.open(openFile.path, this.fs.constants.O_RDWR);
                openedHere = true;
            }
            const buffer = Buffer.from(request.data);
            const { bytesWritten } = await fd.write(buffer, 0, buffer.length, Number(request.offset));
            const committed = request.stable === 0 ? 0 : 2;
            if (request.stable === 2 || request.stable === 1) {
                if (typeof fd.datasync === 'function')
                    await fd.datasync();
                else if (typeof fd.sync === 'function')
                    await fd.sync();
            }
            const verifier = new struct.Nfsv4Verifier((0, node_crypto_1.randomBytes)(8));
            const resok = new msg.Nfsv4WriteResOk(bytesWritten, committed, verifier);
            return new msg.Nfsv4WriteResponse(0, resok);
        }
        catch (err) {
            const status = (0, util_1.normalizeNodeFsError)(err, ctx.connection.logger);
            return new msg.Nfsv4WriteResponse(status);
        }
        finally {
            try {
                if (openedHere && fd && typeof fd.close === 'function')
                    await fd.close();
            }
            catch (e) {
            }
        }
    }
    async DELEGPURGE(request, ctx) {
        return new msg.Nfsv4DelegpurgeResponse(10004);
    }
    async DELEGRETURN(request, ctx) {
        return new msg.Nfsv4DelegreturnResponse(10004);
    }
    async COMMIT(request, ctx) {
        const currentPath = this.fh.currentPath(ctx);
        const currentPathAbsolute = this.absolutePath(currentPath);
        let fd = undefined;
        for (const openFile of this.openFiles.values()) {
            if (openFile.path === currentPathAbsolute) {
                fd = openFile.fd;
                break;
            }
        }
        try {
            if (fd && typeof fd.datasync === 'function') {
                await fd.datasync();
            }
            else if (fd && typeof fd.sync === 'function') {
                await fd.sync();
            }
            else {
                const handle = await this.promises.open(currentPathAbsolute, this.fs.constants.O_RDONLY);
                try {
                    if (typeof handle.datasync === 'function')
                        await handle.datasync();
                    else if (typeof handle.sync === 'function')
                        await handle.sync();
                }
                finally {
                    try {
                        await handle.close();
                    }
                    catch (e) {
                    }
                }
            }
            return new msg.Nfsv4CommitResponse(0);
        }
        catch (err) {
            const status = (0, util_1.normalizeNodeFsError)(err, ctx.connection.logger);
            return new msg.Nfsv4CommitResponse(status);
        }
    }
    async CREATE(request, ctx) {
        const currentPath = this.fh.currentPath(ctx);
        const currentPathAbsolute = this.absolutePath(currentPath);
        const name = request.objname;
        const createPath = NodePath.join(currentPathAbsolute, name);
        if (createPath.length < this.dir.length)
            throw 2;
        try {
            const objType = request.objtype.type;
            if (objType === 2) {
                let mode = 0o777;
                try {
                    if (request.createattrs && request.createattrs.attrmask) {
                        const dec = new XdrDecoder_1.XdrDecoder();
                        dec.reader.reset(request.createattrs.attrVals);
                        const maskSet = (0, attributes_1.parseBitmask)(request.createattrs.attrmask.mask);
                        if (maskSet.has(33)) {
                            const m = dec.readUnsignedInt();
                            mode = m & 0o7777;
                        }
                    }
                }
                catch (e) {
                }
                await this.promises.mkdir(createPath, mode);
            }
            else if (objType === 5) {
                const linkTarget = request.objtype.objtype.linkdata;
                await this.promises.symlink(linkTarget, createPath);
            }
            else {
                let mode = 0o666;
                try {
                    if (request.createattrs && request.createattrs.attrmask) {
                        const dec = new XdrDecoder_1.XdrDecoder();
                        dec.reader.reset(request.createattrs.attrVals);
                        const maskSet = (0, attributes_1.parseBitmask)(request.createattrs.attrmask.mask);
                        if (maskSet.has(33)) {
                            const m = dec.readUnsignedInt();
                            mode = m & 0o7777;
                        }
                    }
                }
                catch (e) {
                }
                const fd = await this.promises.open(createPath, this.fs.constants.O_CREAT | this.fs.constants.O_EXCL | this.fs.constants.O_RDWR, mode);
                try {
                    await fd.close();
                }
                catch { }
            }
            const stats = await this.promises.stat(createPath);
            const fh = this.fh.encode(createPath);
            ctx.cfh = fh;
            const before = this.changeCounter;
            const after = ++this.changeCounter;
            const cinfo = new struct.Nfsv4ChangeInfo(true, before, after);
            const attrset = new struct.Nfsv4Bitmap([]);
            const resok = new msg.Nfsv4CreateResOk(cinfo, attrset);
            return new msg.Nfsv4CreateResponse(0, resok);
        }
        catch (err) {
            const status = (0, util_1.normalizeNodeFsError)(err, ctx.connection.logger);
            return new msg.Nfsv4CreateResponse(status);
        }
    }
    async LINK(request, ctx) {
        const savedPath = this.fh.savedPath(ctx);
        const existingPath = this.absolutePath(savedPath);
        const currentPath = this.fh.currentPath(ctx);
        const newPath = this.absolutePath(NodePath.join(currentPath, request.newname));
        try {
            await this.promises.link(existingPath, newPath);
            const before = this.changeCounter;
            const after = ++this.changeCounter;
            const resok = new msg.Nfsv4LinkResOk(new struct.Nfsv4ChangeInfo(true, before, after));
            return new msg.Nfsv4LinkResponse(0, resok);
        }
        catch (err) {
            const status = (0, util_1.normalizeNodeFsError)(err, ctx.connection.logger);
            return new msg.Nfsv4LinkResponse(status);
        }
    }
    async NVERIFY(request, ctx) {
        const currentPath = this.fh.currentPath(ctx);
        const currentPathAbsolute = this.absolutePath(currentPath);
        try {
            const stats = await this.promises.lstat(currentPathAbsolute);
            const fsStats = await this.fsStats();
            const attrs = (0, attrs_1.encodeAttrs)(request.objAttributes.attrmask, stats, currentPathAbsolute, ctx.cfh, this.leaseTime, fsStats);
            if ((0, cmpUint8Array_1.cmpUint8Array)(attrs.attrVals, request.objAttributes.attrVals))
                return new msg.Nfsv4NverifyResponse(10027);
            return new msg.Nfsv4NverifyResponse(0);
        }
        catch (err) {
            const status = (0, util_1.normalizeNodeFsError)(err, ctx.connection.logger);
            return new msg.Nfsv4NverifyResponse(status);
        }
    }
    async SETATTR(request, ctx) {
        const currentPath = this.fh.currentPath(ctx);
        const currentPathAbsolute = this.absolutePath(currentPath);
        try {
            const inFattr = request.objAttributes;
            const dec = new XdrDecoder_1.XdrDecoder();
            dec.reader.reset(inFattr.attrVals);
            const mask = inFattr.attrmask.mask;
            let atime;
            let mtime;
            let uid;
            let gid;
            for (let i = 0; i < mask.length; i++) {
                const word = mask[i];
                for (let bit = 0; bit < 32; bit++) {
                    const bitMask = 1 << bit;
                    if (!(word & bitMask))
                        continue;
                    const attrNum = i * 32 + bit;
                    switch (attrNum) {
                        case 33: {
                            const mode = dec.readUnsignedInt();
                            await this.promises.chmod(currentPathAbsolute, mode & 0o7777);
                            break;
                        }
                        case 36: {
                            const owner = dec.readString();
                            const parsedUid = parseInt(owner, 10);
                            if (!isNaN(parsedUid)) {
                                uid = parsedUid;
                            }
                            break;
                        }
                        case 37: {
                            const group = dec.readString();
                            const parsedGid = parseInt(group, 10);
                            if (!isNaN(parsedGid)) {
                                gid = parsedGid;
                            }
                            break;
                        }
                        case 4: {
                            const size = dec.readUnsignedHyper();
                            await this.promises.truncate(currentPathAbsolute, Number(size));
                            break;
                        }
                        case 48: {
                            const setIt = dec.readUnsignedInt();
                            if (setIt === 1) {
                                const seconds = Number(dec.readHyper());
                                const nseconds = dec.readUnsignedInt();
                                atime = new Date(seconds * 1000 + nseconds / 1000000);
                            }
                            break;
                        }
                        case 54: {
                            const setIt = dec.readUnsignedInt();
                            if (setIt === 1) {
                                const seconds = Number(dec.readHyper());
                                const nseconds = dec.readUnsignedInt();
                                mtime = new Date(seconds * 1000 + nseconds / 1000000);
                            }
                            break;
                        }
                        case 19: {
                            dec.readVarlenArray(() => dec.readUnsignedInt());
                            break;
                        }
                        case 0: {
                            const len = dec.readUnsignedInt();
                            for (let j = 0; j < len; j++)
                                dec.readUnsignedInt();
                            break;
                        }
                        case 1: {
                            dec.readUnsignedInt();
                            break;
                        }
                        case 20:
                        case 45:
                        case 3: {
                            dec.readUnsignedHyper();
                            break;
                        }
                        case 47:
                        case 53:
                        case 52: {
                            dec.readHyper();
                            dec.readUnsignedInt();
                            break;
                        }
                        default: {
                            return new msg.Nfsv4SetattrResponse(10032);
                        }
                    }
                }
            }
            if (uid !== undefined || gid !== undefined) {
                const stats = await this.promises.lstat(currentPathAbsolute);
                const uidToSet = uid !== undefined ? uid : stats.uid;
                const gidToSet = gid !== undefined ? gid : stats.gid;
                await this.promises.chown(currentPathAbsolute, uidToSet, gidToSet);
            }
            if (atime || mtime) {
                const stats = await this.promises.lstat(currentPathAbsolute);
                const atimeToSet = atime || stats.atime;
                const mtimeToSet = mtime || stats.mtime;
                await this.promises.utimes(currentPathAbsolute, atimeToSet, mtimeToSet);
            }
            const stats = await this.promises.lstat(currentPathAbsolute);
            const fh = this.fh.encode(currentPath);
            const fsStats = await this.fsStats();
            const returnMask = new struct.Nfsv4Bitmap((0, attributes_1.attrNumsToBitmap)([33, 4]));
            const fattr = (0, attrs_1.encodeAttrs)(returnMask, stats, currentPath, fh, this.leaseTime, fsStats);
            const resok = new msg.Nfsv4SetattrResOk(returnMask);
            return new msg.Nfsv4SetattrResponse(0, resok);
        }
        catch (err) {
            const status = (0, util_1.normalizeNodeFsError)(err, ctx.connection.logger);
            return new msg.Nfsv4SetattrResponse(status);
        }
    }
    async VERIFY(request, ctx) {
        const currentPath = this.fh.currentPath(ctx);
        const currentPathAbsolute = this.absolutePath(currentPath);
        try {
            const stats = await this.promises.lstat(currentPathAbsolute);
            const fsStats = await this.fsStats();
            const attrs = (0, attrs_1.encodeAttrs)(request.objAttributes.attrmask, stats, currentPath, ctx.cfh, this.leaseTime, fsStats);
            if ((0, cmpUint8Array_1.cmpUint8Array)(attrs.attrVals, request.objAttributes.attrVals))
                return new msg.Nfsv4VerifyResponse(0);
            return new msg.Nfsv4VerifyResponse(10027);
        }
        catch (err) {
            const status = (0, util_1.normalizeNodeFsError)(err, ctx.connection.logger);
            return new msg.Nfsv4VerifyResponse(status);
        }
    }
}
exports.Nfsv4OperationsNode = Nfsv4OperationsNode;
//# sourceMappingURL=Nfsv4OperationsNode.js.map