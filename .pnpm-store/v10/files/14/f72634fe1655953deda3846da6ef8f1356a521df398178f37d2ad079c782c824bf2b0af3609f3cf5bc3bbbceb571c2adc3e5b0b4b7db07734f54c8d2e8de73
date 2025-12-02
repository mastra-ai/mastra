/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2024. Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

#pragma once

#include "core/error_context/query.hxx"
#include "core/impl/retry_reason.hxx"

#include <couchbase/error_codes.hxx>
#include <couchbase/fmt/retry_reason.hxx>

#include <tao/json/forward.hpp>
#include <tao/json/value.hpp>

namespace tao::json
{
template<>
struct traits<couchbase::core::error_context::query> {
  template<template<typename...> class Traits>
  static void assign(tao::json::basic_value<Traits>& v,
                     const couchbase::core::error_context::query& ctx)
  {
    v["retry_attempts"] = ctx.retry_attempts;
    v["client_context_id"] = ctx.client_context_id;
    v["statement"] = ctx.statement;
    v["method"] = ctx.method;
    v["path"] = ctx.path;
    v["http_status"] = ctx.http_status;
    v["http_body"] = ctx.http_body;
    v["hostname"] = ctx.hostname;
    v["port"] = ctx.port;

    if (const auto& val = ctx.parameters; val.has_value()) {
      v["parameters"] = val.value();
    }
    if (ctx.first_error_code > 0) {
      v["first_error_code"] = ctx.first_error_code;
    }
    if (!ctx.first_error_message.empty()) {
      v["first_error_message"] = ctx.first_error_message;
    }
    if (const auto& reasons = ctx.retry_reasons; !reasons.empty()) {
      tao::json::value reasons_json = tao::json::empty_array;
      for (const auto& reason : reasons) {
        reasons_json.emplace_back(fmt::format("{}", reason));
      }
      v["retry_reasons"] = reasons_json;
    }
    if (const auto& val = ctx.last_dispatched_from; val.has_value()) {
      v["last_dispatched_from"] = val.value();
    }
    if (const auto& val = ctx.last_dispatched_to; val.has_value()) {
      v["last_dispatched_to"] = val.value();
    }
  }

  template<template<typename...> class Traits>
  static auto as(const tao::json::basic_value<Traits>& v) -> couchbase::core::error_context::query
  {
    couchbase::core::error_context::query ctx;
    ctx.retry_attempts = v.at("retry_attempts").get_unsigned();
    ctx.client_context_id = v.at("client_context_id").get_string();
    ctx.statement = v.at("statement").get_string();
    ctx.method = v.at("method").get_string();
    ctx.path = v.at("path").get_string();
    ctx.http_status = static_cast<uint32_t>(v.at("http_status").get_unsigned());
    ctx.http_body = v.at("http_body").get_string();
    ctx.hostname = v.at("hostname").get_string();
    ctx.port = static_cast<uint16_t>(v.at("port").get_unsigned());
    if (const auto& parameters = v.find("parameters");
        parameters != nullptr && parameters->is_string()) {
      ctx.parameters = parameters->get_string();
    }
    if (const auto& first_error_code = v.find("first_error_code");
        first_error_code != nullptr && first_error_code->is_integer()) {
      ctx.first_error_code = first_error_code->get_unsigned();
    }
    if (const auto& first_error_message = v.find("first_error_message");
        first_error_message != nullptr && first_error_message->is_string()) {
      ctx.first_error_message = first_error_message->get_string();
    }
    if (const auto& retry_reasons = v.find("retry_reasons");
        retry_reasons != nullptr && retry_reasons->is_array()) {
      for (const auto& retry_reason : retry_reasons->get_array()) {
        ctx.retry_reasons.insert(
          couchbase::core::impl::retry_reason_to_enum(retry_reason.get_string()));
      }
    }
    if (const auto& last_dispatched_from = v.find("last_dispatched_from");
        last_dispatched_from != nullptr && last_dispatched_from->is_string()) {
      ctx.last_dispatched_from = last_dispatched_from->get_string();
    }
    if (const auto& last_dispatched_to = v.find("last_dispatched_to");
        last_dispatched_to != nullptr && last_dispatched_to->is_string()) {
      ctx.last_dispatched_to = last_dispatched_to->get_string();
    }
    return ctx;
  }
};
} // namespace tao::json
