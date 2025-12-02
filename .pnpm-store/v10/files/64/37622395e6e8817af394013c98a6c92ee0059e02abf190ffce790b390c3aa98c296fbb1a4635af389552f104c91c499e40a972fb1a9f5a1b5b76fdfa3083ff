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
const INCRBY_1 = __importStar(require("./INCRBY"));
exports.default = {
    IS_READ_ONLY: INCRBY_1.default.IS_READ_ONLY,
    /**
     * Decreases the value of a time series by a given amount
     * @param args - Arguments passed to the parseIncrByArguments function
     */
    parseCommand(...args) {
        const parser = args[0];
        parser.push('TS.DECRBY');
        (0, INCRBY_1.parseIncrByArguments)(...args);
    },
    transformReply: INCRBY_1.default.transformReply
};
//# sourceMappingURL=DECRBY.js.map