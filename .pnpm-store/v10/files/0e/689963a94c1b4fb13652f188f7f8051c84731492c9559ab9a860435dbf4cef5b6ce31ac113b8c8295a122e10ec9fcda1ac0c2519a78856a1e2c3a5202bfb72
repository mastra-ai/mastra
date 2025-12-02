"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
const ZUNION_1 = __importDefault(require("./ZUNION"));
exports.default = {
    IS_READ_ONLY: ZUNION_1.default.IS_READ_ONLY,
    /**
     * Returns the union of multiple sorted sets with their scores.
     * @param args - Same parameters as the ZUNION command.
     */
    parseCommand(...args) {
        const parser = args[0];
        ZUNION_1.default.parseCommand(...args);
        parser.push('WITHSCORES');
    },
    transformReply: generic_transformers_1.transformSortedSetReply
};
//# sourceMappingURL=ZUNION_WITHSCORES.js.map