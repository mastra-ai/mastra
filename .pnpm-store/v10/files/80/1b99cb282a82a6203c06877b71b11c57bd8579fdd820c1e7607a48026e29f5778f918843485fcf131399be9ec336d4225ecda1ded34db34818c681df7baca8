"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const EVAL_1 = __importStar(require("./EVAL"));
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Executes a Lua script server side using the script's SHA1 digest
     * @param parser - The Redis command parser
     * @param sha1 - SHA1 digest of the script
     * @param options - Script execution options including keys and arguments
     */
    parseCommand(...args) {
        args[0].push('EVALSHA');
        (0, EVAL_1.parseEvalArguments)(...args);
    },
    transformReply: EVAL_1.default.transformReply
};
//# sourceMappingURL=EVALSHA.js.map