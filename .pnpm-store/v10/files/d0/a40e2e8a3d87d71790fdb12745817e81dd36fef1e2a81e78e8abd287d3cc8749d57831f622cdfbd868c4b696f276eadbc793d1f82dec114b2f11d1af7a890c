/* IMPORT */
import path from 'node:path';
import fs from 'stubborn-fs';
import { DEFAULT_ENCODING, DEFAULT_FILE_MODE, DEFAULT_FOLDER_MODE, DEFAULT_READ_OPTIONS, DEFAULT_WRITE_OPTIONS, DEFAULT_USER_UID, DEFAULT_USER_GID, DEFAULT_TIMEOUT_ASYNC, DEFAULT_TIMEOUT_SYNC, IS_POSIX } from './constants.js';
import { isException, isFunction, isString, isUndefined } from './utils/lang.js';
import Scheduler from './utils/scheduler.js';
import Temp from './utils/temp.js';
function readFile(filePath, options = DEFAULT_READ_OPTIONS) {
    if (isString(options))
        return readFile(filePath, { encoding: options });
    const timeout = Date.now() + ((options.timeout ?? DEFAULT_TIMEOUT_ASYNC) || -1);
    return fs.retry.readFile(timeout)(filePath, options);
}
function readFileSync(filePath, options = DEFAULT_READ_OPTIONS) {
    if (isString(options))
        return readFileSync(filePath, { encoding: options });
    const timeout = Date.now() + ((options.timeout ?? DEFAULT_TIMEOUT_SYNC) || -1);
    return fs.retry.readFileSync(timeout)(filePath, options);
}
function writeFile(filePath, data, options, callback) {
    if (isFunction(options))
        return writeFile(filePath, data, DEFAULT_WRITE_OPTIONS, options);
    const promise = writeFileAsync(filePath, data, options);
    if (callback)
        promise.then(callback, callback);
    return promise;
}
async function writeFileAsync(filePath, data, options = DEFAULT_WRITE_OPTIONS) {
    if (isString(options))
        return writeFileAsync(filePath, data, { encoding: options });
    const timeout = Date.now() + ((options.timeout ?? DEFAULT_TIMEOUT_ASYNC) || -1);
    let schedulerCustomDisposer = null;
    let schedulerDisposer = null;
    let tempDisposer = null;
    let tempPath = null;
    let fd = null;
    try {
        if (options.schedule)
            schedulerCustomDisposer = await options.schedule(filePath);
        schedulerDisposer = await Scheduler.schedule(filePath);
        const filePathReal = await fs.attempt.realpath(filePath);
        const filePathExists = !!filePathReal;
        filePath = filePathReal || filePath;
        [tempPath, tempDisposer] = Temp.get(filePath, options.tmpCreate || Temp.create, !(options.tmpPurge === false));
        const useStatChown = IS_POSIX && isUndefined(options.chown);
        const useStatMode = isUndefined(options.mode);
        if (filePathExists && (useStatChown || useStatMode)) {
            const stats = await fs.attempt.stat(filePath);
            if (stats) {
                options = { ...options };
                if (useStatChown) {
                    options.chown = { uid: stats.uid, gid: stats.gid };
                }
                if (useStatMode) {
                    options.mode = stats.mode;
                }
            }
        }
        if (!filePathExists) {
            const parentPath = path.dirname(filePath);
            await fs.attempt.mkdir(parentPath, {
                mode: DEFAULT_FOLDER_MODE,
                recursive: true
            });
        }
        fd = await fs.retry.open(timeout)(tempPath, 'w', options.mode || DEFAULT_FILE_MODE);
        if (options.tmpCreated) {
            options.tmpCreated(tempPath);
        }
        if (isString(data)) {
            await fs.retry.write(timeout)(fd, data, 0, options.encoding || DEFAULT_ENCODING);
        }
        else if (!isUndefined(data)) {
            await fs.retry.write(timeout)(fd, data, 0, data.length, 0);
        }
        if (options.fsync !== false) {
            if (options.fsyncWait !== false) {
                await fs.retry.fsync(timeout)(fd);
            }
            else {
                fs.attempt.fsync(fd);
            }
        }
        await fs.retry.close(timeout)(fd);
        fd = null;
        if (options.chown && (options.chown.uid !== DEFAULT_USER_UID || options.chown.gid !== DEFAULT_USER_GID)) {
            await fs.attempt.chown(tempPath, options.chown.uid, options.chown.gid);
        }
        if (options.mode && options.mode !== DEFAULT_FILE_MODE) {
            await fs.attempt.chmod(tempPath, options.mode);
        }
        try {
            await fs.retry.rename(timeout)(tempPath, filePath);
        }
        catch (error) {
            if (!isException(error))
                throw error;
            if (error.code !== 'ENAMETOOLONG')
                throw error;
            await fs.retry.rename(timeout)(tempPath, Temp.truncate(filePath));
        }
        tempDisposer();
        tempPath = null;
    }
    finally {
        if (fd)
            await fs.attempt.close(fd);
        if (tempPath)
            Temp.purge(tempPath);
        if (schedulerCustomDisposer)
            schedulerCustomDisposer();
        if (schedulerDisposer)
            schedulerDisposer();
    }
}
function writeFileSync(filePath, data, options = DEFAULT_WRITE_OPTIONS) {
    if (isString(options))
        return writeFileSync(filePath, data, { encoding: options });
    const timeout = Date.now() + ((options.timeout ?? DEFAULT_TIMEOUT_SYNC) || -1);
    let tempDisposer = null;
    let tempPath = null;
    let fd = null;
    try {
        const filePathReal = fs.attempt.realpathSync(filePath);
        const filePathExists = !!filePathReal;
        filePath = filePathReal || filePath;
        [tempPath, tempDisposer] = Temp.get(filePath, options.tmpCreate || Temp.create, !(options.tmpPurge === false));
        const useStatChown = IS_POSIX && isUndefined(options.chown);
        const useStatMode = isUndefined(options.mode);
        if (filePathExists && (useStatChown || useStatMode)) {
            const stats = fs.attempt.statSync(filePath);
            if (stats) {
                options = { ...options };
                if (useStatChown) {
                    options.chown = { uid: stats.uid, gid: stats.gid };
                }
                if (useStatMode) {
                    options.mode = stats.mode;
                }
            }
        }
        if (!filePathExists) {
            const parentPath = path.dirname(filePath);
            fs.attempt.mkdirSync(parentPath, {
                mode: DEFAULT_FOLDER_MODE,
                recursive: true
            });
        }
        fd = fs.retry.openSync(timeout)(tempPath, 'w', options.mode || DEFAULT_FILE_MODE);
        if (options.tmpCreated) {
            options.tmpCreated(tempPath);
        }
        if (isString(data)) {
            fs.retry.writeSync(timeout)(fd, data, 0, options.encoding || DEFAULT_ENCODING);
        }
        else if (!isUndefined(data)) {
            fs.retry.writeSync(timeout)(fd, data, 0, data.length, 0);
        }
        if (options.fsync !== false) {
            if (options.fsyncWait !== false) {
                fs.retry.fsyncSync(timeout)(fd);
            }
            else {
                fs.attempt.fsync(fd);
            }
        }
        fs.retry.closeSync(timeout)(fd);
        fd = null;
        if (options.chown && (options.chown.uid !== DEFAULT_USER_UID || options.chown.gid !== DEFAULT_USER_GID)) {
            fs.attempt.chownSync(tempPath, options.chown.uid, options.chown.gid);
        }
        if (options.mode && options.mode !== DEFAULT_FILE_MODE) {
            fs.attempt.chmodSync(tempPath, options.mode);
        }
        try {
            fs.retry.renameSync(timeout)(tempPath, filePath);
        }
        catch (error) {
            if (!isException(error))
                throw error;
            if (error.code !== 'ENAMETOOLONG')
                throw error;
            fs.retry.renameSync(timeout)(tempPath, Temp.truncate(filePath));
        }
        tempDisposer();
        tempPath = null;
    }
    finally {
        if (fd)
            fs.attempt.closeSync(fd);
        if (tempPath)
            Temp.purge(tempPath);
    }
}
/* EXPORT */
export { readFile, readFileSync, writeFile, writeFileSync };
