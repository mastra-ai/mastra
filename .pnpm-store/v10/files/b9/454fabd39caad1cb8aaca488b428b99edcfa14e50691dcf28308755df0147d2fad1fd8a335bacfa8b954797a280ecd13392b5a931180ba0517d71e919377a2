"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMSetArguments = void 0;
function parseMSetArguments(parser, toSet) {
    if (Array.isArray(toSet)) {
        if (toSet.length == 0) {
            throw new Error("empty toSet Argument");
        }
        if (Array.isArray(toSet[0])) {
            for (const tuple of toSet) {
                parser.pushKey(tuple[0]);
                parser.push(tuple[1]);
            }
        }
        else {
            const arr = toSet;
            for (let i = 0; i < arr.length; i += 2) {
                parser.pushKey(arr[i]);
                parser.push(arr[i + 1]);
            }
        }
    }
    else {
        for (const tuple of Object.entries(toSet)) {
            parser.pushKey(tuple[0]);
            parser.push(tuple[1]);
        }
    }
}
exports.parseMSetArguments = parseMSetArguments;
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the MSET command
     *
     * @param parser - The command parser
     * @param toSet - Key-value pairs to set (array of tuples, flat array, or object)
     * @see https://redis.io/commands/mset/
     */
    parseCommand(parser, toSet) {
        parser.push('MSET');
        return parseMSetArguments(parser, toSet);
    },
    transformReply: undefined
};
//# sourceMappingURL=MSET.js.map