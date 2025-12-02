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

#include <couchbase/date_range.hxx>

#include <spdlog/fmt/bundled/chrono.h>
#include <spdlog/fmt/bundled/core.h>

#include <chrono>
#include <ctime>
#include <optional>
#include <string>
#include <utility>

namespace couchbase
{
static constexpr const char* iso_8601_format = "{:%Y-%m-%dT%H:%M:%S%z}";

date_range::date_range(std::string name, std::string start, std::string end)
  : name_{ std::move(name) }
  , start_{ std::move(start) }
  , end_{ std::move(end) }
{
}

date_range::date_range(std::string name,
                       std::chrono::system_clock::time_point start,
                       std::chrono::system_clock::time_point end)
  : name_{ std::move(name) }
  , start_{ fmt::format(iso_8601_format, start) }
  , end_{ fmt::format(iso_8601_format, end) }
{
}

date_range::date_range(std::string name, std::tm start, std::tm end)
  : name_{ std::move(name) }
  , start_{ fmt::format(iso_8601_format, start) }
  , end_{ fmt::format(iso_8601_format, end) }
{
}

date_range::date_range(std::string name,
                       std::optional<std::string> start,
                       std::optional<std::string> end)
  : name_{ std::move(name) }
  , start_{ std::move(start) }
  , end_{ std::move(end) }
{
}

auto
date_range::with_start(std::string name, std::string start) -> date_range
{
  return { std::move(name), std::move(start), {} };
}

auto
date_range::with_start(std::string name, std::chrono::system_clock::time_point start) -> date_range
{
  return { std::move(name), fmt::format(iso_8601_format, start), {} };
}

auto
date_range::with_start(std::string name, std::tm start) -> date_range
{
  return { std::move(name), fmt::format(iso_8601_format, start), {} };
}

auto
date_range::with_end(std::string name, std::string end) -> date_range
{
  return { std::move(name), {}, std::move(end) };
}

auto
date_range::with_end(std::string name, std::chrono::system_clock::time_point end) -> date_range
{
  return { std::move(name), {}, fmt::format(iso_8601_format, end) };
}

auto
date_range::with_end(std::string name, std::tm end) -> date_range
{
  return { std::move(name), {}, fmt::format(iso_8601_format, end) };
}
} // namespace couchbase
