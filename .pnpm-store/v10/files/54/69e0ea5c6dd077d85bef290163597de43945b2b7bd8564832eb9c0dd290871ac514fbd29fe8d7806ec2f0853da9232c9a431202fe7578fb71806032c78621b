"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const NUMINCRBY_1 = __importDefault(require("./NUMINCRBY"));
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Multiplies a numeric value stored in a JSON document by a given number.
     * Returns the value after multiplication, or null if the key/path doesn't exist or value is not numeric.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param path - Path to the numeric value
     * @param by - Amount to multiply by
     */
    parseCommand(parser, key, path, by) {
        parser.push('JSON.NUMMULTBY');
        parser.pushKey(key);
        parser.push(path, by.toString());
    },
    transformReply: NUMINCRBY_1.default.transformReply
};
//# sourceMappingURL=NUMMULTBY.js.map