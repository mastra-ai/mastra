"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ACL_CAT_1 = __importDefault(require("./ACL_CAT"));
const ACL_DELUSER_1 = __importDefault(require("./ACL_DELUSER"));
const ACL_DRYRUN_1 = __importDefault(require("./ACL_DRYRUN"));
const ACL_GENPASS_1 = __importDefault(require("./ACL_GENPASS"));
const ACL_GETUSER_1 = __importDefault(require("./ACL_GETUSER"));
const ACL_LIST_1 = __importDefault(require("./ACL_LIST"));
const ACL_LOAD_1 = __importDefault(require("./ACL_LOAD"));
const ACL_LOG_RESET_1 = __importDefault(require("./ACL_LOG_RESET"));
const ACL_LOG_1 = __importDefault(require("./ACL_LOG"));
const ACL_SAVE_1 = __importDefault(require("./ACL_SAVE"));
const ACL_SETUSER_1 = __importDefault(require("./ACL_SETUSER"));
const ACL_USERS_1 = __importDefault(require("./ACL_USERS"));
const ACL_WHOAMI_1 = __importDefault(require("./ACL_WHOAMI"));
const APPEND_1 = __importDefault(require("./APPEND"));
const ASKING_1 = __importDefault(require("./ASKING"));
const AUTH_1 = __importDefault(require("./AUTH"));
const BGREWRITEAOF_1 = __importDefault(require("./BGREWRITEAOF"));
const BGSAVE_1 = __importDefault(require("./BGSAVE"));
const BITCOUNT_1 = __importDefault(require("./BITCOUNT"));
const BITFIELD_RO_1 = __importDefault(require("./BITFIELD_RO"));
const BITFIELD_1 = __importDefault(require("./BITFIELD"));
const BITOP_1 = __importDefault(require("./BITOP"));
const BITPOS_1 = __importDefault(require("./BITPOS"));
const BLMOVE_1 = __importDefault(require("./BLMOVE"));
const BLMPOP_1 = __importDefault(require("./BLMPOP"));
const BLPOP_1 = __importDefault(require("./BLPOP"));
const BRPOP_1 = __importDefault(require("./BRPOP"));
const BRPOPLPUSH_1 = __importDefault(require("./BRPOPLPUSH"));
const BZMPOP_1 = __importDefault(require("./BZMPOP"));
const BZPOPMAX_1 = __importDefault(require("./BZPOPMAX"));
const BZPOPMIN_1 = __importDefault(require("./BZPOPMIN"));
const CLIENT_CACHING_1 = __importDefault(require("./CLIENT_CACHING"));
const CLIENT_GETNAME_1 = __importDefault(require("./CLIENT_GETNAME"));
const CLIENT_GETREDIR_1 = __importDefault(require("./CLIENT_GETREDIR"));
const CLIENT_ID_1 = __importDefault(require("./CLIENT_ID"));
const CLIENT_INFO_1 = __importDefault(require("./CLIENT_INFO"));
const CLIENT_KILL_1 = __importDefault(require("./CLIENT_KILL"));
const CLIENT_LIST_1 = __importDefault(require("./CLIENT_LIST"));
const CLIENT_NO_EVICT_1 = __importDefault(require("./CLIENT_NO-EVICT"));
const CLIENT_NO_TOUCH_1 = __importDefault(require("./CLIENT_NO-TOUCH"));
const CLIENT_PAUSE_1 = __importDefault(require("./CLIENT_PAUSE"));
const CLIENT_SETNAME_1 = __importDefault(require("./CLIENT_SETNAME"));
const CLIENT_TRACKING_1 = __importDefault(require("./CLIENT_TRACKING"));
const CLIENT_TRACKINGINFO_1 = __importDefault(require("./CLIENT_TRACKINGINFO"));
const CLIENT_UNPAUSE_1 = __importDefault(require("./CLIENT_UNPAUSE"));
const CLUSTER_ADDSLOTS_1 = __importDefault(require("./CLUSTER_ADDSLOTS"));
const CLUSTER_ADDSLOTSRANGE_1 = __importDefault(require("./CLUSTER_ADDSLOTSRANGE"));
const CLUSTER_BUMPEPOCH_1 = __importDefault(require("./CLUSTER_BUMPEPOCH"));
const CLUSTER_COUNT_FAILURE_REPORTS_1 = __importDefault(require("./CLUSTER_COUNT-FAILURE-REPORTS"));
const CLUSTER_COUNTKEYSINSLOT_1 = __importDefault(require("./CLUSTER_COUNTKEYSINSLOT"));
const CLUSTER_DELSLOTS_1 = __importDefault(require("./CLUSTER_DELSLOTS"));
const CLUSTER_DELSLOTSRANGE_1 = __importDefault(require("./CLUSTER_DELSLOTSRANGE"));
const CLUSTER_FAILOVER_1 = __importDefault(require("./CLUSTER_FAILOVER"));
const CLUSTER_FLUSHSLOTS_1 = __importDefault(require("./CLUSTER_FLUSHSLOTS"));
const CLUSTER_FORGET_1 = __importDefault(require("./CLUSTER_FORGET"));
const CLUSTER_GETKEYSINSLOT_1 = __importDefault(require("./CLUSTER_GETKEYSINSLOT"));
const CLUSTER_INFO_1 = __importDefault(require("./CLUSTER_INFO"));
const CLUSTER_KEYSLOT_1 = __importDefault(require("./CLUSTER_KEYSLOT"));
const CLUSTER_LINKS_1 = __importDefault(require("./CLUSTER_LINKS"));
const CLUSTER_MEET_1 = __importDefault(require("./CLUSTER_MEET"));
const CLUSTER_MYID_1 = __importDefault(require("./CLUSTER_MYID"));
const CLUSTER_MYSHARDID_1 = __importDefault(require("./CLUSTER_MYSHARDID"));
const CLUSTER_NODES_1 = __importDefault(require("./CLUSTER_NODES"));
const CLUSTER_REPLICAS_1 = __importDefault(require("./CLUSTER_REPLICAS"));
const CLUSTER_REPLICATE_1 = __importDefault(require("./CLUSTER_REPLICATE"));
const CLUSTER_RESET_1 = __importDefault(require("./CLUSTER_RESET"));
const CLUSTER_SAVECONFIG_1 = __importDefault(require("./CLUSTER_SAVECONFIG"));
const CLUSTER_SET_CONFIG_EPOCH_1 = __importDefault(require("./CLUSTER_SET-CONFIG-EPOCH"));
const CLUSTER_SETSLOT_1 = __importDefault(require("./CLUSTER_SETSLOT"));
const CLUSTER_SLOTS_1 = __importDefault(require("./CLUSTER_SLOTS"));
const COMMAND_COUNT_1 = __importDefault(require("./COMMAND_COUNT"));
const COMMAND_GETKEYS_1 = __importDefault(require("./COMMAND_GETKEYS"));
const COMMAND_GETKEYSANDFLAGS_1 = __importDefault(require("./COMMAND_GETKEYSANDFLAGS"));
const COMMAND_INFO_1 = __importDefault(require("./COMMAND_INFO"));
const COMMAND_LIST_1 = __importDefault(require("./COMMAND_LIST"));
const COMMAND_1 = __importDefault(require("./COMMAND"));
const CONFIG_GET_1 = __importDefault(require("./CONFIG_GET"));
const CONFIG_RESETSTAT_1 = __importDefault(require("./CONFIG_RESETSTAT"));
const CONFIG_REWRITE_1 = __importDefault(require("./CONFIG_REWRITE"));
const CONFIG_SET_1 = __importDefault(require("./CONFIG_SET"));
const COPY_1 = __importDefault(require("./COPY"));
const DBSIZE_1 = __importDefault(require("./DBSIZE"));
const DECR_1 = __importDefault(require("./DECR"));
const DECRBY_1 = __importDefault(require("./DECRBY"));
const DEL_1 = __importDefault(require("./DEL"));
const DUMP_1 = __importDefault(require("./DUMP"));
const ECHO_1 = __importDefault(require("./ECHO"));
const EVAL_RO_1 = __importDefault(require("./EVAL_RO"));
const EVAL_1 = __importDefault(require("./EVAL"));
const EVALSHA_RO_1 = __importDefault(require("./EVALSHA_RO"));
const EVALSHA_1 = __importDefault(require("./EVALSHA"));
const GEOADD_1 = __importDefault(require("./GEOADD"));
const GEODIST_1 = __importDefault(require("./GEODIST"));
const GEOHASH_1 = __importDefault(require("./GEOHASH"));
const GEOPOS_1 = __importDefault(require("./GEOPOS"));
const GEORADIUS_RO_WITH_1 = __importDefault(require("./GEORADIUS_RO_WITH"));
const GEORADIUS_RO_1 = __importDefault(require("./GEORADIUS_RO"));
const GEORADIUS_STORE_1 = __importDefault(require("./GEORADIUS_STORE"));
const GEORADIUS_WITH_1 = __importDefault(require("./GEORADIUS_WITH"));
const GEORADIUS_1 = __importDefault(require("./GEORADIUS"));
const GEORADIUSBYMEMBER_RO_WITH_1 = __importDefault(require("./GEORADIUSBYMEMBER_RO_WITH"));
const GEORADIUSBYMEMBER_RO_1 = __importDefault(require("./GEORADIUSBYMEMBER_RO"));
const GEORADIUSBYMEMBER_STORE_1 = __importDefault(require("./GEORADIUSBYMEMBER_STORE"));
const GEORADIUSBYMEMBER_WITH_1 = __importDefault(require("./GEORADIUSBYMEMBER_WITH"));
const GEORADIUSBYMEMBER_1 = __importDefault(require("./GEORADIUSBYMEMBER"));
const GEOSEARCH_WITH_1 = __importDefault(require("./GEOSEARCH_WITH"));
const GEOSEARCH_1 = __importDefault(require("./GEOSEARCH"));
const GEOSEARCHSTORE_1 = __importDefault(require("./GEOSEARCHSTORE"));
const GET_1 = __importDefault(require("./GET"));
const GETBIT_1 = __importDefault(require("./GETBIT"));
const GETDEL_1 = __importDefault(require("./GETDEL"));
const GETEX_1 = __importDefault(require("./GETEX"));
const GETRANGE_1 = __importDefault(require("./GETRANGE"));
const GETSET_1 = __importDefault(require("./GETSET"));
const EXISTS_1 = __importDefault(require("./EXISTS"));
const EXPIRE_1 = __importDefault(require("./EXPIRE"));
const EXPIREAT_1 = __importDefault(require("./EXPIREAT"));
const EXPIRETIME_1 = __importDefault(require("./EXPIRETIME"));
const FLUSHALL_1 = __importDefault(require("./FLUSHALL"));
const FLUSHDB_1 = __importDefault(require("./FLUSHDB"));
const FCALL_1 = __importDefault(require("./FCALL"));
const FCALL_RO_1 = __importDefault(require("./FCALL_RO"));
const FUNCTION_DELETE_1 = __importDefault(require("./FUNCTION_DELETE"));
const FUNCTION_DUMP_1 = __importDefault(require("./FUNCTION_DUMP"));
const FUNCTION_FLUSH_1 = __importDefault(require("./FUNCTION_FLUSH"));
const FUNCTION_KILL_1 = __importDefault(require("./FUNCTION_KILL"));
const FUNCTION_LIST_WITHCODE_1 = __importDefault(require("./FUNCTION_LIST_WITHCODE"));
const FUNCTION_LIST_1 = __importDefault(require("./FUNCTION_LIST"));
const FUNCTION_LOAD_1 = __importDefault(require("./FUNCTION_LOAD"));
const FUNCTION_RESTORE_1 = __importDefault(require("./FUNCTION_RESTORE"));
const FUNCTION_STATS_1 = __importDefault(require("./FUNCTION_STATS"));
const HDEL_1 = __importDefault(require("./HDEL"));
const HELLO_1 = __importDefault(require("./HELLO"));
const HEXISTS_1 = __importDefault(require("./HEXISTS"));
const HEXPIRE_1 = __importDefault(require("./HEXPIRE"));
const HEXPIREAT_1 = __importDefault(require("./HEXPIREAT"));
const HEXPIRETIME_1 = __importDefault(require("./HEXPIRETIME"));
const HGET_1 = __importDefault(require("./HGET"));
const HGETALL_1 = __importDefault(require("./HGETALL"));
const HGETDEL_1 = __importDefault(require("./HGETDEL"));
const HGETEX_1 = __importDefault(require("./HGETEX"));
const HINCRBY_1 = __importDefault(require("./HINCRBY"));
const HINCRBYFLOAT_1 = __importDefault(require("./HINCRBYFLOAT"));
const HKEYS_1 = __importDefault(require("./HKEYS"));
const HLEN_1 = __importDefault(require("./HLEN"));
const HMGET_1 = __importDefault(require("./HMGET"));
const HPERSIST_1 = __importDefault(require("./HPERSIST"));
const HPEXPIRE_1 = __importDefault(require("./HPEXPIRE"));
const HPEXPIREAT_1 = __importDefault(require("./HPEXPIREAT"));
const HPEXPIRETIME_1 = __importDefault(require("./HPEXPIRETIME"));
const HPTTL_1 = __importDefault(require("./HPTTL"));
const HRANDFIELD_COUNT_WITHVALUES_1 = __importDefault(require("./HRANDFIELD_COUNT_WITHVALUES"));
const HRANDFIELD_COUNT_1 = __importDefault(require("./HRANDFIELD_COUNT"));
const HRANDFIELD_1 = __importDefault(require("./HRANDFIELD"));
const HSCAN_1 = __importDefault(require("./HSCAN"));
const HSCAN_NOVALUES_1 = __importDefault(require("./HSCAN_NOVALUES"));
const HSET_1 = __importDefault(require("./HSET"));
const HSETEX_1 = __importDefault(require("./HSETEX"));
const HSETNX_1 = __importDefault(require("./HSETNX"));
const HSTRLEN_1 = __importDefault(require("./HSTRLEN"));
const HTTL_1 = __importDefault(require("./HTTL"));
const HVALS_1 = __importDefault(require("./HVALS"));
const INCR_1 = __importDefault(require("./INCR"));
const INCRBY_1 = __importDefault(require("./INCRBY"));
const INCRBYFLOAT_1 = __importDefault(require("./INCRBYFLOAT"));
const INFO_1 = __importDefault(require("./INFO"));
const KEYS_1 = __importDefault(require("./KEYS"));
const LASTSAVE_1 = __importDefault(require("./LASTSAVE"));
const LATENCY_DOCTOR_1 = __importDefault(require("./LATENCY_DOCTOR"));
const LATENCY_GRAPH_1 = __importDefault(require("./LATENCY_GRAPH"));
const LATENCY_HISTORY_1 = __importDefault(require("./LATENCY_HISTORY"));
const LATENCY_LATEST_1 = __importDefault(require("./LATENCY_LATEST"));
const LCS_IDX_WITHMATCHLEN_1 = __importDefault(require("./LCS_IDX_WITHMATCHLEN"));
const LCS_IDX_1 = __importDefault(require("./LCS_IDX"));
const LCS_LEN_1 = __importDefault(require("./LCS_LEN"));
const LCS_1 = __importDefault(require("./LCS"));
const LINDEX_1 = __importDefault(require("./LINDEX"));
const LINSERT_1 = __importDefault(require("./LINSERT"));
const LLEN_1 = __importDefault(require("./LLEN"));
const LMOVE_1 = __importDefault(require("./LMOVE"));
const LMPOP_1 = __importDefault(require("./LMPOP"));
const LOLWUT_1 = __importDefault(require("./LOLWUT"));
const LPOP_COUNT_1 = __importDefault(require("./LPOP_COUNT"));
const LPOP_1 = __importDefault(require("./LPOP"));
const LPOS_COUNT_1 = __importDefault(require("./LPOS_COUNT"));
const LPOS_1 = __importDefault(require("./LPOS"));
const LPUSH_1 = __importDefault(require("./LPUSH"));
const LPUSHX_1 = __importDefault(require("./LPUSHX"));
const LRANGE_1 = __importDefault(require("./LRANGE"));
const LREM_1 = __importDefault(require("./LREM"));
const LSET_1 = __importDefault(require("./LSET"));
const LTRIM_1 = __importDefault(require("./LTRIM"));
const MEMORY_DOCTOR_1 = __importDefault(require("./MEMORY_DOCTOR"));
const MEMORY_MALLOC_STATS_1 = __importDefault(require("./MEMORY_MALLOC-STATS"));
const MEMORY_PURGE_1 = __importDefault(require("./MEMORY_PURGE"));
const MEMORY_STATS_1 = __importDefault(require("./MEMORY_STATS"));
const MEMORY_USAGE_1 = __importDefault(require("./MEMORY_USAGE"));
const MGET_1 = __importDefault(require("./MGET"));
const MIGRATE_1 = __importDefault(require("./MIGRATE"));
const MODULE_LIST_1 = __importDefault(require("./MODULE_LIST"));
const MODULE_LOAD_1 = __importDefault(require("./MODULE_LOAD"));
const MODULE_UNLOAD_1 = __importDefault(require("./MODULE_UNLOAD"));
const MOVE_1 = __importDefault(require("./MOVE"));
const MSET_1 = __importDefault(require("./MSET"));
const MSETNX_1 = __importDefault(require("./MSETNX"));
const OBJECT_ENCODING_1 = __importDefault(require("./OBJECT_ENCODING"));
const OBJECT_FREQ_1 = __importDefault(require("./OBJECT_FREQ"));
const OBJECT_IDLETIME_1 = __importDefault(require("./OBJECT_IDLETIME"));
const OBJECT_REFCOUNT_1 = __importDefault(require("./OBJECT_REFCOUNT"));
const PERSIST_1 = __importDefault(require("./PERSIST"));
const PEXPIRE_1 = __importDefault(require("./PEXPIRE"));
const PEXPIREAT_1 = __importDefault(require("./PEXPIREAT"));
const PEXPIRETIME_1 = __importDefault(require("./PEXPIRETIME"));
const PFADD_1 = __importDefault(require("./PFADD"));
const PFCOUNT_1 = __importDefault(require("./PFCOUNT"));
const PFMERGE_1 = __importDefault(require("./PFMERGE"));
const PING_1 = __importDefault(require("./PING"));
const PSETEX_1 = __importDefault(require("./PSETEX"));
const PTTL_1 = __importDefault(require("./PTTL"));
const PUBLISH_1 = __importDefault(require("./PUBLISH"));
const PUBSUB_CHANNELS_1 = __importDefault(require("./PUBSUB_CHANNELS"));
const PUBSUB_NUMPAT_1 = __importDefault(require("./PUBSUB_NUMPAT"));
const PUBSUB_NUMSUB_1 = __importDefault(require("./PUBSUB_NUMSUB"));
const PUBSUB_SHARDNUMSUB_1 = __importDefault(require("./PUBSUB_SHARDNUMSUB"));
const PUBSUB_SHARDCHANNELS_1 = __importDefault(require("./PUBSUB_SHARDCHANNELS"));
const RANDOMKEY_1 = __importDefault(require("./RANDOMKEY"));
const READONLY_1 = __importDefault(require("./READONLY"));
const RENAME_1 = __importDefault(require("./RENAME"));
const RENAMENX_1 = __importDefault(require("./RENAMENX"));
const REPLICAOF_1 = __importDefault(require("./REPLICAOF"));
const RESTORE_ASKING_1 = __importDefault(require("./RESTORE-ASKING"));
const RESTORE_1 = __importDefault(require("./RESTORE"));
const ROLE_1 = __importDefault(require("./ROLE"));
const RPOP_COUNT_1 = __importDefault(require("./RPOP_COUNT"));
const RPOP_1 = __importDefault(require("./RPOP"));
const RPOPLPUSH_1 = __importDefault(require("./RPOPLPUSH"));
const RPUSH_1 = __importDefault(require("./RPUSH"));
const RPUSHX_1 = __importDefault(require("./RPUSHX"));
const SADD_1 = __importDefault(require("./SADD"));
const SCAN_1 = __importDefault(require("./SCAN"));
const SCARD_1 = __importDefault(require("./SCARD"));
const SCRIPT_DEBUG_1 = __importDefault(require("./SCRIPT_DEBUG"));
const SCRIPT_EXISTS_1 = __importDefault(require("./SCRIPT_EXISTS"));
const SCRIPT_FLUSH_1 = __importDefault(require("./SCRIPT_FLUSH"));
const SCRIPT_KILL_1 = __importDefault(require("./SCRIPT_KILL"));
const SCRIPT_LOAD_1 = __importDefault(require("./SCRIPT_LOAD"));
const SDIFF_1 = __importDefault(require("./SDIFF"));
const SDIFFSTORE_1 = __importDefault(require("./SDIFFSTORE"));
const SET_1 = __importDefault(require("./SET"));
const SETBIT_1 = __importDefault(require("./SETBIT"));
const SETEX_1 = __importDefault(require("./SETEX"));
const SETNX_1 = __importDefault(require("./SETNX"));
const SETRANGE_1 = __importDefault(require("./SETRANGE"));
const SINTER_1 = __importDefault(require("./SINTER"));
const SINTERCARD_1 = __importDefault(require("./SINTERCARD"));
const SINTERSTORE_1 = __importDefault(require("./SINTERSTORE"));
const SISMEMBER_1 = __importDefault(require("./SISMEMBER"));
const SMEMBERS_1 = __importDefault(require("./SMEMBERS"));
const SMISMEMBER_1 = __importDefault(require("./SMISMEMBER"));
const SMOVE_1 = __importDefault(require("./SMOVE"));
const SORT_RO_1 = __importDefault(require("./SORT_RO"));
const SORT_STORE_1 = __importDefault(require("./SORT_STORE"));
const SORT_1 = __importDefault(require("./SORT"));
const SPOP_COUNT_1 = __importDefault(require("./SPOP_COUNT"));
const SPOP_1 = __importDefault(require("./SPOP"));
const SPUBLISH_1 = __importDefault(require("./SPUBLISH"));
const SRANDMEMBER_COUNT_1 = __importDefault(require("./SRANDMEMBER_COUNT"));
const SRANDMEMBER_1 = __importDefault(require("./SRANDMEMBER"));
const SREM_1 = __importDefault(require("./SREM"));
const SSCAN_1 = __importDefault(require("./SSCAN"));
const STRLEN_1 = __importDefault(require("./STRLEN"));
const SUNION_1 = __importDefault(require("./SUNION"));
const SUNIONSTORE_1 = __importDefault(require("./SUNIONSTORE"));
const SWAPDB_1 = __importDefault(require("./SWAPDB"));
const TIME_1 = __importDefault(require("./TIME"));
const TOUCH_1 = __importDefault(require("./TOUCH"));
const TTL_1 = __importDefault(require("./TTL"));
const TYPE_1 = __importDefault(require("./TYPE"));
const UNLINK_1 = __importDefault(require("./UNLINK"));
const WAIT_1 = __importDefault(require("./WAIT"));
const XACK_1 = __importDefault(require("./XACK"));
const XACKDEL_1 = __importDefault(require("./XACKDEL"));
const XADD_NOMKSTREAM_1 = __importDefault(require("./XADD_NOMKSTREAM"));
const XADD_1 = __importDefault(require("./XADD"));
const XAUTOCLAIM_JUSTID_1 = __importDefault(require("./XAUTOCLAIM_JUSTID"));
const XAUTOCLAIM_1 = __importDefault(require("./XAUTOCLAIM"));
const XCLAIM_JUSTID_1 = __importDefault(require("./XCLAIM_JUSTID"));
const XCLAIM_1 = __importDefault(require("./XCLAIM"));
const XDEL_1 = __importDefault(require("./XDEL"));
const XDELEX_1 = __importDefault(require("./XDELEX"));
const XGROUP_CREATE_1 = __importDefault(require("./XGROUP_CREATE"));
const XGROUP_CREATECONSUMER_1 = __importDefault(require("./XGROUP_CREATECONSUMER"));
const XGROUP_DELCONSUMER_1 = __importDefault(require("./XGROUP_DELCONSUMER"));
const XGROUP_DESTROY_1 = __importDefault(require("./XGROUP_DESTROY"));
const XGROUP_SETID_1 = __importDefault(require("./XGROUP_SETID"));
const XINFO_CONSUMERS_1 = __importDefault(require("./XINFO_CONSUMERS"));
const XINFO_GROUPS_1 = __importDefault(require("./XINFO_GROUPS"));
const XINFO_STREAM_1 = __importDefault(require("./XINFO_STREAM"));
const XLEN_1 = __importDefault(require("./XLEN"));
const XPENDING_RANGE_1 = __importDefault(require("./XPENDING_RANGE"));
const XPENDING_1 = __importDefault(require("./XPENDING"));
const XRANGE_1 = __importDefault(require("./XRANGE"));
const XREAD_1 = __importDefault(require("./XREAD"));
const XREADGROUP_1 = __importDefault(require("./XREADGROUP"));
const XREVRANGE_1 = __importDefault(require("./XREVRANGE"));
const XSETID_1 = __importDefault(require("./XSETID"));
const XTRIM_1 = __importDefault(require("./XTRIM"));
const ZADD_INCR_1 = __importDefault(require("./ZADD_INCR"));
const ZADD_1 = __importDefault(require("./ZADD"));
const ZCARD_1 = __importDefault(require("./ZCARD"));
const ZCOUNT_1 = __importDefault(require("./ZCOUNT"));
const ZDIFF_WITHSCORES_1 = __importDefault(require("./ZDIFF_WITHSCORES"));
const ZDIFF_1 = __importDefault(require("./ZDIFF"));
const ZDIFFSTORE_1 = __importDefault(require("./ZDIFFSTORE"));
const ZINCRBY_1 = __importDefault(require("./ZINCRBY"));
const ZINTER_WITHSCORES_1 = __importDefault(require("./ZINTER_WITHSCORES"));
const ZINTER_1 = __importDefault(require("./ZINTER"));
const ZINTERCARD_1 = __importDefault(require("./ZINTERCARD"));
const ZINTERSTORE_1 = __importDefault(require("./ZINTERSTORE"));
const ZLEXCOUNT_1 = __importDefault(require("./ZLEXCOUNT"));
const ZMPOP_1 = __importDefault(require("./ZMPOP"));
const ZMSCORE_1 = __importDefault(require("./ZMSCORE"));
const ZPOPMAX_COUNT_1 = __importDefault(require("./ZPOPMAX_COUNT"));
const ZPOPMAX_1 = __importDefault(require("./ZPOPMAX"));
const ZPOPMIN_COUNT_1 = __importDefault(require("./ZPOPMIN_COUNT"));
const ZPOPMIN_1 = __importDefault(require("./ZPOPMIN"));
const ZRANDMEMBER_COUNT_WITHSCORES_1 = __importDefault(require("./ZRANDMEMBER_COUNT_WITHSCORES"));
const ZRANDMEMBER_COUNT_1 = __importDefault(require("./ZRANDMEMBER_COUNT"));
const ZRANDMEMBER_1 = __importDefault(require("./ZRANDMEMBER"));
const ZRANGE_WITHSCORES_1 = __importDefault(require("./ZRANGE_WITHSCORES"));
const ZRANGE_1 = __importDefault(require("./ZRANGE"));
const ZRANGEBYLEX_1 = __importDefault(require("./ZRANGEBYLEX"));
const ZRANGEBYSCORE_WITHSCORES_1 = __importDefault(require("./ZRANGEBYSCORE_WITHSCORES"));
const ZRANGEBYSCORE_1 = __importDefault(require("./ZRANGEBYSCORE"));
const ZRANGESTORE_1 = __importDefault(require("./ZRANGESTORE"));
const ZREMRANGEBYSCORE_1 = __importDefault(require("./ZREMRANGEBYSCORE"));
const ZRANK_WITHSCORE_1 = __importDefault(require("./ZRANK_WITHSCORE"));
const ZRANK_1 = __importDefault(require("./ZRANK"));
const ZREM_1 = __importDefault(require("./ZREM"));
const ZREMRANGEBYLEX_1 = __importDefault(require("./ZREMRANGEBYLEX"));
const ZREMRANGEBYRANK_1 = __importDefault(require("./ZREMRANGEBYRANK"));
const ZREVRANK_1 = __importDefault(require("./ZREVRANK"));
const ZSCAN_1 = __importDefault(require("./ZSCAN"));
const ZSCORE_1 = __importDefault(require("./ZSCORE"));
const ZUNION_WITHSCORES_1 = __importDefault(require("./ZUNION_WITHSCORES"));
const ZUNION_1 = __importDefault(require("./ZUNION"));
const ZUNIONSTORE_1 = __importDefault(require("./ZUNIONSTORE"));
const VADD_1 = __importDefault(require("./VADD"));
const VCARD_1 = __importDefault(require("./VCARD"));
const VDIM_1 = __importDefault(require("./VDIM"));
const VEMB_1 = __importDefault(require("./VEMB"));
const VEMB_RAW_1 = __importDefault(require("./VEMB_RAW"));
const VGETATTR_1 = __importDefault(require("./VGETATTR"));
const VINFO_1 = __importDefault(require("./VINFO"));
const VLINKS_1 = __importDefault(require("./VLINKS"));
const VLINKS_WITHSCORES_1 = __importDefault(require("./VLINKS_WITHSCORES"));
const VRANDMEMBER_1 = __importDefault(require("./VRANDMEMBER"));
const VREM_1 = __importDefault(require("./VREM"));
const VSETATTR_1 = __importDefault(require("./VSETATTR"));
const VSIM_1 = __importDefault(require("./VSIM"));
const VSIM_WITHSCORES_1 = __importDefault(require("./VSIM_WITHSCORES"));
exports.default = {
    ACL_CAT: ACL_CAT_1.default,
    aclCat: ACL_CAT_1.default,
    ACL_DELUSER: ACL_DELUSER_1.default,
    aclDelUser: ACL_DELUSER_1.default,
    ACL_DRYRUN: ACL_DRYRUN_1.default,
    aclDryRun: ACL_DRYRUN_1.default,
    ACL_GENPASS: ACL_GENPASS_1.default,
    aclGenPass: ACL_GENPASS_1.default,
    ACL_GETUSER: ACL_GETUSER_1.default,
    aclGetUser: ACL_GETUSER_1.default,
    ACL_LIST: ACL_LIST_1.default,
    aclList: ACL_LIST_1.default,
    ACL_LOAD: ACL_LOAD_1.default,
    aclLoad: ACL_LOAD_1.default,
    ACL_LOG_RESET: ACL_LOG_RESET_1.default,
    aclLogReset: ACL_LOG_RESET_1.default,
    ACL_LOG: ACL_LOG_1.default,
    aclLog: ACL_LOG_1.default,
    ACL_SAVE: ACL_SAVE_1.default,
    aclSave: ACL_SAVE_1.default,
    ACL_SETUSER: ACL_SETUSER_1.default,
    aclSetUser: ACL_SETUSER_1.default,
    ACL_USERS: ACL_USERS_1.default,
    aclUsers: ACL_USERS_1.default,
    ACL_WHOAMI: ACL_WHOAMI_1.default,
    aclWhoAmI: ACL_WHOAMI_1.default,
    APPEND: APPEND_1.default,
    append: APPEND_1.default,
    ASKING: ASKING_1.default,
    asking: ASKING_1.default,
    AUTH: AUTH_1.default,
    auth: AUTH_1.default,
    BGREWRITEAOF: BGREWRITEAOF_1.default,
    bgRewriteAof: BGREWRITEAOF_1.default,
    BGSAVE: BGSAVE_1.default,
    bgSave: BGSAVE_1.default,
    BITCOUNT: BITCOUNT_1.default,
    bitCount: BITCOUNT_1.default,
    BITFIELD_RO: BITFIELD_RO_1.default,
    bitFieldRo: BITFIELD_RO_1.default,
    BITFIELD: BITFIELD_1.default,
    bitField: BITFIELD_1.default,
    BITOP: BITOP_1.default,
    bitOp: BITOP_1.default,
    BITPOS: BITPOS_1.default,
    bitPos: BITPOS_1.default,
    BLMOVE: BLMOVE_1.default,
    blMove: BLMOVE_1.default,
    BLMPOP: BLMPOP_1.default,
    blmPop: BLMPOP_1.default,
    BLPOP: BLPOP_1.default,
    blPop: BLPOP_1.default,
    BRPOP: BRPOP_1.default,
    brPop: BRPOP_1.default,
    BRPOPLPUSH: BRPOPLPUSH_1.default,
    brPopLPush: BRPOPLPUSH_1.default,
    BZMPOP: BZMPOP_1.default,
    bzmPop: BZMPOP_1.default,
    BZPOPMAX: BZPOPMAX_1.default,
    bzPopMax: BZPOPMAX_1.default,
    BZPOPMIN: BZPOPMIN_1.default,
    bzPopMin: BZPOPMIN_1.default,
    CLIENT_CACHING: CLIENT_CACHING_1.default,
    clientCaching: CLIENT_CACHING_1.default,
    CLIENT_GETNAME: CLIENT_GETNAME_1.default,
    clientGetName: CLIENT_GETNAME_1.default,
    CLIENT_GETREDIR: CLIENT_GETREDIR_1.default,
    clientGetRedir: CLIENT_GETREDIR_1.default,
    CLIENT_ID: CLIENT_ID_1.default,
    clientId: CLIENT_ID_1.default,
    CLIENT_INFO: CLIENT_INFO_1.default,
    clientInfo: CLIENT_INFO_1.default,
    CLIENT_KILL: CLIENT_KILL_1.default,
    clientKill: CLIENT_KILL_1.default,
    CLIENT_LIST: CLIENT_LIST_1.default,
    clientList: CLIENT_LIST_1.default,
    'CLIENT_NO-EVICT': CLIENT_NO_EVICT_1.default,
    clientNoEvict: CLIENT_NO_EVICT_1.default,
    'CLIENT_NO-TOUCH': CLIENT_NO_TOUCH_1.default,
    clientNoTouch: CLIENT_NO_TOUCH_1.default,
    CLIENT_PAUSE: CLIENT_PAUSE_1.default,
    clientPause: CLIENT_PAUSE_1.default,
    CLIENT_SETNAME: CLIENT_SETNAME_1.default,
    clientSetName: CLIENT_SETNAME_1.default,
    CLIENT_TRACKING: CLIENT_TRACKING_1.default,
    clientTracking: CLIENT_TRACKING_1.default,
    CLIENT_TRACKINGINFO: CLIENT_TRACKINGINFO_1.default,
    clientTrackingInfo: CLIENT_TRACKINGINFO_1.default,
    CLIENT_UNPAUSE: CLIENT_UNPAUSE_1.default,
    clientUnpause: CLIENT_UNPAUSE_1.default,
    CLUSTER_ADDSLOTS: CLUSTER_ADDSLOTS_1.default,
    clusterAddSlots: CLUSTER_ADDSLOTS_1.default,
    CLUSTER_ADDSLOTSRANGE: CLUSTER_ADDSLOTSRANGE_1.default,
    clusterAddSlotsRange: CLUSTER_ADDSLOTSRANGE_1.default,
    CLUSTER_BUMPEPOCH: CLUSTER_BUMPEPOCH_1.default,
    clusterBumpEpoch: CLUSTER_BUMPEPOCH_1.default,
    'CLUSTER_COUNT-FAILURE-REPORTS': CLUSTER_COUNT_FAILURE_REPORTS_1.default,
    clusterCountFailureReports: CLUSTER_COUNT_FAILURE_REPORTS_1.default,
    CLUSTER_COUNTKEYSINSLOT: CLUSTER_COUNTKEYSINSLOT_1.default,
    clusterCountKeysInSlot: CLUSTER_COUNTKEYSINSLOT_1.default,
    CLUSTER_DELSLOTS: CLUSTER_DELSLOTS_1.default,
    clusterDelSlots: CLUSTER_DELSLOTS_1.default,
    CLUSTER_DELSLOTSRANGE: CLUSTER_DELSLOTSRANGE_1.default,
    clusterDelSlotsRange: CLUSTER_DELSLOTSRANGE_1.default,
    CLUSTER_FAILOVER: CLUSTER_FAILOVER_1.default,
    clusterFailover: CLUSTER_FAILOVER_1.default,
    CLUSTER_FLUSHSLOTS: CLUSTER_FLUSHSLOTS_1.default,
    clusterFlushSlots: CLUSTER_FLUSHSLOTS_1.default,
    CLUSTER_FORGET: CLUSTER_FORGET_1.default,
    clusterForget: CLUSTER_FORGET_1.default,
    CLUSTER_GETKEYSINSLOT: CLUSTER_GETKEYSINSLOT_1.default,
    clusterGetKeysInSlot: CLUSTER_GETKEYSINSLOT_1.default,
    CLUSTER_INFO: CLUSTER_INFO_1.default,
    clusterInfo: CLUSTER_INFO_1.default,
    CLUSTER_KEYSLOT: CLUSTER_KEYSLOT_1.default,
    clusterKeySlot: CLUSTER_KEYSLOT_1.default,
    CLUSTER_LINKS: CLUSTER_LINKS_1.default,
    clusterLinks: CLUSTER_LINKS_1.default,
    CLUSTER_MEET: CLUSTER_MEET_1.default,
    clusterMeet: CLUSTER_MEET_1.default,
    CLUSTER_MYID: CLUSTER_MYID_1.default,
    clusterMyId: CLUSTER_MYID_1.default,
    CLUSTER_MYSHARDID: CLUSTER_MYSHARDID_1.default,
    clusterMyShardId: CLUSTER_MYSHARDID_1.default,
    CLUSTER_NODES: CLUSTER_NODES_1.default,
    clusterNodes: CLUSTER_NODES_1.default,
    CLUSTER_REPLICAS: CLUSTER_REPLICAS_1.default,
    clusterReplicas: CLUSTER_REPLICAS_1.default,
    CLUSTER_REPLICATE: CLUSTER_REPLICATE_1.default,
    clusterReplicate: CLUSTER_REPLICATE_1.default,
    CLUSTER_RESET: CLUSTER_RESET_1.default,
    clusterReset: CLUSTER_RESET_1.default,
    CLUSTER_SAVECONFIG: CLUSTER_SAVECONFIG_1.default,
    clusterSaveConfig: CLUSTER_SAVECONFIG_1.default,
    'CLUSTER_SET-CONFIG-EPOCH': CLUSTER_SET_CONFIG_EPOCH_1.default,
    clusterSetConfigEpoch: CLUSTER_SET_CONFIG_EPOCH_1.default,
    CLUSTER_SETSLOT: CLUSTER_SETSLOT_1.default,
    clusterSetSlot: CLUSTER_SETSLOT_1.default,
    CLUSTER_SLOTS: CLUSTER_SLOTS_1.default,
    clusterSlots: CLUSTER_SLOTS_1.default,
    COMMAND_COUNT: COMMAND_COUNT_1.default,
    commandCount: COMMAND_COUNT_1.default,
    COMMAND_GETKEYS: COMMAND_GETKEYS_1.default,
    commandGetKeys: COMMAND_GETKEYS_1.default,
    COMMAND_GETKEYSANDFLAGS: COMMAND_GETKEYSANDFLAGS_1.default,
    commandGetKeysAndFlags: COMMAND_GETKEYSANDFLAGS_1.default,
    COMMAND_INFO: COMMAND_INFO_1.default,
    commandInfo: COMMAND_INFO_1.default,
    COMMAND_LIST: COMMAND_LIST_1.default,
    commandList: COMMAND_LIST_1.default,
    COMMAND: COMMAND_1.default,
    command: COMMAND_1.default,
    CONFIG_GET: CONFIG_GET_1.default,
    configGet: CONFIG_GET_1.default,
    CONFIG_RESETASTAT: CONFIG_RESETSTAT_1.default,
    configResetStat: CONFIG_RESETSTAT_1.default,
    CONFIG_REWRITE: CONFIG_REWRITE_1.default,
    configRewrite: CONFIG_REWRITE_1.default,
    CONFIG_SET: CONFIG_SET_1.default,
    configSet: CONFIG_SET_1.default,
    COPY: COPY_1.default,
    copy: COPY_1.default,
    DBSIZE: DBSIZE_1.default,
    dbSize: DBSIZE_1.default,
    DECR: DECR_1.default,
    decr: DECR_1.default,
    DECRBY: DECRBY_1.default,
    decrBy: DECRBY_1.default,
    DEL: DEL_1.default,
    del: DEL_1.default,
    DUMP: DUMP_1.default,
    dump: DUMP_1.default,
    ECHO: ECHO_1.default,
    echo: ECHO_1.default,
    EVAL_RO: EVAL_RO_1.default,
    evalRo: EVAL_RO_1.default,
    EVAL: EVAL_1.default,
    eval: EVAL_1.default,
    EVALSHA_RO: EVALSHA_RO_1.default,
    evalShaRo: EVALSHA_RO_1.default,
    EVALSHA: EVALSHA_1.default,
    evalSha: EVALSHA_1.default,
    EXISTS: EXISTS_1.default,
    exists: EXISTS_1.default,
    EXPIRE: EXPIRE_1.default,
    expire: EXPIRE_1.default,
    EXPIREAT: EXPIREAT_1.default,
    expireAt: EXPIREAT_1.default,
    EXPIRETIME: EXPIRETIME_1.default,
    expireTime: EXPIRETIME_1.default,
    FLUSHALL: FLUSHALL_1.default,
    flushAll: FLUSHALL_1.default,
    FLUSHDB: FLUSHDB_1.default,
    flushDb: FLUSHDB_1.default,
    FCALL: FCALL_1.default,
    fCall: FCALL_1.default,
    FCALL_RO: FCALL_RO_1.default,
    fCallRo: FCALL_RO_1.default,
    FUNCTION_DELETE: FUNCTION_DELETE_1.default,
    functionDelete: FUNCTION_DELETE_1.default,
    FUNCTION_DUMP: FUNCTION_DUMP_1.default,
    functionDump: FUNCTION_DUMP_1.default,
    FUNCTION_FLUSH: FUNCTION_FLUSH_1.default,
    functionFlush: FUNCTION_FLUSH_1.default,
    FUNCTION_KILL: FUNCTION_KILL_1.default,
    functionKill: FUNCTION_KILL_1.default,
    FUNCTION_LIST_WITHCODE: FUNCTION_LIST_WITHCODE_1.default,
    functionListWithCode: FUNCTION_LIST_WITHCODE_1.default,
    FUNCTION_LIST: FUNCTION_LIST_1.default,
    functionList: FUNCTION_LIST_1.default,
    FUNCTION_LOAD: FUNCTION_LOAD_1.default,
    functionLoad: FUNCTION_LOAD_1.default,
    FUNCTION_RESTORE: FUNCTION_RESTORE_1.default,
    functionRestore: FUNCTION_RESTORE_1.default,
    FUNCTION_STATS: FUNCTION_STATS_1.default,
    functionStats: FUNCTION_STATS_1.default,
    GEOADD: GEOADD_1.default,
    geoAdd: GEOADD_1.default,
    GEODIST: GEODIST_1.default,
    geoDist: GEODIST_1.default,
    GEOHASH: GEOHASH_1.default,
    geoHash: GEOHASH_1.default,
    GEOPOS: GEOPOS_1.default,
    geoPos: GEOPOS_1.default,
    GEORADIUS_RO_WITH: GEORADIUS_RO_WITH_1.default,
    geoRadiusRoWith: GEORADIUS_RO_WITH_1.default,
    GEORADIUS_RO: GEORADIUS_RO_1.default,
    geoRadiusRo: GEORADIUS_RO_1.default,
    GEORADIUS_STORE: GEORADIUS_STORE_1.default,
    geoRadiusStore: GEORADIUS_STORE_1.default,
    GEORADIUS_WITH: GEORADIUS_WITH_1.default,
    geoRadiusWith: GEORADIUS_WITH_1.default,
    GEORADIUS: GEORADIUS_1.default,
    geoRadius: GEORADIUS_1.default,
    GEORADIUSBYMEMBER_RO_WITH: GEORADIUSBYMEMBER_RO_WITH_1.default,
    geoRadiusByMemberRoWith: GEORADIUSBYMEMBER_RO_WITH_1.default,
    GEORADIUSBYMEMBER_RO: GEORADIUSBYMEMBER_RO_1.default,
    geoRadiusByMemberRo: GEORADIUSBYMEMBER_RO_1.default,
    GEORADIUSBYMEMBER_STORE: GEORADIUSBYMEMBER_STORE_1.default,
    geoRadiusByMemberStore: GEORADIUSBYMEMBER_STORE_1.default,
    GEORADIUSBYMEMBER_WITH: GEORADIUSBYMEMBER_WITH_1.default,
    geoRadiusByMemberWith: GEORADIUSBYMEMBER_WITH_1.default,
    GEORADIUSBYMEMBER: GEORADIUSBYMEMBER_1.default,
    geoRadiusByMember: GEORADIUSBYMEMBER_1.default,
    GEOSEARCH_WITH: GEOSEARCH_WITH_1.default,
    geoSearchWith: GEOSEARCH_WITH_1.default,
    GEOSEARCH: GEOSEARCH_1.default,
    geoSearch: GEOSEARCH_1.default,
    GEOSEARCHSTORE: GEOSEARCHSTORE_1.default,
    geoSearchStore: GEOSEARCHSTORE_1.default,
    GET: GET_1.default,
    get: GET_1.default,
    GETBIT: GETBIT_1.default,
    getBit: GETBIT_1.default,
    GETDEL: GETDEL_1.default,
    getDel: GETDEL_1.default,
    GETEX: GETEX_1.default,
    getEx: GETEX_1.default,
    GETRANGE: GETRANGE_1.default,
    getRange: GETRANGE_1.default,
    GETSET: GETSET_1.default,
    getSet: GETSET_1.default,
    HDEL: HDEL_1.default,
    hDel: HDEL_1.default,
    HELLO: HELLO_1.default,
    hello: HELLO_1.default,
    HEXISTS: HEXISTS_1.default,
    hExists: HEXISTS_1.default,
    HEXPIRE: HEXPIRE_1.default,
    hExpire: HEXPIRE_1.default,
    HEXPIREAT: HEXPIREAT_1.default,
    hExpireAt: HEXPIREAT_1.default,
    HEXPIRETIME: HEXPIRETIME_1.default,
    hExpireTime: HEXPIRETIME_1.default,
    HGET: HGET_1.default,
    hGet: HGET_1.default,
    HGETALL: HGETALL_1.default,
    hGetAll: HGETALL_1.default,
    HGETDEL: HGETDEL_1.default,
    hGetDel: HGETDEL_1.default,
    HGETEX: HGETEX_1.default,
    hGetEx: HGETEX_1.default,
    HINCRBY: HINCRBY_1.default,
    hIncrBy: HINCRBY_1.default,
    HINCRBYFLOAT: HINCRBYFLOAT_1.default,
    hIncrByFloat: HINCRBYFLOAT_1.default,
    HKEYS: HKEYS_1.default,
    hKeys: HKEYS_1.default,
    HLEN: HLEN_1.default,
    hLen: HLEN_1.default,
    HMGET: HMGET_1.default,
    hmGet: HMGET_1.default,
    HPERSIST: HPERSIST_1.default,
    hPersist: HPERSIST_1.default,
    HPEXPIRE: HPEXPIRE_1.default,
    hpExpire: HPEXPIRE_1.default,
    HPEXPIREAT: HPEXPIREAT_1.default,
    hpExpireAt: HPEXPIREAT_1.default,
    HPEXPIRETIME: HPEXPIRETIME_1.default,
    hpExpireTime: HPEXPIRETIME_1.default,
    HPTTL: HPTTL_1.default,
    hpTTL: HPTTL_1.default,
    HRANDFIELD_COUNT_WITHVALUES: HRANDFIELD_COUNT_WITHVALUES_1.default,
    hRandFieldCountWithValues: HRANDFIELD_COUNT_WITHVALUES_1.default,
    HRANDFIELD_COUNT: HRANDFIELD_COUNT_1.default,
    hRandFieldCount: HRANDFIELD_COUNT_1.default,
    HRANDFIELD: HRANDFIELD_1.default,
    hRandField: HRANDFIELD_1.default,
    HSCAN: HSCAN_1.default,
    hScan: HSCAN_1.default,
    HSCAN_NOVALUES: HSCAN_NOVALUES_1.default,
    hScanNoValues: HSCAN_NOVALUES_1.default,
    HSET: HSET_1.default,
    hSet: HSET_1.default,
    HSETEX: HSETEX_1.default,
    hSetEx: HSETEX_1.default,
    HSETNX: HSETNX_1.default,
    hSetNX: HSETNX_1.default,
    HSTRLEN: HSTRLEN_1.default,
    hStrLen: HSTRLEN_1.default,
    HTTL: HTTL_1.default,
    hTTL: HTTL_1.default,
    HVALS: HVALS_1.default,
    hVals: HVALS_1.default,
    INCR: INCR_1.default,
    incr: INCR_1.default,
    INCRBY: INCRBY_1.default,
    incrBy: INCRBY_1.default,
    INCRBYFLOAT: INCRBYFLOAT_1.default,
    incrByFloat: INCRBYFLOAT_1.default,
    INFO: INFO_1.default,
    info: INFO_1.default,
    KEYS: KEYS_1.default,
    keys: KEYS_1.default,
    LASTSAVE: LASTSAVE_1.default,
    lastSave: LASTSAVE_1.default,
    LATENCY_DOCTOR: LATENCY_DOCTOR_1.default,
    latencyDoctor: LATENCY_DOCTOR_1.default,
    LATENCY_GRAPH: LATENCY_GRAPH_1.default,
    latencyGraph: LATENCY_GRAPH_1.default,
    LATENCY_HISTORY: LATENCY_HISTORY_1.default,
    latencyHistory: LATENCY_HISTORY_1.default,
    LATENCY_LATEST: LATENCY_LATEST_1.default,
    latencyLatest: LATENCY_LATEST_1.default,
    LCS_IDX_WITHMATCHLEN: LCS_IDX_WITHMATCHLEN_1.default,
    lcsIdxWithMatchLen: LCS_IDX_WITHMATCHLEN_1.default,
    LCS_IDX: LCS_IDX_1.default,
    lcsIdx: LCS_IDX_1.default,
    LCS_LEN: LCS_LEN_1.default,
    lcsLen: LCS_LEN_1.default,
    LCS: LCS_1.default,
    lcs: LCS_1.default,
    LINDEX: LINDEX_1.default,
    lIndex: LINDEX_1.default,
    LINSERT: LINSERT_1.default,
    lInsert: LINSERT_1.default,
    LLEN: LLEN_1.default,
    lLen: LLEN_1.default,
    LMOVE: LMOVE_1.default,
    lMove: LMOVE_1.default,
    LMPOP: LMPOP_1.default,
    lmPop: LMPOP_1.default,
    LOLWUT: LOLWUT_1.default,
    LPOP_COUNT: LPOP_COUNT_1.default,
    lPopCount: LPOP_COUNT_1.default,
    LPOP: LPOP_1.default,
    lPop: LPOP_1.default,
    LPOS_COUNT: LPOS_COUNT_1.default,
    lPosCount: LPOS_COUNT_1.default,
    LPOS: LPOS_1.default,
    lPos: LPOS_1.default,
    LPUSH: LPUSH_1.default,
    lPush: LPUSH_1.default,
    LPUSHX: LPUSHX_1.default,
    lPushX: LPUSHX_1.default,
    LRANGE: LRANGE_1.default,
    lRange: LRANGE_1.default,
    LREM: LREM_1.default,
    lRem: LREM_1.default,
    LSET: LSET_1.default,
    lSet: LSET_1.default,
    LTRIM: LTRIM_1.default,
    lTrim: LTRIM_1.default,
    MEMORY_DOCTOR: MEMORY_DOCTOR_1.default,
    memoryDoctor: MEMORY_DOCTOR_1.default,
    'MEMORY_MALLOC-STATS': MEMORY_MALLOC_STATS_1.default,
    memoryMallocStats: MEMORY_MALLOC_STATS_1.default,
    MEMORY_PURGE: MEMORY_PURGE_1.default,
    memoryPurge: MEMORY_PURGE_1.default,
    MEMORY_STATS: MEMORY_STATS_1.default,
    memoryStats: MEMORY_STATS_1.default,
    MEMORY_USAGE: MEMORY_USAGE_1.default,
    memoryUsage: MEMORY_USAGE_1.default,
    MGET: MGET_1.default,
    mGet: MGET_1.default,
    MIGRATE: MIGRATE_1.default,
    migrate: MIGRATE_1.default,
    MODULE_LIST: MODULE_LIST_1.default,
    moduleList: MODULE_LIST_1.default,
    MODULE_LOAD: MODULE_LOAD_1.default,
    moduleLoad: MODULE_LOAD_1.default,
    MODULE_UNLOAD: MODULE_UNLOAD_1.default,
    moduleUnload: MODULE_UNLOAD_1.default,
    MOVE: MOVE_1.default,
    move: MOVE_1.default,
    MSET: MSET_1.default,
    mSet: MSET_1.default,
    MSETNX: MSETNX_1.default,
    mSetNX: MSETNX_1.default,
    OBJECT_ENCODING: OBJECT_ENCODING_1.default,
    objectEncoding: OBJECT_ENCODING_1.default,
    OBJECT_FREQ: OBJECT_FREQ_1.default,
    objectFreq: OBJECT_FREQ_1.default,
    OBJECT_IDLETIME: OBJECT_IDLETIME_1.default,
    objectIdleTime: OBJECT_IDLETIME_1.default,
    OBJECT_REFCOUNT: OBJECT_REFCOUNT_1.default,
    objectRefCount: OBJECT_REFCOUNT_1.default,
    PERSIST: PERSIST_1.default,
    persist: PERSIST_1.default,
    PEXPIRE: PEXPIRE_1.default,
    pExpire: PEXPIRE_1.default,
    PEXPIREAT: PEXPIREAT_1.default,
    pExpireAt: PEXPIREAT_1.default,
    PEXPIRETIME: PEXPIRETIME_1.default,
    pExpireTime: PEXPIRETIME_1.default,
    PFADD: PFADD_1.default,
    pfAdd: PFADD_1.default,
    PFCOUNT: PFCOUNT_1.default,
    pfCount: PFCOUNT_1.default,
    PFMERGE: PFMERGE_1.default,
    pfMerge: PFMERGE_1.default,
    PING: PING_1.default,
    /**
     * ping jsdoc
     */
    ping: PING_1.default,
    PSETEX: PSETEX_1.default,
    pSetEx: PSETEX_1.default,
    PTTL: PTTL_1.default,
    pTTL: PTTL_1.default,
    PUBLISH: PUBLISH_1.default,
    publish: PUBLISH_1.default,
    PUBSUB_CHANNELS: PUBSUB_CHANNELS_1.default,
    pubSubChannels: PUBSUB_CHANNELS_1.default,
    PUBSUB_NUMPAT: PUBSUB_NUMPAT_1.default,
    pubSubNumPat: PUBSUB_NUMPAT_1.default,
    PUBSUB_NUMSUB: PUBSUB_NUMSUB_1.default,
    pubSubNumSub: PUBSUB_NUMSUB_1.default,
    PUBSUB_SHARDNUMSUB: PUBSUB_SHARDNUMSUB_1.default,
    pubSubShardNumSub: PUBSUB_SHARDNUMSUB_1.default,
    PUBSUB_SHARDCHANNELS: PUBSUB_SHARDCHANNELS_1.default,
    pubSubShardChannels: PUBSUB_SHARDCHANNELS_1.default,
    RANDOMKEY: RANDOMKEY_1.default,
    randomKey: RANDOMKEY_1.default,
    READONLY: READONLY_1.default,
    readonly: READONLY_1.default,
    RENAME: RENAME_1.default,
    rename: RENAME_1.default,
    RENAMENX: RENAMENX_1.default,
    renameNX: RENAMENX_1.default,
    REPLICAOF: REPLICAOF_1.default,
    replicaOf: REPLICAOF_1.default,
    'RESTORE-ASKING': RESTORE_ASKING_1.default,
    restoreAsking: RESTORE_ASKING_1.default,
    RESTORE: RESTORE_1.default,
    restore: RESTORE_1.default,
    RPOP_COUNT: RPOP_COUNT_1.default,
    rPopCount: RPOP_COUNT_1.default,
    ROLE: ROLE_1.default,
    role: ROLE_1.default,
    RPOP: RPOP_1.default,
    rPop: RPOP_1.default,
    RPOPLPUSH: RPOPLPUSH_1.default,
    rPopLPush: RPOPLPUSH_1.default,
    RPUSH: RPUSH_1.default,
    rPush: RPUSH_1.default,
    RPUSHX: RPUSHX_1.default,
    rPushX: RPUSHX_1.default,
    SADD: SADD_1.default,
    sAdd: SADD_1.default,
    SCAN: SCAN_1.default,
    scan: SCAN_1.default,
    SCARD: SCARD_1.default,
    sCard: SCARD_1.default,
    SCRIPT_DEBUG: SCRIPT_DEBUG_1.default,
    scriptDebug: SCRIPT_DEBUG_1.default,
    SCRIPT_EXISTS: SCRIPT_EXISTS_1.default,
    scriptExists: SCRIPT_EXISTS_1.default,
    SCRIPT_FLUSH: SCRIPT_FLUSH_1.default,
    scriptFlush: SCRIPT_FLUSH_1.default,
    SCRIPT_KILL: SCRIPT_KILL_1.default,
    scriptKill: SCRIPT_KILL_1.default,
    SCRIPT_LOAD: SCRIPT_LOAD_1.default,
    scriptLoad: SCRIPT_LOAD_1.default,
    SDIFF: SDIFF_1.default,
    sDiff: SDIFF_1.default,
    SDIFFSTORE: SDIFFSTORE_1.default,
    sDiffStore: SDIFFSTORE_1.default,
    SET: SET_1.default,
    set: SET_1.default,
    SETBIT: SETBIT_1.default,
    setBit: SETBIT_1.default,
    SETEX: SETEX_1.default,
    setEx: SETEX_1.default,
    SETNX: SETNX_1.default,
    setNX: SETNX_1.default,
    SETRANGE: SETRANGE_1.default,
    setRange: SETRANGE_1.default,
    SINTER: SINTER_1.default,
    sInter: SINTER_1.default,
    SINTERCARD: SINTERCARD_1.default,
    sInterCard: SINTERCARD_1.default,
    SINTERSTORE: SINTERSTORE_1.default,
    sInterStore: SINTERSTORE_1.default,
    SISMEMBER: SISMEMBER_1.default,
    sIsMember: SISMEMBER_1.default,
    SMEMBERS: SMEMBERS_1.default,
    sMembers: SMEMBERS_1.default,
    SMISMEMBER: SMISMEMBER_1.default,
    smIsMember: SMISMEMBER_1.default,
    SMOVE: SMOVE_1.default,
    sMove: SMOVE_1.default,
    SORT_RO: SORT_RO_1.default,
    sortRo: SORT_RO_1.default,
    SORT_STORE: SORT_STORE_1.default,
    sortStore: SORT_STORE_1.default,
    SORT: SORT_1.default,
    sort: SORT_1.default,
    SPOP_COUNT: SPOP_COUNT_1.default,
    sPopCount: SPOP_COUNT_1.default,
    SPOP: SPOP_1.default,
    sPop: SPOP_1.default,
    SPUBLISH: SPUBLISH_1.default,
    sPublish: SPUBLISH_1.default,
    SRANDMEMBER_COUNT: SRANDMEMBER_COUNT_1.default,
    sRandMemberCount: SRANDMEMBER_COUNT_1.default,
    SRANDMEMBER: SRANDMEMBER_1.default,
    sRandMember: SRANDMEMBER_1.default,
    SREM: SREM_1.default,
    sRem: SREM_1.default,
    SSCAN: SSCAN_1.default,
    sScan: SSCAN_1.default,
    STRLEN: STRLEN_1.default,
    strLen: STRLEN_1.default,
    SUNION: SUNION_1.default,
    sUnion: SUNION_1.default,
    SUNIONSTORE: SUNIONSTORE_1.default,
    sUnionStore: SUNIONSTORE_1.default,
    SWAPDB: SWAPDB_1.default,
    swapDb: SWAPDB_1.default,
    TIME: TIME_1.default,
    time: TIME_1.default,
    TOUCH: TOUCH_1.default,
    touch: TOUCH_1.default,
    TTL: TTL_1.default,
    ttl: TTL_1.default,
    TYPE: TYPE_1.default,
    type: TYPE_1.default,
    UNLINK: UNLINK_1.default,
    unlink: UNLINK_1.default,
    WAIT: WAIT_1.default,
    wait: WAIT_1.default,
    XACK: XACK_1.default,
    xAck: XACK_1.default,
    XACKDEL: XACKDEL_1.default,
    xAckDel: XACKDEL_1.default,
    XADD_NOMKSTREAM: XADD_NOMKSTREAM_1.default,
    xAddNoMkStream: XADD_NOMKSTREAM_1.default,
    XADD: XADD_1.default,
    xAdd: XADD_1.default,
    XAUTOCLAIM_JUSTID: XAUTOCLAIM_JUSTID_1.default,
    xAutoClaimJustId: XAUTOCLAIM_JUSTID_1.default,
    XAUTOCLAIM: XAUTOCLAIM_1.default,
    xAutoClaim: XAUTOCLAIM_1.default,
    XCLAIM_JUSTID: XCLAIM_JUSTID_1.default,
    xClaimJustId: XCLAIM_JUSTID_1.default,
    XCLAIM: XCLAIM_1.default,
    xClaim: XCLAIM_1.default,
    XDEL: XDEL_1.default,
    xDel: XDEL_1.default,
    XDELEX: XDELEX_1.default,
    xDelEx: XDELEX_1.default,
    XGROUP_CREATE: XGROUP_CREATE_1.default,
    xGroupCreate: XGROUP_CREATE_1.default,
    XGROUP_CREATECONSUMER: XGROUP_CREATECONSUMER_1.default,
    xGroupCreateConsumer: XGROUP_CREATECONSUMER_1.default,
    XGROUP_DELCONSUMER: XGROUP_DELCONSUMER_1.default,
    xGroupDelConsumer: XGROUP_DELCONSUMER_1.default,
    XGROUP_DESTROY: XGROUP_DESTROY_1.default,
    xGroupDestroy: XGROUP_DESTROY_1.default,
    XGROUP_SETID: XGROUP_SETID_1.default,
    xGroupSetId: XGROUP_SETID_1.default,
    XINFO_CONSUMERS: XINFO_CONSUMERS_1.default,
    xInfoConsumers: XINFO_CONSUMERS_1.default,
    XINFO_GROUPS: XINFO_GROUPS_1.default,
    xInfoGroups: XINFO_GROUPS_1.default,
    XINFO_STREAM: XINFO_STREAM_1.default,
    xInfoStream: XINFO_STREAM_1.default,
    XLEN: XLEN_1.default,
    xLen: XLEN_1.default,
    XPENDING_RANGE: XPENDING_RANGE_1.default,
    xPendingRange: XPENDING_RANGE_1.default,
    XPENDING: XPENDING_1.default,
    xPending: XPENDING_1.default,
    XRANGE: XRANGE_1.default,
    xRange: XRANGE_1.default,
    XREAD: XREAD_1.default,
    xRead: XREAD_1.default,
    XREADGROUP: XREADGROUP_1.default,
    xReadGroup: XREADGROUP_1.default,
    XREVRANGE: XREVRANGE_1.default,
    xRevRange: XREVRANGE_1.default,
    XSETID: XSETID_1.default,
    xSetId: XSETID_1.default,
    XTRIM: XTRIM_1.default,
    xTrim: XTRIM_1.default,
    ZADD_INCR: ZADD_INCR_1.default,
    zAddIncr: ZADD_INCR_1.default,
    ZADD: ZADD_1.default,
    zAdd: ZADD_1.default,
    ZCARD: ZCARD_1.default,
    zCard: ZCARD_1.default,
    ZCOUNT: ZCOUNT_1.default,
    zCount: ZCOUNT_1.default,
    ZDIFF_WITHSCORES: ZDIFF_WITHSCORES_1.default,
    zDiffWithScores: ZDIFF_WITHSCORES_1.default,
    ZDIFF: ZDIFF_1.default,
    zDiff: ZDIFF_1.default,
    ZDIFFSTORE: ZDIFFSTORE_1.default,
    zDiffStore: ZDIFFSTORE_1.default,
    ZINCRBY: ZINCRBY_1.default,
    zIncrBy: ZINCRBY_1.default,
    ZINTER_WITHSCORES: ZINTER_WITHSCORES_1.default,
    zInterWithScores: ZINTER_WITHSCORES_1.default,
    ZINTER: ZINTER_1.default,
    zInter: ZINTER_1.default,
    ZINTERCARD: ZINTERCARD_1.default,
    zInterCard: ZINTERCARD_1.default,
    ZINTERSTORE: ZINTERSTORE_1.default,
    zInterStore: ZINTERSTORE_1.default,
    ZLEXCOUNT: ZLEXCOUNT_1.default,
    zLexCount: ZLEXCOUNT_1.default,
    ZMPOP: ZMPOP_1.default,
    zmPop: ZMPOP_1.default,
    ZMSCORE: ZMSCORE_1.default,
    zmScore: ZMSCORE_1.default,
    ZPOPMAX_COUNT: ZPOPMAX_COUNT_1.default,
    zPopMaxCount: ZPOPMAX_COUNT_1.default,
    ZPOPMAX: ZPOPMAX_1.default,
    zPopMax: ZPOPMAX_1.default,
    ZPOPMIN_COUNT: ZPOPMIN_COUNT_1.default,
    zPopMinCount: ZPOPMIN_COUNT_1.default,
    ZPOPMIN: ZPOPMIN_1.default,
    zPopMin: ZPOPMIN_1.default,
    ZRANDMEMBER_COUNT_WITHSCORES: ZRANDMEMBER_COUNT_WITHSCORES_1.default,
    zRandMemberCountWithScores: ZRANDMEMBER_COUNT_WITHSCORES_1.default,
    ZRANDMEMBER_COUNT: ZRANDMEMBER_COUNT_1.default,
    zRandMemberCount: ZRANDMEMBER_COUNT_1.default,
    ZRANDMEMBER: ZRANDMEMBER_1.default,
    zRandMember: ZRANDMEMBER_1.default,
    ZRANGE_WITHSCORES: ZRANGE_WITHSCORES_1.default,
    zRangeWithScores: ZRANGE_WITHSCORES_1.default,
    ZRANGE: ZRANGE_1.default,
    zRange: ZRANGE_1.default,
    ZRANGEBYLEX: ZRANGEBYLEX_1.default,
    zRangeByLex: ZRANGEBYLEX_1.default,
    ZRANGEBYSCORE_WITHSCORES: ZRANGEBYSCORE_WITHSCORES_1.default,
    zRangeByScoreWithScores: ZRANGEBYSCORE_WITHSCORES_1.default,
    ZRANGEBYSCORE: ZRANGEBYSCORE_1.default,
    zRangeByScore: ZRANGEBYSCORE_1.default,
    ZRANGESTORE: ZRANGESTORE_1.default,
    zRangeStore: ZRANGESTORE_1.default,
    ZRANK_WITHSCORE: ZRANK_WITHSCORE_1.default,
    zRankWithScore: ZRANK_WITHSCORE_1.default,
    ZRANK: ZRANK_1.default,
    zRank: ZRANK_1.default,
    ZREM: ZREM_1.default,
    zRem: ZREM_1.default,
    ZREMRANGEBYLEX: ZREMRANGEBYLEX_1.default,
    zRemRangeByLex: ZREMRANGEBYLEX_1.default,
    ZREMRANGEBYRANK: ZREMRANGEBYRANK_1.default,
    zRemRangeByRank: ZREMRANGEBYRANK_1.default,
    ZREMRANGEBYSCORE: ZREMRANGEBYSCORE_1.default,
    zRemRangeByScore: ZREMRANGEBYSCORE_1.default,
    ZREVRANK: ZREVRANK_1.default,
    zRevRank: ZREVRANK_1.default,
    ZSCAN: ZSCAN_1.default,
    zScan: ZSCAN_1.default,
    ZSCORE: ZSCORE_1.default,
    zScore: ZSCORE_1.default,
    ZUNION_WITHSCORES: ZUNION_WITHSCORES_1.default,
    zUnionWithScores: ZUNION_WITHSCORES_1.default,
    ZUNION: ZUNION_1.default,
    zUnion: ZUNION_1.default,
    ZUNIONSTORE: ZUNIONSTORE_1.default,
    zUnionStore: ZUNIONSTORE_1.default,
    VADD: VADD_1.default,
    vAdd: VADD_1.default,
    VCARD: VCARD_1.default,
    vCard: VCARD_1.default,
    VDIM: VDIM_1.default,
    vDim: VDIM_1.default,
    VEMB: VEMB_1.default,
    vEmb: VEMB_1.default,
    VEMB_RAW: VEMB_RAW_1.default,
    vEmbRaw: VEMB_RAW_1.default,
    VGETATTR: VGETATTR_1.default,
    vGetAttr: VGETATTR_1.default,
    VINFO: VINFO_1.default,
    vInfo: VINFO_1.default,
    VLINKS: VLINKS_1.default,
    vLinks: VLINKS_1.default,
    VLINKS_WITHSCORES: VLINKS_WITHSCORES_1.default,
    vLinksWithScores: VLINKS_WITHSCORES_1.default,
    VRANDMEMBER: VRANDMEMBER_1.default,
    vRandMember: VRANDMEMBER_1.default,
    VREM: VREM_1.default,
    vRem: VREM_1.default,
    VSETATTR: VSETATTR_1.default,
    vSetAttr: VSETATTR_1.default,
    VSIM: VSIM_1.default,
    vSim: VSIM_1.default,
    VSIM_WITHSCORES: VSIM_WITHSCORES_1.default,
    vSimWithScores: VSIM_WITHSCORES_1.default
};
//# sourceMappingURL=index.js.map