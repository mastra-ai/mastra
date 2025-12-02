"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Sets a timeout on key. After the timeout has expired, the key will be automatically deleted
     * @param parser - The Redis command parser
     * @param key - Key to set expiration on
     * @param seconds - Number of seconds until key expiration
     * @param mode - Expiration mode: NX (only if key has no expiry), XX (only if key has existing expiry), GT (only if new expiry is greater than current), LT (only if new expiry is less than current)
     */
    parseCommand(parser, key, seconds, mode) {
        parser.push('EXPIRE');
        parser.pushKey(key);
        parser.push(seconds.toString());
        if (mode) {
            parser.push(mode);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=EXPIRE.js.map