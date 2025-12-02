"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Contracts = void 0;
/**
 * @class Contracts
 * @private
 */
class Contracts {
    static throwIfNullOrUndefined(param, name) {
        if (param === undefined || param === null) {
            throw new Error("throwIfNullOrUndefined:" + name);
        }
    }
    static throwIfNull(param, name) {
        if (param === null) {
            throw new Error("throwIfNull:" + name);
        }
    }
    static throwIfNullOrWhitespace(param, name) {
        Contracts.throwIfNullOrUndefined(param, name);
        if (("" + param).trim().length < 1) {
            throw new Error("throwIfNullOrWhitespace:" + name);
        }
    }
    static throwIfNullOrTooLong(param, name, maxLength) {
        Contracts.throwIfNullOrUndefined(param, name);
        if (("" + param).length > maxLength) {
            throw new Error("throwIfNullOrTooLong:" + name + " (more than " + maxLength.toString() + " characters)");
        }
    }
    static throwIfNullOrTooShort(param, name, minLength) {
        Contracts.throwIfNullOrUndefined(param, name);
        if (("" + param).length < minLength) {
            throw new Error("throwIfNullOrTooShort:" + name + " (less than " + minLength.toString() + " characters)");
        }
    }
    static throwIfDisposed(isDisposed) {
        if (isDisposed) {
            throw new Error("the object is already disposed");
        }
    }
    static throwIfArrayEmptyOrWhitespace(array, name) {
        Contracts.throwIfNullOrUndefined(array, name);
        if (array.length === 0) {
            throw new Error("throwIfArrayEmptyOrWhitespace:" + name);
        }
        for (const item of array) {
            Contracts.throwIfNullOrWhitespace(item, name);
        }
    }
    static throwIfFileDoesNotExist(param, name) {
        Contracts.throwIfNullOrWhitespace(param, name);
        // TODO check for file existence.
    }
    static throwIfNotUndefined(param, name) {
        if (param !== undefined) {
            throw new Error("throwIfNotUndefined:" + name);
        }
    }
    static throwIfNumberOutOfRange(value, name, rangeStart, rangeEnd) {
        Contracts.throwIfNullOrUndefined(value, name);
        if (value < rangeStart || value > rangeEnd) {
            throw new Error("throwIfNumberOutOfRange:" + name + " (must be between " + rangeStart.toString() + " and " + rangeEnd.toString() + ")");
        }
    }
}
exports.Contracts = Contracts;

//# sourceMappingURL=Contracts.js.map
