/// <reference types="./driver.d.ts" />
export const TRANSACTION_ACCESS_MODES = ['read only', 'read write'];
export const TRANSACTION_ISOLATION_LEVELS = [
    'read uncommitted',
    'read committed',
    'repeatable read',
    'serializable',
    'snapshot',
];
export function validateTransactionSettings(settings) {
    if (settings.accessMode &&
        !TRANSACTION_ACCESS_MODES.includes(settings.accessMode)) {
        throw new Error(`invalid transaction access mode ${settings.accessMode}`);
    }
    if (settings.isolationLevel &&
        !TRANSACTION_ISOLATION_LEVELS.includes(settings.isolationLevel)) {
        throw new Error(`invalid transaction isolation level ${settings.isolationLevel}`);
    }
}
