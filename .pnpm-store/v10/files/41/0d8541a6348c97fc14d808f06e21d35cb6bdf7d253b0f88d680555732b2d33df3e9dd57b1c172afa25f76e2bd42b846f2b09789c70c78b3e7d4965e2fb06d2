"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
const VSIM_1 = __importDefault(require("./VSIM"));
exports.default = {
    IS_READ_ONLY: VSIM_1.default.IS_READ_ONLY,
    /**
     * Retrieve elements similar to a given vector or element with similarity scores
     * @param args - Same parameters as the VSIM command
     * @see https://redis.io/commands/vsim/
     */
    parseCommand(...args) {
        const parser = args[0];
        VSIM_1.default.parseCommand(...args);
        parser.push('WITHSCORES');
    },
    transformReply: {
        2: (reply) => {
            const inferred = reply;
            const members = {};
            for (let i = 0; i < inferred.length; i += 2) {
                members[inferred[i].toString()] = generic_transformers_1.transformDoubleReply[2](inferred[i + 1]);
            }
            return members;
        },
        3: undefined
    }
};
//# sourceMappingURL=VSIM_WITHSCORES.js.map