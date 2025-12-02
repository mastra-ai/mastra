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

#pragma once

#include <cstddef>

namespace couchbase
{
class compression_options
{
public:
  auto enabled(bool enabled) -> compression_options&
  {
    enabled_ = enabled;
    return *this;
  }

  auto min_size(std::size_t size) -> compression_options&
  {
    min_size_ = size;
    return *this;
  }

  auto min_ratio(double ratio) -> compression_options&
  {
    min_ratio_ = ratio;
    return *this;
  }

  struct built {
    bool enabled;
    std::size_t min_size;
    double min_ratio;
  };

  [[nodiscard]] auto build() const -> built
  {
    return {
      enabled_,
      min_size_,
      min_ratio_,
    };
  }

private:
  bool enabled_{ true };
  std::size_t min_size_{ 32 };
  double min_ratio_{ 0.83 };
};
} // namespace couchbase
