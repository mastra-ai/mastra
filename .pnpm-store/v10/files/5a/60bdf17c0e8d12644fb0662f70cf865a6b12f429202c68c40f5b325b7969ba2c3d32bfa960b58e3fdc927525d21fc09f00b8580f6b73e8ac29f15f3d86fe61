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

#include <couchbase/analytics_index_manager.hxx>
#include <couchbase/analytics_options.hxx>
#include <couchbase/bucket.hxx>
#include <couchbase/bucket_manager.hxx>
#include <couchbase/cluster_options.hxx>
#include <couchbase/diagnostics_options.hxx>
#include <couchbase/fork_event.hxx>
#include <couchbase/ping_options.hxx>
#include <couchbase/query_index_manager.hxx>
#include <couchbase/query_options.hxx>
#include <couchbase/search_index_manager.hxx>
#include <couchbase/search_options.hxx>
#include <couchbase/search_query.hxx>
#include <couchbase/search_request.hxx>
#include <couchbase/transactions.hxx>

#include <memory>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
namespace core
{
class cluster;

namespace transactions
{
class transactions;
}
} // namespace core
class cluster_impl;
#endif

/**
 * The {@link cluster} is the main entry point when connecting to a Couchbase cluster.
 *
 * @since 1.0.0
 * @committed
 */
class cluster
{
public:
  /**
   * Connect to a Couchbase cluster.
   *
   * @param connection_string connection string used to locate the Couchbase cluster object.
   * @param options options to customize connection (note, that connection_string takes precedence
   * over this options).
   * @param handler the handler
   *
   * @since 1.0.0
   * @committed
   */
  static void connect(const std::string& connection_string,
                      const cluster_options& options,
                      cluster_connect_handler&& handler);

  /**
   * Connect to a Couchbase cluster.
   *
   * @param connection_string connection string used to locate the Couchbase cluster object.
   * @param options options to customize connection (note, that connection_string takes precedence
   * over this options).
   *
   * @return future object that carries cluster object and operation status
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] static auto connect(const std::string& connection_string,
                                    const cluster_options& options)
    -> std::future<std::pair<error, cluster>>;

  cluster() = default;
  cluster(const cluster& other) = default;
  cluster(cluster&& other) = default;
  ~cluster() = default;
  auto operator=(const cluster& other) -> cluster& = default;
  auto operator=(cluster&& other) -> cluster& = default;

  void notify_fork(fork_event event);

  void close(std::function<void()>&& handler);
  [[nodiscard]] auto close() -> std::future<void>;

  /**
   * Opens a {@link bucket} with the given name.
   *
   * @param bucket_name the name of the bucket to open.
   * @return a {@link bucket} once opened.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto bucket(std::string_view bucket_name) const -> bucket;

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
  [[nodiscard]] auto query(std::string statement, const query_options& options) const
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
   * Performs application-level ping requests against services in the Couchbase cluster.
   *
   * @note This operation performs active I/O against services and endpoints to assess their health.
   * If you do not wish to performs I/O, consider using @ref diagnostics() instead.
   *
   * @param options custom options to change the default behavior.
   * @param handler the handler that implements @ref ping_handler.
   *
   * @since 1.0.0
   * @committed
   */
  void ping(const ping_options& options, ping_handler&& handler) const;

  /**
   * Performs application-level ping requests against services in the Couchbase cluster.
   *
   * @note This operation performs active I/O against services and endpoints to assess their health.
   * If you do not wish to performs I/O, consider using @ref diagnostics() instead.
   *
   * @param options custom options to change the default behavior.
   * @return future object that carries result of the operation.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto ping(const ping_options& options = {}) const
    -> std::future<std::pair<error, ping_result>>;

  /**
   * Assembles a diagnostics report on the current state of the cluster from the SDK's point of
   * view.
   *
   * @note This operation does not perform any I/O to produce the report. It will only use the
   * current known state of the cluster to assemble the report So, if for example, no SQL++ queries
   * have been run, the Query service's socket pool might be empty and as a result not show up in
   * the report. If you wish to actively assess the health of the cluster by performing I/O,
   * consider using @ref ping() instead.
   *
   * @param options custom options to change the default behavior.
   * @param handler the handler that implements @ref diagnostics_handler.
   *
   * @since 1.0.0
   * @committed
   */
  void diagnostics(const diagnostics_options& options, diagnostics_handler&& handler) const;

  /**
   * Assembles a diagnostics report on the current state of the cluster from the SDK's point of
   * view.
   *
   * @note This operation does not perform any I/O to produce the report. It will only use the
   * current known state of the cluster to assemble the report So, if for example, no SQL++ queries
   * have been run, the Query service's socket pool might be empty and as a result not show up in
   * the report. If you wish to actively assess the health of the cluster by performing I/O,
   * consider using @ref ping() instead.
   *
   * @param options custom options to change the default behavior.
   * @return future object that carries result of the operation.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto diagnostics(const diagnostics_options& options = {}) const
    -> std::future<std::pair<error, diagnostics_result>>;

  /**
   * Provides access to the N1QL index management services.
   *
   * @return a manager instance
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto query_indexes() const -> query_index_manager;

  /**
   * Provides access ot the Analytics index management services.
   *
   * @return a manager instance
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto analytics_indexes() const -> analytics_index_manager;

  /**
   * Provides access to the bucket management services.
   *
   * @return a manager instance
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto buckets() const -> bucket_manager;

  /**
   * Provides access to search index management services
   *
   * @return a manager instance
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto search_indexes() const -> search_index_manager;

  /**
   * Provides access to transaction services.
   *
   * See {@link transactions} for details on using the transactions object.
   *
   * @return an {@link transactions} object
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto transactions() const -> std::shared_ptr<couchbase::transactions::transactions>;

private:
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
  friend class cluster_impl;
  explicit cluster(std::shared_ptr<cluster_impl> impl);
#endif

  std::shared_ptr<cluster_impl> impl_{};
};
} // namespace couchbase
