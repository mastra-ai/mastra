#pragma once
#include "jstocbpp_defs.hpp"

#include "jstocbpp_basic.hpp"
#include "jstocbpp_cpptypes.hpp"

#include <core/cluster.hxx>
#include <core/error_context/transaction_error_context.hxx>
#include <core/transactions.hxx>
#include <core/transactions/internal/exceptions_internal.hxx>
#include <core/transactions/transaction_get_multi_replicas_from_preferred_server_group_result.hxx>
#include <core/transactions/transaction_get_multi_result.hxx>
#include <core/utils/json.hxx>

namespace cbtxns = couchbase::transactions;
namespace cbcoretxns = couchbase::core::transactions;

namespace couchnode
{

// nlohmann::json (used by transactions currently)
template <>
struct js_to_cbpp_t<tao::json::value> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const tao::json::value &cppObj)
    {
        return Napi::String::New(
            env, couchbase::core::utils::json::generate(cppObj));
    }

    static inline tao::json::value from_js(Napi::Value jsVal)
    {
        auto cppStr = jsVal.As<Napi::String>().Utf8Value();
        return couchbase::core::utils::json::parse(cppStr);
    }
};

template <>
struct js_to_cbpp_t<cbtxns::transactions_config> {
    static inline cbtxns::transactions_config from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        cbtxns::transactions_config cppObj;

        auto durability_level =
            js_to_cbpp<std::optional<couchbase::durability_level>>(
                jsObj.Get("durability_level"));

        if (durability_level.has_value()) {
            cppObj.durability_level(durability_level.value());
        }

        auto timeout = js_to_cbpp<std::optional<std::chrono::milliseconds>>(
            jsObj.Get("timeout"));
        if (timeout.has_value()) {
            cppObj.timeout(timeout.value());
        }

        auto query_scan_consistency =
            js_to_cbpp<std::optional<couchbase::query_scan_consistency>>(
                jsObj.Get("query_scan_consistency"));
        if (query_scan_consistency.has_value()) {
            cppObj.query_config().scan_consistency(
                query_scan_consistency.value());
        }

        auto cleanup_window =
            js_to_cbpp<std::optional<std::chrono::milliseconds>>(
                jsObj.Get("cleanup_window"));
        if (cleanup_window.has_value()) {
            cppObj.cleanup_config().cleanup_window(cleanup_window.value());
        }

        auto cleanup_lost_attempts =
            js_to_cbpp<std::optional<bool>>(jsObj.Get("cleanup_lost_attempts"));
        if (cleanup_lost_attempts.has_value()) {
            cppObj.cleanup_config().cleanup_lost_attempts(
                cleanup_lost_attempts.value());
        }

        auto cleanup_client_attempts = js_to_cbpp<std::optional<bool>>(
            jsObj.Get("cleanup_client_attempts"));
        if (cleanup_client_attempts.has_value()) {
            cppObj.cleanup_config().cleanup_client_attempts(
                cleanup_client_attempts.value());
        }

        auto keyspace = js_to_cbpp<std::optional<cbtxns::transaction_keyspace>>(
            jsObj.Get("metadata_collection"));
        if (keyspace.has_value()) {
            cppObj.metadata_collection(keyspace.value());
        }

        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<cbtxns::transaction_options> {
    static inline cbtxns::transaction_options from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        cbtxns::transaction_options cppObj;

        auto durability_level =
            js_to_cbpp<std::optional<couchbase::durability_level>>(
                jsObj.Get("durability_level"));
        if (durability_level.has_value()) {
            cppObj.durability_level(durability_level.value());
        }

        auto timeout = js_to_cbpp<std::optional<std::chrono::milliseconds>>(
            jsObj.Get("timeout"));
        if (timeout.has_value()) {
            cppObj.timeout(timeout.value());
        }

        auto query_scan_consistency =
            js_to_cbpp<std::optional<couchbase::query_scan_consistency>>(
                jsObj.Get("query_scan_consistency"));
        if (query_scan_consistency.has_value()) {
            cppObj.scan_consistency(query_scan_consistency.value());
        }

        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<cbcoretxns::transaction_links> {
    static inline cbcoretxns::transaction_links from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        return cbcoretxns::transaction_links(
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("atr_id")),
            js_to_cbpp<std::optional<std::string>>(
                jsObj.Get("atr_bucket_name")),
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("atr_scope_name")),
            js_to_cbpp<std::optional<std::string>>(
                jsObj.Get("atr_collection_name")),
            js_to_cbpp<std::optional<std::string>>(
                jsObj.Get("staged_transaction_id")),
            js_to_cbpp<std::optional<std::string>>(
                jsObj.Get("staged_attempt_id")),
            js_to_cbpp<std::optional<std::string>>(
                jsObj.Get("staged_operation_id")),
            js_to_cbpp<std::optional<couchbase::codec::encoded_value>>(
                jsObj.Get("staged_content")),
            {},
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("cas_pre_txn")),
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("revid_pre_txn")),
            js_to_cbpp<std::optional<uint32_t>>(jsObj.Get("exptime_pre_txn")),
            js_to_cbpp<std::optional<std::string>>(
                jsObj.Get("crc32_of_staging")),
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("op")),
            js_to_cbpp<std::optional<tao::json::value>>(
                jsObj.Get("forward_compat")),
            js_to_cbpp<bool>(jsObj.Get("is_deleted")));
    }

    static inline Napi::Value to_js(Napi::Env env,
                                    const cbcoretxns::transaction_links &res)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("atr_id", cbpp_to_js(env, res.atr_id()));
        resObj.Set("atr_bucket_name", cbpp_to_js(env, res.atr_bucket_name()));
        resObj.Set("atr_scope_name", cbpp_to_js(env, res.atr_scope_name()));
        resObj.Set("atr_collection_name",
                   cbpp_to_js(env, res.atr_collection_name()));
        resObj.Set("staged_transaction_id",
                   cbpp_to_js(env, res.staged_transaction_id()));
        resObj.Set("staged_attempt_id",
                   cbpp_to_js(env, res.staged_attempt_id()));
        resObj.Set("staged_operation_id",
                   cbpp_to_js(env, res.staged_operation_id()));
        resObj.Set("staged_content",
                   cbpp_to_js(env, res.staged_content_json()));
        resObj.Set("cas_pre_txn", cbpp_to_js(env, res.cas_pre_txn()));
        resObj.Set("revid_pre_txn", cbpp_to_js(env, res.revid_pre_txn()));
        resObj.Set("exptime_pre_txn", cbpp_to_js(env, res.exptime_pre_txn()));
        resObj.Set("crc32_of_staging", cbpp_to_js(env, res.crc32_of_staging()));
        resObj.Set("op", cbpp_to_js(env, res.op()));
        resObj.Set("forward_compat", cbpp_to_js(env, res.forward_compat()));
        resObj.Set("is_deleted", cbpp_to_js(env, res.is_deleted()));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<cbcoretxns::document_metadata> {
    static inline cbcoretxns::document_metadata from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        return cbcoretxns::document_metadata(
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("cas")),
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("revid")),
            js_to_cbpp<std::optional<uint32_t>>(jsObj.Get("exptime")),
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("crc32")));
    }

    static inline Napi::Value to_js(Napi::Env env,
                                    const cbcoretxns::document_metadata &res)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("cas", cbpp_to_js(env, res.cas()));
        resObj.Set("revid", cbpp_to_js(env, res.revid()));
        resObj.Set("exptime", cbpp_to_js(env, res.exptime()));
        resObj.Set("crc32", cbpp_to_js(env, res.crc32()));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<cbtxns::transaction_keyspace> {
    static inline cbtxns::transaction_keyspace from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        auto bucket_name = js_to_cbpp<std::string>(jsObj.Get("bucket_name"));
        auto scope_name =
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("scope_name"));
        auto collection_name = js_to_cbpp<std::optional<std::string>>(
            jsObj.Get("collection_name"));
        if (scope_name.has_value() && collection_name.has_value()) {
            return cbtxns::transaction_keyspace(bucket_name, scope_name.value(),
                                                collection_name.value());
        }
        return cbtxns::transaction_keyspace(bucket_name);
    }

    static inline Napi::Value to_js(Napi::Env env,
                                    const cbtxns::transaction_keyspace &res)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("bucket", cbpp_to_js(env, res.bucket));
        resObj.Set("scope", cbpp_to_js(env, res.scope));
        resObj.Set("collection", cbpp_to_js(env, res.collection));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<cbcoretxns::transaction_get_result> {
    static inline cbcoretxns::transaction_get_result from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        return cbcoretxns::transaction_get_result(
            js_to_cbpp<couchbase::core::document_id>(jsObj.Get("id")),
            js_to_cbpp<couchbase::codec::encoded_value>(jsObj.Get("content")),
            js_to_cbpp<couchbase::cas>(jsObj.Get("cas")).value(),
            js_to_cbpp<cbcoretxns::transaction_links>(jsObj.Get("links")),
            js_to_cbpp<std::optional<cbcoretxns::document_metadata>>(
                jsObj.Get("metadata")));
    }

    static inline Napi::Value
    to_js(Napi::Env env, const cbcoretxns::transaction_get_result &res)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("id", cbpp_to_js(env, res.id()));
        resObj.Set("content", cbpp_to_js(env, res.content()));
        resObj.Set("cas", cbpp_to_js(env, couchbase::cas{res.cas()}));
        resObj.Set("links", cbpp_to_js(env, res.links()));
        resObj.Set("metadata", cbpp_to_js(env, res.metadata()));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<cbcoretxns::transaction_get_multi_result> {
    static inline cbcoretxns::transaction_get_multi_result
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        return cbcoretxns::transaction_get_multi_result(
            js_to_cbpp<
                std::vector<std::optional<couchbase::codec::encoded_value>>>(
                jsObj.Get("content")));
    }

    static inline Napi::Value
    to_js(Napi::Env env, const cbcoretxns::transaction_get_multi_result &res)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("content", cbpp_to_js(env, res.content()));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<
    cbcoretxns::
        transaction_get_multi_replicas_from_preferred_server_group_result> {
    static inline cbcoretxns::
        transaction_get_multi_replicas_from_preferred_server_group_result
        from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        return cbcoretxns::
            transaction_get_multi_replicas_from_preferred_server_group_result(
                js_to_cbpp<std::vector<
                    std::optional<couchbase::codec::encoded_value>>>(
                    jsObj.Get("content")));
    }

    static inline Napi::Value
    to_js(Napi::Env env,
          const cbcoretxns::
              transaction_get_multi_replicas_from_preferred_server_group_result
                  &res)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("content", cbpp_to_js(env, res.content()));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<cbtxns::transaction_query_options> {
    static inline cbtxns::transaction_query_options from_js(Napi::Value jsVal)
    {

        auto jsObj = jsVal.ToObject();
        cbtxns::transaction_query_options cppObj;

        auto raw = js_to_cbpp<std::optional<
            std::map<std::string, std::vector<std::byte>, std::less<>>>>(
            jsObj.Get("raw"));
        if (raw.has_value() && raw.value().size() > 0) {
            cppObj.encoded_raw_options(raw.value());
        }

        auto ad_hoc = js_to_cbpp<std::optional<bool>>(jsObj.Get("ad_hoc"));
        if (ad_hoc.has_value()) {
            cppObj.ad_hoc(ad_hoc.value());
        }

        auto scan_consistency =
            js_to_cbpp<std::optional<couchbase::query_scan_consistency>>(
                jsObj.Get("scan_consistency"));
        if (scan_consistency.has_value()) {
            cppObj.scan_consistency(scan_consistency.value());
        }

        auto profile = js_to_cbpp<std::optional<couchbase::query_profile>>(
            jsObj.Get("profile"));
        if (profile.has_value()) {
            cppObj.profile(profile.value());
        }

        auto metrics = js_to_cbpp<std::optional<bool>>(jsObj.Get("metrics"));
        if (metrics.has_value()) {
            cppObj.metrics(metrics.value());
        }

        auto client_context_id = js_to_cbpp<std::optional<std::string>>(
            jsObj.Get("client_context_id"));
        if (client_context_id.has_value()) {
            cppObj.client_context_id(client_context_id.value());
        }

        auto scan_wait = js_to_cbpp<std::optional<std::chrono::milliseconds>>(
            jsObj.Get("scan_wait"));
        if (scan_wait.has_value()) {
            cppObj.scan_wait(scan_wait.value());
        }

        auto readonly = js_to_cbpp<std::optional<bool>>(jsObj.Get("readonly"));
        if (readonly.has_value()) {
            cppObj.readonly(readonly.value());
        }

        auto scan_cap =
            js_to_cbpp<std::optional<uint64_t>>(jsObj.Get("scan_cap"));
        if (scan_cap.has_value()) {
            cppObj.scan_cap(scan_cap.value());
        }

        auto pipeline_batch =
            js_to_cbpp<std::optional<uint64_t>>(jsObj.Get("pipeline_batch"));
        if (pipeline_batch.has_value()) {
            cppObj.pipeline_batch(pipeline_batch.value());
        }

        auto pipeline_cap =
            js_to_cbpp<std::optional<uint64_t>>(jsObj.Get("pipeline_cap"));
        if (pipeline_cap.has_value()) {
            cppObj.pipeline_cap(pipeline_cap.value());
        }

        auto max_parallelism =
            js_to_cbpp<std::optional<uint64_t>>(jsObj.Get("max_parallelism"));
        if (max_parallelism.has_value()) {
            cppObj.max_parallelism(max_parallelism.value());
        }

        auto positional_parameters =
            js_to_cbpp<std::optional<std::vector<std::vector<std::byte>>>>(
                jsObj.Get("positional_parameters"));
        if (positional_parameters.has_value() &&
            positional_parameters.value().size() > 0) {
            cppObj.encoded_positional_parameters(positional_parameters.value());
        }

        auto named_parameters = js_to_cbpp<std::optional<
            std::map<std::string, std::vector<std::byte>, std::less<>>>>(
            jsObj.Get("named_parameters"));
        if (named_parameters.has_value() &&
            named_parameters.value().size() > 0) {
            cppObj.encoded_named_parameters(named_parameters.value());
        }

        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<cbcoretxns::transaction_operation_failed> {
    static inline Napi::Value
    to_js(Napi::Env env, const cbcoretxns::transaction_operation_failed &err)
    {
        Napi::Error jsErr = Napi::Error::New(env, "transaction_exception");

        jsErr.Set("should_not_retry", cbpp_to_js(env, !err.should_retry()));
        jsErr.Set("should_not_rollback",
                  cbpp_to_js(env, !err.should_rollback()));
        if (err.cause() == cbcoretxns::external_exception::UNKNOWN) {
            if (err.to_raise() == cbcoretxns::final_error::EXPIRED) {
                jsErr.Set("ctxtype",
                          Napi::String::New(env, "transaction_exception"));
                jsErr.Set("type",
                          cbpp_to_js(env, cbcoretxns::failure_type::EXPIRY));
            } else if (err.to_raise() == cbcoretxns::final_error::AMBIGUOUS) {
                jsErr.Set("ctxtype",
                          Napi::String::New(env, "transaction_exception"));
                jsErr.Set("type",
                          cbpp_to_js(
                              env, cbcoretxns::failure_type::COMMIT_AMBIGUOUS));
            } else {
                jsErr.Set("ctxtype", Napi::String::New(
                                         env, "transaction_operation_failed"));
            }
        } else if (err.cause() == cbcoretxns::external_exception::
                                      DOCUMENT_UNRETRIEVABLE_EXCEPTION) {
            jsErr.Set("ctxtype",
                      Napi::String::New(env, "transaction_op_exception"));
        } else {
            jsErr.Set("ctxtype",
                      Napi::String::New(env, "transaction_operation_failed"));
        }
        jsErr.Set("cause", cbpp_to_js(env, err.cause()));
        jsErr.Set("message", cbpp_to_js(env, std::string(err.what())));
        return jsErr.Value();
    }
};

template <>
struct js_to_cbpp_t<cbcoretxns::transaction_exception> {
    static inline Napi::Value
    to_js(Napi::Env env, const cbcoretxns::transaction_exception &err)
    {
        Napi::Error jsErr = Napi::Error::New(env, "transaction_exception");
        jsErr.Set("ctxtype", Napi::String::New(env, "transaction_exception"));
        auto txn_result = err.get_transaction_result();
        jsErr.Set("ctx", cbpp_to_js(env, txn_result.first));
        jsErr.Set("result", cbpp_to_js(env, txn_result.second));
        jsErr.Set("cause", cbpp_to_js(env, err.cause()));
        jsErr.Set("type", cbpp_to_js(env, err.type()));
        return jsErr.Value();
    }
};

template <>
struct js_to_cbpp_t<cbtxns::transaction_result> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const cbtxns::transaction_result &res)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("transaction_id", cbpp_to_js(env, res.transaction_id));
        resObj.Set("unstaging_complete",
                   cbpp_to_js(env, res.unstaging_complete));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::core::transaction_error_context> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::core::transaction_error_context &res)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("code", cbpp_to_js(env, res.ec()));
        resObj.Set("cause", cbpp_to_js(env, res.cause()));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<cbcoretxns::op_exception> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const cbcoretxns::op_exception &err)
    {
        Napi::Error jsErr = Napi::Error::New(env, "transaction_exception");
        jsErr.Set("ctxtype",
                  Napi::String::New(env, "transaction_op_exception"));
        jsErr.Set("ctx", cbpp_to_js(env, err.ctx()));
        jsErr.Set("cause", cbpp_to_js(env, err.cause()));
        return jsErr.Value();
    }
};

template <>
struct js_to_cbpp_t<couchbase::core::transaction_op_error_context> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::core::transaction_op_error_context &res)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("code", cbpp_to_js(env, res.ec()));
        resObj.Set(
            "cause",
            cbpp_to_js<std::variant<std::monostate,
                                    couchbase::core::key_value_error_context,
                                    couchbase::core::query_error_context>>(
                env, res.cause()));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<std::exception_ptr> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const std::exception_ptr &err)
    {
        if (!err) {
            return env.Null();
        }

        try {
            std::rethrow_exception(err);
        } catch (const cbcoretxns::transaction_operation_failed &err) {
            return cbpp_to_js(env, err);
        } catch (const cbcoretxns::op_exception &err) {
            return cbpp_to_js(env, err);
        } catch (const std::exception &err) {
            return cbpp_to_js(env, err);
        } catch (...) {
            return Napi::Error::New(env, "unexpected c++ error").Value();
        }
    }
};

} // namespace couchnode
