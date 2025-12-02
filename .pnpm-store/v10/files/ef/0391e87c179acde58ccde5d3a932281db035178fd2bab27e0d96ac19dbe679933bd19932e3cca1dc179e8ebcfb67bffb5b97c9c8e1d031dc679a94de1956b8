"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeferralMap = void 0;
/**
 * The error that is thrown when an argument passed in is null.
 *
 * @export
 * @class DefferalMap
 */
class DeferralMap {
    constructor() {
        this.privMap = {};
    }
    add(id, deferral) {
        this.privMap[id] = deferral;
    }
    getId(id) {
        return this.privMap[id];
    }
    complete(id, result) {
        try {
            this.privMap[id].resolve(result);
        }
        catch (error) {
            this.privMap[id].reject(error);
        }
        finally {
            this.privMap[id] = undefined;
        }
    }
}
exports.DeferralMap = DeferralMap;

//# sourceMappingURL=DeferralMap.js.map
