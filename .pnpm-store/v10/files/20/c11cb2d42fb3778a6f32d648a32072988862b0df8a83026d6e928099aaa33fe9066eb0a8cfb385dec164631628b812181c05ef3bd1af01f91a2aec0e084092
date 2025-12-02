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

#include <couchbase/match_operator.hxx>
#include <couchbase/search_query.hxx>

#include <chrono>
#include <cstdint>
#include <ctime>
#include <optional>
#include <string>

namespace couchbase
{
/**
 * The date range query finds documents containing a date value in the specified field within the
 * specified range. Either start or end can be omitted, but not both.
 *
 * Match documents where field `review_date` falls within the range ("2001-10-09T10:20:30-08:00",
 * "2016-10-31")
 * @snippet{trimleft} test_unit_search.cxx search-date-range
 *
 * It also works with `std::tm` and `std::chrono::system_clock::time_point`.
 * @snippet{trimleft} test_unit_search.cxx search-date-range-tm
 *
 * @see https://docs.couchbase.com/server/current/fts/fts-supported-queries-date-range.html server
 * documentation.
 *
 * @since 1.0.0
 * @committed
 */
class date_range_query : public search_query
{
public:
  /**
   * Set lower limit and automatically format so that default date_time parser will be able to parse
   * it on the server.
   *
   * @param value  start limit time point
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto start(std::chrono::system_clock::time_point value) -> date_range_query&;

  /**
   * Set lower limit and automatically format so that default date_time parser will be able to parse
   * it on the server.
   *
   * @param value start limit as a `tm` (broken down timestamp)
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto start(std::tm value) -> date_range_query&;

  /**
   * Set lower limit and automatically format so that default date_time parser will be able to parse
   * it on the server.
   *
   * @param value  start limit time point
   * @param inclusive whether to include limit value into the interval.
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto start(std::chrono::system_clock::time_point value, bool inclusive) -> date_range_query&;

  /**
   * Set lower limit and automatically format so that default date_time parser will be able to parse
   * it on the server.
   *
   * @param value start limit as a `tm` (broken down timestamp)
   * @param inclusive whether to include limit value into the interval.
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto start(std::tm value, bool inclusive) -> date_range_query&;

  /**
   * Set preformatted date as lower limit.
   *
   * @param value  start limit formatted as a string, use @ref date_time_parser() for non-standard
   * formats
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto start(std::string value) -> date_range_query&
  {
    start_ = std::move(value);
    return *this;
  }

  /**
   * Set preformatted date as lower limit.
   *
   * @param value  start limit formatted as a string, use @ref date_time_parser() for non-standard
   * formats
   * @param inclusive whether to include limit value into the interval.
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto start(std::string value, bool inclusive) -> date_range_query&
  {
    start_ = std::move(value);
    inclusive_start_ = inclusive;
    return *this;
  }

  /**
   * Set upper limit and automatically format so that default date_time parser will be able to parse
   * it on the server.
   *
   * @param value  end limit time point
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto end(std::chrono::system_clock::time_point value) -> date_range_query&;

  /**
   * Set upper limit and automatically format so that default date_time parser will be able to parse
   * it on the server.
   *
   * @param value end limit as a `tm` (broken down timestamp)
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto end(std::tm value) -> date_range_query&;

  /**
   * Set upper limit and automatically format so that default date_time parser will be able to parse
   * it on the server.
   *
   * @param value  end limit time point
   * @param inclusive whether to include limit value into the interval.
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto end(std::chrono::system_clock::time_point value, bool inclusive) -> date_range_query&;

  /**
   * Set upper limit and automatically format so that default date_time parser will be able to parse
   * it on the server.
   *
   * @param value end limit as a `tm` (broken down timestamp)
   * @param inclusive whether to include limit value into the interval.
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto end(std::tm value, bool inclusive) -> date_range_query&;

  /**
   * Set preformatted date as upper limit.
   *
   * @param value  end limit formatted as a string, use @ref date_time_parser() for non-standard
   * formats
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto end(std::string value)
  {
    end_ = std::move(value);
    return *this;
  }

  /**
   * Set preformatted date as upper limit.
   *
   * @param value  end limit formatted as a string, use @ref date_time_parser() for non-standard
   * formats
   * @param inclusive whether to include limit value into the interval.
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto end(std::string value, bool inclusive) -> date_range_query&
  {
    end_ = std::move(value);
    inclusive_end_ = inclusive;
    return *this;
  }

  /**
   * Enable custom date parser.
   *
   * @param parser_name name of the custom date parser
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto date_time_parser(std::string parser_name) -> date_range_query&
  {
    date_time_parser_ = std::move(parser_name);
    return *this;
  }

  /**
   * If a field is specified, only terms in that field will be matched.
   *
   * @param field_name name of the field to be matched
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto field(std::string field_name) -> date_range_query&
  {
    field_ = std::move(field_name);
    return *this;
  }

  /**
   * @return encoded representation of the query.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto encode() const -> encoded_search_query override;

private:
  std::optional<std::string> start_{};
  std::optional<std::string> end_{};
  std::optional<bool> inclusive_start_{};
  std::optional<bool> inclusive_end_{};
  std::optional<std::string> date_time_parser_{};
  std::optional<std::string> field_{};
};
} // namespace couchbase
