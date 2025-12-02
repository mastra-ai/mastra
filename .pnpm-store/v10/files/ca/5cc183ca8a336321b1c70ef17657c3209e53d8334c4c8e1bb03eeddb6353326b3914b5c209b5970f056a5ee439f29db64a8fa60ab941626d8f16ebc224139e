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
const SEARCH_1 = __importStar(require("./SEARCH"));
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Profiles the execution of a search query for performance analysis.
     * @param parser - The command parser
     * @param index - Name of the index to profile query against
     * @param query - The search query to profile
     * @param options - Optional parameters:
     *   - LIMITED: Collect limited timing information only
     *   - All options supported by FT.SEARCH command
     */
    parseCommand(parser, index, query, options) {
        parser.push('FT.PROFILE', index, 'SEARCH');
        if (options?.LIMITED) {
            parser.push('LIMITED');
        }
        parser.push('QUERY', query);
        (0, SEARCH_1.parseSearchOptions)(parser, options);
    },
    transformReply: {
        2: (reply) => {
            return {
                results: SEARCH_1.default.transformReply[2](reply[0]),
                profile: reply[1]
            };
        },
        3: (reply) => reply
    },
    unstableResp3: true
};
//# sourceMappingURL=PROFILE_SEARCH.js.map