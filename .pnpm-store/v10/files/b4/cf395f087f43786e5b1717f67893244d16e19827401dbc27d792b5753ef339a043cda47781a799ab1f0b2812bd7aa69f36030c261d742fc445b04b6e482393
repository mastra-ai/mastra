"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    /**
     * Sets the expiration for hash fields at a specific Unix timestamp
     * @param parser - The Redis command parser
     * @param key - Key of the hash
     * @param fields - Fields to set expiration on
     * @param timestamp - Unix timestamp (seconds since January 1, 1970) or Date object
     * @param mode - Expiration mode: NX (only if field has no expiry), XX (only if field has existing expiry), GT (only if new expiry is greater than current), LT (only if new expiry is less than current)
     */
    parseCommand(parser, key, fields, timestamp, mode) {
        parser.push('HEXPIREAT');
        parser.pushKey(key);
        parser.push((0, generic_transformers_1.transformEXAT)(timestamp));
        if (mode) {
            parser.push(mode);
        }
        parser.push('FIELDS');
        parser.pushVariadicWithLength(fields);
    },
    transformReply: undefined
};
//# sourceMappingURL=HEXPIREAT.js.map