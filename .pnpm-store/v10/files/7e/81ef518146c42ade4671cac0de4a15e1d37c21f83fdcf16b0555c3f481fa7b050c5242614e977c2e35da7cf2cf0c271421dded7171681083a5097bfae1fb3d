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

#include <couchbase/search_query.hxx>

#include <string>

namespace couchbase
{
/**
 * The query string query allows humans to describe complex queries using a simple syntax.
 *
 * 1. When you specify multiple query-clauses, you can specify the relative importance to a given
 * clause by suffixing it with the `^` operator, followed by a number or by specifying the boost
 * parameter with the number to boost the search. For example perform
 * @ref match_query for pool in both the name and description fields, but documents having the term
 * in the name field score higher.
 * @snippet{trimleft} test_unit_search.cxx search-query-string-boosting
 *
 * 2. You can perform date or numeric range searches by using the `>`, `>=`, `<`, and `<=`
 * operators, followed by a date value in quotes. For example, perform a @ref date_range_query on
 * the created field for values after September 21, 2016.
 * @snippet{trimleft} test_unit_search.cxx search-query-string-date-range
 * Or, perform a @ref numeric_range_query  on the `reviews.ratings.Cleanliness` field, for values
 * greater than 4.
 * @snippet{trimleft} test_unit_search.cxx search-query-string-numeric-range
 *
 * @see https://docs.couchbase.com/server/current/fts/fts-query-string-syntax.html definition of
 * query syntax
 *
 * @since 1.0.0
 * @committed
 */
class query_string_query : public search_query
{
public:
  /**
   * Create a new query string query.
   *
   * @param query the query string to be analyzed and used against
   *
   * @since 1.0.0
   * @committed
   */
  explicit query_string_query(std::string query)
    : query_{ std::move(query) }
  {
  }

  /**
   * @return encoded representation of the query.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto encode() const -> encoded_search_query override;

private:
  std::string query_;
};
} // namespace couchbase
