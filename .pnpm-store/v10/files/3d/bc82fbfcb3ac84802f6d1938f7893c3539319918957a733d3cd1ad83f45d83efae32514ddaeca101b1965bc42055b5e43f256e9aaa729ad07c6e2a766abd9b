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

#include <cstdint>
#include <memory>
#include <vector>

namespace couchbase
{
/**
 * The disjunction query is a compound query. The result documents must satisfy a configurable
 * minimal (@ref min) number of child queries. By default this min is set to 1.
 *
 * At execution, a conjunction query that has no child queries is not allowed and will fail fast.
 *
 * Match documents with at least one (see @ref min) of the following conditions is satisfied:
 * * `"location"` in the field `reviews.content`
 * * `true` in the field `free_breakfast`.
 *
 * @snippet{trimleft} test_unit_search.cxx search-disjunction
 *
 * @see https://docs.couchbase.com/server/current/fts/fts-supported-queries-conjuncts-disjuncts.html
 * server documentation
 *
 * @since 1.0.0
 * @committed
 */
class disjunction_query : public search_query
{
public:
  /**
   * Create a disjunction query.
   *
   * @tparam SearchQuery any subclass of @ref search_query
   * @param queries sequence of query arguments
   *
   * @since 1.0.0
   * @committed
   */
  template<typename... SearchQuery>
  explicit disjunction_query(SearchQuery&&... queries)
  {
    or_else(std::forward<SearchQuery>(queries)...);
  }

  /**
   * Add one or more queries to add to the disjunction.
   *
   * @tparam SearchQuery any subclass of @ref search_query
   * @param queries sequence of query arguments
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  template<typename... SearchQuery>
  auto or_else(SearchQuery... queries) -> disjunction_query&
  {
    (disjuncts_.emplace_back(std::make_shared<SearchQuery>(std::move(queries))), ...);
    return *this;
  }

  /**
   * Set the minimum number of child queries that must be satisfied for the disjunction query.
   *
   * @param number_of_queries minimum number of child queries.
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto min(std::uint32_t number_of_queries) -> disjunction_query&
  {
    min_ = number_of_queries;
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
  std::vector<std::shared_ptr<search_query>> disjuncts_{};
  std::uint32_t min_{ 1 };
};
} // namespace couchbase
