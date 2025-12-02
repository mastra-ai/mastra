"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvatarEventArgs = exports.AvatarEventTypes = void 0;
var AvatarEventTypes;
(function (AvatarEventTypes) {
    AvatarEventTypes["SwitchedToSpeaking"] = "SwitchedToSpeaking";
    AvatarEventTypes["SwitchedToIdle"] = "SwitchedToIdle";
    AvatarEventTypes["SessionClosed"] = "SessionClosed";
})(AvatarEventTypes = exports.AvatarEventTypes || (exports.AvatarEventTypes = {}));
/**
 * Defines content for talking avatar events.
 * @class AvatarEventArgs
 * Added in version 1.33.0
 *
 * @experimental This feature is experimental and might change or have limited support.
 */
class AvatarEventArgs {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {number} audioOffset - The audio offset.
     * @param {string} description - The description of the event.
     */
    constructor(audioOffset, description) {
        this.privOffset = audioOffset;
        this.privDescription = description;
    }
    /**
     * The type of the event.
     * @public
     * @returns {AvatarEventTypes} The type of the event.
     */
    get type() {
        return this.privType;
    }
    /**
     * The time offset associated with this event.
     * @public
     * @returns {number} The time offset associated with this event.
     */
    get offset() {
        return this.privOffset;
    }
    /**
     * The description of the event.
     * @public
     * @returns {string} The description of the event.
     */
    get description() {
        return this.privDescription;
    }
}
exports.AvatarEventArgs = AvatarEventArgs;

//# sourceMappingURL=AvatarEventArgs.js.map
