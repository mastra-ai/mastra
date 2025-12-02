"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REDISEARCH_LANGUAGE = exports.parseSchema = exports.SCHEMA_GEO_SHAPE_COORD_SYSTEM = exports.VAMANA_COMPRESSION_ALGORITHM = exports.SCHEMA_VECTOR_FIELD_ALGORITHM = exports.SCHEMA_TEXT_FIELD_PHONETIC = exports.SCHEMA_FIELD_TYPE = void 0;
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.SCHEMA_FIELD_TYPE = {
    TEXT: 'TEXT',
    NUMERIC: 'NUMERIC',
    GEO: 'GEO',
    TAG: 'TAG',
    VECTOR: 'VECTOR',
    GEOSHAPE: 'GEOSHAPE'
};
exports.SCHEMA_TEXT_FIELD_PHONETIC = {
    DM_EN: 'dm:en',
    DM_FR: 'dm:fr',
    FM_PT: 'dm:pt',
    DM_ES: 'dm:es'
};
exports.SCHEMA_VECTOR_FIELD_ALGORITHM = {
    FLAT: 'FLAT',
    HNSW: 'HNSW',
    /**
     * available since 8.2
    */
    VAMANA: 'SVS-VAMANA'
};
exports.VAMANA_COMPRESSION_ALGORITHM = {
    LVQ4: 'LVQ4',
    LVQ8: 'LVQ8',
    LVQ4x4: 'LVQ4x4',
    LVQ4x8: 'LVQ4x8',
    LeanVec4x8: 'LeanVec4x8',
    LeanVec8x8: 'LeanVec8x8'
};
exports.SCHEMA_GEO_SHAPE_COORD_SYSTEM = {
    SPHERICAL: 'SPHERICAL',
    FLAT: 'FLAT'
};
function parseCommonSchemaFieldOptions(parser, fieldOptions) {
    if (fieldOptions.SORTABLE) {
        parser.push('SORTABLE');
        if (fieldOptions.SORTABLE === 'UNF') {
            parser.push('UNF');
        }
    }
    if (fieldOptions.NOINDEX) {
        parser.push('NOINDEX');
    }
}
function parseSchema(parser, schema) {
    for (const [field, fieldOptions] of Object.entries(schema)) {
        parser.push(field);
        if (typeof fieldOptions === 'string') {
            parser.push(fieldOptions);
            continue;
        }
        if (fieldOptions.AS) {
            parser.push('AS', fieldOptions.AS);
        }
        parser.push(fieldOptions.type);
        if (fieldOptions.INDEXMISSING) {
            parser.push('INDEXMISSING');
        }
        switch (fieldOptions.type) {
            case exports.SCHEMA_FIELD_TYPE.TEXT:
                if (fieldOptions.NOSTEM) {
                    parser.push('NOSTEM');
                }
                if (fieldOptions.WEIGHT !== undefined) {
                    parser.push('WEIGHT', fieldOptions.WEIGHT.toString());
                }
                if (fieldOptions.PHONETIC) {
                    parser.push('PHONETIC', fieldOptions.PHONETIC);
                }
                if (fieldOptions.WITHSUFFIXTRIE) {
                    parser.push('WITHSUFFIXTRIE');
                }
                if (fieldOptions.INDEXEMPTY) {
                    parser.push('INDEXEMPTY');
                }
                parseCommonSchemaFieldOptions(parser, fieldOptions);
                break;
            case exports.SCHEMA_FIELD_TYPE.NUMERIC:
            case exports.SCHEMA_FIELD_TYPE.GEO:
                parseCommonSchemaFieldOptions(parser, fieldOptions);
                break;
            case exports.SCHEMA_FIELD_TYPE.TAG:
                if (fieldOptions.SEPARATOR) {
                    parser.push('SEPARATOR', fieldOptions.SEPARATOR);
                }
                if (fieldOptions.CASESENSITIVE) {
                    parser.push('CASESENSITIVE');
                }
                if (fieldOptions.WITHSUFFIXTRIE) {
                    parser.push('WITHSUFFIXTRIE');
                }
                if (fieldOptions.INDEXEMPTY) {
                    parser.push('INDEXEMPTY');
                }
                parseCommonSchemaFieldOptions(parser, fieldOptions);
                break;
            case exports.SCHEMA_FIELD_TYPE.VECTOR:
                parser.push(fieldOptions.ALGORITHM);
                const args = [];
                args.push('TYPE', fieldOptions.TYPE, 'DIM', fieldOptions.DIM.toString(), 'DISTANCE_METRIC', fieldOptions.DISTANCE_METRIC);
                if (fieldOptions.INITIAL_CAP !== undefined) {
                    args.push('INITIAL_CAP', fieldOptions.INITIAL_CAP.toString());
                }
                switch (fieldOptions.ALGORITHM) {
                    case exports.SCHEMA_VECTOR_FIELD_ALGORITHM.FLAT:
                        if (fieldOptions.BLOCK_SIZE !== undefined) {
                            args.push('BLOCK_SIZE', fieldOptions.BLOCK_SIZE.toString());
                        }
                        break;
                    case exports.SCHEMA_VECTOR_FIELD_ALGORITHM.HNSW:
                        if (fieldOptions.M !== undefined) {
                            args.push('M', fieldOptions.M.toString());
                        }
                        if (fieldOptions.EF_CONSTRUCTION !== undefined) {
                            args.push('EF_CONSTRUCTION', fieldOptions.EF_CONSTRUCTION.toString());
                        }
                        if (fieldOptions.EF_RUNTIME !== undefined) {
                            args.push('EF_RUNTIME', fieldOptions.EF_RUNTIME.toString());
                        }
                        break;
                    case exports.SCHEMA_VECTOR_FIELD_ALGORITHM['VAMANA']:
                        if (fieldOptions.COMPRESSION) {
                            args.push('COMPRESSION', fieldOptions.COMPRESSION);
                        }
                        if (fieldOptions.CONSTRUCTION_WINDOW_SIZE !== undefined) {
                            args.push('CONSTRUCTION_WINDOW_SIZE', fieldOptions.CONSTRUCTION_WINDOW_SIZE.toString());
                        }
                        if (fieldOptions.GRAPH_MAX_DEGREE !== undefined) {
                            args.push('GRAPH_MAX_DEGREE', fieldOptions.GRAPH_MAX_DEGREE.toString());
                        }
                        if (fieldOptions.SEARCH_WINDOW_SIZE !== undefined) {
                            args.push('SEARCH_WINDOW_SIZE', fieldOptions.SEARCH_WINDOW_SIZE.toString());
                        }
                        if (fieldOptions.EPSILON !== undefined) {
                            args.push('EPSILON', fieldOptions.EPSILON.toString());
                        }
                        if (fieldOptions.TRAINING_THRESHOLD !== undefined) {
                            args.push('TRAINING_THRESHOLD', fieldOptions.TRAINING_THRESHOLD.toString());
                        }
                        if (fieldOptions.REDUCE !== undefined) {
                            args.push('REDUCE', fieldOptions.REDUCE.toString());
                        }
                        break;
                }
                parser.pushVariadicWithLength(args);
                break;
            case exports.SCHEMA_FIELD_TYPE.GEOSHAPE:
                if (fieldOptions.COORD_SYSTEM !== undefined) {
                    parser.push('COORD_SYSTEM', fieldOptions.COORD_SYSTEM);
                }
                break;
        }
    }
}
exports.parseSchema = parseSchema;
exports.REDISEARCH_LANGUAGE = {
    ARABIC: 'Arabic',
    BASQUE: 'Basque',
    CATALANA: 'Catalan',
    DANISH: 'Danish',
    DUTCH: 'Dutch',
    ENGLISH: 'English',
    FINNISH: 'Finnish',
    FRENCH: 'French',
    GERMAN: 'German',
    GREEK: 'Greek',
    HUNGARIAN: 'Hungarian',
    INDONESAIN: 'Indonesian',
    IRISH: 'Irish',
    ITALIAN: 'Italian',
    LITHUANIAN: 'Lithuanian',
    NEPALI: 'Nepali',
    NORWEIGAN: 'Norwegian',
    PORTUGUESE: 'Portuguese',
    ROMANIAN: 'Romanian',
    RUSSIAN: 'Russian',
    SPANISH: 'Spanish',
    SWEDISH: 'Swedish',
    TAMIL: 'Tamil',
    TURKISH: 'Turkish',
    CHINESE: 'Chinese'
};
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Creates a new search index with the given schema and options.
     * @param parser - The command parser
     * @param index - Name of the index to create
     * @param schema - Index schema defining field names and types (TEXT, NUMERIC, GEO, TAG, VECTOR, GEOSHAPE)
     * @param options - Optional parameters:
     *   - ON: Type of container to index (HASH or JSON)
     *   - PREFIX: Prefixes for document keys to index
     *   - FILTER: Expression that filters indexed documents
     *   - LANGUAGE/LANGUAGE_FIELD: Default language for indexing
     *   - SCORE/SCORE_FIELD: Document ranking parameters
     *   - MAXTEXTFIELDS: Index all text fields without specifying them
     *   - TEMPORARY: Create a temporary index
     *   - NOOFFSETS/NOHL/NOFIELDS/NOFREQS: Index optimization flags
     *   - STOPWORDS: Custom stopword list
     */
    parseCommand(parser, index, schema, options) {
        parser.push('FT.CREATE', index);
        if (options?.ON) {
            parser.push('ON', options.ON);
        }
        (0, generic_transformers_1.parseOptionalVariadicArgument)(parser, 'PREFIX', options?.PREFIX);
        if (options?.FILTER) {
            parser.push('FILTER', options.FILTER);
        }
        if (options?.LANGUAGE) {
            parser.push('LANGUAGE', options.LANGUAGE);
        }
        if (options?.LANGUAGE_FIELD) {
            parser.push('LANGUAGE_FIELD', options.LANGUAGE_FIELD);
        }
        if (options?.SCORE) {
            parser.push('SCORE', options.SCORE.toString());
        }
        if (options?.SCORE_FIELD) {
            parser.push('SCORE_FIELD', options.SCORE_FIELD);
        }
        // if (options?.PAYLOAD_FIELD) {
        //     parser.push('PAYLOAD_FIELD', options.PAYLOAD_FIELD);
        // }
        if (options?.MAXTEXTFIELDS) {
            parser.push('MAXTEXTFIELDS');
        }
        if (options?.TEMPORARY) {
            parser.push('TEMPORARY', options.TEMPORARY.toString());
        }
        if (options?.NOOFFSETS) {
            parser.push('NOOFFSETS');
        }
        if (options?.NOHL) {
            parser.push('NOHL');
        }
        if (options?.NOFIELDS) {
            parser.push('NOFIELDS');
        }
        if (options?.NOFREQS) {
            parser.push('NOFREQS');
        }
        if (options?.SKIPINITIALSCAN) {
            parser.push('SKIPINITIALSCAN');
        }
        (0, generic_transformers_1.parseOptionalVariadicArgument)(parser, 'STOPWORDS', options?.STOPWORDS);
        parser.push('SCHEMA');
        parseSchema(parser, schema);
    },
    transformReply: undefined
};
//# sourceMappingURL=CREATE.js.map