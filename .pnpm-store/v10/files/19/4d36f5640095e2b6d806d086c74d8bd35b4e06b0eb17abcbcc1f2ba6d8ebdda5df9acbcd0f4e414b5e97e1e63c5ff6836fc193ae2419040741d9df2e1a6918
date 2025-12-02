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
#include <couchbase/vector_search.hxx>

#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
namespace couchbase
{
namespace core
{
class cluster;
} // namespace core
class search_request_impl;
} // namespace couchbase
#endif

namespace couchbase
{
/**
 * A search_request is used to perform operations against the Full Text Search (FTS) Couchbase
 * service.
 *
 * It can be used to send an FTS @ref search_query, and/or a @ref vector_search
 *
 * @since 1.0.0
 * @committed
 */
class search_request
{
public:
  /**
   * Create a new search_request with a @ref search_query
   *
   * @param search_query the query to run
   *
   * @since 1.0.0
   * @committed
   */
  explicit search_request(const couchbase::search_query& search_query);

  /**
   * Create a new search_request with a @ref vector_search
   *
   * @param vector_search the vector_search to run
   *
   * @since 1.0.0
   * @committed
   */
  explicit search_request(const couchbase::vector_search& vector_search);

  /**
   * Used to run a @ref search_query together with an existing @ref vector_search.
   * Note that a maximum of one SearchQuery and one VectorSearch can be provided.
   *
   * @param search_query the search_query to run with an existing vector_search.
   *
   * @return this search_request for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto search_query(const couchbase::search_query& search_query) -> search_request&;

  /**
   * Used to run a @ref vector_query together with an existing @ref search_query.
   * Note that a maximum of one SearchQuery and one VectorSearch can be provided.
   *
   * @param vector_search the vector_search to be run with an existing search_query.
   *
   * @return this search_request for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto vector_search(const couchbase::vector_search& vector_search) -> search_request&;

  /**
   * @return encoded representation of the query.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] std::optional<encoded_search_query> search_query() const;

  /**
   * @return encoded representation of the vector search query.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] std::optional<encoded_search_query> vector_search() const;

  /**
   * @return vector_search_options, if set
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] std::optional<vector_search_options::built> vector_options();

private:
  std::shared_ptr<search_request_impl> impl_;
};
} // namespace couchbase
