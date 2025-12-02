"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.omit = void 0;
const omit = (obj, ...keys) => Object.keys(obj).reduce((acc, key) => {
    if (!keys.includes(key)) {
        acc[key] = obj[key];
    }
    return acc;
}, {});
exports.omit = omit;
