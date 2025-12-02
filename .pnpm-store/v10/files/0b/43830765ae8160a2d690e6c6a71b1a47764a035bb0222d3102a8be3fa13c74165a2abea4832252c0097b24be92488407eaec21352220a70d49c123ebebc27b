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

#include <optional>
#include <string>

namespace couchbase
{
/**
 * The term range query finds documents containing a string value in the specified field within the
 * specified range. Either min or max can be omitted, but not both.
 *
 * Match documents where field `desc` contains terms in the range `("foo", "foof")`:
 * @snippet{trimleft} test_unit_search.cxx search-term-range
 *
 * @see https://docs.couchbase.com/server/current/fts/fts-supported-queries-term-range.html server
 * documentation.
 *
 * @since 1.0.0
 * @committed
 */
class term_range_query : public search_query
{
public:
  /**
   * Set lower limit of the range. Whether to include limit into the range will be decided by server
   * defaults.
   *
   * @param value  lower limit of the range.
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto min(std::string value) -> term_range_query&
  {
    min_ = std::move(value);
    return *this;
  }

  /**
   * Set lower limit and specify whether to include it into the limit.
   *
   * @param value  lower limit of the range.
   * @param inclusive whether to include limit value into the interval.
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto min(std::string value, bool inclusive) -> term_range_query&
  {
    min_ = std::move(value);
    inclusive_min_ = inclusive;
    return *this;
  }

  /**
   * Set upper limit of the range. Whether to include limit into the range will be decided by server
   * defaults.
   *
   * @param value  upper limit of the range
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto max(std::string value) -> term_range_query&
  {
    max_ = std::move(value);
    return *this;
  }

  /**
   * Set upper limit and specify whether to include it into the limit.
   *
   * @param value  upper limit of the range.
   * @param inclusive whether to include limit value into the interval.
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto max(std::string value, bool inclusive) -> term_range_query&
  {
    max_ = std::move(value);
    inclusive_max_ = inclusive;
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
  auto field(std::string field_name) -> term_range_query&
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
  std::optional<std::string> min_{};
  std::optional<std::string> max_{};
  std::optional<bool> inclusive_min_{};
  std::optional<bool> inclusive_max_{};
  std::optional<std::string> field_{};
};
} // namespace couchbase
