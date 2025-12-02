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

#pragma once

#include <couchbase/analytics_options.hxx>
#include <couchbase/collection.hxx>
#include <couchbase/query_options.hxx>
#include <couchbase/scope_search_index_manager.hxx>
#include <couchbase/search_options.hxx>
#include <couchbase/search_query.hxx>
#include <couchbase/search_request.hxx>

#include <memory>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
namespace core
{
class cluster;
} // namespace core
class bucket;
class scope_impl;
#endif

/**
 * The scope identifies a group of collections and allows high application density as a result.
 *
 * @since 1.0.0
 */
class scope
{
public:
  /**
   * Constant for the name of the default scope in the bucket.
   *
   * @since 1.0.0
   * @committed
   */
  static constexpr auto default_name{ "_default" };

  /**
   * Returns name of the bucket where the scope is defined.
   *
   * @return name of the bucket
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto bucket_name() const -> const std::string&;

  /**
   * Returns name of the scope.
   *
   * @return name of the scope
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto name() const -> const std::string&;

  /**
   * Opens a collection for this scope with an explicit name.
   *
   * @param collection_name the collection name.
   * @return the requested collection if successful.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto collection(std::string_view collection_name) const -> collection;

  /**
   * Performs a query against the query (N1QL) services.
   *
   * @param statement the N1QL query statement.
   * @param options options to customize the query request.
   * @param handler the handler that implements @ref query_handler
   *
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  void query(std::string statement, const query_options& options, query_handler&& handler) const;

  /**
   * Performs a query against the query (N1QL) services.
   *
   * @param statement the N1QL query statement.
   * @param options options to customize the query request.
   * @return future object that carries result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto query(std::string statement, const query_options& options = {}) const
    -> std::future<std::pair<error, query_result>>;

  /**
   * Performs a request against the full text search services.
   *
   * This can be used to perform a traditional FTS query, and/or a vector search.
   *
   * @param index_name name of the search index
   * @param request request object, see @ref search_request for more details.
   * @param options options to customize the query request.
   * @param handler the handler that implements @ref search_handler
   *
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @see https://docs.couchbase.com/server/current/fts/fts-introduction.html
   *
   * @since 1.0.0
   * @committed
   */
  void search(std::string index_name,
              search_request request,
              const search_options& options,
              search_handler&& handler) const;

  /**
   * Performs a request against the full text search services.
   *
   * This can be used to perform a traditional FTS query, and/or a vector search.
   *
   * @param index_name name of the search index
   * @param request request object, see @ref search_request for more details.
   * @param options options to customize the query request.
   * @return future object that carries result of the operation
   *
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @see https://docs.couchbase.com/server/current/fts/fts-introduction.html
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto search(std::string index_name,
                            search_request request,
                            const search_options& options = {}) const
    -> std::future<std::pair<error, search_result>>;

  /**
   * Performs a query against the analytics services.
   *
   * @param statement the query statement.
   * @param options options to customize the query request.
   * @param handler the handler that implements @ref query_handler
   *
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @see https://docs.couchbase.com/server/current/analytics/introduction.html
   *
   * @since 1.0.0
   * @committed
   */
  void analytics_query(std::string statement,
                       const analytics_options& options,
                       analytics_handler&& handler) const;

  /**
   * Performs a query against the analytics services.
   *
   * @param statement the query statement.
   * @param options options to customize the query request.
   * @return future object that carries result of the operation
   *
   * @see https://docs.couchbase.com/server/current/analytics/introduction.html
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto analytics_query(std::string statement, const analytics_options& options = {})
    const -> std::future<std::pair<error, analytics_result>>;

  /**
   * Provides access to search index management services at the scope level
   *
   * @return a manager instance
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto search_indexes() const -> scope_search_index_manager;

private:
  friend class bucket;

  scope(core::cluster core,
        std::string_view bucket_name,
        std::string_view name,
        std::shared_ptr<crypto::manager> crypto_manager);

  std::shared_ptr<scope_impl> impl_;
};
} // namespace couchbase
