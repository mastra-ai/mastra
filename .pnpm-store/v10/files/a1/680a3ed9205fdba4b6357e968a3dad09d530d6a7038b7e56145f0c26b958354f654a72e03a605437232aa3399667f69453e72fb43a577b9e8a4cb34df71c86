"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Toggles a boolean value stored in a JSON document.
     * Returns 1 if value was toggled to true, 0 if toggled to false, or null if path doesn't exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param path - Path to the boolean value
     */
    parseCommand(parser, key, path) {
        parser.push('JSON.TOGGLE');
        parser.pushKey(key);
        parser.push(path);
    },
    transformReply: undefined
};
//# sourceMappingURL=TOGGLE.js.map