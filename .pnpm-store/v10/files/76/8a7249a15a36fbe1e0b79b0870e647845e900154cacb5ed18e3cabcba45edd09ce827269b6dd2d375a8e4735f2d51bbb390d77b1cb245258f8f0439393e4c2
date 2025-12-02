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

#include <couchbase/date_range_query.hxx>

#include "encoded_search_query.hxx"

#include <couchbase/error_codes.hxx>

#include <spdlog/fmt/bundled/chrono.h>
#include <spdlog/fmt/bundled/core.h>
#include <tao/json/type.hpp>

#include <chrono>
#include <ctime>

namespace couchbase
{

static constexpr const char* iso_8601_format = "{:%Y-%m-%dT%H:%M:%S%z}";

auto
date_range_query::start(std::chrono::system_clock::time_point value) -> date_range_query&
{
  start_ = fmt::format(iso_8601_format, value);
  return *this;
}

auto
date_range_query::start(std::tm value) -> date_range_query&
{
  start_ = fmt::format(iso_8601_format, value);
  return *this;
}

auto
date_range_query::start(std::chrono::system_clock::time_point value,
                        bool inclusive) -> date_range_query&
{
  start_ = fmt::format(iso_8601_format, value);
  inclusive_start_ = inclusive;
  return *this;
}

auto
date_range_query::start(std::tm value, bool inclusive) -> date_range_query&
{
  start_ = fmt::format(iso_8601_format, value);
  inclusive_start_ = inclusive;
  return *this;
}

auto
date_range_query::end(std::chrono::system_clock::time_point value) -> date_range_query&
{

  end_ = fmt::format(iso_8601_format, value);
  return *this;
}

auto
date_range_query::end(std::tm value) -> date_range_query&
{
  end_ = fmt::format(iso_8601_format, value);
  return *this;
}

auto
date_range_query::end(std::chrono::system_clock::time_point value,
                      bool inclusive) -> date_range_query&
{
  end_ = fmt::format(iso_8601_format, value);
  inclusive_end_ = inclusive;
  return *this;
}

auto
date_range_query::end(std::tm value, bool inclusive) -> date_range_query&
{
  end_ = fmt::format(iso_8601_format, value);
  inclusive_end_ = inclusive;
  return *this;
}

auto
date_range_query::encode() const -> encoded_search_query
{
  if ((!start_ || start_->empty()) && (!end_ || end_->empty())) {
    return { errc::common::invalid_argument };
  }

  encoded_search_query built;
  built.query = tao::json::empty_object;
  if (boost_) {
    built.query["boost"] = boost_.value();
  }
  if (field_) {
    built.query["field"] = field_.value();
  }
  if (start_) {
    built.query["start"] = start_.value();
    if (inclusive_start_.has_value()) {
      built.query["inclusive_start"] = inclusive_start_.value();
    }
  }
  if (end_) {
    built.query["end"] = end_.value();
    if (inclusive_end_.has_value()) {
      built.query["inclusive_end"] = inclusive_end_.value();
    }
  }
  if (date_time_parser_) {
    built.query["datetime_parser"] = date_time_parser_.value();
  }

  return built;
}
} // namespace couchbase
