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
const ZMPOP_1 = __importStar(require("./ZMPOP"));
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Removes and returns members from one or more sorted sets in the specified order; blocks until elements are available
     * @param parser - The Redis command parser
     * @param timeout - Maximum seconds to block, 0 to block indefinitely
     * @param args - Additional arguments specifying the keys, min/max count, and order (MIN/MAX)
     */
    parseCommand(parser, timeout, ...args) {
        parser.push('BZMPOP', timeout.toString());
        (0, ZMPOP_1.parseZMPopArguments)(parser, ...args);
    },
    transformReply: ZMPOP_1.default.transformReply
};
//# sourceMappingURL=BZMPOP.js.map