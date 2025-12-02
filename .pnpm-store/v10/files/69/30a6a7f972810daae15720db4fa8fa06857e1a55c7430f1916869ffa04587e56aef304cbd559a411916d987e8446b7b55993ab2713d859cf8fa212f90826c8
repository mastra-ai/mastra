"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertUuid = assertUuid;
exports.uuid7FromTime = uuid7FromTime;
exports.getUuidVersion = getUuidVersion;
exports.warnIfNotUuidV7 = warnIfNotUuidV7;
// Relaxed UUID validation regex (allows any valid UUID format including nil UUIDs)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid_1 = require("uuid");
const warn_js_1 = require("./warn.cjs");
let UUID7_WARNING_EMITTED = false;
function assertUuid(str, which) {
    // Use relaxed regex validation instead of strict uuid.validate()
    // This allows edge cases like nil UUIDs or test UUIDs that might not pass strict validation
    if (!UUID_REGEX.test(str)) {
        const msg = which !== undefined
            ? `Invalid UUID for ${which}: ${str}`
            : `Invalid UUID: ${str}`;
        throw new Error(msg);
    }
    return str;
}
/**
 * Generate a UUID v7 from a timestamp.
 *
 * @param timestamp - The timestamp in milliseconds
 * @returns A UUID v7 string
 */
function uuid7FromTime(timestamp) {
    const msecs = typeof timestamp === "string" ? Date.parse(timestamp) : timestamp;
    // Work around uuid@10 behavior where providing only { msecs }
    // may not set the internal timestamp used for stringification.
    // Providing a seq ensures the implementation updates its internal state
    // and encodes the provided milliseconds into the UUID bytes.
    return (0, uuid_1.v7)({ msecs, seq: 0 });
}
/**
 * Get the version of a UUID string.
 * @param uuidStr - The UUID string to check
 * @returns The version number (1-7) or null if invalid
 */
function getUuidVersion(uuidStr) {
    if (!UUID_REGEX.test(uuidStr)) {
        return null;
    }
    // Version is in bits 48-51
    // Format: xxxxxxxx-xxxx-Vxxx-xxxx-xxxxxxxxxxxx
    const versionChar = uuidStr[14];
    return parseInt(versionChar, 16);
}
/**
 * Warn if a UUID is not version 7.
 *
 * @param uuidStr - The UUID string to check
 * @param idType - The type of ID (e.g., "run_id", "trace_id") for the warning message
 */
function warnIfNotUuidV7(uuidStr, _idType) {
    const version = getUuidVersion(uuidStr);
    if (version !== null && version !== 7 && !UUID7_WARNING_EMITTED) {
        UUID7_WARNING_EMITTED = true;
        (0, warn_js_1.warnOnce)(`LangSmith now uses UUID v7 for run and trace identifiers. ` +
            `This warning appears when passing custom IDs. ` +
            `Please use: import { uuidv7 } from 'langsmith'; const id = uuidv7(); ` +
            `Future versions will require UUID v7.`);
    }
}
