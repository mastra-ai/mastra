/*
 * Copyright Michael Hart
 * Licensed under the MIT license. See LICENSE file for details.
 *
 * Portions of this file Copyright Fastly, Inc. See LICENSE file for details.
 * Portions of this file Copyright Joyent, Inc. and other Node contributors. See LICENSE file for details.
 */
/* These items copied from Node.js: node/lib/internal/http.js. */
export const kNeedDrain = Symbol("kNeedDrain");
export const kOutHeaders = Symbol("kOutHeaders");
// In Node.js this utcDate is cached for 1 second, for use across
// all http connections. However, in C@E we just create a new one
// since we're not able to share this data across separate invocations.
export function utcDate() {
    return new Date().toUTCString();
}
