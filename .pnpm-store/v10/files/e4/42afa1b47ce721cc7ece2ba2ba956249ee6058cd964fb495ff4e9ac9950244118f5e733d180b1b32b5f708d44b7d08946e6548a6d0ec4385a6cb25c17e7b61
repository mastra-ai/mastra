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

#include <couchbase/numeric_range.hxx>

#include <spdlog/fmt/bundled/chrono.h>

namespace couchbase
{
numeric_range::numeric_range(std::string name, double min, double max)
  : name_{ std::move(name) }
  , min_{ min }
  , max_{ max }
{
}

numeric_range::numeric_range(std::string name, std::optional<double> min, std::optional<double> max)
  : name_{ std::move(name) }
  , min_{ min }
  , max_{ max }
{
}

auto
numeric_range::with_min(std::string name, double start) -> numeric_range
{
  return { std::move(name), start, {} };
}

auto
numeric_range::with_max(std::string name, double end) -> numeric_range
{
  return { std::move(name), {}, end };
}
} // namespace couchbase
