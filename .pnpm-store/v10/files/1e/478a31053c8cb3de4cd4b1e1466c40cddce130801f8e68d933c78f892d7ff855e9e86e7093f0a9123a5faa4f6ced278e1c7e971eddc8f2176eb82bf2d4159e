/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2023-Present Couchbase, Inc.
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

#include <cinttypes>
#include <string>
#include <variant>

namespace couchbase
{
/**
 * @since 1.0.0
 * @committed
 */
class search_numeric_range
{
public:
  search_numeric_range(std::string name,
                       std::variant<std::monostate, std::uint64_t, double> min,
                       std::variant<std::monostate, std::uint64_t, double> max,
                       std::uint64_t count)
    : name_{ std::move(name) }
    , min_{ min }
    , max_{ max }
    , count_{ count }
  {
  }

  [[nodiscard]] auto name() const -> const std::string&
  {
    return name_;
  }

  [[nodiscard]] auto min() const -> const std::variant<std::monostate, std::uint64_t, double>&
  {
    return min_;
  }

  [[nodiscard]] auto max() const -> const std::variant<std::monostate, std::uint64_t, double>&
  {
    return max_;
  }

  [[nodiscard]] auto count() const -> std::uint64_t
  {
    return count_;
  }

private:
  std::string name_;
  std::variant<std::monostate, std::uint64_t, double> min_{};
  std::variant<std::monostate, std::uint64_t, double> max_{};
  std::uint64_t count_;
};
} // namespace couchbase
