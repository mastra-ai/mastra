"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SCAN_1 = require("./SCAN");
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Incrementally iterates over a sorted set.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     * @param cursor - Cursor position to start the scan from.
     * @param options - Optional scan parameters (COUNT, MATCH, TYPE).
     */
    parseCommand(parser, key, cursor, options) {
        parser.push('ZSCAN');
        parser.pushKey(key);
        (0, SCAN_1.parseScanArguments)(parser, cursor, options);
    },
    transformReply([cursor, rawMembers]) {
        return {
            cursor,
            members: generic_transformers_1.transformSortedSetReply[2](rawMembers)
        };
    }
};
//# sourceMappingURL=ZSCAN.js.map