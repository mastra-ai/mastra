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

#include <chrono>
#include <cstdint>
#include <ctime>
#include <optional>
#include <string>
#include <variant>

namespace couchbase
{
/**
 * Date range for @ref date_range_facet.
 */
class date_range
{
public:
  date_range(std::string name, std::string start, std::string end);
  date_range(std::string name,
             std::chrono::system_clock::time_point start,
             std::chrono::system_clock::time_point end);
  date_range(std::string name, std::tm start, std::tm end);

  static date_range with_start(std::string name, std::string start);
  static date_range with_start(std::string name, std::chrono::system_clock::time_point start);
  static date_range with_start(std::string name, std::tm start);

  static date_range with_end(std::string name, std::string end);
  static date_range with_end(std::string name, std::chrono::system_clock::time_point end);
  static date_range with_end(std::string name, std::tm end);

  [[nodiscard]] auto name() const -> const std::string&
  {
    return name_;
  }

  [[nodiscard]] auto start() const -> const std::optional<std::string>&
  {
    return start_;
  }

  [[nodiscard]] auto end() const -> const std::optional<std::string>&
  {
    return end_;
  }

private:
  date_range(std::string name, std::optional<std::string> start, std::optional<std::string> end);

  std::string name_;
  std::optional<std::string> start_{};
  std::optional<std::string> end_{};
};
} // namespace couchbase
