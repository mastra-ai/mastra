/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-Present Couchbase, Inc.
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

#include "core/error_context/query_error_context.hxx"

#include <spdlog/fmt/bundled/core.h>
#include <tao/json/to_string.hpp>

#include <couchbase/fmt/retry_reason.hxx>

namespace couchbase::core
{
auto
query_error_context::to_json() const -> std::string
{
  tao::json::value json = {
    {
      "ec",
      tao::json::value{
        { "value", ec().value() },
        { "message", ec().message() },
      },
    },
    { "operation_id", operation_id() },
    { "retry_attempts", retry_attempts() },
    { "client_context_id", client_context_id_ },
    { "statement", statement_ },
    { "method", method_ },
    { "path", path_ },
    { "http_status", http_status_ },
    { "http_body", http_body_ },
    { "hostname", hostname_ },
    { "port", port_ },
  };

  if (const auto& val = parameters_; val.has_value()) {
    json["parameters"] = val.value();
  }
  if (first_error_code_ > 0) {
    json["first_error_code"] = first_error_code_;
  }
  if (!first_error_message_.empty()) {
    json["first_error_message"] = first_error_message_;
  }

  if (const auto& reasons = retry_reasons(); !reasons.empty()) {
    tao::json::value reasons_json = tao::json::empty_array;
    for (const auto& reason : reasons) {
      reasons_json.emplace_back(fmt::format("{}", reason));
    }
    json["retry_reasons"] = reasons_json;
  }
  if (const auto& val = last_dispatched_from(); val.has_value()) {
    json["last_dispatched_from"] = val.value();
  }
  if (const auto& val = last_dispatched_to(); val.has_value()) {
    json["last_dispatched_to"] = val.value();
  }

  return tao::json::to_string(json, 2);
}
} // namespace couchbase::core
