"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Trims an array in a JSON document to include only elements within the specified range.
     * Returns the new array length after trimming, or null if the path does not exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the array
     * @param path - Path to the array in the JSON document
     * @param start - Starting index (inclusive)
     * @param stop - Ending index (inclusive)
     */
    parseCommand(parser, key, path, start, stop) {
        parser.push('JSON.ARRTRIM');
        parser.pushKey(key);
        parser.push(path, start.toString(), stop.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=ARRTRIM.js.map