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

#include "core/error_context/key_value_error_context.hxx"

#include <spdlog/fmt/bundled/core.h>
#include <tao/json/to_string.hpp>

#include "core/fmt/key_value_error_map_attribute.hxx"
#include "core/fmt/key_value_status_code.hxx"

#include <couchbase/fmt/cas.hxx>
#include <couchbase/fmt/retry_reason.hxx>

namespace couchbase::core
{
auto
key_value_error_context::to_json() const -> std::string
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
    { "id", id_ },
    { "bucket", bucket_ },
    { "scope", scope_ },
    { "collection", collection_ },
  };

  if (auto val = retry_attempts(); val > 0) {
    json["retry_attempts"] = val;
  }
  if (opaque_ > 0) {
    json["opaque"] = opaque_;
  }

  if (!cas_.empty()) {
    json["cas"] = fmt::format("{}", cas_);
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
  if (const auto& val = status_code_; val.has_value()) {
    json["status_code"] = fmt::format("{}", val.value());
  }
  if (const auto& val = extended_error_info_; val.has_value()) {
    json["extended_error_info"] = tao::json::value{
      { "context", val->context() },
      { "reference", val->reference() },
    };
  }
  if (const auto& val = error_map_info_; val.has_value()) {
    tao::json::value info{
      { "code", val->code() },
      { "name", val->name() },
      { "description", val->description() },
    };
    if (const auto& attributes = val->attributes(); !attributes.empty()) {
      tao::json::value attrs_json = tao::json::empty_array;
      for (const auto& attr : attributes) {
        attrs_json.emplace_back(fmt::format("{}", attr));
      }
      info["attributes"] = attrs_json;
    }
    json["error_map_info"] = info;
  }

  return tao::json::to_string(json, 2);
}
} // namespace couchbase::core
