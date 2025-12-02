"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Retrieve elements similar to a given vector or element with optional filtering
     *
     * @param parser - The command parser
     * @param key - The key of the vector set
     * @param query - The query vector (array of numbers) or element name (string)
     * @param options - Optional parameters for similarity search
     * @see https://redis.io/commands/vsim/
     */
    parseCommand(parser, key, query, options) {
        parser.push('VSIM');
        parser.pushKey(key);
        if (Array.isArray(query)) {
            parser.push('VALUES', query.length.toString());
            for (const value of query) {
                parser.push((0, generic_transformers_1.transformDoubleArgument)(value));
            }
        }
        else {
            parser.push('ELE', query);
        }
        if (options?.COUNT !== undefined) {
            parser.push('COUNT', options.COUNT.toString());
        }
        if (options?.EPSILON !== undefined) {
            parser.push('EPSILON', options.EPSILON.toString());
        }
        if (options?.EF !== undefined) {
            parser.push('EF', options.EF.toString());
        }
        if (options?.FILTER) {
            parser.push('FILTER', options.FILTER);
        }
        if (options?.['FILTER-EF'] !== undefined) {
            parser.push('FILTER-EF', options['FILTER-EF'].toString());
        }
        if (options?.TRUTH) {
            parser.push('TRUTH');
        }
        if (options?.NOTHREAD) {
            parser.push('NOTHREAD');
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=VSIM.js.map