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

#include <cstdint>
#include <memory>
#include <string>
#include <system_error>
#include <variant>

#include <tao/json/value.hpp>

namespace couchbase::core::columnar
{
/**
 * Properties specific to query errors. Will only be set if the error code is
 * columnar::errc::query_error
 */
struct query_error_properties {
  std::int32_t code{};
  std::string server_message{};
};

using error_properties = std::variant<std::monostate, query_error_properties>;

struct error {
  std::error_code ec{};
  std::string message{};
  error_properties properties{};
  tao::json::value ctx = tao::json::empty_object;
  std::shared_ptr<error> cause{};

  explicit operator bool() const;
  [[nodiscard]] auto message_with_ctx() const -> std::string;
};
} // namespace couchbase::core::columnar
