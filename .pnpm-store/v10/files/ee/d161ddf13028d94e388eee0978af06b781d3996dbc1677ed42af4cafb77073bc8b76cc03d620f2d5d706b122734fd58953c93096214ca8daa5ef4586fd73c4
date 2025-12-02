"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
const VEMB_1 = __importDefault(require("./VEMB"));
const transformRawVembReply = {
    2: (reply) => {
        return {
            quantization: reply[0],
            raw: reply[1],
            l2Norm: generic_transformers_1.transformDoubleReply[2](reply[2]),
            ...(reply[3] !== undefined && { quantizationRange: generic_transformers_1.transformDoubleReply[2](reply[3]) })
        };
    },
    3: (reply) => {
        return {
            quantization: reply[0],
            raw: reply[1],
            l2Norm: reply[2],
            quantizationRange: reply[3]
        };
    },
};
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Retrieve the RAW approximate vector associated with a vector set element
     *
     * @param parser - The command parser
     * @param key - The key of the vector set
     * @param element - The name of the element to retrieve the vector for
     * @see https://redis.io/commands/vemb/
     */
    parseCommand(parser, key, element) {
        VEMB_1.default.parseCommand(parser, key, element);
        parser.push('RAW');
    },
    transformReply: transformRawVembReply
};
//# sourceMappingURL=VEMB_RAW.js.map