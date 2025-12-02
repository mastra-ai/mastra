"use strict";
// This is only here for so that users with cached recorder.ts don't get errors during the transition to lazy loading
// if you have the new eager loaded recording code it will request this file, not `recorder.js`
// so you don't have the problem that clients get new code and a cached recorder.js
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
var globals_1 = require("../utils/globals");
var lazy_loaded_session_recorder_1 = require("../extensions/replay/external/lazy-loaded-session-recorder");
globals_1.assignableWindow.__PosthogExtensions__ = globals_1.assignableWindow.__PosthogExtensions__ || {};
globals_1.assignableWindow.__PosthogExtensions__.initSessionRecording = function (ph) { return new lazy_loaded_session_recorder_1.LazyLoadedSessionRecording(ph); };
__exportStar(require("./recorder"), exports);
//# sourceMappingURL=lazy-recorder.js.map