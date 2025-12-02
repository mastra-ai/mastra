import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument } from "@redis/client";
import { ArrayReply, BlobStringReply, DoubleReply, MapReply, NullReply, NumberReply, ReplyUnion, SimpleStringReply, TypeMapping } from "@redis/client/dist/lib/RESP/types";
import { TuplesReply } from '@redis/client/dist/lib/RESP/types';
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns information and statistics about an index.
     * @param parser - The command parser
     * @param index - Name of the index to get information about
     */
    readonly parseCommand: (this: void, parser: CommandParser, index: RedisArgument) => void;
    readonly transformReply: {
        readonly 2: typeof transformV2Reply;
        readonly 3: () => ReplyUnion;
    };
    readonly unstableResp3: true;
};
export default _default;
export interface InfoReply {
    index_name: SimpleStringReply;
    index_options: ArrayReply<SimpleStringReply>;
    index_definition: MapReply<SimpleStringReply, SimpleStringReply>;
    attributes: Array<MapReply<SimpleStringReply, SimpleStringReply>>;
    num_docs: NumberReply;
    max_doc_id: NumberReply;
    num_terms: NumberReply;
    num_records: NumberReply;
    inverted_sz_mb: DoubleReply;
    vector_index_sz_mb: DoubleReply;
    total_inverted_index_blocks: NumberReply;
    offset_vectors_sz_mb: DoubleReply;
    doc_table_size_mb: DoubleReply;
    sortable_values_size_mb: DoubleReply;
    key_table_size_mb: DoubleReply;
    tag_overhead_sz_mb: DoubleReply;
    text_overhead_sz_mb: DoubleReply;
    total_index_memory_sz_mb: DoubleReply;
    geoshapes_sz_mb: DoubleReply;
    records_per_doc_avg: DoubleReply;
    bytes_per_record_avg: DoubleReply;
    offsets_per_term_avg: DoubleReply;
    offset_bits_per_record_avg: DoubleReply;
    hash_indexing_failures: NumberReply;
    total_indexing_time: DoubleReply;
    indexing: NumberReply;
    percent_indexed: DoubleReply;
    number_of_uses: NumberReply;
    cleaning: NumberReply;
    gc_stats: {
        bytes_collected: DoubleReply;
        total_ms_run: DoubleReply;
        total_cycles: DoubleReply;
        average_cycle_time_ms: DoubleReply;
        last_run_time_ms: DoubleReply;
        gc_numeric_trees_missed: DoubleReply;
        gc_blocks_denied: DoubleReply;
    };
    cursor_stats: {
        global_idle: NumberReply;
        global_total: NumberReply;
        index_capacity: NumberReply;
        index_total: NumberReply;
    };
    stopwords_list?: ArrayReply<BlobStringReply> | TuplesReply<[NullReply]>;
}
declare function transformV2Reply(reply: Array<any>, preserve?: any, typeMapping?: TypeMapping): InfoReply;
//# sourceMappingURL=INFO.d.ts.map