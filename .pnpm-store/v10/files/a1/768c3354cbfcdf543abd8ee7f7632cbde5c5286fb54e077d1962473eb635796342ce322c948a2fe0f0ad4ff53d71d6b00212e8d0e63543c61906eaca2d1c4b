"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SCAN_1 = require("./SCAN");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the HSCAN command
     *
     * @param parser - The command parser
     * @param key - The key of the hash to scan
     * @param cursor - The cursor position to start scanning from
     * @param options - Options for the scan (COUNT, MATCH, TYPE)
     * @see https://redis.io/commands/hscan/
     */
    parseCommand(parser, key, cursor, options) {
        parser.push('HSCAN');
        parser.pushKey(key);
        (0, SCAN_1.parseScanArguments)(parser, cursor, options);
    },
    transformReply([cursor, rawEntries]) {
        const entries = [];
        let i = 0;
        while (i < rawEntries.length) {
            entries.push({
                field: rawEntries[i++],
                value: rawEntries[i++]
            });
        }
        return {
            cursor,
            entries
        };
    }
};
//# sourceMappingURL=HSCAN.js.map