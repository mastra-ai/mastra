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

#include <couchbase/error_context.hxx>

#include <tao/json/value.hpp>

namespace couchbase
{
struct internal_error_context {
  tao::json::value internal_ = tao::json::empty_object;
  tao::json::value internal_metadata_ = tao::json::empty_object;

  explicit operator bool() const;
  [[nodiscard]] auto internal_to_json(error_context_json_format format) const -> std::string;
  [[nodiscard]] auto internal_metadata_to_json(couchbase::error_context_json_format format) const
    -> std::string;

  template<typename T>
  T as() const
  {
    if constexpr (std::is_same_v<T, tao::json::value>) {
      return internal_;
    } else {
      return internal_.as<T>();
    }
  }

  internal_error_context() = default;
  internal_error_context(tao::json::value internal, tao::json::value internal_metadata);

  [[nodiscard]] static auto build_error_context(
    const tao::json::value& internal = tao::json::empty_object,
    const tao::json::value& internal_metadata = tao::json::empty_object)
    -> couchbase::error_context;
};
} // namespace couchbase
