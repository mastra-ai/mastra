"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns the maximum value from a t-digest sketch
     * @param parser - The command parser
     * @param key - The name of the t-digest sketch
     */
    parseCommand(parser, key) {
        parser.push('TDIGEST.MAX');
        parser.pushKey(key);
    },
    transformReply: generic_transformers_1.transformDoubleReply
};
//# sourceMappingURL=MAX.js.map