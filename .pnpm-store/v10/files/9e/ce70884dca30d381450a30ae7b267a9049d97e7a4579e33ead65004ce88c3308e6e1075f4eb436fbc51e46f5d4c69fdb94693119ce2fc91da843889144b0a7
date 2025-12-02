"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the MOVE command
     *
     * @param parser - The command parser
     * @param key - The key to move
     * @param db - The destination database index
     * @see https://redis.io/commands/move/
     */
    parseCommand(parser, key, db) {
        parser.push('MOVE');
        parser.pushKey(key);
        parser.push(db.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=MOVE.js.map