"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ACL_LOG_1 = __importDefault(require("./ACL_LOG"));
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: ACL_LOG_1.default.IS_READ_ONLY,
    /**
     * Clears the ACL security events log
     * @param parser - The Redis command parser
     */
    parseCommand(parser) {
        parser.push('ACL', 'LOG', 'RESET');
    },
    transformReply: undefined
};
//# sourceMappingURL=ACL_LOG_RESET.js.map