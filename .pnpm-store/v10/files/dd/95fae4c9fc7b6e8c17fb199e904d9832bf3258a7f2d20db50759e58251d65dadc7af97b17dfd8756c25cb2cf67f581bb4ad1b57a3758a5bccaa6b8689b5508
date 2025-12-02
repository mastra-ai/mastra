"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const FUNCTION_LIST_1 = __importDefault(require("./FUNCTION_LIST"));
exports.default = {
    NOT_KEYED_COMMAND: FUNCTION_LIST_1.default.NOT_KEYED_COMMAND,
    IS_READ_ONLY: FUNCTION_LIST_1.default.IS_READ_ONLY,
    /**
     * Returns all libraries and functions including their source code
     * @param parser - The Redis command parser
     * @param options - Options for listing functions
     */
    parseCommand(...args) {
        FUNCTION_LIST_1.default.parseCommand(...args);
        args[0].push('WITHCODE');
    },
    transformReply: {
        2: (reply) => {
            return reply.map(library => {
                const unwrapped = library;
                return {
                    library_name: unwrapped[1],
                    engine: unwrapped[3],
                    functions: unwrapped[5].map(fn => {
                        const unwrapped = fn;
                        return {
                            name: unwrapped[1],
                            description: unwrapped[3],
                            flags: unwrapped[5]
                        };
                    }),
                    library_code: unwrapped[7]
                };
            });
        },
        3: undefined
    }
};
//# sourceMappingURL=FUNCTION_LIST_WITHCODE.js.map