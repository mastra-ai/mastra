"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const default_1 = require("../dialect/default");
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns the execution plan for a complex query in a more verbose format than FT.EXPLAIN.
     * @param parser - The command parser
     * @param index - Name of the index to explain query against
     * @param query - The query string to explain
     * @param options - Optional parameters:
     *   - DIALECT: Version of query dialect to use (defaults to 1)
     */
    parseCommand(parser, index, query, options) {
        parser.push('FT.EXPLAINCLI', index, query);
        if (options?.DIALECT) {
            parser.push('DIALECT', options.DIALECT.toString());
        }
        else {
            parser.push('DIALECT', default_1.DEFAULT_DIALECT);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=EXPLAINCLI.js.map