/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2021 Couchbase, Inc.
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

#include <string>
#include <variant>
#include <vector>

namespace couchbase::core
{
struct json_string {
  json_string() = default;

  json_string(std::string&& value)
    : value_(std::move(value))
  {
  }

  json_string& operator=(std::string&& value)
  {
    value_ = std::move(value);
    return *this;
  }

  json_string(const std::vector<std::byte>& value)
    : value_(value)
  {
  }

  json_string(std::vector<std::byte>&& value)
    : value_(std::move(value))
  {
  }

  json_string& operator=(std::vector<std::byte>&& value)
  {
    value_ = std::move(value);
    return *this;
  }

  [[nodiscard]] auto is_string() const -> bool
  {
    return std::holds_alternative<std::string>(value_);
  }

  [[nodiscard]] auto is_binary() const -> bool
  {
    return std::holds_alternative<std::vector<std::byte>>(value_);
  }

  [[nodiscard]] const std::string& str() const
  {
    if (is_string()) {
      return std::get<std::string>(value_);
    }
    static std::string empty_string{};
    return empty_string;
  }

  [[nodiscard]] const std::vector<std::byte>& bytes() const
  {
    if (is_binary()) {
      return std::get<std::vector<std::byte>>(value_);
    }
    static std::vector<std::byte> empty_bytes{};
    return empty_bytes;
  }

private:
  std::variant<std::nullptr_t, std::string, std::vector<std::byte>> value_{ nullptr };
};
} // namespace couchbase::core
