"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Token = void 0;
/**
 * A token that can be used to authenticate with a service.
 */
class Token {
    value;
    expiresAtMs;
    receivedAtMs;
    constructor(value, 
    //represents the token deadline - the time in milliseconds since the Unix epoch at which the token expires
    expiresAtMs, 
    //represents the time in milliseconds since the Unix epoch at which the token was received
    receivedAtMs) {
        this.value = value;
        this.expiresAtMs = expiresAtMs;
        this.receivedAtMs = receivedAtMs;
    }
    /**
     * Returns the time-to-live of the token in milliseconds.
     * @param now The current time in milliseconds since the Unix epoch.
     */
    getTtlMs(now) {
        if (this.expiresAtMs < now) {
            return 0;
        }
        return this.expiresAtMs - now;
    }
}
exports.Token = Token;
//# sourceMappingURL=token.js.map