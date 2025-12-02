"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns information and statistics about an index.
     * @param parser - The command parser
     * @param index - Name of the index to get information about
     */
    parseCommand(parser, index) {
        parser.push('FT.INFO', index);
    },
    transformReply: {
        2: transformV2Reply,
        3: undefined
    },
    unstableResp3: true
};
function transformV2Reply(reply, preserve, typeMapping) {
    const myTransformFunc = (0, generic_transformers_1.createTransformTuplesReplyFunc)(preserve, typeMapping);
    const ret = {};
    for (let i = 0; i < reply.length; i += 2) {
        const key = reply[i].toString();
        switch (key) {
            case 'index_name':
            case 'index_options':
            case 'num_docs':
            case 'max_doc_id':
            case 'num_terms':
            case 'num_records':
            case 'total_inverted_index_blocks':
            case 'hash_indexing_failures':
            case 'indexing':
            case 'number_of_uses':
            case 'cleaning':
            case 'stopwords_list':
                ret[key] = reply[i + 1];
                break;
            case 'inverted_sz_mb':
            case 'vector_index_sz_mb':
            case 'offset_vectors_sz_mb':
            case 'doc_table_size_mb':
            case 'sortable_values_size_mb':
            case 'key_table_size_mb':
            case 'text_overhead_sz_mb':
            case 'tag_overhead_sz_mb':
            case 'total_index_memory_sz_mb':
            case 'geoshapes_sz_mb':
            case 'records_per_doc_avg':
            case 'bytes_per_record_avg':
            case 'offsets_per_term_avg':
            case 'offset_bits_per_record_avg':
            case 'total_indexing_time':
            case 'percent_indexed':
                ret[key] = generic_transformers_1.transformDoubleReply[2](reply[i + 1], undefined, typeMapping);
                break;
            case 'index_definition':
                ret[key] = myTransformFunc(reply[i + 1]);
                break;
            case 'attributes':
                ret[key] = reply[i + 1].map(attribute => myTransformFunc(attribute));
                break;
            case 'gc_stats': {
                const innerRet = {};
                const array = reply[i + 1];
                for (let i = 0; i < array.length; i += 2) {
                    const innerKey = array[i].toString();
                    switch (innerKey) {
                        case 'bytes_collected':
                        case 'total_ms_run':
                        case 'total_cycles':
                        case 'average_cycle_time_ms':
                        case 'last_run_time_ms':
                        case 'gc_numeric_trees_missed':
                        case 'gc_blocks_denied':
                            innerRet[innerKey] = generic_transformers_1.transformDoubleReply[2](array[i + 1], undefined, typeMapping);
                            break;
                    }
                }
                ret[key] = innerRet;
                break;
            }
            case 'cursor_stats': {
                const innerRet = {};
                const array = reply[i + 1];
                for (let i = 0; i < array.length; i += 2) {
                    const innerKey = array[i].toString();
                    switch (innerKey) {
                        case 'global_idle':
                        case 'global_total':
                        case 'index_capacity':
                        case 'index_total':
                            innerRet[innerKey] = array[i + 1];
                            break;
                    }
                }
                ret[key] = innerRet;
                break;
            }
        }
    }
    return ret;
}
//# sourceMappingURL=INFO.js.map