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

#include <couchbase/vector_query.hxx>
#include <couchbase/vector_search_options.hxx>

namespace couchbase
{
/**
 * A vector_search allows one or more @ref vector_query to be executed.
 *
 * @since 1.0.0
 * @committed
 */
class vector_search
{
public:
  /**
   * Will execute all of the provided vector_queries, using the specified options
   *
   * @param vector_queries vector queries to be run
   * @param options options to use on the vector queries
   *
   * @since 1.0.0
   * @committed
   */
  explicit vector_search(std::vector<vector_query> vector_queries,
                         vector_search_options options = {})
    : vector_queries_{ std::move(vector_queries) }
    , options_{ options.build() }
  {
    if (vector_queries_.empty()) {
      throw std::invalid_argument("At least one vector query must be specified");
    }
  }

  /**
   * Will execute a single vector_query, using default options
   *
   * @param query the query to be run
   *
   * @since 1.0.0
   * @committed
   */
  explicit vector_search(vector_query query)
    : vector_queries_{ std::vector<vector_query>{ std::move(query) } }
  {
  }

  /**
   * Fetches the vector_search_options
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] vector_search_options::built options() const
  {
    return options_;
  }

  /**
   * @return encoded representation of the vector_search.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto encode() const -> encoded_search_query;

private:
  std::vector<vector_query> vector_queries_;
  vector_search_options::built options_{};
};
} // namespace couchbase
