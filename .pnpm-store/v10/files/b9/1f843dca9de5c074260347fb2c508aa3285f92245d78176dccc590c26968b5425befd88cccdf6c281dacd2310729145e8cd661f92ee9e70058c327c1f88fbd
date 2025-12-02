"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeNodeFsError = exports.isErrCode = void 0;
const isErrCode = (code, error) => !!error && typeof error === 'object' && error.code === code;
exports.isErrCode = isErrCode;
const normalizeNodeFsError = (err, logger) => {
    if ((0, exports.isErrCode)('ENOENT', err))
        return 2;
    if ((0, exports.isErrCode)('EACCES', err))
        return 13;
    if ((0, exports.isErrCode)('EEXIST', err))
        return 17;
    logger.error('UNEXPECTED_FS_ERROR', err);
    return 5;
};
exports.normalizeNodeFsError = normalizeNodeFsError;
//# sourceMappingURL=util.js.map