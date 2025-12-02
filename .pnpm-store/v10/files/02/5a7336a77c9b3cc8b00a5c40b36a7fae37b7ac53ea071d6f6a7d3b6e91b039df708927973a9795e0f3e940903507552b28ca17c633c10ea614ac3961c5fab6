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

#include <cstdint>
#include <optional>
#include <string>

namespace couchbase
{
/**
 * Numeric range for @ref numeric_range_facet.
 */
class numeric_range
{
public:
  numeric_range(std::string name, double min, double max);
  static numeric_range with_min(std::string name, double start);
  static numeric_range with_max(std::string name, double end);

  [[nodiscard]] auto name() const -> const std::string&
  {
    return name_;
  }

  [[nodiscard]] auto min() const -> const std::optional<double>&
  {
    return min_;
  }

  [[nodiscard]] auto max() const -> const std::optional<double>&
  {
    return max_;
  }

private:
  numeric_range(std::string name, std::optional<double> min, std::optional<double> max);

  std::string name_;
  std::optional<double> min_{};
  std::optional<double> max_{};
};
} // namespace couchbase
