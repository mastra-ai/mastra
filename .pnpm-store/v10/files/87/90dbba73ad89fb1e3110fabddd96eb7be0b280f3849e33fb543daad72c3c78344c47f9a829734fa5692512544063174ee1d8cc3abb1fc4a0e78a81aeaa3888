"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushScanArguments = exports.parseScanArguments = void 0;
/**
 * Parses scan arguments for SCAN-type commands
 *
 * @param parser - The command parser
 * @param cursor - The cursor position for iteration
 * @param options - Scan options
 */
function parseScanArguments(parser, cursor, options) {
    parser.push(cursor);
    if (options?.MATCH) {
        parser.push('MATCH', options.MATCH);
    }
    if (options?.COUNT) {
        parser.push('COUNT', options.COUNT.toString());
    }
}
exports.parseScanArguments = parseScanArguments;
/**
 * Pushes scan arguments to the command arguments array
 *
 * @param args - The command arguments array
 * @param cursor - The cursor position for iteration
 * @param options - Scan options
 * @returns The updated command arguments array
 */
function pushScanArguments(args, cursor, options) {
    args.push(cursor.toString());
    if (options?.MATCH) {
        args.push('MATCH', options.MATCH);
    }
    if (options?.COUNT) {
        args.push('COUNT', options.COUNT.toString());
    }
    return args;
}
exports.pushScanArguments = pushScanArguments;
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the SCAN command
     *
     * @param parser - The command parser
     * @param cursor - The cursor position to start scanning from
     * @param options - Scan options
     * @see https://redis.io/commands/scan/
     */
    parseCommand(parser, cursor, options) {
        parser.push('SCAN');
        parseScanArguments(parser, cursor, options);
        if (options?.TYPE) {
            parser.push('TYPE', options.TYPE);
        }
    },
    /**
     * Transforms the SCAN reply into a structured object
     *
     * @param reply - The raw reply containing cursor and keys
     * @returns Object with cursor and keys properties
     */
    transformReply([cursor, keys]) {
        return {
            cursor,
            keys
        };
    }
};
//# sourceMappingURL=SCAN.js.map