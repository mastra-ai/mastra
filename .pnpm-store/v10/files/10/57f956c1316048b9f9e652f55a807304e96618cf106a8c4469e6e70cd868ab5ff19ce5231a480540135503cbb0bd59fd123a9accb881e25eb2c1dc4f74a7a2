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

#include <couchbase/build_query_index_options.hxx>
#include <couchbase/create_primary_query_index_options.hxx>
#include <couchbase/create_query_index_options.hxx>
#include <couchbase/drop_primary_query_index_options.hxx>
#include <couchbase/drop_query_index_options.hxx>
#include <couchbase/get_all_query_indexes_options.hxx>
#include <couchbase/management/query_index.hxx>
#include <couchbase/watch_query_indexes_options.hxx>

#include <future>
#include <memory>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
namespace core
{
class cluster;
} // namespace core
class query_index_manager_impl;
#endif

/**
 * The Query Index Manager interface contains the means for managing indexes used for queries.
 *
 * @since 1.0.0
 * @committed
 */
class query_index_manager
{
public:
  /**
   * Get all indexes within a bucket.
   *
   * @param bucket_name specifies the bucket in which we look for the indexes
   * @param options optional parameters
   * @param handler the handler that implements @ref get_all_query_indexes_handler
   *
   * @since 1.0.0
   * @committed
   */
  void get_all_indexes(const std::string& bucket_name,
                       const get_all_query_indexes_options& options,
                       get_all_query_indexes_handler&& handler) const;

  /**
   * Get all indexes within a bucket.
   *
   * @param bucket_name specifies the bucket in which we look for the indexes
   * @param options optional parameters
   * @return future object that carries result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto get_all_indexes(const std::string& bucket_name,
                                     const get_all_query_indexes_options& options) const
    -> std::future<std::pair<error, std::vector<management::query_index>>>;

  /**
   * Create an index on a bucket.
   *
   * @param bucket_name specifies the bucket in which to create the index
   * @param index_name name of the index
   * @param keys the keys to create the index over
   * @param options optional parameters
   * @param handler the handler that implements @ref create_query_index_handler
   *
   * @since 1.0.0
   * @committed
   */
  void create_index(const std::string& bucket_name,
                    std::string index_name,
                    std::vector<std::string> keys,
                    const create_query_index_options& options,
                    create_query_index_handler&& handler) const;

  /**
   * Create an index on a bucket.
   *
   * @param bucket_name specifies the bucket in which to create the index
   * @param index_name name of the index
   * @param keys the keys to create the index over
   * @param options optional parameters
   * @return future object that carries result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto create_index(const std::string& bucket_name,
                                  std::string index_name,
                                  std::vector<std::string> keys,
                                  const create_query_index_options& options) const
    -> std::future<error>;

  /**
   * Create a primary index on a bucket.
   *
   * @param bucket_name specifies the bucket in which to create the index
   * @param options optional parameters
   * @param handler the handler that implements @ref create_query_index_handler
   *
   * @since 1.0.0
   * @committed
   */
  void create_primary_index(const std::string& bucket_name,
                            const create_primary_query_index_options& options,
                            create_primary_query_index_handler&& handler) const;

  /**
   * Create a primary index on a bucket.
   *
   * @param bucket_name specifies the bucket in which to create the index
   * @param options optional parameters
   * @return future object that carries result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto create_primary_index(const std::string& bucket_name,
                                          const create_primary_query_index_options& options) const
    -> std::future<error>;

  /**
   * Drop primary index on a bucket.
   *
   * @param bucket_name name of the bucket in which to drop the primary index
   * @param options optional parameters
   * @param handler the handler that implements @ref drop_query_index_handler
   *
   * @since 1.0.0
   * @committed
   */
  void drop_primary_index(const std::string& bucket_name,
                          const drop_primary_query_index_options& options,
                          drop_primary_query_index_handler&& handler) const;

  /**
   * Drop primary index on a bucket.
   *
   * @param bucket_name name of the bucket in which to drop the primary index
   * @param options optional parameters
   * @return future object that carries result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto drop_primary_index(const std::string& bucket_name,
                                        const drop_primary_query_index_options& options) const
    -> std::future<error>;

  /**
   * Drop specified query index.
   *
   * @param bucket_name name of the bucket in which to drop the index
   * @param index_name name of the index to drop
   * @param options optional parameters
   * @param handler handler that implements @ref drop_query_index_handler
   *
   * @since 1.0.0
   * @committed
   */
  void drop_index(const std::string& bucket_name,
                  std::string index_name,
                  const drop_query_index_options& options,
                  drop_query_index_handler&& handler) const;

  /**
   * Drop specified query index.
   *
   * @param bucket_name name of the bucket in which to drop the index
   * @param index_name name of the index to drop
   * @param options optional parameters
   * @return future object that carries result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto drop_index(const std::string& bucket_name,
                                std::string index_name,
                                const drop_query_index_options& options) const
    -> std::future<error>;

  /**
   * Builds all currently deferred indexes.
   *
   * By default, this method will build the indexes on the bucket.
   *
   * @param bucket_name name of the bucket
   * @param options optional parameters
   * @param handler the handler that implements @ref build_deferred_query_indexes_handler
   *
   * @since 1.0.0
   * @committed
   */
  void build_deferred_indexes(const std::string& bucket_name,
                              const build_query_index_options& options,
                              build_deferred_query_indexes_handler&& handler) const;

  /**
   * Builds all currently deferred indexes.
   *
   * By default, this method will build the indexes on the bucket.
   *
   * @param bucket_name name of the bucket
   * @param options optional parameters
   * @return future object that carries result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto build_deferred_indexes(const std::string& bucket_name,
                                            const build_query_index_options& options) const
    -> std::future<error>;

  /**
   * Polls the state of a set of indexes, until they all are online.
   *
   * @param bucket_name name of the bucket in which to look for the indexes
   * @param index_names names of the indexes to watch
   * @param options optional parameters
   * @param handler handler that implements @ref watch_query_indexes_handler
   *
   * @since 1.0.0
   * @committed
   */
  void watch_indexes(const std::string& bucket_name,
                     std::vector<std::string> index_names,
                     const watch_query_indexes_options& options,
                     watch_query_indexes_handler&& handler) const;

  /**
   * Polls the state of a set of indexes, until they all are online.
   *
   * @param bucket_name name of the bucket in which to look for the indexes
   * @param index_names names of the indexes to watch
   * @param options optional parameters
   * @return future object that carries result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto watch_indexes(const std::string& bucket_name,
                                   std::vector<std::string> index_names,
                                   const watch_query_indexes_options& options) const
    -> std::future<error>;

private:
  friend class cluster;

  explicit query_index_manager(core::cluster core);

  std::shared_ptr<query_index_manager_impl> impl_;
};
} // namespace couchbase
