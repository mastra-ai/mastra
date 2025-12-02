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
const BYRANK_1 = __importStar(require("./BYRANK"));
/**
 * Returns value estimates for one or more ranks in a t-digest sketch, starting from highest rank
 * @param parser - The command parser
 * @param key - The name of the t-digest sketch
 * @param ranks - Array of ranks to get value estimates for (descending order)
 */
exports.default = {
    IS_READ_ONLY: BYRANK_1.default.IS_READ_ONLY,
    parseCommand(...args) {
        args[0].push('TDIGEST.BYREVRANK');
        (0, BYRANK_1.transformByRankArguments)(...args);
    },
    transformReply: BYRANK_1.default.transformReply
};
//# sourceMappingURL=BYREVRANK.js.map