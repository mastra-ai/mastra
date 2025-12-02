import type { DataFormat } from './data_formatter';
/**
 * @see {@link https://github.com/ClickHouse/ClickHouse/blob/46ed4f6cdf68fbbdc59fbe0f0bfa9a361cc0dec1/src/Core/Settings.h}
 * @see {@link https://github.com/ClickHouse/ClickHouse/blob/eae2667a1c29565c801be0ffd465f8bfcffe77ef/src/Storages/MergeTree/MergeTreeSettings.h}
 */
interface ClickHouseServerSettings {
    /** Write add http CORS header. */
    add_http_cors_header?: Bool;
    /** Additional filter expression which would be applied to query result */
    additional_result_filter?: string;
    /** Additional filter expression which would be applied after reading from specified table. Syntax: {'table1': 'expression', 'database.table2': 'expression'} */
    additional_table_filters?: Map;
    /** Rewrite all aggregate functions in a query, adding -OrNull suffix to them */
    aggregate_functions_null_for_empty?: Bool;
    /** Maximal size of block in bytes accumulated during aggregation in order of primary key. Lower block size allows to parallelize more final merge stage of aggregation. */
    aggregation_in_order_max_block_bytes?: UInt64;
    /** Number of threads to use for merge intermediate aggregation results in memory efficient mode. When bigger, then more memory is consumed. 0 means - same as 'max_threads'. */
    aggregation_memory_efficient_merge_threads?: UInt64;
    /** Enable independent aggregation of partitions on separate threads when partition key suits group by key. Beneficial when number of partitions close to number of cores and partitions have roughly the same size */
    allow_aggregate_partitions_independently?: Bool;
    /** Use background I/O pool to read from MergeTree tables. This setting may increase performance for I/O bound queries */
    allow_asynchronous_read_from_io_pool_for_merge_tree?: Bool;
    /** Allow HedgedConnections to change replica until receiving first data packet */
    allow_changing_replica_until_first_data_packet?: Bool;
    /** Allow CREATE INDEX query without TYPE. Query will be ignored. Made for SQL compatibility tests. */
    allow_create_index_without_type?: Bool;
    /** Enable custom error code in function throwIf(). If true, thrown exceptions may have unexpected error codes. */
    allow_custom_error_code_in_throwif?: Bool;
    /** If it is set to true, then a user is allowed to executed DDL queries. */
    allow_ddl?: Bool;
    /** Allow to create databases with deprecated Ordinary engine */
    allow_deprecated_database_ordinary?: Bool;
    /** Allow to create *MergeTree tables with deprecated engine definition syntax */
    allow_deprecated_syntax_for_merge_tree?: Bool;
    /** If it is set to true, then a user is allowed to executed distributed DDL queries. */
    allow_distributed_ddl?: Bool;
    /** Allow ALTER TABLE ... DROP DETACHED PART[ITION] ... queries */
    allow_drop_detached?: Bool;
    /** Allow execute multiIf function columnar */
    allow_execute_multiif_columnar?: Bool;
    /** Allow atomic alter on Materialized views. Work in progress. */
    allow_experimental_alter_materialized_view_structure?: Bool;
    /** Allow experimental analyzer */
    allow_experimental_analyzer?: Bool;
    /** Allows to use Annoy index. Disabled by default because this feature is experimental */
    allow_experimental_annoy_index?: Bool;
    /** If it is set to true, allow to specify experimental compression codecs (but we don't have those yet and this option does nothing). */
    allow_experimental_codecs?: Bool;
    /** Allow to create database with Engine=MaterializedMySQL(...). */
    allow_experimental_database_materialized_mysql?: Bool;
    /** Allow to create database with Engine=MaterializedPostgreSQL(...). */
    allow_experimental_database_materialized_postgresql?: Bool;
    /** Allow to create databases with Replicated engine */
    allow_experimental_database_replicated?: Bool;
    /** Enable experimental functions for funnel analysis. */
    allow_experimental_funnel_functions?: Bool;
    /** Enable experimental hash functions */
    allow_experimental_hash_functions?: Bool;
    /** If it is set to true, allow to use experimental inverted index. */
    allow_experimental_inverted_index?: Bool;
    /** Enable LIVE VIEW. Not mature enough. */
    allow_experimental_live_view?: Bool;
    /** Enable experimental functions for natural language processing. */
    allow_experimental_nlp_functions?: Bool;
    /** Allow Object and JSON data types */
    allow_experimental_object_type?: Bool;
    /** Use all the replicas from a shard for SELECT query execution. Reading is parallelized and coordinated dynamically. 0 - disabled, 1 - enabled, silently disable them in case of failure, 2 - enabled, throw an exception in case of failure */
    allow_experimental_parallel_reading_from_replicas?: UInt64;
    /** Experimental data deduplication for SELECT queries based on part UUIDs */
    allow_experimental_query_deduplication?: Bool;
    /** Allow to use undrop query to restore dropped table in a limited time */
    allow_experimental_undrop_table_query?: Bool;
    /** Enable WINDOW VIEW. Not mature enough. */
    allow_experimental_window_view?: Bool;
    /** Support join with inequal conditions which involve columns from both left and right table. e.g. t1.y < t2.y. */
    allow_experimental_join_condition?: Bool;
    /** Since ClickHouse 24.1 */
    allow_experimental_variant_type?: Bool;
    /** Since ClickHouse 24.5 */
    allow_experimental_dynamic_type?: Bool;
    /** Since ClickHouse 24.8 */
    allow_experimental_json_type?: Bool;
    /** Since ClickHouse 25.3 */
    enable_json_type?: Bool;
    /** Since ClickHouse 25.6 */
    enable_time_time64_type?: Bool;
    /** Allow functions that use Hyperscan library. Disable to avoid potentially long compilation times and excessive resource usage. */
    allow_hyperscan?: Bool;
    /** Allow functions for introspection of ELF and DWARF for query profiling. These functions are slow and may impose security considerations. */
    allow_introspection_functions?: Bool;
    /** Allow to execute alters which affects not only tables metadata, but also data on disk */
    allow_non_metadata_alters?: Bool;
    /** Allow non-const timezone arguments in certain time-related functions like toTimeZone(), fromUnixTimestamp*(), snowflakeToDateTime*() */
    allow_nonconst_timezone_arguments?: Bool;
    /** Allow non-deterministic functions in ALTER UPDATE/ALTER DELETE statements */
    allow_nondeterministic_mutations?: Bool;
    /** Allow non-deterministic functions (includes dictGet) in sharding_key for optimize_skip_unused_shards */
    allow_nondeterministic_optimize_skip_unused_shards?: Bool;
    /** Prefer prefethed threadpool if all parts are on remote filesystem */
    allow_prefetched_read_pool_for_local_filesystem?: Bool;
    /** Prefer prefethed threadpool if all parts are on remote filesystem */
    allow_prefetched_read_pool_for_remote_filesystem?: Bool;
    /** Allows push predicate when subquery contains WITH clause */
    allow_push_predicate_when_subquery_contains_with?: Bool;
    /** Allow SETTINGS after FORMAT, but note, that this is not always safe (note: this is a compatibility setting). */
    allow_settings_after_format_in_insert?: Bool;
    /** Allow using simdjson library in 'JSON*' functions if AVX2 instructions are available. If disabled rapidjson will be used. */
    allow_simdjson?: Bool;
    /** If it is set to true, allow to specify meaningless compression codecs. */
    allow_suspicious_codecs?: Bool;
    /** In CREATE TABLE statement allows creating columns of type FixedString(n) with n > 256. FixedString with length >= 256 is suspicious and most likely indicates misusage */
    allow_suspicious_fixed_string_types?: Bool;
    /** Reject primary/secondary indexes and sorting keys with identical expressions */
    allow_suspicious_indices?: Bool;
    /** In CREATE TABLE statement allows specifying LowCardinality modifier for types of small fixed size (8 or less). Enabling this may increase merge times and memory consumption. */
    allow_suspicious_low_cardinality_types?: Bool;
    /** Allow unrestricted (without condition on path) reads from system.zookeeper table, can be handy, but is not safe for zookeeper */
    allow_unrestricted_reads_from_keeper?: Bool;
    /** Output information about affected parts. Currently, works only for FREEZE and ATTACH commands. */
    alter_partition_verbose_result?: Bool;
    /** Wait for actions to manipulate the partitions. 0 - do not wait, 1 - wait for execution only of itself, 2 - wait for everyone. */
    alter_sync?: UInt64;
    /** SELECT queries search up to this many nodes in Annoy indexes. */
    annoy_index_search_k_nodes?: Int64;
    /** Enable old ANY JOIN logic with many-to-one left-to-right table keys mapping for all ANY JOINs. It leads to confusing not equal results for 't1 ANY LEFT JOIN t2' and 't2 ANY RIGHT JOIN t1'. ANY RIGHT JOIN needs one-to-many keys mapping to be consistent with LEFT one. */
    any_join_distinct_right_table_keys?: Bool;
    /** Include ALIAS columns for wildcard query */
    asterisk_include_alias_columns?: Bool;
    /** Include MATERIALIZED columns for wildcard query */
    asterisk_include_materialized_columns?: Bool;
    /** If true, data from INSERT query is stored in queue and later flushed to table in background. If wait_for_async_insert is false, INSERT query is processed almost instantly, otherwise client will wait until data will be flushed to table */
    async_insert?: Bool;
    /** Maximum time to wait before dumping collected data per query since the first data appeared */
    async_insert_busy_timeout_ms?: Milliseconds;
    /** For async INSERT queries in the replicated table, specifies that deduplication of insertings blocks should be performed */
    async_insert_deduplicate?: Bool;
    /** Maximum size in bytes of unparsed data collected per query before being inserted */
    async_insert_max_data_size?: UInt64;
    /** Maximum number of insert queries before being inserted */
    async_insert_max_query_number?: UInt64;
    /** Asynchronously create connections and send query to shards in remote query */
    async_query_sending_for_remote?: Bool;
    /** Asynchronously read from socket executing remote query */
    async_socket_for_remote?: Bool;
    /** Enables or disables creating a new file on each insert in azure engine tables */
    azure_create_new_file_on_insert?: Bool;
    /** Maximum number of files that could be returned in batch by ListObject request */
    azure_list_object_keys_size?: UInt64;
    /** The maximum size of object to upload using singlepart upload to Azure blob storage. */
    azure_max_single_part_upload_size?: UInt64;
    /** The maximum number of retries during single Azure blob storage read. */
    azure_max_single_read_retries?: UInt64;
    /** Enables or disables truncate before insert in azure engine tables. */
    azure_truncate_on_insert?: Bool;
    /** Maximum size of batch for multiread request to [Zoo]Keeper during backup or restore */
    backup_restore_batch_size_for_keeper_multiread?: UInt64;
    /** Approximate probability of failure for a keeper request during backup or restore. Valid value is in interval [0.0f, 1.0f] */
    backup_restore_keeper_fault_injection_probability?: Float;
    /** 0 - random seed, otherwise the setting value */
    backup_restore_keeper_fault_injection_seed?: UInt64;
    /** Max retries for keeper operations during backup or restore */
    backup_restore_keeper_max_retries?: UInt64;
    /** Initial backoff timeout for [Zoo]Keeper operations during backup or restore */
    backup_restore_keeper_retry_initial_backoff_ms?: UInt64;
    /** Max backoff timeout for [Zoo]Keeper operations during backup or restore */
    backup_restore_keeper_retry_max_backoff_ms?: UInt64;
    /** Maximum size of data of a [Zoo]Keeper's node during backup */
    backup_restore_keeper_value_max_size?: UInt64;
    /** Text to represent bool value in TSV/CSV formats. */
    bool_false_representation?: string;
    /** Text to represent bool value in TSV/CSV formats. */
    bool_true_representation?: string;
    /** Calculate text stack trace in case of exceptions during query execution. This is the default. It requires symbol lookups that may slow down fuzzing tests when huge amount of wrong queries are executed. In normal cases you should not disable this option. */
    calculate_text_stack_trace?: Bool;
    /** Cancel HTTP readonly queries when a client closes the connection without waiting for response. */
    cancel_http_readonly_queries_on_client_close?: Bool;
    /** CAST operator into IPv4, CAST operator into IPV6 type, toIPv4, toIPv6 functions will return default value instead of throwing exception on conversion error. */
    cast_ipv4_ipv6_default_on_conversion_error?: Bool;
    /** CAST operator keep Nullable for result data type */
    cast_keep_nullable?: Bool;
    /** Return check query result as single 1/0 value */
    check_query_single_value_result?: Bool;
    /** Check that DDL query (such as DROP TABLE or RENAME) will not break referential dependencies */
    check_referential_table_dependencies?: Bool;
    /** Check that DDL query (such as DROP TABLE or RENAME) will not break dependencies */
    check_table_dependencies?: Bool;
    /** Validate checksums on reading. It is enabled by default and should be always enabled in production. Please do not expect any benefits in disabling this setting. It may only be used for experiments and benchmarks. The setting only applicable for tables of MergeTree family. Checksums are always validated for other table engines and when receiving data over network. */
    checksum_on_read?: Bool;
    /** Cluster for a shard in which current server is located */
    cluster_for_parallel_replicas?: string;
    /** Enable collecting hash table statistics to optimize memory allocation */
    collect_hash_table_stats_during_aggregation?: Bool;
    /** The list of column names to use in schema inference for formats without column names. The format: 'column1,column2,column3,...' */
    column_names_for_schema_inference?: string;
    /** Changes other settings according to provided ClickHouse version. If we know that we changed some behaviour in ClickHouse by changing some settings in some version, this compatibility setting will control these settings */
    compatibility?: string;
    /** Ignore AUTO_INCREMENT keyword in column declaration if true, otherwise return error. It simplifies migration from MySQL */
    compatibility_ignore_auto_increment_in_create_table?: Bool;
    /** Compatibility ignore collation in create table */
    compatibility_ignore_collation_in_create_table?: Bool;
    /** Compile aggregate functions to native code. This feature has a bug and should not be used. */
    compile_aggregate_expressions?: Bool;
    /** Compile some scalar functions and operators to native code. */
    compile_expressions?: Bool;
    /** Compile sort description to native code. */
    compile_sort_description?: Bool;
    /** Connection timeout if there are no replicas. */
    connect_timeout?: Seconds;
    /** Connection timeout for selecting first healthy replica. */
    connect_timeout_with_failover_ms?: Milliseconds;
    /** Connection timeout for selecting first healthy replica (for secure connections). */
    connect_timeout_with_failover_secure_ms?: Milliseconds;
    /** The wait time when the connection pool is full. */
    connection_pool_max_wait_ms?: Milliseconds;
    /** The maximum number of attempts to connect to replicas. */
    connections_with_failover_max_tries?: UInt64;
    /** Convert SELECT query to CNF */
    convert_query_to_cnf?: Bool;
    /** What aggregate function to use for implementation of count(DISTINCT ...) */
    count_distinct_implementation?: string;
    /** Rewrite count distinct to subquery of group by */
    count_distinct_optimization?: Bool;
    /** Use inner join instead of comma/cross join if there're joining expressions in the WHERE section. Values: 0 - no rewrite, 1 - apply if possible for comma/cross, 2 - force rewrite all comma joins, cross - if possible */
    cross_to_inner_join_rewrite?: UInt64;
    /** Data types without NULL or NOT NULL will make Nullable */
    data_type_default_nullable?: Bool;
    /** When executing DROP or DETACH TABLE in Atomic database, wait for table data to be finally dropped or detached. */
    database_atomic_wait_for_drop_and_detach_synchronously?: Bool;
    /** Allow to create only Replicated tables in database with engine Replicated */
    database_replicated_allow_only_replicated_engine?: Bool;
    /** Allow to create only Replicated tables in database with engine Replicated with explicit arguments */
    database_replicated_allow_replicated_engine_arguments?: Bool;
    /** Execute DETACH TABLE as DETACH TABLE PERMANENTLY if database engine is Replicated */
    database_replicated_always_detach_permanently?: Bool;
    /** Enforces synchronous waiting for some queries (see also database_atomic_wait_for_drop_and_detach_synchronously, mutation_sync, alter_sync). Not recommended to enable these settings. */
    database_replicated_enforce_synchronous_settings?: Bool;
    /** How long initial DDL query should wait for Replicated database to precess previous DDL queue entries */
    database_replicated_initial_query_timeout_sec?: UInt64;
    /** Method to read DateTime from text input formats. Possible values: 'basic', 'best_effort' and 'best_effort_us'. */
    date_time_input_format?: DateTimeInputFormat;
    /** Method to write DateTime to text output. Possible values: 'simple', 'iso', 'unix_timestamp'. */
    date_time_output_format?: DateTimeOutputFormat;
    /** Check overflow of decimal arithmetic/comparison operations */
    decimal_check_overflow?: Bool;
    /** Should deduplicate blocks for materialized views if the block is not a duplicate for the table. Use true to always deduplicate in dependent tables. */
    deduplicate_blocks_in_dependent_materialized_views?: Bool;
    /** Maximum size of right-side table if limit is required but max_bytes_in_join is not set. */
    default_max_bytes_in_join?: UInt64;
    /** Default table engine used when ENGINE is not set in CREATE statement. */
    default_table_engine?: DefaultTableEngine;
    /** Default table engine used when ENGINE is not set in CREATE TEMPORARY statement. */
    default_temporary_table_engine?: DefaultTableEngine;
    /** Deduce concrete type of columns of type Object in DESCRIBE query */
    describe_extend_object_types?: Bool;
    /** If true, subcolumns of all table columns will be included into result of DESCRIBE query */
    describe_include_subcolumns?: Bool;
    /** Which dialect will be used to parse query */
    dialect?: Dialect;
    /** Execute a pipeline for reading from a dictionary with several threads. It's supported only by DIRECT dictionary with CLICKHOUSE source. */
    dictionary_use_async_executor?: Bool;
    /**  Allows to disable decoding/encoding path in uri in URL table engine */
    disable_url_encoding?: Bool;
    /** What to do when the limit is exceeded. */
    distinct_overflow_mode?: OverflowMode;
    /** Is the memory-saving mode of distributed aggregation enabled. */
    distributed_aggregation_memory_efficient?: Bool;
    /** Maximum number of connections with one remote server in the pool. */
    distributed_connections_pool_size?: UInt64;
    /** Compatibility version of distributed DDL (ON CLUSTER) queries */
    distributed_ddl_entry_format_version?: UInt64;
    /** Format of distributed DDL query result */
    distributed_ddl_output_mode?: DistributedDDLOutputMode;
    /** Timeout for DDL query responses from all hosts in cluster. If a ddl request has not been performed on all hosts, a response will contain a timeout error and a request will be executed in an async mode. Negative value means infinite. Zero means async mode. */
    distributed_ddl_task_timeout?: Int64;
    /** Should StorageDistributed DirectoryMonitors try to batch individual inserts into bigger ones. */
    distributed_directory_monitor_batch_inserts?: Bool;
    /** Maximum sleep time for StorageDistributed DirectoryMonitors, it limits exponential growth too. */
    distributed_directory_monitor_max_sleep_time_ms?: Milliseconds;
    /** Sleep time for StorageDistributed DirectoryMonitors, in case of any errors delay grows exponentially. */
    distributed_directory_monitor_sleep_time_ms?: Milliseconds;
    /** Should StorageDistributed DirectoryMonitors try to split batch into smaller in case of failures. */
    distributed_directory_monitor_split_batch_on_failure?: Bool;
    /** If 1, Do not merge aggregation states from different servers for distributed queries (shards will process query up to the Complete stage, initiator just proxies the data from the shards). If 2 the initiator will apply ORDER BY and LIMIT stages (it is not in case when shard process query up to the Complete stage) */
    distributed_group_by_no_merge?: UInt64;
    /** How are distributed subqueries performed inside IN or JOIN sections? */
    distributed_product_mode?: DistributedProductMode;
    /** If 1, LIMIT will be applied on each shard separately. Usually you don't need to use it, since this will be done automatically if it is possible, i.e. for simple query SELECT FROM LIMIT. */
    distributed_push_down_limit?: UInt64;
    /** Max number of errors per replica, prevents piling up an incredible amount of errors if replica was offline for some time and allows it to be reconsidered in a shorter amount of time. */
    distributed_replica_error_cap?: UInt64;
    /** Time period reduces replica error counter by 2 times. */
    distributed_replica_error_half_life?: Seconds;
    /** Number of errors that will be ignored while choosing replicas */
    distributed_replica_max_ignored_errors?: UInt64;
    /** Merge parts only in one partition in select final */
    do_not_merge_across_partitions_select_final?: Bool;
    /** Return empty result when aggregating by constant keys on empty set. */
    empty_result_for_aggregation_by_constant_keys_on_empty_set?: Bool;
    /** Return empty result when aggregating without keys on empty set. */
    empty_result_for_aggregation_by_empty_set?: Bool;
    /** Enable/disable the DEFLATE_QPL codec. */
    enable_deflate_qpl_codec?: Bool;
    /** Enable query optimization where we analyze function and subqueries results and rewrite query if there're constants there */
    enable_early_constant_folding?: Bool;
    /** Enable date functions like toLastDayOfMonth return Date32 results (instead of Date results) for Date32/DateTime64 arguments. */
    enable_extended_results_for_datetime_functions?: Bool;
    /** Use cache for remote filesystem. This setting does not turn on/off cache for disks (must be done via disk config), but allows to bypass cache for some queries if intended */
    enable_filesystem_cache?: Bool;
    /** Allows to record the filesystem caching log for each query */
    enable_filesystem_cache_log?: Bool;
    /** Write into cache on write operations. To actually work this setting requires be added to disk config too */
    enable_filesystem_cache_on_write_operations?: Bool;
    /** Log to system.filesystem prefetch_log during query. Should be used only for testing or debugging, not recommended to be turned on by default */
    enable_filesystem_read_prefetches_log?: Bool;
    /** Propagate WITH statements to UNION queries and all subqueries */
    enable_global_with_statement?: Bool;
    /** Compress the result if the client over HTTP said that it understands data compressed by gzip or deflate. */
    enable_http_compression?: Bool;
    /** Output stack trace of a job creator when job results in exception */
    enable_job_stack_trace?: Bool;
    /** Enable lightweight DELETE mutations for mergetree tables. */
    enable_lightweight_delete?: Bool;
    /** Enable memory bound merging strategy for aggregation. */
    enable_memory_bound_merging_of_aggregation_results?: Bool;
    /** Move more conditions from WHERE to PREWHERE and do reads from disk and filtering in multiple steps if there are multiple conditions combined with AND */
    enable_multiple_prewhere_read_steps?: Bool;
    /** If it is set to true, optimize predicates to subqueries. */
    enable_optimize_predicate_expression?: Bool;
    /** Allow push predicate to final subquery. */
    enable_optimize_predicate_expression_to_final_subquery?: Bool;
    /** Enable positional arguments in ORDER BY, GROUP BY and LIMIT BY */
    enable_positional_arguments?: Bool;
    /** Enable reading results of SELECT queries from the query cache */
    enable_reads_from_query_cache?: Bool;
    /** Enable very explicit logging of S3 requests. Makes sense for debug only. */
    enable_s3_requests_logging?: Bool;
    /** If it is set to true, prevent scalar subqueries from (de)serializing large scalar values and possibly avoid running the same subquery more than once. */
    enable_scalar_subquery_optimization?: Bool;
    /** Allow sharing set objects build for IN subqueries between different tasks of the same mutation. This reduces memory usage and CPU consumption */
    enable_sharing_sets_for_mutations?: Bool;
    /** Enable use of software prefetch in aggregation */
    enable_software_prefetch_in_aggregation?: Bool;
    /** Allow ARRAY JOIN with multiple arrays that have different sizes. When this settings is enabled, arrays will be resized to the longest one. */
    enable_unaligned_array_join?: Bool;
    /** Enable storing results of SELECT queries in the query cache */
    enable_writes_to_query_cache?: Bool;
    /** Enables or disables creating a new file on each insert in file engine tables if format has suffix. */
    engine_file_allow_create_multiple_files?: Bool;
    /** Allows to select data from a file engine table without file */
    engine_file_empty_if_not_exists?: Bool;
    /** Allows to skip empty files in file table engine */
    engine_file_skip_empty_files?: Bool;
    /** Enables or disables truncate before insert in file engine tables */
    engine_file_truncate_on_insert?: Bool;
    /** Allows to skip empty files in url table engine */
    engine_url_skip_empty_files?: Bool;
    /** Method to write Errors to text output. */
    errors_output_format?: string;
    /** When enabled, ClickHouse will provide exact value for rows_before_limit_at_least statistic, but with the cost that the data before limit will have to be read completely */
    exact_rows_before_limit?: Bool;
    /** Set default mode in EXCEPT query. Possible values: empty string, 'ALL', 'DISTINCT'. If empty, query without mode will throw exception. */
    except_default_mode?: SetOperationMode;
    /** Connect timeout in seconds. Now supported only for MySQL */
    external_storage_connect_timeout_sec?: UInt64;
    /** Limit maximum number of bytes when table with external engine should flush history data. Now supported only for MySQL table engine, database engine, dictionary and MaterializedMySQL. If equal to 0, this setting is disabled */
    external_storage_max_read_bytes?: UInt64;
    /** Limit maximum number of rows when table with external engine should flush history data. Now supported only for MySQL table engine, database engine, dictionary and MaterializedMySQL. If equal to 0, this setting is disabled */
    external_storage_max_read_rows?: UInt64;
    /** Read/write timeout in seconds. Now supported only for MySQL */
    external_storage_rw_timeout_sec?: UInt64;
    /** If it is set to true, external table functions will implicitly use Nullable type if needed. Otherwise NULLs will be substituted with default values. Currently supported only by 'mysql', 'postgresql' and 'odbc' table functions. */
    external_table_functions_use_nulls?: Bool;
    /** If it is set to true, transforming expression to local filter is forbidden for queries to external tables. */
    external_table_strict_query?: Bool;
    /** Max number pairs that can be produced by extractKeyValuePairs function. Used to safeguard against consuming too much memory. */
    extract_kvp_max_pairs_per_row?: UInt64;
    /** Calculate minimums and maximums of the result columns. They can be output in JSON-formats. */
    extremes?: Bool;
    /** Suppose max_replica_delay_for_distributed_queries is set and all replicas for the queried table are stale. If this setting is enabled, the query will be performed anyway, otherwise the error will be reported. */
    fallback_to_stale_replicas_for_distributed_queries?: Bool;
    /** Max remote filesystem cache size that can be downloaded by a single query */
    filesystem_cache_max_download_size?: UInt64;
    /** Maximum memory usage for prefetches. Zero means unlimited */
    filesystem_prefetch_max_memory_usage?: UInt64;
    /** Do not parallelize within one file read less than this amount of bytes. E.g. one reader will not receive a read task of size less than this amount. This setting is recommended to avoid spikes of time for aws getObject requests to aws */
    filesystem_prefetch_min_bytes_for_single_read_task?: UInt64;
    /** Prefetch step in bytes. Zero means `auto` - approximately the best prefetch step will be auto deduced, but might not be 100% the best. The actual value might be different because of setting filesystem_prefetch_min_bytes_for_single_read_task */
    filesystem_prefetch_step_bytes?: UInt64;
    /** Prefetch step in marks. Zero means `auto` - approximately the best prefetch step will be auto deduced, but might not be 100% the best. The actual value might be different because of setting filesystem_prefetch_min_bytes_for_single_read_task */
    filesystem_prefetch_step_marks?: UInt64;
    /** Maximum number of prefetches. Zero means unlimited. A setting `filesystem_prefetches_max_memory_usage` is more recommended if you want to limit the number of prefetches */
    filesystem_prefetches_limit?: UInt64;
    /** Query with the FINAL modifier by default. If the engine does not support final, it does not have any effect. On queries with multiple tables final is applied only on those that support it. It also works on distributed tables */
    final?: Bool;
    /** If true, columns of type Nested will be flattened to separate array columns instead of one array of tuples */
    flatten_nested?: Bool;
    /** Force the use of optimization when it is applicable, but heuristics decided not to use it */
    force_aggregate_partitions_independently?: Bool;
    /** Force use of aggregation in order on remote nodes during distributed aggregation. PLEASE, NEVER CHANGE THIS SETTING VALUE MANUALLY! */
    force_aggregation_in_order?: Bool;
    /** Comma separated list of strings or literals with the name of the data skipping indices that should be used during query execution, otherwise an exception will be thrown. */
    force_data_skipping_indices?: string;
    /** Make GROUPING function to return 1 when argument is not used as an aggregation key */
    force_grouping_standard_compatibility?: Bool;
    /** Throw an exception if there is a partition key in a table, and it is not used. */
    force_index_by_date?: Bool;
    /** If projection optimization is enabled, SELECT queries need to use projection */
    force_optimize_projection?: Bool;
    /** Throw an exception if unused shards cannot be skipped (1 - throw only if the table has the sharding key, 2 - always throw. */
    force_optimize_skip_unused_shards?: UInt64;
    /** Same as force_optimize_skip_unused_shards, but accept nesting level until which it will work. */
    force_optimize_skip_unused_shards_nesting?: UInt64;
    /** Throw an exception if there is primary key in a table, and it is not used. */
    force_primary_key?: Bool;
    /** Recursively remove data on DROP query. Avoids 'Directory not empty' error, but may silently remove detached data */
    force_remove_data_recursively_on_drop?: Bool;
    /** For AvroConfluent format: Confluent Schema Registry URL. */
    format_avro_schema_registry_url?: URI;
    /** The maximum allowed size for Array in RowBinary format. It prevents allocating large amount of memory in case of corrupted data. 0 means there is no limit */
    format_binary_max_array_size?: UInt64;
    /** The maximum allowed size for String in RowBinary format. It prevents allocating large amount of memory in case of corrupted data. 0 means there is no limit */
    format_binary_max_string_size?: UInt64;
    /** How to map ClickHouse Enum and CapnProto Enum */
    format_capn_proto_enum_comparising_mode?: CapnProtoEnumComparingMode;
    /** If it is set to true, allow strings in double quotes. */
    format_csv_allow_double_quotes?: Bool;
    /** If it is set to true, allow strings in single quotes. */
    format_csv_allow_single_quotes?: Bool;
    /** The character to be considered as a delimiter in CSV data. If setting with a string, a string has to have a length of 1. */
    format_csv_delimiter?: Char;
    /** Custom NULL representation in CSV format */
    format_csv_null_representation?: string;
    /** Field escaping rule (for CustomSeparated format) */
    format_custom_escaping_rule?: EscapingRule;
    /** Delimiter between fields (for CustomSeparated format) */
    format_custom_field_delimiter?: string;
    /** Suffix after result set (for CustomSeparated format) */
    format_custom_result_after_delimiter?: string;
    /** Prefix before result set (for CustomSeparated format) */
    format_custom_result_before_delimiter?: string;
    /** Delimiter after field of the last column (for CustomSeparated format) */
    format_custom_row_after_delimiter?: string;
    /** Delimiter before field of the first column (for CustomSeparated format) */
    format_custom_row_before_delimiter?: string;
    /** Delimiter between rows (for CustomSeparated format) */
    format_custom_row_between_delimiter?: string;
    /** Do not hide secrets in SHOW and SELECT queries. */
    format_display_secrets_in_show_and_select?: Bool;
    /** The name of column that will be used as object names in JSONObjectEachRow format. Column type should be String */
    format_json_object_each_row_column_for_object_name?: string;
    /** Regular expression (for Regexp format) */
    format_regexp?: string;
    /** Field escaping rule (for Regexp format) */
    format_regexp_escaping_rule?: EscapingRule;
    /** Skip lines unmatched by regular expression (for Regexp format) */
    format_regexp_skip_unmatched?: Bool;
    /** Schema identifier (used by schema-based formats) */
    format_schema?: string;
    /** Path to file which contains format string for result set (for Template format) */
    format_template_resultset?: string;
    /** Path to file which contains format string for rows (for Template format) */
    format_template_row?: string;
    /** Delimiter between rows (for Template format) */
    format_template_rows_between_delimiter?: string;
    /** Custom NULL representation in TSV format */
    format_tsv_null_representation?: string;
    /** Formatter '%f' in function 'formatDateTime()' produces a single zero instead of six zeros if the formatted value has no fractional seconds. */
    formatdatetime_f_prints_single_zero?: Bool;
    /** Formatter '%M' in functions 'formatDateTime()' and 'parseDateTime()' produces the month name instead of minutes. */
    formatdatetime_parsedatetime_m_is_month_name?: Bool;
    /** Do fsync after changing metadata for tables and databases (.sql files). Could be disabled in case of poor latency on server with high load of DDL queries and high load of disk subsystem. */
    fsync_metadata?: Bool;
    /** Choose function implementation for specific target or variant (experimental). If empty enable all of them. */
    function_implementation?: string;
    /** Allow function JSON_VALUE to return complex type, such as: struct, array, map. */
    function_json_value_return_type_allow_complex?: Bool;
    /** Allow function JSON_VALUE to return nullable type. */
    function_json_value_return_type_allow_nullable?: Bool;
    /** Maximum number of values generated by function `range` per block of data (sum of array sizes for every row in a block, see also 'max_block_size' and 'min_insert_block_size_rows'). It is a safety threshold. */
    function_range_max_elements_in_block?: UInt64;
    /** Maximum number of microseconds the function `sleep` is allowed to sleep for each block. If a user called it with a larger value, it throws an exception. It is a safety threshold. */
    function_sleep_max_microseconds_per_block?: UInt64;
    /** Maximum number of allowed addresses (For external storages, table functions, etc). */
    glob_expansion_max_elements?: UInt64;
    /** Initial number of grace hash join buckets */
    grace_hash_join_initial_buckets?: UInt64;
    /** Limit on the number of grace hash join buckets */
    grace_hash_join_max_buckets?: UInt64;
    /** What to do when the limit is exceeded. */
    group_by_overflow_mode?: OverflowModeGroupBy;
    /** From what number of keys, a two-level aggregation starts. 0 - the threshold is not set. */
    group_by_two_level_threshold?: UInt64;
    /** From what size of the aggregation state in bytes, a two-level aggregation begins to be used. 0 - the threshold is not set. Two-level aggregation is used when at least one of the thresholds is triggered. */
    group_by_two_level_threshold_bytes?: UInt64;
    /** Treat columns mentioned in ROLLUP, CUBE or GROUPING SETS as Nullable */
    group_by_use_nulls?: Bool;
    /** Timeout for receiving HELLO packet from replicas. */
    handshake_timeout_ms?: Milliseconds;
    /** Enables or disables creating a new file on each insert in hdfs engine tables */
    hdfs_create_new_file_on_insert?: Bool;
    /** The actual number of replications can be specified when the hdfs file is created. */
    hdfs_replication?: UInt64;
    /** Allow to skip empty files in hdfs table engine */
    hdfs_skip_empty_files?: Bool;
    /** Enables or disables truncate before insert in s3 engine tables */
    hdfs_truncate_on_insert?: Bool;
    /** Connection timeout for establishing connection with replica for Hedged requests */
    hedged_connection_timeout_ms?: Milliseconds;
    /** Expired time for hsts. 0 means disable HSTS. */
    hsts_max_age?: UInt64;
    /** HTTP connection timeout. */
    http_connection_timeout?: Seconds;
    /** Do not send HTTP headers X-ClickHouse-Progress more frequently than at each specified interval. */
    http_headers_progress_interval_ms?: UInt64;
    /** Maximum value of a chunk size in HTTP chunked transfer encoding */
    http_max_chunk_size?: UInt64;
    /** Maximum length of field name in HTTP header */
    http_max_field_name_size?: UInt64;
    /** Maximum length of field value in HTTP header */
    http_max_field_value_size?: UInt64;
    /** Maximum number of fields in HTTP header */
    http_max_fields?: UInt64;
    /** Limit on size of multipart/form-data content. This setting cannot be parsed from URL parameters and should be set in user profile. Note that content is parsed and external tables are created in memory before start of query execution. And this is the only limit that has effect on that stage (limits on max memory usage and max execution time have no effect while reading HTTP form data). */
    http_max_multipart_form_data_size?: UInt64;
    /** Limit on size of request data used as a query parameter in predefined HTTP requests. */
    http_max_request_param_data_size?: UInt64;
    /** Max attempts to read via http. */
    http_max_tries?: UInt64;
    /** Maximum URI length of HTTP request */
    http_max_uri_size?: UInt64;
    /** If you uncompress the POST data from the client compressed by the native format, do not check the checksum. */
    http_native_compression_disable_checksumming_on_decompress?: Bool;
    /** HTTP receive timeout */
    http_receive_timeout?: Seconds;
    /** The number of bytes to buffer in the server memory before sending a HTTP response to the client or flushing to disk (when http_wait_end_of_query is enabled). */
    http_response_buffer_size?: UInt64;
    /** Min milliseconds for backoff, when retrying read via http */
    http_retry_initial_backoff_ms?: UInt64;
    /** Max milliseconds for backoff, when retrying read via http */
    http_retry_max_backoff_ms?: UInt64;
    /** HTTP send timeout */
    http_send_timeout?: Seconds;
    /** Skip url's for globs with HTTP_NOT_FOUND error */
    http_skip_not_found_url_for_globs?: Bool;
    /** Enable HTTP response buffering on the server-side. */
    http_wait_end_of_query?: Bool;
    /** Compression level - used if the client on HTTP said that it understands data compressed by gzip or deflate. */
    http_zlib_compression_level?: Int64;
    /** Close idle TCP connections after specified number of seconds. */
    idle_connection_timeout?: UInt64;
    /** Comma separated list of strings or literals with the name of the data skipping indices that should be excluded during query execution. */
    ignore_data_skipping_indices?: string;
    /** If enabled and not already inside a transaction, wraps the query inside a full transaction (begin + commit or rollback) */
    implicit_transaction?: Bool;
    /** Maximum absolute amount of errors while reading text formats (like CSV, TSV). In case of error, if at least absolute or relative amount of errors is lower than corresponding value, will skip until next line and continue. */
    input_format_allow_errors_num?: UInt64;
    /** Maximum relative amount of errors while reading text formats (like CSV, TSV). In case of error, if at least absolute or relative amount of errors is lower than corresponding value, will skip until next line and continue. */
    input_format_allow_errors_ratio?: Float;
    /** Allow seeks while reading in ORC/Parquet/Arrow input formats */
    input_format_allow_seeks?: Bool;
    /** Allow missing columns while reading Arrow input formats */
    input_format_arrow_allow_missing_columns?: Bool;
    /** Ignore case when matching Arrow columns with CH columns. */
    input_format_arrow_case_insensitive_column_matching?: Bool;
    /** Allow to insert array of structs into Nested table in Arrow input format. */
    input_format_arrow_import_nested?: Bool;
    /** Skip columns with unsupported types while schema inference for format Arrow */
    input_format_arrow_skip_columns_with_unsupported_types_in_schema_inference?: Bool;
    /** For Avro/AvroConfluent format: when field is not found in schema use default value instead of error */
    input_format_avro_allow_missing_fields?: Bool;
    /** For Avro/AvroConfluent format: insert default in case of null and non Nullable column */
    input_format_avro_null_as_default?: Bool;
    /** Skip fields with unsupported types while schema inference for format BSON. */
    input_format_bson_skip_fields_with_unsupported_types_in_schema_inference?: Bool;
    /** Skip columns with unsupported types while schema inference for format CapnProto */
    input_format_capn_proto_skip_fields_with_unsupported_types_in_schema_inference?: Bool;
    /** Ignore extra columns in CSV input (if file has more columns than expected) and treat missing fields in CSV input as default values */
    input_format_csv_allow_variable_number_of_columns?: Bool;
    /** Allow to use spaces and tabs(\\t) as field delimiter in the CSV strings */
    input_format_csv_allow_whitespace_or_tab_as_delimiter?: Bool;
    /** When reading Array from CSV, expect that its elements were serialized in nested CSV and then put into string. Example: `"[""Hello"", ""world"", ""42"""" TV""]"`. Braces around array can be omitted. */
    input_format_csv_arrays_as_nested_csv?: Bool;
    /** Automatically detect header with names and types in CSV format */
    input_format_csv_detect_header?: Bool;
    /** Treat empty fields in CSV input as default values. */
    input_format_csv_empty_as_default?: Bool;
    /** Treat inserted enum values in CSV formats as enum indices */
    input_format_csv_enum_as_number?: Bool;
    /** Skip specified number of lines at the beginning of data in CSV format */
    input_format_csv_skip_first_lines?: UInt64;
    /** Skip trailing empty lines in CSV format */
    input_format_csv_skip_trailing_empty_lines?: Bool;
    /** Trims spaces and tabs (\\t) characters at the beginning and end in CSV strings */
    input_format_csv_trim_whitespaces?: Bool;
    /** Use some tweaks and heuristics to infer schema in CSV format */
    input_format_csv_use_best_effort_in_schema_inference?: Bool;
    /** Allow to set default value to column when CSV field deserialization failed on bad value */
    input_format_csv_use_default_on_bad_values?: Bool;
    /** Automatically detect header with names and types in CustomSeparated format */
    input_format_custom_detect_header?: Bool;
    /** Skip trailing empty lines in CustomSeparated format */
    input_format_custom_skip_trailing_empty_lines?: Bool;
    /** For input data calculate default expressions for omitted fields (it works for JSONEachRow, -WithNames, -WithNamesAndTypes formats). */
    input_format_defaults_for_omitted_fields?: Bool;
    /** Delimiter between collection(array or map) items in Hive Text File */
    input_format_hive_text_collection_items_delimiter?: Char;
    /** Delimiter between fields in Hive Text File */
    input_format_hive_text_fields_delimiter?: Char;
    /** Delimiter between a pair of map key/values in Hive Text File */
    input_format_hive_text_map_keys_delimiter?: Char;
    /** Map nested JSON data to nested tables (it works for JSONEachRow format). */
    input_format_import_nested_json?: Bool;
    /** Deserialization of IPv4 will use default values instead of throwing exception on conversion error. */
    input_format_ipv4_default_on_conversion_error?: Bool;
    /** Deserialization of IPV6 will use default values instead of throwing exception on conversion error. */
    input_format_ipv6_default_on_conversion_error?: Bool;
    /** Insert default value in named tuple element if it's missing in json object */
    input_format_json_defaults_for_missing_elements_in_named_tuple?: Bool;
    /** Ignore unknown keys in json object for named tuples */
    input_format_json_ignore_unknown_keys_in_named_tuple?: Bool;
    /** Deserialize named tuple columns as JSON objects */
    input_format_json_named_tuples_as_objects?: Bool;
    /** Allow to parse bools as numbers in JSON input formats */
    input_format_json_read_bools_as_numbers?: Bool;
    /** Allow to parse numbers as strings in JSON input formats */
    input_format_json_read_numbers_as_strings?: Bool;
    /** Allow to parse JSON objects as strings in JSON input formats */
    input_format_json_read_objects_as_strings?: Bool;
    /** Throw an exception if JSON string contains bad escape sequence. If disabled, bad escape sequences will remain as is in the data. Default value - true. */
    input_format_json_throw_on_bad_escape_sequence?: Bool;
    /** Try to infer numbers from string fields while schema inference */
    input_format_json_try_infer_numbers_from_strings?: Bool;
    /** For JSON/JSONCompact/JSONColumnsWithMetadata input formats this controls whether format parser should check if data types from input metadata match data types of the corresponding columns from the table */
    input_format_json_validate_types_from_metadata?: Bool;
    /** The maximum bytes of data to read for automatic schema inference */
    input_format_max_bytes_to_read_for_schema_inference?: UInt64;
    /** The maximum rows of data to read for automatic schema inference */
    input_format_max_rows_to_read_for_schema_inference?: UInt64;
    /** The number of columns in inserted MsgPack data. Used for automatic schema inference from data. */
    input_format_msgpack_number_of_columns?: UInt64;
    /** Match columns from table in MySQL dump and columns from ClickHouse table by names */
    input_format_mysql_dump_map_column_names?: Bool;
    /** Name of the table in MySQL dump from which to read data */
    input_format_mysql_dump_table_name?: string;
    /** Allow data types conversion in Native input format */
    input_format_native_allow_types_conversion?: Bool;
    /** Initialize null fields with default values if the data type of this field is not nullable and it is supported by the input format */
    input_format_null_as_default?: Bool;
    /** Allow missing columns while reading ORC input formats */
    input_format_orc_allow_missing_columns?: Bool;
    /** Ignore case when matching ORC columns with CH columns. */
    input_format_orc_case_insensitive_column_matching?: Bool;
    /** Allow to insert array of structs into Nested table in ORC input format. */
    input_format_orc_import_nested?: Bool;
    /** Batch size when reading ORC stripes. */
    input_format_orc_row_batch_size?: Int64;
    /** Skip columns with unsupported types while schema inference for format ORC */
    input_format_orc_skip_columns_with_unsupported_types_in_schema_inference?: Bool;
    /** Enable parallel parsing for some data formats. */
    input_format_parallel_parsing?: Bool;
    /** Allow missing columns while reading Parquet input formats */
    input_format_parquet_allow_missing_columns?: Bool;
    /** Ignore case when matching Parquet columns with CH columns. */
    input_format_parquet_case_insensitive_column_matching?: Bool;
    /** Allow to insert array of structs into Nested table in Parquet input format. */
    input_format_parquet_import_nested?: Bool;
    /** Max block size for parquet reader. */
    input_format_parquet_max_block_size?: UInt64;
    /** Avoid reordering rows when reading from Parquet files. Usually makes it much slower. */
    input_format_parquet_preserve_order?: Bool;
    /** Skip columns with unsupported types while schema inference for format Parquet */
    input_format_parquet_skip_columns_with_unsupported_types_in_schema_inference?: Bool;
    /** Enable Google wrappers for regular non-nested columns, e.g. google.protobuf.StringValue 'str' for String column 'str'. For Nullable columns empty wrappers are recognized as defaults, and missing as nulls */
    input_format_protobuf_flatten_google_wrappers?: Bool;
    /** Skip fields with unsupported types while schema inference for format Protobuf */
    input_format_protobuf_skip_fields_with_unsupported_types_in_schema_inference?: Bool;
    /** Path of the file used to record errors while reading text formats (CSV, TSV). */
    input_format_record_errors_file_path?: string;
    /** Skip columns with unknown names from input data (it works for JSONEachRow, -WithNames, -WithNamesAndTypes and TSKV formats). */
    input_format_skip_unknown_fields?: Bool;
    /** Try to infer dates from string fields while schema inference in text formats */
    input_format_try_infer_dates?: Bool;
    /** Try to infer datetimes from string fields while schema inference in text formats */
    input_format_try_infer_datetimes?: Bool;
    /** Try to infer integers instead of floats while schema inference in text formats */
    input_format_try_infer_integers?: Bool;
    /** Automatically detect header with names and types in TSV format */
    input_format_tsv_detect_header?: Bool;
    /** Treat empty fields in TSV input as default values. */
    input_format_tsv_empty_as_default?: Bool;
    /** Treat inserted enum values in TSV formats as enum indices. */
    input_format_tsv_enum_as_number?: Bool;
    /** Skip specified number of lines at the beginning of data in TSV format */
    input_format_tsv_skip_first_lines?: UInt64;
    /** Skip trailing empty lines in TSV format */
    input_format_tsv_skip_trailing_empty_lines?: Bool;
    /** Use some tweaks and heuristics to infer schema in TSV format */
    input_format_tsv_use_best_effort_in_schema_inference?: Bool;
    /** For Values format: when parsing and interpreting expressions using template, check actual type of literal to avoid possible overflow and precision issues. */
    input_format_values_accurate_types_of_literals?: Bool;
    /** For Values format: if the field could not be parsed by streaming parser, run SQL parser, deduce template of the SQL expression, try to parse all rows using template and then interpret expression for all rows. */
    input_format_values_deduce_templates_of_expressions?: Bool;
    /** For Values format: if the field could not be parsed by streaming parser, run SQL parser and try to interpret it as SQL expression. */
    input_format_values_interpret_expressions?: Bool;
    /** For -WithNames input formats this controls whether format parser is to assume that column data appear in the input exactly as they are specified in the header. */
    input_format_with_names_use_header?: Bool;
    /** For -WithNamesAndTypes input formats this controls whether format parser should check if data types from the input match data types from the header. */
    input_format_with_types_use_header?: Bool;
    /** If setting is enabled, Allow materialized columns in INSERT. */
    insert_allow_materialized_columns?: Bool;
    /** For INSERT queries in the replicated table, specifies that deduplication of insertings blocks should be performed */
    insert_deduplicate?: Bool;
    /** If not empty, used for duplicate detection instead of data digest */
    insert_deduplication_token?: string;
    /** If setting is enabled, inserting into distributed table will choose a random shard to write when there is no sharding key */
    insert_distributed_one_random_shard?: Bool;
    /** If setting is enabled, insert query into distributed waits until data will be sent to all nodes in cluster. */
    insert_distributed_sync?: Bool;
    /** Timeout for insert query into distributed. Setting is used only with insert_distributed_sync enabled. Zero value means no timeout. */
    insert_distributed_timeout?: UInt64;
    /** Approximate probability of failure for a keeper request during insert. Valid value is in interval [0.0f, 1.0f] */
    insert_keeper_fault_injection_probability?: Float;
    /** 0 - random seed, otherwise the setting value */
    insert_keeper_fault_injection_seed?: UInt64;
    /** Max retries for keeper operations during insert */
    insert_keeper_max_retries?: UInt64;
    /** Initial backoff timeout for keeper operations during insert */
    insert_keeper_retry_initial_backoff_ms?: UInt64;
    /** Max backoff timeout for keeper operations during insert */
    insert_keeper_retry_max_backoff_ms?: UInt64;
    /** Insert DEFAULT values instead of NULL in INSERT SELECT (UNION ALL) */
    insert_null_as_default?: Bool;
    /** For INSERT queries in the replicated table, wait writing for the specified number of replicas and linearize the addition of the data. 0 - disabled, 'auto' - use majority */
    insert_quorum?: UInt64Auto;
    /** For quorum INSERT queries - enable to make parallel inserts without linearizability */
    insert_quorum_parallel?: Bool;
    /** If the quorum of replicas did not meet in specified time (in milliseconds), exception will be thrown and insertion is aborted. */
    insert_quorum_timeout?: Milliseconds;
    /** If non-zero, when insert into a distributed table, the data will be inserted into the shard `insert_shard_id` synchronously. Possible values range from 1 to `shards_number` of corresponding distributed table */
    insert_shard_id?: UInt64;
    /** The interval in microseconds to check if the request is cancelled, and to send progress info. */
    interactive_delay?: UInt64;
    /** Set default mode in INTERSECT query. Possible values: empty string, 'ALL', 'DISTINCT'. If empty, query without mode will throw exception. */
    intersect_default_mode?: SetOperationMode;
    /** Textual representation of Interval. Possible values: 'kusto', 'numeric'. */
    interval_output_format?: IntervalOutputFormat;
    /** Specify join algorithm. */
    join_algorithm?: JoinAlgorithm;
    /** When disabled (default) ANY JOIN will take the first found row for a key. When enabled, it will take the last row seen if there are multiple rows for the same key. */
    join_any_take_last_row?: Bool;
    /** Set default strictness in JOIN query. Possible values: empty string, 'ANY', 'ALL'. If empty, query without strictness will throw exception. */
    join_default_strictness?: JoinStrictness;
    /** For MergeJoin on disk set how much files it's allowed to sort simultaneously. Then this value bigger then more memory used and then less disk I/O needed. Minimum is 2. */
    join_on_disk_max_files_to_merge?: UInt64;
    /** What to do when the limit is exceeded. */
    join_overflow_mode?: OverflowMode;
    /** Use NULLs for non-joined rows of outer JOINs for types that can be inside Nullable. If false, use default value of corresponding columns data type. */
    join_use_nulls?: Bool;
    /** Force joined subqueries and table functions to have aliases for correct name qualification. */
    joined_subquery_requires_alias?: Bool;
    /** Disable limit on kafka_num_consumers that depends on the number of available CPU cores */
    kafka_disable_num_consumers_limit?: Bool;
    /** The wait time for reading from Kafka before retry. */
    kafka_max_wait_ms?: Milliseconds;
    /** Enforce additional checks during operations on KeeperMap. E.g. throw an exception on an insert for already existing key */
    keeper_map_strict_mode?: Bool;
    /** List all names of element of large tuple literals in their column names instead of hash. This settings exists only for compatibility reasons. It makes sense to set to 'true', while doing rolling update of cluster from version lower than 21.7 to higher. */
    legacy_column_name_of_tuple_literal?: Bool;
    /** Limit on read rows from the most 'end' result for select query, default 0 means no limit length */
    limit?: UInt64;
    /** Controls the synchronicity of lightweight DELETE operations. It determines whether a DELETE statement will wait for the operation to complete before returning to the client. */
    lightweight_deletes_sync?: UInt64;
    /** The heartbeat interval in seconds to indicate live query is alive. */
    live_view_heartbeat_interval?: Seconds;
    /** Which replicas (among healthy replicas) to preferably send a query to (on the first attempt) for distributed processing. */
    load_balancing?: LoadBalancing;
    /** Which replica to preferably send a query when FIRST_OR_RANDOM load balancing strategy is used. */
    load_balancing_first_offset?: UInt64;
    /** Load MergeTree marks asynchronously */
    load_marks_asynchronously?: Bool;
    /** Method of reading data from local filesystem, one of: read, pread, mmap, io_uring, pread_threadpool. The 'io_uring' method is experimental and does not work for Log, TinyLog, StripeLog, File, Set and Join, and other tables with append-able files in presence of concurrent reads and writes. */
    local_filesystem_read_method?: string;
    /** Should use prefetching when reading data from local filesystem. */
    local_filesystem_read_prefetch?: Bool;
    /** How long locking request should wait before failing */
    lock_acquire_timeout?: Seconds;
    /** Log comment into system.query_log table and server log. It can be set to arbitrary string no longer than max_query_size. */
    log_comment?: string;
    /** Log formatted queries and write the log to the system table. */
    log_formatted_queries?: Bool;
    /** Log Processors profile events. */
    log_processors_profiles?: Bool;
    /** Log query performance statistics into the query_log, query_thread_log and query_views_log. */
    log_profile_events?: Bool;
    /** Log requests and write the log to the system table. */
    log_queries?: Bool;
    /** If query length is greater than specified threshold (in bytes), then cut query when writing to query log. Also limit length of printed query in ordinary text log. */
    log_queries_cut_to_length?: UInt64;
    /** Minimal time for the query to run, to get to the query_log/query_thread_log/query_views_log. */
    log_queries_min_query_duration_ms?: Milliseconds;
    /** Minimal type in query_log to log, possible values (from low to high): QUERY_START, QUERY_FINISH, EXCEPTION_BEFORE_START, EXCEPTION_WHILE_PROCESSING. */
    log_queries_min_type?: LogQueriesType;
    /** Log queries with the specified probabality. */
    log_queries_probability?: Float;
    /** Log query settings into the query_log. */
    log_query_settings?: Bool;
    /** Log query threads into system.query_thread_log table. This setting have effect only when 'log_queries' is true. */
    log_query_threads?: Bool;
    /** Log query dependent views into system.query_views_log table. This setting have effect only when 'log_queries' is true. */
    log_query_views?: Bool;
    /** Use LowCardinality type in Native format. Otherwise, convert LowCardinality columns to ordinary for select query, and convert ordinary columns to required LowCardinality for insert query. */
    low_cardinality_allow_in_native_format?: Bool;
    /** Maximum size (in rows) of shared global dictionary for LowCardinality type. */
    low_cardinality_max_dictionary_size?: UInt64;
    /** LowCardinality type serialization setting. If is true, than will use additional keys when global dictionary overflows. Otherwise, will create several shared dictionaries. */
    low_cardinality_use_single_dictionary_for_part?: Bool;
    /** Apply TTL for old data, after ALTER MODIFY TTL query */
    materialize_ttl_after_modify?: Bool;
    /** Allows to ignore errors for MATERIALIZED VIEW, and deliver original block to the table regardless of MVs */
    materialized_views_ignore_errors?: Bool;
    /** Maximum number of analyses performed by interpreter. */
    max_analyze_depth?: UInt64;
    /** Maximum depth of query syntax tree. Checked after parsing. */
    max_ast_depth?: UInt64;
    /** Maximum size of query syntax tree in number of nodes. Checked after parsing. */
    max_ast_elements?: UInt64;
    /** The maximum read speed in bytes per second for particular backup on server. Zero means unlimited. */
    max_backup_bandwidth?: UInt64;
    /** Maximum block size for reading */
    max_block_size?: UInt64;
    /** If memory usage during GROUP BY operation is exceeding this threshold in bytes, activate the 'external aggregation' mode (spill data to disk). Recommended value is half of available system memory. */
    max_bytes_before_external_group_by?: UInt64;
    /** If memory usage during ORDER BY operation is exceeding this threshold in bytes, activate the 'external sorting' mode (spill data to disk). Recommended value is half of available system memory. */
    max_bytes_before_external_sort?: UInt64;
    /** In case of ORDER BY with LIMIT, when memory usage is higher than specified threshold, perform additional steps of merging blocks before final merge to keep just top LIMIT rows. */
    max_bytes_before_remerge_sort?: UInt64;
    /** Maximum total size of state (in uncompressed bytes) in memory for the execution of DISTINCT. */
    max_bytes_in_distinct?: UInt64;
    /** Maximum size of the hash table for JOIN (in number of bytes in memory). */
    max_bytes_in_join?: UInt64;
    /** Maximum size of the set (in bytes in memory) resulting from the execution of the IN section. */
    max_bytes_in_set?: UInt64;
    /** Limit on read bytes (after decompression) from the most 'deep' sources. That is, only in the deepest subquery. When reading from a remote server, it is only checked on a remote server. */
    max_bytes_to_read?: UInt64;
    /** Limit on read bytes (after decompression) on the leaf nodes for distributed queries. Limit is applied for local reads only excluding the final merge stage on the root node. */
    max_bytes_to_read_leaf?: UInt64;
    /** If more than specified amount of (uncompressed) bytes have to be processed for ORDER BY operation, the behavior will be determined by the 'sort_overflow_mode' which by default is - throw an exception */
    max_bytes_to_sort?: UInt64;
    /** Maximum size (in uncompressed bytes) of the transmitted external table obtained when the GLOBAL IN/JOIN section is executed. */
    max_bytes_to_transfer?: UInt64;
    /** If a query requires reading more than specified number of columns, exception is thrown. Zero value means unlimited. This setting is useful to prevent too complex queries. */
    max_columns_to_read?: UInt64;
    /** The maximum size of blocks of uncompressed data before compressing for writing to a table. */
    max_compress_block_size?: UInt64;
    /** The maximum number of concurrent requests for all users. */
    max_concurrent_queries_for_all_users?: UInt64;
    /** The maximum number of concurrent requests per user. */
    max_concurrent_queries_for_user?: UInt64;
    /** The maximum number of connections for distributed processing of one query (should be greater than max_threads). */
    max_distributed_connections?: UInt64;
    /** Maximum distributed query depth */
    max_distributed_depth?: UInt64;
    /** The maximal size of buffer for parallel downloading (e.g. for URL engine) per each thread. */
    max_download_buffer_size?: UInt64;
    /** The maximum number of threads to download data (e.g. for URL engine). */
    max_download_threads?: MaxThreads;
    /** How many entries hash table statistics collected during aggregation is allowed to have */
    max_entries_for_hash_table_stats?: UInt64;
    /** Maximum number of execution rows per second. */
    max_execution_speed?: UInt64;
    /** Maximum number of execution bytes per second. */
    max_execution_speed_bytes?: UInt64;
    /** If query run time exceeded the specified number of seconds, the behavior will be determined by the 'timeout_overflow_mode' which by default is - throw an exception. Note that the timeout is checked and query can stop only in designated places during data processing. It currently cannot stop during merging of aggregation states or during query analysis, and the actual run time will be higher than the value of this setting. */
    max_execution_time?: Seconds;
    /** Maximum size of query syntax tree in number of nodes after expansion of aliases and the asterisk. */
    max_expanded_ast_elements?: UInt64;
    /** Amount of retries while fetching partition from another host. */
    max_fetch_partition_retries_count?: UInt64;
    /** The maximum number of threads to read from table with FINAL. */
    max_final_threads?: MaxThreads;
    /** Max number of http GET redirects hops allowed. Make sure additional security measures are in place to prevent a malicious server to redirect your requests to unexpected services. */
    max_http_get_redirects?: UInt64;
    /** Max length of regexp than can be used in hyperscan multi-match functions. Zero means unlimited. */
    max_hyperscan_regexp_length?: UInt64;
    /** Max total length of all regexps than can be used in hyperscan multi-match functions (per every function). Zero means unlimited. */
    max_hyperscan_regexp_total_length?: UInt64;
    /** The maximum block size for insertion, if we control the creation of blocks for insertion. */
    max_insert_block_size?: UInt64;
    /** The maximum number of streams (columns) to delay final part flush. Default - auto (1000 in case of underlying storage supports parallel write, for example S3 and disabled otherwise) */
    max_insert_delayed_streams_for_parallel_write?: UInt64;
    /** The maximum number of threads to execute the INSERT SELECT query. Values 0 or 1 means that INSERT SELECT is not run in parallel. Higher values will lead to higher memory usage. Parallel INSERT SELECT has effect only if the SELECT part is run on parallel, see 'max_threads' setting. */
    max_insert_threads?: UInt64;
    /** Maximum block size for JOIN result (if join algorithm supports it). 0 means unlimited. */
    max_joined_block_size_rows?: UInt64;
    /** SELECT queries with LIMIT bigger than this setting cannot use ANN indexes. Helps to prevent memory overflows in ANN search indexes. */
    max_limit_for_ann_queries?: UInt64;
    /** Limit maximum number of inserted blocks after which mergeable blocks are dropped and query is re-executed. */
    max_live_view_insert_blocks_before_refresh?: UInt64;
    /** The maximum speed of local reads in bytes per second. */
    max_local_read_bandwidth?: UInt64;
    /** The maximum speed of local writes in bytes per second. */
    max_local_write_bandwidth?: UInt64;
    /** Maximum memory usage for processing of single query. Zero means unlimited. */
    max_memory_usage?: UInt64;
    /** Maximum memory usage for processing all concurrently running queries for the user. Zero means unlimited. */
    max_memory_usage_for_user?: UInt64;
    /** The maximum speed of data exchange over the network in bytes per second for a query. Zero means unlimited. */
    max_network_bandwidth?: UInt64;
    /** The maximum speed of data exchange over the network in bytes per second for all concurrently running queries. Zero means unlimited. */
    max_network_bandwidth_for_all_users?: UInt64;
    /** The maximum speed of data exchange over the network in bytes per second for all concurrently running user queries. Zero means unlimited. */
    max_network_bandwidth_for_user?: UInt64;
    /** The maximum number of bytes (compressed) to receive or transmit over the network for execution of the query. */
    max_network_bytes?: UInt64;
    /** Maximal number of partitions in table to apply optimization */
    max_number_of_partitions_for_independent_aggregation?: UInt64;
    /** The maximum number of replicas of each shard used when the query is executed. For consistency (to get different parts of the same partition), this option only works for the specified sampling key. The lag of the replicas is not controlled. */
    max_parallel_replicas?: UInt64;
    /** Maximum parser depth (recursion depth of recursive descend parser). */
    max_parser_depth?: UInt64;
    /** Limit maximum number of partitions in single INSERTed block. Zero means unlimited. Throw exception if the block contains too many partitions. This setting is a safety threshold, because using large number of partitions is a common misconception. */
    max_partitions_per_insert_block?: UInt64;
    /** Limit the max number of partitions that can be accessed in one query. <= 0 means unlimited. */
    max_partitions_to_read?: Int64;
    /** The maximum number of bytes of a query string parsed by the SQL parser. Data in the VALUES clause of INSERT queries is processed by a separate stream parser (that consumes O(1) RAM) and not affected by this restriction. */
    max_query_size?: UInt64;
    /** The maximum size of the buffer to read from the filesystem. */
    max_read_buffer_size?: UInt64;
    /** The maximum size of the buffer to read from local filesystem. If set to 0 then max_read_buffer_size will be used. */
    max_read_buffer_size_local_fs?: UInt64;
    /** The maximum size of the buffer to read from remote filesystem. If set to 0 then max_read_buffer_size will be used. */
    max_read_buffer_size_remote_fs?: UInt64;
    /** The maximum speed of data exchange over the network in bytes per second for read. */
    max_remote_read_network_bandwidth?: UInt64;
    /** The maximum speed of data exchange over the network in bytes per second for write. */
    max_remote_write_network_bandwidth?: UInt64;
    /** If set, distributed queries of Replicated tables will choose servers with replication delay in seconds less than the specified value (not inclusive). Zero means do not take delay into account. */
    max_replica_delay_for_distributed_queries?: UInt64;
    /** Limit on result size in bytes (uncompressed).  The query will stop after processing a block of data if the threshold is met, but it will not cut the last block of the result, therefore the result size can be larger than the threshold. Caveats: the result size in memory is taken into account for this threshold. Even if the result size is small, it can reference larger data structures in memory, representing dictionaries of LowCardinality columns, and Arenas of AggregateFunction columns, so the threshold can be exceeded despite the small result size. The setting is fairly low level and should be used with caution. */
    max_result_bytes?: UInt64;
    /** Limit on result size in rows. The query will stop after processing a block of data if the threshold is met, but it will not cut the last block of the result, therefore the result size can be larger than the threshold. */
    max_result_rows?: UInt64;
    /** Maximum number of elements during execution of DISTINCT. */
    max_rows_in_distinct?: UInt64;
    /** Maximum size of the hash table for JOIN (in number of rows). */
    max_rows_in_join?: UInt64;
    /** Maximum size of the set (in number of elements) resulting from the execution of the IN section. */
    max_rows_in_set?: UInt64;
    /** Maximal size of the set to filter joined tables by each other row sets before joining. 0 - disable. */
    max_rows_in_set_to_optimize_join?: UInt64;
    /** If aggregation during GROUP BY is generating more than specified number of rows (unique GROUP BY keys), the behavior will be determined by the 'group_by_overflow_mode' which by default is - throw an exception, but can be also switched to an approximate GROUP BY mode. */
    max_rows_to_group_by?: UInt64;
    /** Limit on read rows from the most 'deep' sources. That is, only in the deepest subquery. When reading from a remote server, it is only checked on a remote server. */
    max_rows_to_read?: UInt64;
    /** Limit on read rows on the leaf nodes for distributed queries. Limit is applied for local reads only excluding the final merge stage on the root node. */
    max_rows_to_read_leaf?: UInt64;
    /** If more than specified amount of records have to be processed for ORDER BY operation, the behavior will be determined by the 'sort_overflow_mode' which by default is - throw an exception */
    max_rows_to_sort?: UInt64;
    /** Maximum size (in rows) of the transmitted external table obtained when the GLOBAL IN/JOIN section is executed. */
    max_rows_to_transfer?: UInt64;
    /** For how many elements it is allowed to preallocate space in all hash tables in total before aggregation */
    max_size_to_preallocate_for_aggregation?: UInt64;
    /** If is not zero, limit the number of reading streams for MergeTree table. */
    max_streams_for_merge_tree_reading?: UInt64;
    /** Ask more streams when reading from Merge table. Streams will be spread across tables that Merge table will use. This allows more even distribution of work across threads and especially helpful when merged tables differ in size. */
    max_streams_multiplier_for_merge_tables?: Float;
    /** Allows you to use more sources than the number of threads - to more evenly distribute work across threads. It is assumed that this is a temporary solution, since it will be possible in the future to make the number of sources equal to the number of threads, but for each source to dynamically select available work for itself. */
    max_streams_to_max_threads_ratio?: Float;
    /** If a query has more than specified number of nested subqueries, throw an exception. This allows you to have a sanity check to protect the users of your cluster from going insane with their queries. */
    max_subquery_depth?: UInt64;
    /** If a query generates more than the specified number of temporary columns in memory as a result of intermediate calculation, exception is thrown. Zero value means unlimited. This setting is useful to prevent too complex queries. */
    max_temporary_columns?: UInt64;
    /** The maximum amount of data consumed by temporary files on disk in bytes for all concurrently running queries. Zero means unlimited. */
    max_temporary_data_on_disk_size_for_query?: UInt64;
    /** The maximum amount of data consumed by temporary files on disk in bytes for all concurrently running user queries. Zero means unlimited. */
    max_temporary_data_on_disk_size_for_user?: UInt64;
    /** Similar to the 'max_temporary_columns' setting but applies only to non-constant columns. This makes sense, because constant columns are cheap and it is reasonable to allow more of them. */
    max_temporary_non_const_columns?: UInt64;
    /** The maximum number of threads to execute the request. By default, it is determined automatically. */
    max_threads?: MaxThreads;
    /** Small allocations and deallocations are grouped in thread local variable and tracked or profiled only when amount (in absolute value) becomes larger than specified value. If the value is higher than 'memory_profiler_step' it will be effectively lowered to 'memory_profiler_step'. */
    max_untracked_memory?: UInt64;
    /** It represents soft memory limit on the user level. This value is used to compute query overcommit ratio. */
    memory_overcommit_ratio_denominator?: UInt64;
    /** It represents soft memory limit on the global level. This value is used to compute query overcommit ratio. */
    memory_overcommit_ratio_denominator_for_user?: UInt64;
    /** Collect random allocations and deallocations and write them into system.trace_log with 'MemorySample' trace_type. The probability is for every alloc/free regardless to the size of the allocation. Note that sampling happens only when the amount of untracked memory exceeds 'max_untracked_memory'. You may want to set 'max_untracked_memory' to 0 for extra fine grained sampling. */
    memory_profiler_sample_probability?: Float;
    /** Whenever query memory usage becomes larger than every next step in number of bytes the memory profiler will collect the allocating stack trace. Zero means disabled memory profiler. Values lower than a few megabytes will slow down query processing. */
    memory_profiler_step?: UInt64;
    /** For testing of `exception safety` - throw an exception every time you allocate memory with the specified probability. */
    memory_tracker_fault_probability?: Float;
    /** Maximum time thread will wait for memory to be freed in the case of memory overcommit. If timeout is reached and memory is not freed, exception is thrown. */
    memory_usage_overcommit_max_wait_microseconds?: UInt64;
    /** If the index segment can contain the required keys, divide it into as many parts and recursively check them. */
    merge_tree_coarse_index_granularity?: UInt64;
    /** The maximum number of bytes per request, to use the cache of uncompressed data. If the request is large, the cache is not used. (For large queries not to flush out the cache.) */
    merge_tree_max_bytes_to_use_cache?: UInt64;
    /** The maximum number of rows per request, to use the cache of uncompressed data. If the request is large, the cache is not used. (For large queries not to flush out the cache.) */
    merge_tree_max_rows_to_use_cache?: UInt64;
    /** If at least as many bytes are read from one file, the reading can be parallelized. */
    merge_tree_min_bytes_for_concurrent_read?: UInt64;
    /** If at least as many bytes are read from one file, the reading can be parallelized, when reading from remote filesystem. */
    merge_tree_min_bytes_for_concurrent_read_for_remote_filesystem?: UInt64;
    /** You can skip reading more than that number of bytes at the price of one seek per file. */
    merge_tree_min_bytes_for_seek?: UInt64;
    /** Min bytes to read per task. */
    merge_tree_min_bytes_per_task_for_remote_reading?: UInt64;
    /** If at least as many lines are read from one file, the reading can be parallelized. */
    merge_tree_min_rows_for_concurrent_read?: UInt64;
    /** If at least as many lines are read from one file, the reading can be parallelized, when reading from remote filesystem. */
    merge_tree_min_rows_for_concurrent_read_for_remote_filesystem?: UInt64;
    /** You can skip reading more than that number of rows at the price of one seek per file. */
    merge_tree_min_rows_for_seek?: UInt64;
    /** Whether to use constant size tasks for reading from a remote table. */
    merge_tree_use_const_size_tasks_for_remote_reading?: Bool;
    /** If enabled, some of the perf events will be measured throughout queries' execution. */
    metrics_perf_events_enabled?: Bool;
    /** Comma separated list of perf metrics that will be measured throughout queries' execution. Empty means all events. See PerfEventInfo in sources for the available events. */
    metrics_perf_events_list?: string;
    /** The minimum number of bytes for reading the data with O_DIRECT option during SELECT queries execution. 0 - disabled. */
    min_bytes_to_use_direct_io?: UInt64;
    /** The minimum number of bytes for reading the data with mmap option during SELECT queries execution. 0 - disabled. */
    min_bytes_to_use_mmap_io?: UInt64;
    /** The minimum chunk size in bytes, which each thread will parse in parallel. */
    min_chunk_bytes_for_parallel_parsing?: UInt64;
    /** The actual size of the block to compress, if the uncompressed data less than max_compress_block_size is no less than this value and no less than the volume of data for one mark. */
    min_compress_block_size?: UInt64;
    /** The number of identical aggregate expressions before they are JIT-compiled */
    min_count_to_compile_aggregate_expression?: UInt64;
    /** The number of identical expressions before they are JIT-compiled */
    min_count_to_compile_expression?: UInt64;
    /** The number of identical sort descriptions before they are JIT-compiled */
    min_count_to_compile_sort_description?: UInt64;
    /** Minimum number of execution rows per second. */
    min_execution_speed?: UInt64;
    /** Minimum number of execution bytes per second. */
    min_execution_speed_bytes?: UInt64;
    /** The minimum disk space to keep while writing temporary data used in external sorting and aggregation. */
    min_free_disk_space_for_temporary_data?: UInt64;
    /** Squash blocks passed to INSERT query to specified size in bytes, if blocks are not big enough. */
    min_insert_block_size_bytes?: UInt64;
    /** Like min_insert_block_size_bytes, but applied only during pushing to MATERIALIZED VIEW (default: min_insert_block_size_bytes) */
    min_insert_block_size_bytes_for_materialized_views?: UInt64;
    /** Squash blocks passed to INSERT query to specified size in rows, if blocks are not big enough. */
    min_insert_block_size_rows?: UInt64;
    /** Like min_insert_block_size_rows, but applied only during pushing to MATERIALIZED VIEW (default: min_insert_block_size_rows) */
    min_insert_block_size_rows_for_materialized_views?: UInt64;
    /** Move all viable conditions from WHERE to PREWHERE */
    move_all_conditions_to_prewhere?: Bool;
    /** Move PREWHERE conditions containing primary key columns to the end of AND chain. It is likely that these conditions are taken into account during primary key analysis and thus will not contribute a lot to PREWHERE filtering. */
    move_primary_key_columns_to_end_of_prewhere?: Bool;
    /** Do not add aliases to top level expression list on multiple joins rewrite */
    multiple_joins_try_to_keep_original_names?: Bool;
    /** Wait for synchronous execution of ALTER TABLE UPDATE/DELETE queries (mutations). 0 - execute asynchronously. 1 - wait current server. 2 - wait all replicas if they exist. */
    mutations_sync?: UInt64;
    /** Which MySQL types should be converted to corresponding ClickHouse types (rather than being represented as String). Can be empty or any combination of 'decimal', 'datetime64', 'date2Date32' or 'date2String'. When empty MySQL's DECIMAL and DATETIME/TIMESTAMP with non-zero precision are seen as String on ClickHouse's side. */
    mysql_datatypes_support_level?: MySQLDataTypesSupport;
    /** The maximum number of rows in MySQL batch insertion of the MySQL storage engine */
    mysql_max_rows_to_insert?: UInt64;
    /** Allows you to select the method of data compression when writing. */
    network_compression_method?: string;
    /** Allows you to select the level of ZSTD compression. */
    network_zstd_compression_level?: Int64;
    /** Normalize function names to their canonical names */
    normalize_function_names?: Bool;
    /** If the mutated table contains at least that many unfinished mutations, artificially slow down mutations of table. 0 - disabled */
    number_of_mutations_to_delay?: UInt64;
    /** If the mutated table contains at least that many unfinished mutations, throw 'Too many mutations ...' exception. 0 - disabled */
    number_of_mutations_to_throw?: UInt64;
    /** Connection pool size for each connection settings string in ODBC bridge. */
    odbc_bridge_connection_pool_size?: UInt64;
    /** Use connection pooling in ODBC bridge. If set to false, a new connection is created every time */
    odbc_bridge_use_connection_pooling?: Bool;
    /** Offset on read rows from the most 'end' result for select query */
    offset?: UInt64;
    /** Probability to start an OpenTelemetry trace for an incoming query. */
    opentelemetry_start_trace_probability?: Float;
    /** Collect OpenTelemetry spans for processors. */
    opentelemetry_trace_processors?: Bool;
    /** Enable GROUP BY optimization for aggregating data in corresponding order in MergeTree tables. */
    optimize_aggregation_in_order?: Bool;
    /** Eliminates min/max/any/anyLast aggregators of GROUP BY keys in SELECT section */
    optimize_aggregators_of_group_by_keys?: Bool;
    /** Use constraints in order to append index condition (indexHint) */
    optimize_append_index?: Bool;
    /** Move arithmetic operations out of aggregation functions */
    optimize_arithmetic_operations_in_aggregate_functions?: Bool;
    /** Enable DISTINCT optimization if some columns in DISTINCT form a prefix of sorting. For example, prefix of sorting key in merge tree or ORDER BY statement */
    optimize_distinct_in_order?: Bool;
    /** Optimize GROUP BY sharding_key queries (by avoiding costly aggregation on the initiator server). */
    optimize_distributed_group_by_sharding_key?: Bool;
    /** Transform functions to subcolumns, if possible, to reduce amount of read data. E.g. 'length(arr)' -> 'arr.size0', 'col IS NULL' -> 'col.null'  */
    optimize_functions_to_subcolumns?: Bool;
    /** Eliminates functions of other keys in GROUP BY section */
    optimize_group_by_function_keys?: Bool;
    /** Replace if(cond1, then1, if(cond2, ...)) chains to multiIf. Currently it's not beneficial for numeric types. */
    optimize_if_chain_to_multiif?: Bool;
    /** Replaces string-type arguments in If and Transform to enum. Disabled by default cause it could make inconsistent change in distributed query that would lead to its fail. */
    optimize_if_transform_strings_to_enum?: Bool;
    /** Delete injective functions of one argument inside uniq*() functions. */
    optimize_injective_functions_inside_uniq?: Bool;
    /** The minimum length of the expression `expr = x1 OR ... expr = xN` for optimization  */
    optimize_min_equality_disjunction_chain_length?: UInt64;
    /** Replace monotonous function with its argument in ORDER BY */
    optimize_monotonous_functions_in_order_by?: Bool;
    /** Move functions out of aggregate functions 'any', 'anyLast'. */
    optimize_move_functions_out_of_any?: Bool;
    /** Allows disabling WHERE to PREWHERE optimization in SELECT queries from MergeTree. */
    optimize_move_to_prewhere?: Bool;
    /** If query has `FINAL`, the optimization `move_to_prewhere` is not always correct and it is enabled only if both settings `optimize_move_to_prewhere` and `optimize_move_to_prewhere_if_final` are turned on */
    optimize_move_to_prewhere_if_final?: Bool;
    /** Replace 'multiIf' with only one condition to 'if'. */
    optimize_multiif_to_if?: Bool;
    /** Rewrite aggregate functions that semantically equals to count() as count(). */
    optimize_normalize_count_variants?: Bool;
    /** Do the same transformation for inserted block of data as if merge was done on this block. */
    optimize_on_insert?: Bool;
    /** Optimize multiple OR LIKE into multiMatchAny. This optimization should not be enabled by default, because it defies index analysis in some cases. */
    optimize_or_like_chain?: Bool;
    /** Enable ORDER BY optimization for reading data in corresponding order in MergeTree tables. */
    optimize_read_in_order?: Bool;
    /** Enable ORDER BY optimization in window clause for reading data in corresponding order in MergeTree tables. */
    optimize_read_in_window_order?: Bool;
    /** Remove functions from ORDER BY if its argument is also in ORDER BY */
    optimize_redundant_functions_in_order_by?: Bool;
    /** If it is set to true, it will respect aliases in WHERE/GROUP BY/ORDER BY, that will help with partition pruning/secondary indexes/optimize_aggregation_in_order/optimize_read_in_order/optimize_trivial_count */
    optimize_respect_aliases?: Bool;
    /** Rewrite aggregate functions with if expression as argument when logically equivalent. For example, avg(if(cond, col, null)) can be rewritten to avgIf(cond, col) */
    optimize_rewrite_aggregate_function_with_if?: Bool;
    /** Rewrite arrayExists() functions to has() when logically equivalent. For example, arrayExists(x -> x = 1, arr) can be rewritten to has(arr, 1) */
    optimize_rewrite_array_exists_to_has?: Bool;
    /** Rewrite sumIf() and sum(if()) function countIf() function when logically equivalent */
    optimize_rewrite_sum_if_to_count_if?: Bool;
    /** Skip partitions with one part with level > 0 in optimize final */
    optimize_skip_merged_partitions?: Bool;
    /** Assumes that data is distributed by sharding_key. Optimization to skip unused shards if SELECT query filters by sharding_key. */
    optimize_skip_unused_shards?: Bool;
    /** Limit for number of sharding key values, turns off optimize_skip_unused_shards if the limit is reached */
    optimize_skip_unused_shards_limit?: UInt64;
    /** Same as optimize_skip_unused_shards, but accept nesting level until which it will work. */
    optimize_skip_unused_shards_nesting?: UInt64;
    /** Rewrite IN in query for remote shards to exclude values that does not belong to the shard (requires optimize_skip_unused_shards) */
    optimize_skip_unused_shards_rewrite_in?: Bool;
    /** Optimize sorting by sorting properties of input stream */
    optimize_sorting_by_input_stream_properties?: Bool;
    /** Use constraints for column substitution */
    optimize_substitute_columns?: Bool;
    /** Allow applying fuse aggregating function. Available only with `allow_experimental_analyzer` */
    optimize_syntax_fuse_functions?: Bool;
    /** If setting is enabled and OPTIMIZE query didn't actually assign a merge then an explanatory exception is thrown */
    optimize_throw_if_noop?: Bool;
    /** Process trivial 'SELECT count() FROM table' query from metadata. */
    optimize_trivial_count_query?: Bool;
    /** Optimize trivial 'INSERT INTO table SELECT ... FROM TABLES' query */
    optimize_trivial_insert_select?: Bool;
    /** Automatically choose implicit projections to perform SELECT query */
    optimize_use_implicit_projections?: Bool;
    /** Automatically choose projections to perform SELECT query */
    optimize_use_projections?: Bool;
    /** Use constraints for query optimization */
    optimize_using_constraints?: Bool;
    /** If non zero - set corresponding 'nice' value for query processing threads. Can be used to adjust query priority for OS scheduler. */
    os_thread_priority?: Int64;
    /** Compression method for Arrow output format. Supported codecs: lz4_frame, zstd, none (uncompressed) */
    output_format_arrow_compression_method?: ArrowCompression;
    /** Use Arrow FIXED_SIZE_BINARY type instead of Binary for FixedString columns. */
    output_format_arrow_fixed_string_as_fixed_byte_array?: Bool;
    /** Enable output LowCardinality type as Dictionary Arrow type */
    output_format_arrow_low_cardinality_as_dictionary?: Bool;
    /** Use Arrow String type instead of Binary for String columns */
    output_format_arrow_string_as_string?: Bool;
    /** Compression codec used for output. Possible values: 'null', 'deflate', 'snappy'. */
    output_format_avro_codec?: string;
    /** Max rows in a file (if permitted by storage) */
    output_format_avro_rows_in_file?: UInt64;
    /** For Avro format: regexp of String columns to select as AVRO string. */
    output_format_avro_string_column_pattern?: string;
    /** Sync interval in bytes. */
    output_format_avro_sync_interval?: UInt64;
    /** Use BSON String type instead of Binary for String columns. */
    output_format_bson_string_as_string?: Bool;
    /** If it is set true, end of line in CSV format will be \\r\\n instead of \\n. */
    output_format_csv_crlf_end_of_line?: Bool;
    /** Output trailing zeros when printing Decimal values. E.g. 1.230000 instead of 1.23. */
    output_format_decimal_trailing_zeros?: Bool;
    /** Enable streaming in output formats that support it. */
    output_format_enable_streaming?: Bool;
    /** Output a JSON array of all rows in JSONEachRow(Compact) format. */
    output_format_json_array_of_rows?: Bool;
    /** Controls escaping forward slashes for string outputs in JSON output format. This is intended for compatibility with JavaScript. Don't confuse with backslashes that are always escaped. */
    output_format_json_escape_forward_slashes?: Bool;
    /** Serialize named tuple columns as JSON objects. */
    output_format_json_named_tuples_as_objects?: Bool;
    /** Controls quoting of 64-bit float numbers in JSON output format. */
    output_format_json_quote_64bit_floats?: Bool;
    /** Controls quoting of 64-bit integers in JSON output format. */
    output_format_json_quote_64bit_integers?: Bool;
    /** Controls quoting of decimals in JSON output format. */
    output_format_json_quote_decimals?: Bool;
    /** Enables '+nan', '-nan', '+inf', '-inf' outputs in JSON output format. */
    output_format_json_quote_denormals?: Bool;
    /** Validate UTF-8 sequences in JSON output formats, doesn't impact formats JSON/JSONCompact/JSONColumnsWithMetadata, they always validate utf8 */
    output_format_json_validate_utf8?: Bool;
    /** The way how to output UUID in MsgPack format. */
    output_format_msgpack_uuid_representation?: MsgPackUUIDRepresentation;
    /** Compression method for ORC output format. Supported codecs: lz4, snappy, zlib, zstd, none (uncompressed) */
    output_format_orc_compression_method?: ORCCompression;
    /** Use ORC String type instead of Binary for String columns */
    output_format_orc_string_as_string?: Bool;
    /** Enable parallel formatting for some data formats. */
    output_format_parallel_formatting?: Bool;
    /** In parquet file schema, use name 'element' instead of 'item' for list elements. This is a historical artifact of Arrow library implementation. Generally increases compatibility, except perhaps with some old versions of Arrow. */
    output_format_parquet_compliant_nested_types?: Bool;
    /** Compression method for Parquet output format. Supported codecs: snappy, lz4, brotli, zstd, gzip, none (uncompressed) */
    output_format_parquet_compression_method?: ParquetCompression;
    /** Use Parquet FIXED_LENGTH_BYTE_ARRAY type instead of Binary for FixedString columns. */
    output_format_parquet_fixed_string_as_fixed_byte_array?: Bool;
    /** Target row group size in rows. */
    output_format_parquet_row_group_size?: UInt64;
    /** Target row group size in bytes, before compression. */
    output_format_parquet_row_group_size_bytes?: UInt64;
    /** Use Parquet String type instead of Binary for String columns. */
    output_format_parquet_string_as_string?: Bool;
    /** Parquet format version for output format. Supported versions: 1.0, 2.4, 2.6 and 2.latest (default) */
    output_format_parquet_version?: ParquetVersion;
    /** Use ANSI escape sequences to paint colors in Pretty formats */
    output_format_pretty_color?: Bool;
    /** Charset for printing grid borders. Available charsets: ASCII, UTF-8 (default one). */
    output_format_pretty_grid_charset?: string;
    /** Maximum width to pad all values in a column in Pretty formats. */
    output_format_pretty_max_column_pad_width?: UInt64;
    /** Rows limit for Pretty formats. */
    output_format_pretty_max_rows?: UInt64;
    /** Maximum width of value to display in Pretty formats. If greater - it will be cut. */
    output_format_pretty_max_value_width?: UInt64;
    /** Add row numbers before each row for pretty output format */
    output_format_pretty_row_numbers?: Bool;
    /** When serializing Nullable columns with Google wrappers, serialize default values as empty wrappers. If turned off, default and null values are not serialized */
    output_format_protobuf_nullables_with_google_wrappers?: Bool;
    /** Include column names in INSERT query */
    output_format_sql_insert_include_column_names?: Bool;
    /** The maximum number  of rows in one INSERT statement. */
    output_format_sql_insert_max_batch_size?: UInt64;
    /** Quote column names with '`' characters */
    output_format_sql_insert_quote_names?: Bool;
    /** The name of table in the output INSERT query */
    output_format_sql_insert_table_name?: string;
    /** Use REPLACE statement instead of INSERT */
    output_format_sql_insert_use_replace?: Bool;
    /** If it is set true, end of line in TSV format will be \\r\\n instead of \\n. */
    output_format_tsv_crlf_end_of_line?: Bool;
    /** Write statistics about read rows, bytes, time elapsed in suitable output formats. */
    output_format_write_statistics?: Bool;
    /** Process distributed INSERT SELECT query in the same cluster on local tables on every shard; if set to 1 - SELECT is executed on each shard; if set to 2 - SELECT and INSERT are executed on each shard */
    parallel_distributed_insert_select?: UInt64;
    /** This is internal setting that should not be used directly and represents an implementation detail of the 'parallel replicas' mode. This setting will be automatically set up by the initiator server for distributed queries to the index of the replica participating in query processing among parallel replicas. */
    parallel_replica_offset?: UInt64;
    /** This is internal setting that should not be used directly and represents an implementation detail of the 'parallel replicas' mode. This setting will be automatically set up by the initiator server for distributed queries to the number of parallel replicas participating in query processing. */
    parallel_replicas_count?: UInt64;
    /** Custom key assigning work to replicas when parallel replicas are used. */
    parallel_replicas_custom_key?: string;
    /** Type of filter to use with custom key for parallel replicas. default - use modulo operation on the custom key, range - use range filter on custom key using all possible values for the value type of custom key. */
    parallel_replicas_custom_key_filter_type?: ParallelReplicasCustomKeyFilterType;
    /** If true, ClickHouse will use parallel replicas algorithm also for non-replicated MergeTree tables */
    parallel_replicas_for_non_replicated_merge_tree?: Bool;
    /** If the number of marks to read is less than the value of this setting - parallel replicas will be disabled */
    parallel_replicas_min_number_of_granules_to_enable?: UInt64;
    /** A multiplier which will be added during calculation for minimal number of marks to retrieve from coordinator. This will be applied only for remote replicas. */
    parallel_replicas_single_task_marks_count_multiplier?: Float;
    /** Enables pushing to attached views concurrently instead of sequentially. */
    parallel_view_processing?: Bool;
    /** Parallelize output for reading step from storage. It allows parallelizing query processing right after reading from storage if possible */
    parallelize_output_from_storages?: Bool;
    /** If not 0 group left table blocks in bigger ones for left-side table in partial merge join. It uses up to 2x of specified memory per joining thread. */
    partial_merge_join_left_table_buffer_bytes?: UInt64;
    /** Split right-hand joining data in blocks of specified size. It's a portion of data indexed by min-max values and possibly unloaded on disk. */
    partial_merge_join_rows_in_right_blocks?: UInt64;
    /** Allows query to return a partial result after cancel. */
    partial_result_on_first_cancel?: Bool;
    /** If the destination table contains at least that many active parts in a single partition, artificially slow down insert into table. */
    parts_to_delay_insert?: UInt64;
    /** If more than this number active parts in a single partition of the destination table, throw 'Too many parts ...' exception. */
    parts_to_throw_insert?: UInt64;
    /** Interval after which periodically refreshed live view is forced to refresh. */
    periodic_live_view_refresh?: Seconds;
    /** Block at the query wait loop on the server for the specified number of seconds. */
    poll_interval?: UInt64;
    /** Close connection before returning connection to the pool. */
    postgresql_connection_pool_auto_close_connection?: Bool;
    /** Connection pool size for PostgreSQL table engine and database engine. */
    postgresql_connection_pool_size?: UInt64;
    /** Connection pool push/pop timeout on empty pool for PostgreSQL table engine and database engine. By default it will block on empty pool. */
    postgresql_connection_pool_wait_timeout?: UInt64;
    /** Prefer using column names instead of aliases if possible. */
    prefer_column_name_to_alias?: Bool;
    /** If enabled, all IN/JOIN operators will be rewritten as GLOBAL IN/JOIN. It's useful when the to-be-joined tables are only available on the initiator and we need to always scatter their data on-the-fly during distributed processing with the GLOBAL keyword. It's also useful to reduce the need to access the external sources joining external tables. */
    prefer_global_in_and_join?: Bool;
    /** If it's true then queries will be always sent to local replica (if it exists). If it's false then replica to send a query will be chosen between local and remote ones according to load_balancing */
    prefer_localhost_replica?: Bool;
    /** This setting adjusts the data block size for query processing and represents additional fine tune to the more rough 'max_block_size' setting. If the columns are large and with 'max_block_size' rows the block size is likely to be larger than the specified amount of bytes, its size will be lowered for better CPU cache locality. */
    preferred_block_size_bytes?: UInt64;
    /** Limit on max column size in block while reading. Helps to decrease cache misses count. Should be close to L2 cache size. */
    preferred_max_column_in_block_size_bytes?: UInt64;
    /** The maximum size of the prefetch buffer to read from the filesystem. */
    prefetch_buffer_size?: UInt64;
    /** Priority of the query. 1 - the highest, higher value - lower priority; 0 - do not use priorities. */
    priority?: UInt64;
    /** Compress cache entries. */
    query_cache_compress_entries?: Bool;
    /** The maximum number of query results the current user may store in the query cache. 0 means unlimited. */
    query_cache_max_entries?: UInt64;
    /** The maximum amount of memory (in bytes) the current user may allocate in the query cache. 0 means unlimited.  */
    query_cache_max_size_in_bytes?: UInt64;
    /** Minimum time in milliseconds for a query to run for its result to be stored in the query cache. */
    query_cache_min_query_duration?: Milliseconds;
    /** Minimum number a SELECT query must run before its result is stored in the query cache */
    query_cache_min_query_runs?: UInt64;
    /** Allow other users to read entry in the query cache */
    query_cache_share_between_users?: Bool;
    /** Squash partial result blocks to blocks of size 'max_block_size'. Reduces performance of inserts into the query cache but improves the compressability of cache entries. */
    query_cache_squash_partial_results?: Bool;
    /** Store results of queries with non-deterministic functions (e.g. rand(), now()) in the query cache */
    query_cache_store_results_of_queries_with_nondeterministic_functions?: Bool;
    /** After this time in seconds entries in the query cache become stale */
    query_cache_ttl?: Seconds;
    /** Use query plan for aggregation-in-order optimisation */
    query_plan_aggregation_in_order?: Bool;
    /** Apply optimizations to query plan */
    query_plan_enable_optimizations?: Bool;
    /** Allow to push down filter by predicate query plan step */
    query_plan_filter_push_down?: Bool;
    /** Limit the total number of optimizations applied to query plan. If zero, ignored. If limit reached, throw exception */
    query_plan_max_optimizations_to_apply?: UInt64;
    /** Analyze primary key using query plan (instead of AST) */
    query_plan_optimize_primary_key?: Bool;
    /** Use query plan for aggregation-in-order optimisation */
    query_plan_optimize_projection?: Bool;
    /** Use query plan for read-in-order optimisation */
    query_plan_read_in_order?: Bool;
    /** Remove redundant Distinct step in query plan */
    query_plan_remove_redundant_distinct?: Bool;
    /** Remove redundant sorting in query plan. For example, sorting steps related to ORDER BY clauses in subqueries */
    query_plan_remove_redundant_sorting?: Bool;
    /** Period for CPU clock timer of query profiler (in nanoseconds). Set 0 value to turn off the CPU clock query profiler. Recommended value is at least 10000000 (100 times a second) for single queries or 1000000000 (once a second) for cluster-wide profiling. */
    query_profiler_cpu_time_period_ns?: UInt64;
    /** Period for real clock timer of query profiler (in nanoseconds). Set 0 value to turn off the real clock query profiler. Recommended value is at least 10000000 (100 times a second) for single queries or 1000000000 (once a second) for cluster-wide profiling. */
    query_profiler_real_time_period_ns?: UInt64;
    /** The wait time in the request queue, if the number of concurrent requests exceeds the maximum. */
    queue_max_wait_ms?: Milliseconds;
    /** The wait time for reading from RabbitMQ before retry. */
    rabbitmq_max_wait_ms?: Milliseconds;
    /** Settings to reduce the number of threads in case of slow reads. Count events when the read bandwidth is less than that many bytes per second. */
    read_backoff_max_throughput?: UInt64;
    /** Settings to try keeping the minimal number of threads in case of slow reads. */
    read_backoff_min_concurrency?: UInt64;
    /** Settings to reduce the number of threads in case of slow reads. The number of events after which the number of threads will be reduced. */
    read_backoff_min_events?: UInt64;
    /** Settings to reduce the number of threads in case of slow reads. Do not pay attention to the event, if the previous one has passed less than a certain amount of time. */
    read_backoff_min_interval_between_events_ms?: Milliseconds;
    /** Setting to reduce the number of threads in case of slow reads. Pay attention only to reads that took at least that much time. */
    read_backoff_min_latency_ms?: Milliseconds;
    /** Allow to use the filesystem cache in passive mode - benefit from the existing cache entries, but don't put more entries into the cache. If you set this setting for heavy ad-hoc queries and leave it disabled for short real-time queries, this will allows to avoid cache threshing by too heavy queries and to improve the overall system efficiency. */
    read_from_filesystem_cache_if_exists_otherwise_bypass_cache?: Bool;
    /** Minimal number of parts to read to run preliminary merge step during multithread reading in order of primary key. */
    read_in_order_two_level_merge_threshold?: UInt64;
    /** What to do when the limit is exceeded. */
    read_overflow_mode?: OverflowMode;
    /** What to do when the leaf limit is exceeded. */
    read_overflow_mode_leaf?: OverflowMode;
    /** Priority to read data from local filesystem or remote filesystem. Only supported for 'pread_threadpool' method for local filesystem and for `threadpool` method for remote filesystem. */
    read_priority?: Int64;
    /** 0 - no read-only restrictions. 1 - only read requests, as well as changing explicitly allowed settings. 2 - only read requests, as well as changing settings, except for the 'readonly' setting. */
    readonly?: UInt64;
    /** Connection timeout for receiving first packet of data or packet with positive progress from replica */
    receive_data_timeout_ms?: Milliseconds;
    /** Timeout for receiving data from network, in seconds. If no bytes were received in this interval, exception is thrown. If you set this setting on client, the 'send_timeout' for the socket will be also set on the corresponding connection end on the server. */
    receive_timeout?: Seconds;
    /** Allow regexp_tree dictionary using Hyperscan library. */
    regexp_dict_allow_hyperscan?: Bool;
    /** Max matches of any single regexp per row, used to safeguard 'extractAllGroupsHorizontal' against consuming too much memory with greedy RE. */
    regexp_max_matches_per_row?: UInt64;
    /** Reject patterns which will likely be expensive to evaluate with hyperscan (due to NFA state explosion) */
    reject_expensive_hyperscan_regexps?: Bool;
    /** If memory usage after remerge does not reduced by this ratio, remerge will be disabled. */
    remerge_sort_lowered_memory_bytes_ratio?: Float;
    /** Method of reading data from remote filesystem, one of: read, threadpool. */
    remote_filesystem_read_method?: string;
    /** Should use prefetching when reading data from remote filesystem. */
    remote_filesystem_read_prefetch?: Bool;
    /** Max attempts to read with backoff */
    remote_fs_read_backoff_max_tries?: UInt64;
    /** Max wait time when trying to read data for remote disk */
    remote_fs_read_max_backoff_ms?: UInt64;
    /** Min bytes required for remote read (url, s3) to do seek, instead of read with ignore. */
    remote_read_min_bytes_for_seek?: UInt64;
    /** Rename successfully processed files according to the specified pattern; Pattern can include the following placeholders: `%a` (full original file name), `%f` (original filename without extension), `%e` (file extension with dot), `%t` (current timestamp in µs), and `%%` (% sign) */
    rename_files_after_processing?: string;
    /** Whether the running request should be canceled with the same id as the new one. */
    replace_running_query?: Bool;
    /** The wait time for running query with the same query_id to finish when setting 'replace_running_query' is active. */
    replace_running_query_max_wait_ms?: Milliseconds;
    /** Wait for inactive replica to execute ALTER/OPTIMIZE. Time in seconds, 0 - do not wait, negative - wait for unlimited time. */
    replication_wait_for_inactive_replica_timeout?: Int64;
    /** What to do when the limit is exceeded. */
    result_overflow_mode?: OverflowMode;
    /** Use multiple threads for s3 multipart upload. It may lead to slightly higher memory usage */
    s3_allow_parallel_part_upload?: Bool;
    /** Check each uploaded object to s3 with head request to be sure that upload was successful */
    s3_check_objects_after_upload?: Bool;
    /** Enables or disables creating a new file on each insert in s3 engine tables */
    s3_create_new_file_on_insert?: Bool;
    /** Maximum number of files that could be returned in batch by ListObject request */
    s3_list_object_keys_size?: UInt64;
    /** The maximum number of connections per server. */
    s3_max_connections?: UInt64;
    /** Max number of requests that can be issued simultaneously before hitting request per second limit. By default (0) equals to `s3_max_get_rps` */
    s3_max_get_burst?: UInt64;
    /** Limit on S3 GET request per second rate before throttling. Zero means unlimited. */
    s3_max_get_rps?: UInt64;
    /** The maximum number of a concurrent loaded parts in multipart upload request. 0 means unlimited. You  */
    s3_max_inflight_parts_for_one_file?: UInt64;
    /** Max number of requests that can be issued simultaneously before hitting request per second limit. By default (0) equals to `s3_max_put_rps` */
    s3_max_put_burst?: UInt64;
    /** Limit on S3 PUT request per second rate before throttling. Zero means unlimited. */
    s3_max_put_rps?: UInt64;
    /** Max number of S3 redirects hops allowed. */
    s3_max_redirects?: UInt64;
    /** The maximum size of object to upload using singlepart upload to S3. */
    s3_max_single_part_upload_size?: UInt64;
    /** The maximum number of retries during single S3 read. */
    s3_max_single_read_retries?: UInt64;
    /** The maximum number of retries in case of unexpected errors during S3 write. */
    s3_max_unexpected_write_error_retries?: UInt64;
    /** The maximum size of part to upload during multipart upload to S3. */
    s3_max_upload_part_size?: UInt64;
    /** The minimum size of part to upload during multipart upload to S3. */
    s3_min_upload_part_size?: UInt64;
    /** Idleness timeout for sending and receiving data to/from S3. Fail if a single TCP read or write call blocks for this long. */
    s3_request_timeout_ms?: UInt64;
    /** Setting for Aws::Client::RetryStrategy, Aws::Client does retries itself, 0 means no retries */
    s3_retry_attempts?: UInt64;
    /** Allow to skip empty files in s3 table engine */
    s3_skip_empty_files?: Bool;
    /** The exact size of part to upload during multipart upload to S3 (some implementations does not supports variable size parts). */
    s3_strict_upload_part_size?: UInt64;
    /** Throw an error, when ListObjects request cannot match any files */
    s3_throw_on_zero_files_match?: Bool;
    /** Enables or disables truncate before insert in s3 engine tables. */
    s3_truncate_on_insert?: Bool;
    /** Multiply s3_min_upload_part_size by this factor each time s3_multiply_parts_count_threshold parts were uploaded from a single write to S3. */
    s3_upload_part_size_multiply_factor?: UInt64;
    /** Each time this number of parts was uploaded to S3 s3_min_upload_part_size multiplied by s3_upload_part_size_multiply_factor. */
    s3_upload_part_size_multiply_parts_count_threshold?: UInt64;
    /** Use schema from cache for URL with last modification time validation (for urls with Last-Modified header) */
    schema_inference_cache_require_modification_time_for_url?: Bool;
    /** The list of column names and types to use in schema inference for formats without column names. The format: 'column_name1 column_type1, column_name2 column_type2, ...' */
    schema_inference_hints?: string;
    /** If set to true, all inferred types will be Nullable in schema inference for formats without information about nullability. */
    schema_inference_make_columns_nullable?: Bool;
    /** Use cache in schema inference while using azure table function */
    schema_inference_use_cache_for_azure?: Bool;
    /** Use cache in schema inference while using file table function */
    schema_inference_use_cache_for_file?: Bool;
    /** Use cache in schema inference while using hdfs table function */
    schema_inference_use_cache_for_hdfs?: Bool;
    /** Use cache in schema inference while using s3 table function */
    schema_inference_use_cache_for_s3?: Bool;
    /** Use cache in schema inference while using url table function */
    schema_inference_use_cache_for_url?: Bool;
    /** For SELECT queries from the replicated table, throw an exception if the replica does not have a chunk written with the quorum; do not read the parts that have not yet been written with the quorum. */
    select_sequential_consistency?: UInt64;
    /** Send server text logs with specified minimum level to client. Valid values: 'trace', 'debug', 'information', 'warning', 'error', 'fatal', 'none' */
    send_logs_level?: LogsLevel;
    /** Send server text logs with specified regexp to match log source name. Empty means all sources. */
    send_logs_source_regexp?: string;
    /** Send progress notifications using X-ClickHouse-Progress headers. Some clients do not support high amount of HTTP headers (Python requests in particular), so it is disabled by default. */
    send_progress_in_http_headers?: Bool;
    /** Timeout for sending data to network, in seconds. If client needs to sent some data, but it did not able to send any bytes in this interval, exception is thrown. If you set this setting on client, the 'receive_timeout' for the socket will be also set on the corresponding connection end on the server. */
    send_timeout?: Seconds;
    /** This setting can be removed in the future due to potential caveats. It is experimental and is not suitable for production usage. The default timezone for current session or query. The server default timezone if empty. */
    session_timezone?: string;
    /** What to do when the limit is exceeded. */
    set_overflow_mode?: OverflowMode;
    /** Setting for short-circuit function evaluation configuration. Possible values: 'enable' - use short-circuit function evaluation for functions that are suitable for it, 'disable' - disable short-circuit function evaluation, 'force_enable' - use short-circuit function evaluation for all functions. */
    short_circuit_function_evaluation?: ShortCircuitFunctionEvaluation;
    /** For tables in databases with Engine=Atomic show UUID of the table in its CREATE query. */
    show_table_uuid_in_table_create_query_if_not_nil?: Bool;
    /** For single JOIN in case of identifier ambiguity prefer left table */
    single_join_prefer_left_table?: Bool;
    /** Skip download from remote filesystem if exceeds query cache size */
    skip_download_if_exceeds_query_cache?: Bool;
    /** If true, ClickHouse silently skips unavailable shards and nodes unresolvable through DNS. Shard is marked as unavailable when none of the replicas can be reached. */
    skip_unavailable_shards?: Bool;
    /** Time to sleep after receiving query in TCPHandler */
    sleep_after_receiving_query_ms?: Milliseconds;
    /** Time to sleep in sending data in TCPHandler */
    sleep_in_send_data_ms?: Milliseconds;
    /** Time to sleep in sending tables status response in TCPHandler */
    sleep_in_send_tables_status_ms?: Milliseconds;
    /** What to do when the limit is exceeded. */
    sort_overflow_mode?: OverflowMode;
    /** Method of reading data from storage file, one of: read, pread, mmap. The mmap method does not apply to clickhouse-server (it's intended for clickhouse-local). */
    storage_file_read_method?: LocalFSReadMethod;
    /** Maximum time to read from a pipe for receiving information from the threads when querying the `system.stack_trace` table. This setting is used for testing purposes and not meant to be changed by users. */
    storage_system_stack_trace_pipe_read_timeout_ms?: Milliseconds;
    /** Timeout for flushing data from streaming storages. */
    stream_flush_interval_ms?: Milliseconds;
    /** Allow direct SELECT query for Kafka, RabbitMQ, FileLog, Redis Streams and NATS engines. In case there are attached materialized views, SELECT query is not allowed even if this setting is enabled. */
    stream_like_engine_allow_direct_select?: Bool;
    /** When stream like engine reads from multiple queues, user will need to select one queue to insert into when writing. Used by Redis Streams and NATS. */
    stream_like_engine_insert_queue?: string;
    /** Timeout for polling data from/to streaming storages. */
    stream_poll_timeout_ms?: Milliseconds;
    /** When querying system.events or system.metrics tables, include all metrics, even with zero values. */
    system_events_show_zero_values?: Bool;
    /** The maximum number of different shards and the maximum number of replicas of one shard in the `remote` function. */
    table_function_remote_max_addresses?: UInt64;
    /** The time in seconds the connection needs to remain idle before TCP starts sending keepalive probes */
    tcp_keep_alive_timeout?: Seconds;
    /** Set compression codec for temporary files (sort and join on disk). I.e. LZ4, NONE. */
    temporary_files_codec?: string;
    /** Enables or disables empty INSERTs, enabled by default */
    throw_if_no_data_to_insert?: Bool;
    /** Ignore error from cache when caching on write operations (INSERT, merges) */
    throw_on_error_from_cache_on_write_operations?: Bool;
    /** Throw exception if unsupported query is used inside transaction */
    throw_on_unsupported_query_inside_transaction?: Bool;
    /** Check that the speed is not too low after the specified time has elapsed. */
    timeout_before_checking_execution_speed?: Seconds;
    /** What to do when the limit is exceeded. */
    timeout_overflow_mode?: OverflowMode;
    /** The threshold for totals_mode = 'auto'. */
    totals_auto_threshold?: Float;
    /** How to calculate TOTALS when HAVING is present, as well as when max_rows_to_group_by and group_by_overflow_mode = ‘any’ are present. */
    totals_mode?: TotalsMode;
    /** Send to system.trace_log profile event and value of increment on each increment with 'ProfileEvent' trace_type */
    trace_profile_events?: Bool;
    /** What to do when the limit is exceeded. */
    transfer_overflow_mode?: OverflowMode;
    /** If enabled, NULL values will be matched with 'IN' operator as if they are considered equal. */
    transform_null_in?: Bool;
    /** Set default mode in UNION query. Possible values: empty string, 'ALL', 'DISTINCT'. If empty, query without mode will throw exception. */
    union_default_mode?: SetOperationMode;
    /** Send unknown packet instead of data Nth data packet */
    unknown_packet_in_send_data?: UInt64;
    /** Use client timezone for interpreting DateTime string values, instead of adopting server timezone. */
    use_client_time_zone?: Bool;
    /** Changes format of directories names for distributed table insert parts. */
    use_compact_format_in_distributed_parts_names?: Bool;
    /** Use hedged requests for distributed queries */
    use_hedged_requests?: Bool;
    /** Try using an index if there is a subquery or a table expression on the right side of the IN operator. */
    use_index_for_in_with_subqueries?: Bool;
    /** The maximum size of set on the right hand side of the IN operator to use table index for filtering. It allows to avoid performance degradation and higher memory usage due to preparation of additional data structures for large queries. Zero means no limit. */
    use_index_for_in_with_subqueries_max_values?: UInt64;
    /** Use local cache for remote storage like HDFS or S3, it's used for remote table engine only */
    use_local_cache_for_remote_storage?: Bool;
    /** Use MySQL converted types when connected via MySQL compatibility for show columns query */
    use_mysql_types_in_show_columns?: Bool;
    /** Enable the query cache */
    use_query_cache?: Bool;
    /** Use data skipping indexes during query execution. */
    use_skip_indexes?: Bool;
    /** If query has FINAL, then skipping data based on indexes may produce incorrect result, hence disabled by default. */
    use_skip_indexes_if_final?: Bool;
    /** Use structure from insertion table instead of schema inference from data. Possible values: 0 - disabled, 1 - enabled, 2 - auto */
    use_structure_from_insertion_table_in_table_functions?: UInt64;
    /** Whether to use the cache of uncompressed blocks. */
    use_uncompressed_cache?: Bool;
    /** Columns preceding WITH FILL columns in ORDER BY clause form sorting prefix. Rows with different values in sorting prefix are filled independently */
    use_with_fill_by_sorting_prefix?: Bool;
    /** Throw exception if polygon is invalid in function pointInPolygon (e.g. self-tangent, self-intersecting). If the setting is false, the function will accept invalid polygons but may silently return wrong result. */
    validate_polygons?: Bool;
    /** Wait for committed changes to become actually visible in the latest snapshot */
    wait_changes_become_visible_after_commit_mode?: TransactionsWaitCSNMode;
    /** If true wait for processing of asynchronous insertion */
    wait_for_async_insert?: Bool;
    /** Timeout for waiting for processing asynchronous insertion */
    wait_for_async_insert_timeout?: Seconds;
    /** Timeout for waiting for window view fire signal in event time processing */
    wait_for_window_view_fire_signal_timeout?: Seconds;
    /** The clean interval of window view in seconds to free outdated data. */
    window_view_clean_interval?: Seconds;
    /** The heartbeat interval in seconds to indicate watch query is alive. */
    window_view_heartbeat_interval?: Seconds;
    /** Name of workload to be used to access resources */
    workload?: string;
    /** Allows you to select the max window log of ZSTD (it will not be used for MergeTree family) */
    zstd_window_log_max?: Int64;
}
/** @see https://clickhouse.com/docs/en/interfaces/http */
interface ClickHouseHTTPSettings {
    /** Ensures that the entire response is buffered.
     *  In this case, the data that is not stored in memory will be buffered in a temporary server file.
     *  This could help prevent errors that might occur during the streaming of SELECT queries.
     *  Additionally, this is useful when executing DDLs on clustered environments,
     *  as the client will receive the response only when the DDL is applied on all nodes of the cluster. */
    wait_end_of_query: Bool;
    /** Format to use if a SELECT query is executed without a FORMAT clause.
     *  Only useful for the {@link ClickHouseClient.exec} method,
     *  as {@link ClickHouseClient.query} method always attaches this clause. */
    default_format: DataFormat;
    /** By default, the session is terminated after 60 seconds of inactivity
     *  This is regulated by the `default_session_timeout` server setting. */
    session_timeout: UInt64;
    /** You can use this setting to check the session status before executing the query.
     *  If a session is expired or cannot be found, the server returns `SESSION_NOT_FOUND` with error code 372.
     *  NB: the session mechanism is only reliable when you connect directly to a particular ClickHouse server node.
     *  Due to each particular session not being shared across the cluster, sessions won't work well in a multi-node environment with a load balancer,
     *  as there will be no guarantee that each consequent request will be received on the same node. */
    session_check: Bool;
}
export type ClickHouseSettings = Partial<ClickHouseServerSettings> & Partial<ClickHouseHTTPSettings> & Record<string, number | string | boolean | SettingsMap | undefined>;
export interface MergeTreeSettings {
    /** Allow floating point as partition key */
    allow_floating_point_partition_key?: Bool;
    /** Allow Nullable types as primary keys. */
    allow_nullable_key?: Bool;
    /** Don't use this setting in production, because it is not ready. */
    allow_remote_fs_zero_copy_replication?: Bool;
    /** Reject primary/secondary indexes and sorting keys with identical expressions */
    allow_suspicious_indices?: Bool;
    /** Allows vertical merges from compact to wide parts. This settings must have the same value on all replicas */
    allow_vertical_merges_from_compact_to_wide_parts?: Bool;
    /** If true, replica never merge parts and always download merged parts from other replicas. */
    always_fetch_merged_part?: Bool;
    /** Generate UUIDs for parts. Before enabling check that all replicas support new format. */
    assign_part_uuids?: Bool;
    /** minimum interval between updates of async_block_ids_cache */
    async_block_ids_cache_min_update_interval_ms?: Milliseconds;
    /** If true, data from INSERT query is stored in queue and later flushed to table in background. */
    async_insert?: Bool;
    /** Obsolete setting, does nothing. */
    check_delay_period?: UInt64;
    /** Check columns or columns by hash for sampling are unsigned integer. */
    check_sample_column_is_correct?: Bool;
    /** Is the Replicated Merge cleanup has to be done automatically at each merge or manually (possible values are 'Always'/'Never' (default)) */
    clean_deleted_rows?: 'Always' | 'Never';
    /** Minimum period to clean old queue logs, blocks hashes and parts. */
    cleanup_delay_period?: UInt64;
    /** Add uniformly distributed value from 0 to x seconds to cleanup_delay_period to avoid thundering herd effect and subsequent DoS of ZooKeeper in case of very large number of tables. */
    cleanup_delay_period_random_add?: UInt64;
    /** Preferred batch size for background cleanup (points are abstract but 1 point is approximately equivalent to 1 inserted block). */
    cleanup_thread_preferred_points_per_iteration?: UInt64;
    /** Allow to create a table with sampling expression not in primary key. This is needed only to temporarily allow to run the server with wrong tables for backward compatibility. */
    compatibility_allow_sampling_expression_not_in_primary_key?: Bool;
    /** Marks support compression, reduce mark file size and speed up network transmission. */
    compress_marks?: Bool;
    /** Primary key support compression, reduce primary key file size and speed up network transmission. */
    compress_primary_key?: Bool;
    /** Activate concurrent part removal (see 'max_part_removal_threads') only if the number of inactive data parts is at least this. */
    concurrent_part_removal_threshold?: UInt64;
    /** Do not remove non byte-identical parts for ReplicatedMergeTree, instead detach them (maybe useful for further analysis). */
    detach_not_byte_identical_parts?: Bool;
    /** Do not remove old local parts when repairing lost replica. */
    detach_old_local_parts_when_cloning_replica?: Bool;
    /** Name of storage disk. Can be specified instead of storage policy. */
    disk?: string;
    /** Enable parts with adaptive and non-adaptive granularity */
    enable_mixed_granularity_parts?: Bool;
    /** Enable the endpoint id with zookeeper name prefix for the replicated merge tree table */
    enable_the_endpoint_id_with_zookeeper_name_prefix?: Bool;
    /** Enable usage of Vertical merge algorithm. */
    enable_vertical_merge_algorithm?: UInt64;
    /** When greater than zero only a single replica starts the merge immediately, others wait up to that amount of time to download the result instead of doing merges locally. If the chosen replica doesn't finish the merge during that amount of time, fallback to standard behavior happens. */
    execute_merges_on_single_replica_time_threshold?: Seconds;
    /** How many records about mutations that are done to keep. If zero, then keep all of them. */
    finished_mutations_to_keep?: UInt64;
    /** Do fsync for every inserted part. Significantly decreases performance of inserts, not recommended to use with wide parts. */
    fsync_after_insert?: Bool;
    /** Do fsync for part directory after all part operations (writes, renames, etc.). */
    fsync_part_directory?: Bool;
    /** Obsolete setting, does nothing. */
    in_memory_parts_enable_wal?: Bool;
    /** Obsolete setting, does nothing. */
    in_memory_parts_insert_sync?: Bool;
    /** If table contains at least that many inactive parts in single partition, artificially slow down insert into table. */
    inactive_parts_to_delay_insert?: UInt64;
    /** If more than this number inactive parts in single partition, throw 'Too many inactive parts ...' exception. */
    inactive_parts_to_throw_insert?: UInt64;
    /** How many rows correspond to one primary key value. */
    index_granularity?: UInt64;
    /** Approximate amount of bytes in single granule (0 - disabled). */
    index_granularity_bytes?: UInt64;
    /** Retry period for table initialization, in seconds. */
    initialization_retry_period?: Seconds;
    /** For background operations like merges, mutations etc. How many seconds before failing to acquire table locks. */
    lock_acquire_timeout_for_background_operations?: Seconds;
    /** Mark compress block size, the actual size of the block to compress. */
    marks_compress_block_size?: UInt64;
    /** Compression encoding used by marks, marks are small enough and cached, so the default compression is ZSTD(3). */
    marks_compression_codec?: string;
    /** Only recalculate ttl info when MATERIALIZE TTL */
    materialize_ttl_recalculate_only?: Bool;
    /** The 'too many parts' check according to 'parts_to_delay_insert' and 'parts_to_throw_insert' will be active only if the average part size (in the relevant partition) is not larger than the specified threshold. If it is larger than the specified threshold, the INSERTs will be neither delayed or rejected. This allows to have hundreds of terabytes in a single table on a single server if the parts are successfully merged to larger parts. This does not affect the thresholds on inactive parts or total parts. */
    max_avg_part_size_for_too_many_parts?: UInt64;
    /** Maximum in total size of parts to merge, when there are maximum free threads in background pool (or entries in replication queue). */
    max_bytes_to_merge_at_max_space_in_pool?: UInt64;
    /** Maximum in total size of parts to merge, when there are minimum free threads in background pool (or entries in replication queue). */
    max_bytes_to_merge_at_min_space_in_pool?: UInt64;
    /** Maximum period to clean old queue logs, blocks hashes and parts. */
    max_cleanup_delay_period?: UInt64;
    /** Compress the pending uncompressed data in buffer if its size is larger or equal than the specified threshold. Block of data will be compressed even if the current granule is not finished. If this setting is not set, the corresponding global setting is used. */
    max_compress_block_size?: UInt64;
    /** Max number of concurrently executed queries related to the MergeTree table (0 - disabled). Queries will still be limited by other max_concurrent_queries settings. */
    max_concurrent_queries?: UInt64;
    /** Max delay of inserting data into MergeTree table in seconds, if there are a lot of unmerged parts in single partition. */
    max_delay_to_insert?: UInt64;
    /** Max delay of mutating MergeTree table in milliseconds, if there are a lot of unfinished mutations */
    max_delay_to_mutate_ms?: UInt64;
    /** Max number of bytes to digest per segment to build GIN index. */
    max_digestion_size_per_segment?: UInt64;
    /** Not apply ALTER if number of files for modification(deletion, addition) more than this. */
    max_files_to_modify_in_alter_columns?: UInt64;
    /** Not apply ALTER, if number of files for deletion more than this. */
    max_files_to_remove_in_alter_columns?: UInt64;
    /** Maximum sleep time for merge selecting, a lower setting will trigger selecting tasks in background_schedule_pool frequently which result in large amount of requests to zookeeper in large-scale clusters */
    max_merge_selecting_sleep_ms?: UInt64;
    /** When there is more than specified number of merges with TTL entries in pool, do not assign new merge with TTL. This is to leave free threads for regular merges and avoid \"Too many parts\" */
    max_number_of_merges_with_ttl_in_pool?: UInt64;
    /** Limit the number of part mutations per replica to the specified amount. Zero means no limit on the number of mutations per replica (the execution can still be constrained by other settings). */
    max_number_of_mutations_for_replica?: UInt64;
    /** Obsolete setting, does nothing. */
    max_part_loading_threads?: MaxThreads;
    /** Obsolete setting, does nothing. */
    max_part_removal_threads?: MaxThreads;
    /** Limit the max number of partitions that can be accessed in one query. <= 0 means unlimited. This setting is the default that can be overridden by the query-level setting with the same name. */
    max_partitions_to_read?: Int64;
    /** If more than this number active parts in all partitions in total, throw 'Too many parts ...' exception. */
    max_parts_in_total?: UInt64;
    /** Max amount of parts which can be merged at once (0 - disabled). Doesn't affect OPTIMIZE FINAL query. */
    max_parts_to_merge_at_once?: UInt64;
    /** The maximum speed of data exchange over the network in bytes per second for replicated fetches. Zero means unlimited. */
    max_replicated_fetches_network_bandwidth?: UInt64;
    /** How many records may be in log, if there is inactive replica. Inactive replica becomes lost when when this number exceed. */
    max_replicated_logs_to_keep?: UInt64;
    /** How many tasks of merging and mutating parts are allowed simultaneously in ReplicatedMergeTree queue. */
    max_replicated_merges_in_queue?: UInt64;
    /** How many tasks of merging parts with TTL are allowed simultaneously in ReplicatedMergeTree queue. */
    max_replicated_merges_with_ttl_in_queue?: UInt64;
    /** How many tasks of mutating parts are allowed simultaneously in ReplicatedMergeTree queue. */
    max_replicated_mutations_in_queue?: UInt64;
    /** The maximum speed of data exchange over the network in bytes per second for replicated sends. Zero means unlimited. */
    max_replicated_sends_network_bandwidth?: UInt64;
    /** Max broken parts, if more - deny automatic deletion. */
    max_suspicious_broken_parts?: UInt64;
    /** Max size of all broken parts, if more - deny automatic deletion. */
    max_suspicious_broken_parts_bytes?: UInt64;
    /** How many rows in blocks should be formed for merge operations. By default, has the same value as `index_granularity`. */
    merge_max_block_size?: UInt64;
    /** How many bytes in blocks should be formed for merge operations. By default, has the same value as `index_granularity_bytes`. */
    merge_max_block_size_bytes?: UInt64;
    /** Maximum sleep time for merge selecting, a lower setting will trigger selecting tasks in background_schedule_pool frequently which result in large amount of requests to zookeeper in large-scale clusters */
    merge_selecting_sleep_ms?: UInt64;
    /** The sleep time for merge selecting task is multiplied by this factor when there's nothing to merge and divided when a merge was assigned */
    merge_selecting_sleep_slowdown_factor?: Float;
    /** Remove old broken detached parts in the background if they remained untouched for a specified by this setting period of time. */
    merge_tree_clear_old_broken_detached_parts_ttl_timeout_seconds?: UInt64;
    /** The period of executing the clear old parts operation in background. */
    merge_tree_clear_old_parts_interval_seconds?: UInt64;
    /** The period of executing the clear old temporary directories operation in background. */
    merge_tree_clear_old_temporary_directories_interval_seconds?: UInt64;
    /** Enable clearing old broken detached parts operation in background. */
    merge_tree_enable_clear_old_broken_detached?: UInt64;
    /** Minimal time in seconds, when merge with recompression TTL can be repeated. */
    merge_with_recompression_ttl_timeout?: Int64;
    /** Minimal time in seconds, when merge with delete TTL can be repeated. */
    merge_with_ttl_timeout?: Int64;
    /** Minimal absolute delay to close, stop serving requests and not return Ok during status check. */
    min_absolute_delay_to_close?: UInt64;
    /** Whether min_age_to_force_merge_seconds should be applied only on the entire partition and not on subset. */
    min_age_to_force_merge_on_partition_only?: Bool;
    /** If all parts in a certain range are older than this value, range will be always eligible for merging. Set to 0 to disable. */
    min_age_to_force_merge_seconds?: UInt64;
    /** Obsolete setting, does nothing. */
    min_bytes_for_compact_part?: UInt64;
    /** Minimal uncompressed size in bytes to create part in wide format instead of compact */
    min_bytes_for_wide_part?: UInt64;
    /** Minimal amount of bytes to enable part rebalance over JBOD array (0 - disabled). */
    min_bytes_to_rebalance_partition_over_jbod?: UInt64;
    /** When granule is written, compress the data in buffer if the size of pending uncompressed data is larger or equal than the specified threshold. If this setting is not set, the corresponding global setting is used. */
    min_compress_block_size?: UInt64;
    /** Minimal number of compressed bytes to do fsync for part after fetch (0 - disabled) */
    min_compressed_bytes_to_fsync_after_fetch?: UInt64;
    /** Minimal number of compressed bytes to do fsync for part after merge (0 - disabled) */
    min_compressed_bytes_to_fsync_after_merge?: UInt64;
    /** Min delay of inserting data into MergeTree table in milliseconds, if there are a lot of unmerged parts in single partition. */
    min_delay_to_insert_ms?: UInt64;
    /** Min delay of mutating MergeTree table in milliseconds, if there are a lot of unfinished mutations */
    min_delay_to_mutate_ms?: UInt64;
    /** Minimum amount of bytes in single granule. */
    min_index_granularity_bytes?: UInt64;
    /** Minimal number of marks to honor the MergeTree-level's max_concurrent_queries (0 - disabled). Queries will still be limited by other max_concurrent_queries settings. */
    min_marks_to_honor_max_concurrent_queries?: UInt64;
    /** Minimal amount of bytes to enable O_DIRECT in merge (0 - disabled). */
    min_merge_bytes_to_use_direct_io?: UInt64;
    /** Minimal delay from other replicas to close, stop serving requests and not return Ok during status check. */
    min_relative_delay_to_close?: UInt64;
    /** Calculate relative replica delay only if absolute delay is not less that this value. */
    min_relative_delay_to_measure?: UInt64;
    /** Obsolete setting, does nothing. */
    min_relative_delay_to_yield_leadership?: UInt64;
    /** Keep about this number of last records in ZooKeeper log, even if they are obsolete. It doesn't affect work of tables: used only to diagnose ZooKeeper log before cleaning. */
    min_replicated_logs_to_keep?: UInt64;
    /** Obsolete setting, does nothing. */
    min_rows_for_compact_part?: UInt64;
    /** Minimal number of rows to create part in wide format instead of compact */
    min_rows_for_wide_part?: UInt64;
    /** Minimal number of rows to do fsync for part after merge (0 - disabled) */
    min_rows_to_fsync_after_merge?: UInt64;
    /** How many last blocks of hashes should be kept on disk (0 - disabled). */
    non_replicated_deduplication_window?: UInt64;
    /** When there is less than specified number of free entries in pool, do not execute part mutations. This is to leave free threads for regular merges and avoid \"Too many parts\" */
    number_of_free_entries_in_pool_to_execute_mutation?: UInt64;
    /** When there is less than specified number of free entries in pool (or replicated queue), start to lower maximum size of merge to process (or to put in queue). This is to allow small merges to process - not filling the pool with long running merges. */
    number_of_free_entries_in_pool_to_lower_max_size_of_merge?: UInt64;
    /** If table has at least that many unfinished mutations, artificially slow down mutations of table. Disabled if set to 0 */
    number_of_mutations_to_delay?: UInt64;
    /** If table has at least that many unfinished mutations, throw 'Too many mutations' exception. Disabled if set to 0 */
    number_of_mutations_to_throw?: UInt64;
    /** How many seconds to keep obsolete parts. */
    old_parts_lifetime?: Seconds;
    /** Time to wait before/after moving parts between shards. */
    part_moves_between_shards_delay_seconds?: UInt64;
    /** Experimental/Incomplete feature to move parts between shards. Does not take into account sharding expressions. */
    part_moves_between_shards_enable?: UInt64;
    /** If table contains at least that many active parts in single partition, artificially slow down insert into table. Disabled if set to 0 */
    parts_to_delay_insert?: UInt64;
    /** If more than this number active parts in single partition, throw 'Too many parts ...' exception. */
    parts_to_throw_insert?: UInt64;
    /** If sum size of parts exceeds this threshold and time passed after replication log entry creation is greater than \"prefer_fetch_merged_part_time_threshold\", prefer fetching merged part from replica instead of doing merge locally. To speed up very long merges. */
    prefer_fetch_merged_part_size_threshold?: UInt64;
    /** If time passed after replication log entry creation exceeds this threshold and sum size of parts is greater than \"prefer_fetch_merged_part_size_threshold\", prefer fetching merged part from replica instead of doing merge locally. To speed up very long merges. */
    prefer_fetch_merged_part_time_threshold?: Seconds;
    /** Primary compress block size, the actual size of the block to compress. */
    primary_key_compress_block_size?: UInt64;
    /** Compression encoding used by primary, primary key is small enough and cached, so the default compression is ZSTD(3). */
    primary_key_compression_codec?: string;
    /** Minimal ratio of number of default values to number of all values in column to store it in sparse serializations. If >= 1, columns will be always written in full serialization. */
    ratio_of_defaults_for_sparse_serialization?: Float;
    /** When greater than zero only a single replica starts the merge immediately if merged part on shared storage and 'allow_remote_fs_zero_copy_replication' is enabled. */
    remote_fs_execute_merges_on_single_replica_time_threshold?: Seconds;
    /** Run zero-copy in compatible mode during conversion process. */
    remote_fs_zero_copy_path_compatible_mode?: Bool;
    /** ZooKeeper path for zero-copy table-independent info. */
    remote_fs_zero_copy_zookeeper_path?: string;
    /** Remove empty parts after they were pruned by TTL, mutation, or collapsing merge algorithm. */
    remove_empty_parts?: Bool;
    /** Setting for an incomplete experimental feature. */
    remove_rolled_back_parts_immediately?: Bool;
    /** If true, Replicated tables replicas on this node will try to acquire leadership. */
    replicated_can_become_leader?: Bool;
    /** How many last blocks of hashes should be kept in ZooKeeper (old blocks will be deleted). */
    replicated_deduplication_window?: UInt64;
    /** How many last hash values of async_insert blocks should be kept in ZooKeeper (old blocks will be deleted). */
    replicated_deduplication_window_for_async_inserts?: UInt64;
    /** Similar to \"replicated_deduplication_window\", but determines old blocks by their lifetime. Hash of an inserted block will be deleted (and the block will not be deduplicated after) if it outside of one \"window\". You can set very big replicated_deduplication_window to avoid duplicating INSERTs during that period of time. */
    replicated_deduplication_window_seconds?: UInt64;
    /** Similar to \"replicated_deduplication_window_for_async_inserts\", but determines old blocks by their lifetime. Hash of an inserted block will be deleted (and the block will not be deduplicated after) if it outside of one \"window\". You can set very big replicated_deduplication_window to avoid duplicating INSERTs during that period of time. */
    replicated_deduplication_window_seconds_for_async_inserts?: UInt64;
    /** HTTP connection timeout for part fetch requests. Inherited from default profile `http_connection_timeout` if not set explicitly. */
    replicated_fetches_http_connection_timeout?: Seconds;
    /** HTTP receive timeout for fetch part requests. Inherited from default profile `http_receive_timeout` if not set explicitly. */
    replicated_fetches_http_receive_timeout?: Seconds;
    /** HTTP send timeout for part fetch requests. Inherited from default profile `http_send_timeout` if not set explicitly. */
    replicated_fetches_http_send_timeout?: Seconds;
    /** Max number of mutation commands that can be merged together and executed in one MUTATE_PART entry (0 means unlimited) */
    replicated_max_mutations_in_one_entry?: UInt64;
    /** Obsolete setting, does nothing. */
    replicated_max_parallel_fetches?: UInt64;
    /** Limit parallel fetches from endpoint (actually pool size). */
    replicated_max_parallel_fetches_for_host?: UInt64;
    /** Obsolete setting, does nothing. */
    replicated_max_parallel_fetches_for_table?: UInt64;
    /** Obsolete setting, does nothing. */
    replicated_max_parallel_sends?: UInt64;
    /** Obsolete setting, does nothing. */
    replicated_max_parallel_sends_for_table?: UInt64;
    /** If ratio of wrong parts to total number of parts is less than this - allow to start. */
    replicated_max_ratio_of_wrong_parts?: Float;
    /** Maximum number of parts to remove during one CleanupThread iteration (0 means unlimited). */
    simultaneous_parts_removal_limit?: UInt64;
    /** Name of storage disk policy */
    storage_policy?: string;
    /** How many seconds to keep tmp_-directories. You should not lower this value because merges and mutations may not be able to work with low value of this setting. */
    temporary_directories_lifetime?: Seconds;
    /** Recompression works slow in most cases, so we don't start merge with recompression until this timeout and trying to fetch recompressed part from replica which assigned this merge with recompression. */
    try_fetch_recompressed_part_timeout?: Seconds;
    /** Only drop altogether the expired parts and not partially prune them. */
    ttl_only_drop_parts?: Bool;
    /** use in-memory cache to filter duplicated async inserts based on block ids */
    use_async_block_ids_cache?: Bool;
    /** Experimental feature to speed up parts loading process by using MergeTree metadata cache */
    use_metadata_cache?: Bool;
    /** Use small format (dozens bytes) for part checksums in ZooKeeper instead of ordinary ones (dozens KB). Before enabling check that all replicas support new format. */
    use_minimalistic_checksums_in_zookeeper?: Bool;
    /** Store part header (checksums and columns) in a compact format and a single part znode instead of separate znodes (<part>/columns and <part>/checksums). This can dramatically reduce snapshot size in ZooKeeper. Before enabling check that all replicas support new format. */
    use_minimalistic_part_header_in_zookeeper?: Bool;
    /** Minimal (approximate) uncompressed size in bytes in merging parts to activate Vertical merge algorithm. */
    vertical_merge_algorithm_min_bytes_to_activate?: UInt64;
    /** Minimal amount of non-PK columns to activate Vertical merge algorithm. */
    vertical_merge_algorithm_min_columns_to_activate?: UInt64;
    /** Minimal (approximate) sum of rows in merging parts to activate Vertical merge algorithm. */
    vertical_merge_algorithm_min_rows_to_activate?: UInt64;
    /** Obsolete setting, does nothing. */
    write_ahead_log_bytes_to_fsync?: UInt64;
    /** Obsolete setting, does nothing. */
    write_ahead_log_interval_ms_to_fsync?: UInt64;
    /** Obsolete setting, does nothing. */
    write_ahead_log_max_bytes?: UInt64;
    /** Obsolete setting, does nothing. */
    write_final_mark?: Bool;
    /** Max percentage of top level parts to postpone removal in order to get smaller independent ranges (highly not recommended to change) */
    zero_copy_concurrent_part_removal_max_postpone_ratio?: Float;
    /** Max recursion depth for splitting independent Outdated parts ranges into smaller subranges (highly not recommended to change) */
    zero_copy_concurrent_part_removal_max_split_times?: UInt64;
    /** If zero copy replication is enabled sleep random amount of time before trying to lock depending on parts size for merge or mutation */
    zero_copy_merge_mutation_min_parts_size_sleep_before_lock?: UInt64;
    /** ZooKeeper session expiration check period, in seconds. */
    zookeeper_session_expiration_check_period?: Seconds;
}
type Bool = 0 | 1;
type Int64 = string;
type UInt64 = string;
type UInt64Auto = string;
type Float = number;
type MaxThreads = number;
type Seconds = number;
type Milliseconds = number;
type Char = string;
type URI = string;
type Map = SettingsMap;
export declare class SettingsMap {
    private readonly record;
    private constructor();
    toString(): string;
    static from(record: Record<string, string>): SettingsMap;
}
export type LoadBalancing = 'random' | 'nearest_hostname' | 'in_order' | 'first_or_random' | 'round_robin';
export type TotalsMode = 'before_having' | 'after_having_inclusive' | 'after_having_exclusive' | 'after_having_auto';
export type DistributedProductMode = 'deny' | 'local' | 'global' | 'allow';
export type LogsLevel = 'none' | 'fatal' | 'error' | 'warning' | 'information' | 'debug' | 'trace' | 'test';
export type LogQueriesType = 'QUERY_START' | 'QUERY_FINISH' | 'EXCEPTION_BEFORE_START' | 'EXCEPTION_WHILE_PROCESSING';
export type DefaultTableEngine = 'Memory' | 'ReplicatedMergeTree' | 'ReplacingMergeTree' | 'MergeTree' | 'StripeLog' | 'ReplicatedReplacingMergeTree' | 'Log' | 'None';
export type MySQLDataTypesSupport = '' | 'date2String' | 'date2Date32' | 'datetime64' | 'decimal';
export type DistributedDDLOutputMode = 'never_throw' | 'null_status_on_timeout' | 'throw' | 'none';
export type ShortCircuitFunctionEvaluation = 'force_enable' | 'disable' | 'enable';
export type TransactionsWaitCSNMode = 'wait_unknown' | 'wait' | 'async';
export type EscapingRule = 'CSV' | 'JSON' | 'Quoted' | 'Raw' | 'XML' | 'Escaped' | 'None';
export type DateTimeOutputFormat = 'simple' | 'iso' | 'unix_timestamp';
export type DateTimeInputFormat = 'best_effort_us' | 'best_effort' | 'basic';
export type MsgPackUUIDRepresentation = 'ext' | 'str' | 'bin';
export type OverflowMode = 'break' | 'throw';
export type OverflowModeGroupBy = OverflowMode | 'any';
export type JoinStrictness = 'ANY' | 'ALL' | '';
export type JoinAlgorithm = 'prefer_partial_merge' | 'hash' | 'parallel_hash' | 'partial_merge' | 'auto' | 'default' | 'direct' | 'full_sorting_merge' | 'grace_hash';
export type Dialect = 'clickhouse' | 'kusto' | 'kusto_auto' | 'prql';
export type CapnProtoEnumComparingMode = 'by_names' | 'by_values' | 'by_names_case_insensitive';
export type ParquetCompression = 'none' | 'snappy' | 'zstd' | 'gzip' | 'lz4' | 'brotli';
export type ArrowCompression = 'none' | 'lz4_frame' | 'zstd';
export type ORCCompression = 'none' | 'snappy' | 'zstd' | 'gzip' | 'lz4';
export type SetOperationMode = '' | 'ALL' | 'DISTINCT';
export type LocalFSReadMethod = 'read' | 'pread' | 'mmap';
export type ParallelReplicasCustomKeyFilterType = 'default' | 'range';
export type IntervalOutputFormat = 'kusto' | 'numeric';
export type ParquetVersion = '1.0' | '2.4' | '2.6' | '2.latest';
export {};
