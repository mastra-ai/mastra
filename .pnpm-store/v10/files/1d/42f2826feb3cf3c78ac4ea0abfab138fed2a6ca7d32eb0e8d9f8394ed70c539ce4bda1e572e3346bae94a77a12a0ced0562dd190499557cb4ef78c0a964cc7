#pragma once
#include "jstocbpp_defs.hpp"

#include "jstocbpp_basic.hpp"
#include "jstocbpp_cpptypes.hpp"

#include <core/cluster.hxx>
#include <core/operations/management/error_utils.hxx>
#include <core/error_context/query_error_context.hxx>

namespace couchnode
{

template <>
struct js_to_cbpp_t<std::exception> {
    static inline Napi::Value to_js(Napi::Env env, const std::exception &except)
    {
        Napi::Error err = Napi::Error::New(env, except.what());
        return err.Value();
    }
};

template <>
struct js_to_cbpp_t<std::error_code> {
    static inline Napi::Value to_js(Napi::Env env, const std::error_code &ec)
    {
        if (!ec) {
            return env.Null();
        }

        Napi::Error err = Napi::Error::New(env, ec.message());
        err.Set("code", Napi::Number::New(env, ec.value()));
        return err.Value();
    }

    static inline std::error_code from_js(Napi::Value jsVal)
    {
        throw Napi::Error::New(jsVal.Env(),
                               "invalid std::error_code marshal from js");
    }
};

template <>
struct js_to_cbpp_t<couchbase::core::key_value_extended_error_info> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::core::key_value_extended_error_info &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("reference", cbpp_to_js(env, cppObj.reference()));
        resObj.Set("context", cbpp_to_js(env, cppObj.context()));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::core::key_value_error_context> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::core::key_value_error_context &ctx)
    {
        if (!ctx.ec()) {
            return env.Null();
        }

        Napi::Error err = Napi::Error::New(env, ctx.ec().message());
        err.Set("ctxtype", Napi::String::New(env, "key_value"));
        err.Set("code", cbpp_to_js(env, ctx.ec().value()));
        err.Set("id", cbpp_to_js(env, ctx.id()));
        err.Set("opaque", cbpp_to_js(env, ctx.opaque()));
        err.Set("cas", cbpp_to_js(env, ctx.cas()));
        err.Set("status_code", cbpp_to_js(env, ctx.status_code()));
        err.Set("enhanced_error_info",
                cbpp_to_js(env, ctx.extended_error_info()));
        err.Set("last_dispatched_to",
                cbpp_to_js(env, ctx.last_dispatched_to()));
        err.Set("last_dispatched_from",
                cbpp_to_js(env, ctx.last_dispatched_from()));
        err.Set("retry_attempts", cbpp_to_js(env, ctx.retry_attempts()));
        err.Set("retry_reasons", cbpp_to_js(env, ctx.retry_reasons()));
        return err.Value();
    }
};

template <>
struct js_to_cbpp_t<couchbase::core::subdocument_error_context> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::core::subdocument_error_context &ctx)
    {
        if (!ctx.ec()) {
            return env.Null();
        }

        Napi::Error err = Napi::Error::New(env, ctx.ec().message());
        err.Set("ctxtype", Napi::String::New(env, "subdocument"));
        err.Set("code", cbpp_to_js(env, ctx.ec().value()));
        err.Set("id", cbpp_to_js(env, ctx.id()));
        err.Set("opaque", cbpp_to_js(env, ctx.opaque()));
        err.Set("cas", cbpp_to_js(env, ctx.cas()));
        err.Set("status_code", cbpp_to_js(env, ctx.status_code()));
        err.Set("enhanced_error_info",
                cbpp_to_js(env, ctx.extended_error_info()));
        err.Set("last_dispatched_to",
                cbpp_to_js(env, ctx.last_dispatched_to()));
        err.Set("last_dispatched_from",
                cbpp_to_js(env, ctx.last_dispatched_from()));
        err.Set("retry_attempts", cbpp_to_js(env, ctx.retry_attempts()));
        err.Set("retry_reasons", cbpp_to_js(env, ctx.retry_reasons()));
        err.Set("first_error_path", cbpp_to_js(env, ctx.first_error_path()));
        err.Set("first_error_index", cbpp_to_js(env, ctx.first_error_index()));
        err.Set("deleted", cbpp_to_js(env, ctx.deleted()));
        return err.Value();
    }
};

template <>
struct js_to_cbpp_t<couchbase::core::error_context::view> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::core::error_context::view &ctx)
    {
        if (!ctx.ec) {
            return env.Null();
        }

        Napi::Error err = Napi::Error::New(env, ctx.ec.message());
        err.Set("ctxtype", Napi::String::New(env, "view"));
        err.Set("code", cbpp_to_js(env, ctx.ec.value()));

        err.Set("client_context_id", cbpp_to_js(env, ctx.client_context_id));
        err.Set("design_document_name",
                cbpp_to_js(env, ctx.design_document_name));
        err.Set("view_name", cbpp_to_js(env, ctx.view_name));
        err.Set("query_string", cbpp_to_js(env, ctx.query_string));

        err.Set("method", cbpp_to_js(env, ctx.method));
        err.Set("path", cbpp_to_js(env, ctx.path));
        err.Set("http_status", cbpp_to_js(env, ctx.http_status));
        err.Set("http_body", cbpp_to_js(env, ctx.http_body));

        err.Set("last_dispatched_to", cbpp_to_js(env, ctx.last_dispatched_to));
        err.Set("last_dispatched_from",
                cbpp_to_js(env, ctx.last_dispatched_from));
        err.Set("retry_attempts", cbpp_to_js(env, ctx.retry_attempts));
        err.Set("retry_reasons", cbpp_to_js(env, ctx.retry_reasons));
        return err.Value();
    }
};

template <>
struct js_to_cbpp_t<couchbase::core::error_context::query> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::core::error_context::query &ctx)
    {
        if (!ctx.ec) {
            return env.Null();
        }

        auto ec = ctx.ec;
        if (ec) {
            auto maybeEc = couchbase::core::operations::management::
                translate_query_error_code(ctx.first_error_code,
                                           ctx.first_error_message, 0);
            if (maybeEc.has_value()) {
                ec = maybeEc.value();
            }
        }

        Napi::Error err = Napi::Error::New(env, ec.message());
        err.Set("ctxtype", Napi::String::New(env, "query"));
        err.Set("code", cbpp_to_js(env, ec.value()));

        err.Set("first_error_code", cbpp_to_js(env, ctx.first_error_code));
        err.Set("first_error_message",
                cbpp_to_js(env, ctx.first_error_message));
        err.Set("client_context_id", cbpp_to_js(env, ctx.client_context_id));
        err.Set("statement", cbpp_to_js(env, ctx.statement));
        err.Set("parameters", cbpp_to_js(env, ctx.parameters));

        err.Set("method", cbpp_to_js(env, ctx.method));
        err.Set("path", cbpp_to_js(env, ctx.path));
        err.Set("http_status", cbpp_to_js(env, ctx.http_status));
        err.Set("http_body", cbpp_to_js(env, ctx.http_body));

        err.Set("last_dispatched_to", cbpp_to_js(env, ctx.last_dispatched_to));
        err.Set("last_dispatched_from",
                cbpp_to_js(env, ctx.last_dispatched_from));
        err.Set("retry_attempts", cbpp_to_js(env, ctx.retry_attempts));
        err.Set("retry_reasons", cbpp_to_js(env, ctx.retry_reasons));
        return err.Value();
    }
};

template <>
struct js_to_cbpp_t<couchbase::core::query_error_context> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const couchbase::core::query_error_context &ctx)
    {
        if (!ctx.ec()) {
            return env.Null();
        }

        Napi::Error err = Napi::Error::New(env, ctx.ec().message());
        err.Set("ctxtype", Napi::String::New(env, "query"));
        err.Set("code", cbpp_to_js(env, ctx.ec().value()));

        err.Set("first_error_code", cbpp_to_js(env, ctx.first_error_code()));
        err.Set("first_error_message",
                cbpp_to_js(env, ctx.first_error_message()));
        err.Set("client_context_id", cbpp_to_js(env, ctx.client_context_id()));
        err.Set("statement", cbpp_to_js(env, ctx.statement()));
        err.Set("parameters", cbpp_to_js(env, ctx.parameters()));

        err.Set("method", cbpp_to_js(env, ctx.method()));
        err.Set("path", cbpp_to_js(env, ctx.path()));
        err.Set("http_status", cbpp_to_js(env, ctx.http_status()));
        err.Set("http_body", cbpp_to_js(env, ctx.http_body()));

        err.Set("last_dispatched_to",
                cbpp_to_js(env, ctx.last_dispatched_to()));
        err.Set("last_dispatched_from",
                cbpp_to_js(env, ctx.last_dispatched_from()));
        err.Set("retry_attempts", cbpp_to_js(env, ctx.retry_attempts()));
        err.Set("retry_reasons", cbpp_to_js(env, ctx.retry_reasons()));
        return err.Value();
    }
};

template <>
struct js_to_cbpp_t<couchbase::core::error_context::search> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::core::error_context::search &ctx)
    {
        if (!ctx.ec) {
            return env.Null();
        }

        auto ec = ctx.ec;
        if (ec) {
            auto maybeEc = couchbase::core::operations::management::
                translate_search_error_code(ctx.http_status, ctx.http_body);
            if (maybeEc.has_value()) {
                ec = maybeEc.value();
            }
        }

        Napi::Error err = Napi::Error::New(env, ec.message());
        err.Set("ctxtype", Napi::String::New(env, "search"));
        err.Set("code", cbpp_to_js(env, ec.value()));

        err.Set("client_context_id", cbpp_to_js(env, ctx.client_context_id));
        err.Set("index_name", cbpp_to_js(env, ctx.index_name));
        err.Set("query", cbpp_to_js(env, ctx.query));
        err.Set("parameters", cbpp_to_js(env, ctx.parameters));

        err.Set("method", cbpp_to_js(env, ctx.method));
        err.Set("path", cbpp_to_js(env, ctx.path));
        err.Set("http_status", cbpp_to_js(env, ctx.http_status));
        err.Set("http_body", cbpp_to_js(env, ctx.http_body));

        err.Set("last_dispatched_to", cbpp_to_js(env, ctx.last_dispatched_to));
        err.Set("last_dispatched_from",
                cbpp_to_js(env, ctx.last_dispatched_from));
        err.Set("retry_attempts", cbpp_to_js(env, ctx.retry_attempts));
        err.Set("retry_reasons", cbpp_to_js(env, ctx.retry_reasons));
        return err.Value();
    }
};

template <>
struct js_to_cbpp_t<couchbase::core::error_context::analytics> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::core::error_context::analytics &ctx)
    {
        if (!ctx.ec) {
            return env.Null();
        }

        auto ec = ctx.ec;
        if (ec) {
            auto maybeEc = couchbase::core::operations::management::
                translate_analytics_error_code(ctx.first_error_code,
                                               ctx.first_error_message);
            if (maybeEc.has_value()) {
                ec = maybeEc.value();
            }
        }

        Napi::Error err = Napi::Error::New(env, ec.message());
        err.Set("ctxtype", Napi::String::New(env, "analytics"));
        err.Set("code", cbpp_to_js(env, ec.value()));

        err.Set("first_error_code", cbpp_to_js(env, ctx.first_error_code));
        err.Set("first_error_message",
                cbpp_to_js(env, ctx.first_error_message));
        err.Set("client_context_id", cbpp_to_js(env, ctx.client_context_id));
        err.Set("statement", cbpp_to_js(env, ctx.statement));
        err.Set("parameters", cbpp_to_js(env, ctx.parameters));

        err.Set("method", cbpp_to_js(env, ctx.method));
        err.Set("path", cbpp_to_js(env, ctx.path));
        err.Set("http_status", cbpp_to_js(env, ctx.http_status));
        err.Set("http_body", cbpp_to_js(env, ctx.http_body));

        err.Set("last_dispatched_to", cbpp_to_js(env, ctx.last_dispatched_to));
        err.Set("last_dispatched_from",
                cbpp_to_js(env, ctx.last_dispatched_from));
        err.Set("retry_attempts", cbpp_to_js(env, ctx.retry_attempts));
        err.Set("retry_reasons", cbpp_to_js(env, ctx.retry_reasons));
        return err.Value();
    }
};

template <>
struct js_to_cbpp_t<couchbase::core::error_context::http> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::core::error_context::http &ctx)
    {
        if (!ctx.ec) {
            return env.Null();
        }

        Napi::Error err = Napi::Error::New(env, ctx.ec.message());
        err.Set("ctxtype", Napi::String::New(env, "http"));
        err.Set("code", cbpp_to_js(env, ctx.ec.value()));

        err.Set("client_context_id", cbpp_to_js(env, ctx.client_context_id));
        err.Set("method", cbpp_to_js(env, ctx.method));
        err.Set("path", cbpp_to_js(env, ctx.path));
        err.Set("http_status", cbpp_to_js(env, ctx.http_status));
        err.Set("http_body", cbpp_to_js(env, ctx.http_body));

        err.Set("last_dispatched_to", cbpp_to_js(env, ctx.last_dispatched_to));
        err.Set("last_dispatched_from",
                cbpp_to_js(env, ctx.last_dispatched_from));
        err.Set("retry_attempts", cbpp_to_js(env, ctx.retry_attempts));
        err.Set("retry_reasons", cbpp_to_js(env, ctx.retry_reasons));
        return err.Value();
    }
};

} // namespace couchnode
