"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setDestroyed = exports.isDestroyed = exports.setGotGoaway = exports.hasGotGoaway = void 0;
function hasGotGoaway(session) {
    return !!session.__fetch_h2_goaway;
}
exports.hasGotGoaway = hasGotGoaway;
function setGotGoaway(session) {
    session.__fetch_h2_goaway = true;
}
exports.setGotGoaway = setGotGoaway;
function isDestroyed(session) {
    const monkeySession = session;
    return monkeySession.destroyed || monkeySession.__fetch_h2_destroyed;
}
exports.isDestroyed = isDestroyed;
function setDestroyed(session) {
    session.__fetch_h2_destroyed = true;
}
exports.setDestroyed = setDestroyed;
//# sourceMappingURL=utils-http2.js.map