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
const RANK_1 = __importStar(require("./RANK"));
/**
 * Returns the reverse rank of one or more values in a t-digest sketch (number of values that are higher than each value)
 * @param parser - The command parser
 * @param key - The name of the t-digest sketch
 * @param values - Array of values to get reverse ranks for
 */
exports.default = {
    IS_READ_ONLY: RANK_1.default.IS_READ_ONLY,
    parseCommand(...args) {
        args[0].push('TDIGEST.REVRANK');
        (0, RANK_1.transformRankArguments)(...args);
    },
    transformReply: RANK_1.default.transformReply
};
//# sourceMappingURL=REVRANK.js.map