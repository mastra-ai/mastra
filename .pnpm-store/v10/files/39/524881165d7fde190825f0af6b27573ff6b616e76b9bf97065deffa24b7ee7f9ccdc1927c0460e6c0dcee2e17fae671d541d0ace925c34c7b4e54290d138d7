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

#include <couchbase/conjunction_query.hxx>
#include <couchbase/disjunction_query.hxx>
#include <couchbase/match_all_query.hxx>
#include <couchbase/match_none_query.hxx>
#include <couchbase/search_query.hxx>

#include <cstdint>
#include <memory>
#include <vector>

namespace couchbase
{
/**
 * The boolean query is a useful combination of conjunction and disjunction queries. A boolean query
 * takes three lists of queries:
 *
 * * **must** - result documents must satisfy all of these queries.
 * * **should** - result documents should satisfy these queries.
 * * **must not** - result documents must not satisfy any of these queries.
 *
 * At execution, a boolean query that has no child queries in any 3 categories is not allowed and
 * will fail fast.
 *
 * The inner representation of child queries in the `must`/`must_not`/`should` sections are
 * respectively a @ref conjunction_query and two
 * @ref disjunction_query.
 *
 * In the example below the following rules enforced by the boolean query:
 * * retrieved documents MUST match `"hostel room"` in their `reviews.content` field AND have `true`
 * in `free_breakfast` field.
 * * also the documents SHOULD have EITHER `reviews.ratings.Overall > 4` OR `reviews.ratings.Service
 * > 5`.
 * * and finally, exclude documents with `city` `"Padfield"` or `"Gilingham"`.
 *
 * @snippet{trimleft} test_unit_search.cxx search-boolean
 *
 * @see https://docs.couchbase.com/server/current/fts/fts-supported-queries-boolean-field-query.html
 * server documentation
 *
 * @since 1.0.0
 * @committed
 */
class boolean_query : public search_query
{
public:
  /**
   * Set @ref conjunction_query that groups all queries the documents **must** satisfy.
   *
   * @param query must-query
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto must(conjunction_query query) -> boolean_query&
  {
    must_ = std::move(query);
    return *this;
  }

  /**
   * Create @ref conjunction_query with given queries and set it as **must** query.
   *
   * @tparam SearchQuery any subclass of @ref search_query
   * @param queries
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  template<typename... SearchQuery>
  auto must(SearchQuery... queries) -> boolean_query&
  {
    must_ = conjunction_query(queries...);
    return *this;
  }

  /**
   * Returns @ref conjunction_query that groups all queries the documents **must** satisfy. Use it
   * to add more queries.
   *
   * @return must-query
   *
   * @since 1.0.0
   * @committed
   */
  auto must() -> conjunction_query&
  {
    if (!must_) {
      must_ = conjunction_query();
    }
    return must_.value();
  }

  /**
   * Set @ref disjunction_query that groups  queries the documents **should** satisfy.
   *
   * @param query should-query
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto should(disjunction_query query) -> boolean_query&
  {
    should_ = std::move(query);
    return *this;
  }

  /**
   * Create @ref disjunction_query with given queries and set it as **should** query.
   *
   * @tparam SearchQuery any subclass of @ref search_query
   * @param queries
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  template<typename... SearchQuery>
  auto should(SearchQuery... queries) -> boolean_query&
  {
    should_ = disjunction_query(queries...);
    return *this;
  }

  /**
   * Returns @ref disjunction_query that groups  queries the documents **should** satisfy. Use it to
   * add more queries or change
   * @ref disjunction_query#min.
   *
   * @return should-query
   *
   * @since 1.0.0
   * @committed
   */
  auto should() -> disjunction_query&
  {
    if (!should_) {
      should_ = disjunction_query();
    }
    return should_.value();
  }

  /**
   * Set @ref disjunction_query that groups queries the documents **must not** satisfy.
   *
   * @param query must_not-query
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto must_not(disjunction_query query) -> boolean_query&
  {
    must_not_ = std::move(query);
    return *this;
  }

  /**
   * Create @ref disjunction_query with given queries and set it as **must not** query.
   *
   * @tparam SearchQuery any subclass of @ref search_query
   * @param queries
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  template<typename... SearchQuery>
  auto must_not(SearchQuery... queries) -> boolean_query&
  {
    must_not_ = disjunction_query(queries...);
    return *this;
  }

  /**
   * Returns @ref disjunction_query that groups  queries the documents **should** satisfy. Use it to
   * add more queries.
   *
   * @return must_not-query
   *
   * @since 1.0.0
   * @committed
   */
  auto must_not() -> disjunction_query&
  {
    if (!must_not_) {
      must_not_ = disjunction_query();
    }
    return must_not_.value();
  }

  /**
   * @return encoded representation of the query.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto encode() const -> encoded_search_query override;

private:
  std::optional<conjunction_query> must_{};
  std::optional<disjunction_query> should_{};
  std::optional<disjunction_query> must_not_{};
};
} // namespace couchbase
