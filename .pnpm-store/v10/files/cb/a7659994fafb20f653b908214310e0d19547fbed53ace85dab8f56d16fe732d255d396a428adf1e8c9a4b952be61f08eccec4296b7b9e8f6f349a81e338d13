"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSACTION_ISOLATION_LEVELS = exports.TRANSACTION_ACCESS_MODES = void 0;
exports.validateTransactionSettings = validateTransactionSettings;
exports.TRANSACTION_ACCESS_MODES = ['read only', 'read write'];
exports.TRANSACTION_ISOLATION_LEVELS = [
    'read uncommitted',
    'read committed',
    'repeatable read',
    'serializable',
    'snapshot',
];
function validateTransactionSettings(settings) {
    if (settings.accessMode &&
        !exports.TRANSACTION_ACCESS_MODES.includes(settings.accessMode)) {
        throw new Error(`invalid transaction access mode ${settings.accessMode}`);
    }
    if (settings.isolationLevel &&
        !exports.TRANSACTION_ISOLATION_LEVELS.includes(settings.isolationLevel)) {
        throw new Error(`invalid transaction isolation level ${settings.isolationLevel}`);
    }
}
