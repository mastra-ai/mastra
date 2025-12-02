"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSort = void 0;
exports.extractDbIdFromUrl = extractDbIdFromUrl;
exports.replaceAstraUrlIdAndRegion = replaceAstraUrlIdAndRegion;
exports.validateOption = validateOption;
function extractDbIdFromUrl(uri) {
    return new URL(uri).hostname.match(/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)?.[0];
}
function replaceAstraUrlIdAndRegion(uri, id, region) {
    const url = new URL(uri);
    const parts = url.hostname.split('.');
    parts[0] = id + '-' + region;
    url.hostname = parts.join('.');
    return url.toString().slice(0, -1);
}
function validateOption(name, obj, types, require = false, test) {
    types = Array.isArray(types) ? types : [types];
    const typesString = `[${types.join(', ')}]`;
    if (obj === null || obj === undefined) {
        if (require) {
            throw new Error(`Missing required ${name}; expected a value of some type in ${typesString}`);
        }
        return;
    }
    if (!types.some(t => t === typeof obj)) {
        throw new TypeError(`Invalid ${name}; expected a value of some type in ${typesString}, or undefined/null`);
    }
    test?.(obj);
}
const normalizeSort = (sort) => {
    const ret = {};
    for (const key in sort) {
        switch (sort[key]) {
            case 1:
            case 'asc':
            case 'ascending':
                ret[key] = 1;
                break;
            case -1:
            case 'desc':
            case 'descending':
                ret[key] = -1;
                break;
            default:
                ret[key] = sort[key];
        }
    }
    return ret;
};
exports.normalizeSort = normalizeSort;
