"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSearchOptions = exports.parseParamsArgument = void 0;
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
const default_1 = require("../dialect/default");
function parseParamsArgument(parser, params) {
    if (params) {
        parser.push('PARAMS');
        const args = [];
        for (const key in params) {
            if (!Object.hasOwn(params, key))
                continue;
            const value = params[key];
            args.push(key, typeof value === 'number' ? value.toString() : value);
        }
        parser.pushVariadicWithLength(args);
    }
}
exports.parseParamsArgument = parseParamsArgument;
function parseSearchOptions(parser, options) {
    if (options?.VERBATIM) {
        parser.push('VERBATIM');
    }
    if (options?.NOSTOPWORDS) {
        parser.push('NOSTOPWORDS');
    }
    (0, generic_transformers_1.parseOptionalVariadicArgument)(parser, 'INKEYS', options?.INKEYS);
    (0, generic_transformers_1.parseOptionalVariadicArgument)(parser, 'INFIELDS', options?.INFIELDS);
    (0, generic_transformers_1.parseOptionalVariadicArgument)(parser, 'RETURN', options?.RETURN);
    if (options?.SUMMARIZE) {
        parser.push('SUMMARIZE');
        if (typeof options.SUMMARIZE === 'object') {
            (0, generic_transformers_1.parseOptionalVariadicArgument)(parser, 'FIELDS', options.SUMMARIZE.FIELDS);
            if (options.SUMMARIZE.FRAGS !== undefined) {
                parser.push('FRAGS', options.SUMMARIZE.FRAGS.toString());
            }
            if (options.SUMMARIZE.LEN !== undefined) {
                parser.push('LEN', options.SUMMARIZE.LEN.toString());
            }
            if (options.SUMMARIZE.SEPARATOR !== undefined) {
                parser.push('SEPARATOR', options.SUMMARIZE.SEPARATOR);
            }
        }
    }
    if (options?.HIGHLIGHT) {
        parser.push('HIGHLIGHT');
        if (typeof options.HIGHLIGHT === 'object') {
            (0, generic_transformers_1.parseOptionalVariadicArgument)(parser, 'FIELDS', options.HIGHLIGHT.FIELDS);
            if (options.HIGHLIGHT.TAGS) {
                parser.push('TAGS', options.HIGHLIGHT.TAGS.open, options.HIGHLIGHT.TAGS.close);
            }
        }
    }
    if (options?.SLOP !== undefined) {
        parser.push('SLOP', options.SLOP.toString());
    }
    if (options?.TIMEOUT !== undefined) {
        parser.push('TIMEOUT', options.TIMEOUT.toString());
    }
    if (options?.INORDER) {
        parser.push('INORDER');
    }
    if (options?.LANGUAGE) {
        parser.push('LANGUAGE', options.LANGUAGE);
    }
    if (options?.EXPANDER) {
        parser.push('EXPANDER', options.EXPANDER);
    }
    if (options?.SCORER) {
        parser.push('SCORER', options.SCORER);
    }
    if (options?.SORTBY) {
        parser.push('SORTBY');
        if (typeof options.SORTBY === 'string' || options.SORTBY instanceof Buffer) {
            parser.push(options.SORTBY);
        }
        else {
            parser.push(options.SORTBY.BY);
            if (options.SORTBY.DIRECTION) {
                parser.push(options.SORTBY.DIRECTION);
            }
        }
    }
    if (options?.LIMIT) {
        parser.push('LIMIT', options.LIMIT.from.toString(), options.LIMIT.size.toString());
    }
    parseParamsArgument(parser, options?.PARAMS);
    if (options?.DIALECT) {
        parser.push('DIALECT', options.DIALECT.toString());
    }
    else {
        parser.push('DIALECT', default_1.DEFAULT_DIALECT);
    }
}
exports.parseSearchOptions = parseSearchOptions;
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Searches a RediSearch index with the given query.
     * @param parser - The command parser
     * @param index - The index name to search
     * @param query - The text query to search. For syntax, see https://redis.io/docs/stack/search/reference/query_syntax
     * @param options - Optional search parameters including:
     *   - VERBATIM: do not try to use stemming for query expansion
     *   - NOSTOPWORDS: do not filter stopwords from the query
     *   - INKEYS/INFIELDS: restrict the search to specific keys/fields
     *   - RETURN: limit which fields are returned
     *   - SUMMARIZE/HIGHLIGHT: create search result highlights
     *   - LIMIT: pagination control
     *   - SORTBY: sort results by a specific field
     *   - PARAMS: bind parameters to the query
     */
    parseCommand(parser, index, query, options) {
        parser.push('FT.SEARCH', index, query);
        parseSearchOptions(parser, options);
    },
    transformReply: {
        2: (reply) => {
            // if reply[2] is array, then we have content/documents. Otherwise, only ids
            const withoutDocuments = reply.length > 2 && !Array.isArray(reply[2]);
            const documents = [];
            let i = 1;
            while (i < reply.length) {
                documents.push({
                    id: reply[i++],
                    value: withoutDocuments ? Object.create(null) : documentValue(reply[i++])
                });
            }
            return {
                total: reply[0],
                documents
            };
        },
        3: undefined
    },
    unstableResp3: true
};
function documentValue(tuples) {
    const message = Object.create(null);
    if (!tuples) {
        return message;
    }
    let i = 0;
    while (i < tuples.length) {
        const key = tuples[i++], value = tuples[i++];
        if (key === '$') { // might be a JSON reply
            try {
                Object.assign(message, JSON.parse(value));
                continue;
            }
            catch {
                // set as a regular property if not a valid JSON
            }
        }
        message[key] = value;
    }
    return message;
}
//# sourceMappingURL=SEARCH.js.map