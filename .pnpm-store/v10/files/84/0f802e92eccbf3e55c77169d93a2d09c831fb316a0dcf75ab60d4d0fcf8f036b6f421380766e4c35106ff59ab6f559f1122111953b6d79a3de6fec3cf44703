"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
// response
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentResponse = void 0;
class IntentResponse {
    constructor(json) {
        if (json === "") {
            this.privIntentResponse = {};
        }
        else {
            this.privIntentResponse = JSON.parse(json);
        }
    }
    static fromJSON(json) {
        return new IntentResponse(json);
    }
    get query() {
        return this.privIntentResponse.query;
    }
    get topScoringIntent() {
        return this.privIntentResponse.topScoringIntent;
    }
    get entities() {
        return this.privIntentResponse.entities;
    }
}
exports.IntentResponse = IntentResponse;

//# sourceMappingURL=IntentResponse.js.map
