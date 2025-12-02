"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the PFMERGE command
     *
     * @param parser - The command parser
     * @param destination - The destination key to merge to
     * @param sources - One or more source keys to merge from
     * @see https://redis.io/commands/pfmerge/
     */
    parseCommand(parser, destination, sources) {
        parser.push('PFMERGE');
        parser.pushKey(destination);
        if (sources) {
            parser.pushKeys(sources);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=PFMERGE.js.map