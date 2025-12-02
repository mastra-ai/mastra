"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialogServiceTurnStateManager = void 0;
const Error_js_1 = require("../common/Error.js");
const DialogServiceTurnState_js_1 = require("./DialogServiceTurnState.js");
class DialogServiceTurnStateManager {
    constructor() {
        this.privTurnMap = new Map();
        return;
    }
    StartTurn(id) {
        if (this.privTurnMap.has(id)) {
            throw new Error_js_1.InvalidOperationError("Service error: There is already a turn with id:" + id);
        }
        const turnState = new DialogServiceTurnState_js_1.DialogServiceTurnState(this, id);
        this.privTurnMap.set(id, turnState);
        return this.privTurnMap.get(id);
    }
    GetTurn(id) {
        return this.privTurnMap.get(id);
    }
    CompleteTurn(id) {
        if (!this.privTurnMap.has(id)) {
            throw new Error_js_1.InvalidOperationError("Service error: Received turn end for an unknown turn id:" + id);
        }
        const turnState = this.privTurnMap.get(id);
        turnState.complete();
        this.privTurnMap.delete(id);
        return turnState;
    }
}
exports.DialogServiceTurnStateManager = DialogServiceTurnStateManager;

//# sourceMappingURL=DialogServiceTurnStateManager.js.map
