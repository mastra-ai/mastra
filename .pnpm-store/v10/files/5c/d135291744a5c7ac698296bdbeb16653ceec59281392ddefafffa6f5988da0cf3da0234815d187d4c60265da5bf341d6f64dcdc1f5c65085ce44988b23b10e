"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: false,
    /**
     * Returns all libraries and functions
     * @param parser - The Redis command parser
     * @param options - Options for listing functions
     */
    parseCommand(parser, options) {
        parser.push('FUNCTION', 'LIST');
        if (options?.LIBRARYNAME) {
            parser.push('LIBRARYNAME', options.LIBRARYNAME);
        }
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
                    })
                };
            });
        },
        3: undefined
    }
};
//# sourceMappingURL=FUNCTION_LIST.js.map