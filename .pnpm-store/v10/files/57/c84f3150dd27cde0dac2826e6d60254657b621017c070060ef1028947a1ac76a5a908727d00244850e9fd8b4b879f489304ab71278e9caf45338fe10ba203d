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
const INSERT_1 = __importStar(require("./INSERT"));
/**
 * Adds one or more items to a Cuckoo Filter only if they do not exist yet, creating the filter if needed
 * @param parser - The command parser
 * @param key - The name of the Cuckoo filter
 * @param items - One or more items to add to the filter
 * @param options - Optional parameters for filter creation
 * @param options.CAPACITY - The number of entries intended to be added to the filter
 * @param options.NOCREATE - If true, prevents automatic filter creation
 */
exports.default = {
    IS_READ_ONLY: INSERT_1.default.IS_READ_ONLY,
    parseCommand(...args) {
        args[0].push('CF.INSERTNX');
        (0, INSERT_1.parseCfInsertArguments)(...args);
    },
    transformReply: INSERT_1.default.transformReply
};
//# sourceMappingURL=INSERTNX.js.map