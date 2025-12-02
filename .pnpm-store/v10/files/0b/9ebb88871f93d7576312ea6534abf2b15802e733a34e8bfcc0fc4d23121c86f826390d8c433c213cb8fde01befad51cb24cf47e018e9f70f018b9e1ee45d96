"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const XADD_1 = require("./XADD");
/**
 * Command for adding entries to an existing stream without creating it if it doesn't exist
 */
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the XADD command with NOMKSTREAM option to append a new entry to an existing stream
     *
     * @param args - Arguments tuple containing parser, key, id, message, and options
     * @returns The ID of the added entry, or null if the stream doesn't exist
     * @see https://redis.io/commands/xadd/
     */
    parseCommand(...args) {
        return (0, XADD_1.parseXAddArguments)('NOMKSTREAM', ...args);
    },
    transformReply: undefined
};
//# sourceMappingURL=XADD_NOMKSTREAM.js.map