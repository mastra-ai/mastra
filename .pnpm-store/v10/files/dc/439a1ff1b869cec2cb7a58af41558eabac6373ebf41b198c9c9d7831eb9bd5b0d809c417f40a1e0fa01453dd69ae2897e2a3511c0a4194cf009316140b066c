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

#include <couchbase/connect_link_analytics_options.hxx>
#include <couchbase/create_dataset_analytics_options.hxx>
#include <couchbase/create_dataverse_analytics_options.hxx>
#include <couchbase/create_index_analytics_options.hxx>
#include <couchbase/create_link_analytics_options.hxx>
#include <couchbase/disconnect_link_analytics_options.hxx>
#include <couchbase/drop_dataset_analytics_options.hxx>
#include <couchbase/drop_dataverse_analytics_options.hxx>
#include <couchbase/drop_index_analytics_options.hxx>
#include <couchbase/drop_link_analytics_options.hxx>
#include <couchbase/get_all_datasets_analytics_options.hxx>
#include <couchbase/get_all_indexes_analytics_options.hxx>
#include <couchbase/get_links_analytics_options.hxx>
#include <couchbase/get_pending_mutations_analytics_options.hxx>
#include <couchbase/management/analytics_dataset.hxx>
#include <couchbase/management/analytics_index.hxx>
#include <couchbase/management/analytics_link.hxx>
#include <couchbase/replace_link_analytics_options.hxx>

#include <future>
#include <string>
#include <utility>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
namespace core
{
class cluster;
} // namespace core
class analytics_index_manager_impl;
#endif

class analytics_index_manager
{
public:
  /**
   * Creates a new dataset (analytics scope).
   *
   * @param dataverse_name the name of the dataverse to create
   * @param options optional parameters
   * @param handler the handler that implements @ref create_dataverse_analytics_handler
   *
   * @since 1.0.0
   * @committed
   */
  void create_dataverse(const std::string& dataverse_name,
                        const create_dataverse_analytics_options& options,
                        create_dataverse_analytics_handler&& handler) const;

  /**
   * Creates a new dataset (analytics scope).
   *
   * @param dataverse_name the name of the dataverse to create
   * @param options optional parameters
   * @return future object that carries the result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto create_dataverse(const std::string& dataverse_name,
                                      const create_dataverse_analytics_options& options) const
    -> std::future<error>;

  /**
   * Drops (deletes) a dataverse.
   *
   * @param dataverse_name the name of the dataverse to drop
   * @param options optional parameters
   * @param handler the handler that implements @ref drop_dataverse_analytics_handler
   *
   * @since 1.0.0
   * @committed
   */
  void drop_dataverse(const std::string& dataverse_name,
                      const drop_dataverse_analytics_options& options,
                      drop_dataverse_analytics_handler&& handler) const;

  /**
   * Drops (deletes) a dataverse.
   *
   * @param dataverse_name the name of the dataverse to drop
   * @param options optional parameters
   * @return future object that carries the result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto drop_dataverse(const std::string& dataverse_name,
                                    const drop_dataverse_analytics_options& options) const
    -> std::future<error>;

  /**
   * Creates a new dataset (analytics collection).
   *
   * @param dataset_name the name of the dataset to create
   * @param bucket_name the name of the bucket where the dataset should be stored into
   * @param options optional parameters
   * @param handler the handler that implements @ref create_dataset_analytics_handler
   *
   * @since 1.0.0
   * @committed
   */
  void create_dataset(const std::string& dataset_name,
                      const std::string& bucket_name,
                      const create_dataset_analytics_options& options,
                      create_dataset_analytics_handler&& handler) const;

  /**
   * Creates a new dataset (analytics collection).
   *
   * @param dataset_name the name of the dataset to create
   * @param bucket_name the name of the bucket where the dataset should be stored into
   * @param options optional parameters
   * @return future object that carries the result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto create_dataset(const std::string& dataset_name,
                                    const std::string& bucket_name,
                                    const create_dataset_analytics_options& options) const
    -> std::future<error>;

  /**
   * Drops (deletes) a dataset.
   *
   * @param dataset_name the name of the dataset to drop
   * @param options optional parameters
   * @param handler the handler that implements @ref drop_dataset_analytics_handler
   *
   * @since 1.0.0
   * @committed
   */
  void drop_dataset(const std::string& dataset_name,
                    const drop_dataset_analytics_options& options,
                    drop_dataset_analytics_handler&& handler) const;

  /**
   * Drops (deletes) a dataset.
   *
   * @param dataset_name the name of the dataset to drop
   * @param options optional parameters
   * @return future object that carries the result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto drop_dataset(const std::string& dataset_name,
                                  const drop_dataset_analytics_options& options) const
    -> std::future<error>;

  /**
   * Fetches all datasets (analytics collections) from the analytics service.
   *
   * @param options optional parameters
   * @param handler the handler that implements @ref get_all_datasets_analytics_handler
   *
   * @since 1.0.0
   * @committed
   */
  void get_all_datasets(const get_all_datasets_analytics_options& options,
                        get_all_datasets_analytics_handler&& handler) const;

  /**
   * Fetches all datasets (analytics collections) from the analytics service.
   *
   * @param options optional parameters
   * @return future object that carries the result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto get_all_datasets(const get_all_datasets_analytics_options& options) const
    -> std::future<std::pair<error, std::vector<management::analytics_dataset>>>;

  /**
   * Creates a new analytics index.
   *
   * @param index_name the name of the index to create
   * @param dataset_name the name of the dataset where the index should be created
   * @param fields the fields that should be indexed
   * @param options optional parameters
   * @param handler the handler that implements @ref create_index_analytics_handler
   *
   * @since 1.0.0
   * @committed
   */
  void create_index(const std::string& index_name,
                    const std::string& dataset_name,
                    const std::map<std::string, std::string>& fields,
                    const create_index_analytics_options& options,
                    create_index_analytics_handler&& handler) const;

  /**
   * Creates a new analytics index.
   *
   * @param index_name the name of the index to create
   * @param dataset_name the name of the dataset where the index should be created
   * @param fields the fields that should be indexed
   * @param options optional parameters
   * @return future object that carries the result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto create_index(const std::string& index_name,
                                  const std::string& dataset_name,
                                  const std::map<std::string, std::string>& fields,
                                  const create_index_analytics_options& options) const
    -> std::future<error>;

  /**
   * Drops (removes) an analytics index.
   *
   * @param index_name the name of the index to drop
   * @param dataset_name the dataset where the index exists
   * @param options optional parameters
   * @param handler the handler that implements @ref drop_index_analytics_handler
   *
   * @since 1.0.0
   * @committed
   */
  void drop_index(const std::string& index_name,
                  const std::string& dataset_name,
                  const drop_index_analytics_options& options,
                  drop_index_analytics_handler&& handler) const;

  /**
   * Drops (removes) an analytics index.
   *
   * @param index_name the name of the index to drop
   * @param dataset_name the dataset where the index exists
   * @param options optional parameters
   * @return future object that carries the result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto drop_index(const std::string& index_name,
                                const std::string& dataset_name,
                                const drop_index_analytics_options& options) const
    -> std::future<error>;

  /**
   * Fetches all analytics indexes.
   *
   * @param options optional parameters
   * @param handler the handler that implements @ref get_all_indexes_analytics_handler
   *
   * @since 1.0.0
   * @committed
   */
  void get_all_indexes(const get_all_indexes_analytics_options& options,
                       get_all_indexes_analytics_handler&& handler) const;

  /**
   * Fetches all analytics indexes.
   *
   * @param options optional parameters
   * @return future object that carries the result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto get_all_indexes(const get_all_indexes_analytics_options& options) const
    -> std::future<std::pair<error, std::vector<management::analytics_index>>>;

  /**
   * Connects a not yet connected link.
   *
   * @param options optional parameters
   * @param handler the handler that implements @ref connect_link_analytics_handler
   *
   * @since 1.0.0
   * @committed
   */
  void connect_link(const connect_link_analytics_options& options,
                    connect_link_analytics_handler&& handler) const;

  /**
   * Connects a not yet connected link.
   *
   * @param options optional parameters
   * @return future object that carries the result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto connect_link(const connect_link_analytics_options& options) const
    -> std::future<error>;

  /**
   * Disconnects a currently connected link.
   *
   * @param options optional parameters
   * @param handler the handler that implements @ref disconnect_link_analytics_handler
   *
   * @since 1.0.0
   * @committed
   */
  void disconnect_link(const disconnect_link_analytics_options& options,
                       disconnect_link_analytics_handler&& handler) const;

  /**
   * Disconnects a currently connected link.
   *
   * @param options optional parameters
   * @return future object that carries the result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto disconnect_link(const disconnect_link_analytics_options& options) const
    -> std::future<error>;

  /**
   * Returns the pending mutations for different dataverses.
   *
   * @param options optional parameters
   * @param handler the handler that implements @ref get_pending_mutations_analytics_handler
   *
   * @since 1.0.0
   * @committed
   */
  void get_pending_mutations(const get_pending_mutations_analytics_options& options,
                             get_pending_mutations_analytics_handler&& handler) const;

  /**
   * Returns the pending mutations for different dataverses.
   *
   * @param options optional parameters
   * @return future object that carries the result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto get_pending_mutations(
    const get_pending_mutations_analytics_options& options) const
    -> std::future<std::pair<error, std::map<std::string, std::map<std::string, std::int64_t>>>>;

  /**
   * Creates a new analytics remote link.
   *
   * @param link the settings for the link to be created
   * @param options optional parameters
   * @param handler the handler that implements @ref create_link_analytics_handler
   *
   * @since 1.0.0
   * @committed
   */
  void create_link(const management::analytics_link& link,
                   const create_link_analytics_options& options,
                   create_link_analytics_handler&& handler) const;

  /**
   * Creates a new analytics remote link.
   *
   * @param link the settings for the link to be created
   * @param options optional parameters
   * @return future object that carries the result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto create_link(const management::analytics_link& link,
                                 const create_link_analytics_options& options) const
    -> std::future<error>;

  /**
   * Replaces an existing analytics remote link.
   *
   * @param link the settings for the updated link
   * @param options optional parameters
   * @param handler the handler that implements @ref replace_link_analytics_handler
   *
   * @since 1.0.0
   * @committed
   */
  void replace_link(const management::analytics_link& link,
                    const replace_link_analytics_options& options,
                    replace_link_analytics_handler&& handler) const;

  /**
   * Replaces an existing analytics remote link.
   *
   * @param link the settings for the updated link
   * @param options optional parameters
   * @return future object that carries the result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto replace_link(const management::analytics_link& link,
                                  const replace_link_analytics_options& options) const
    -> std::future<error>;

  /**
   * Drops an existing analytics remote link.
   *
   * @param link_name the name of the link to drop
   * @param dataverse_name the name of the dataverse containing the link to be dropped
   * @param options optional parameters
   * @param handler the handler that implements @ref drop_link_analytics_handler
   *
   * @since 1.0.0
   * @committed
   */
  void drop_link(const std::string& link_name,
                 const std::string& dataverse_name,
                 const drop_link_analytics_options& options,
                 drop_link_analytics_handler&& handler) const;

  /**
   * Drops an existing analytics remote link.
   *
   * @param link_name the name of the link to drop
   * @param dataverse_name the name of the dataverse containing the link to be dropped
   * @param options optional parameters
   * @return future object that carries the result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto drop_link(const std::string& link_name,
                               const std::string& dataverse_name,
                               const drop_link_analytics_options& options) const
    -> std::future<error>;

  /**
   * Fetches the existing analytics remote links.
   *
   * @param options optional parameters
   * @param handler the handler that implemenets @ref get_links_analytics_handler
   *
   * @since 1.0.0
   * @committed
   */
  void get_links(const get_links_analytics_options& options,
                 get_links_analytics_handler&& handler) const;

  /**
   * Fetches the existing analytics remote links.
   *
   * @param options optional parameters
   * @return future object that carries the result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto get_links(const get_links_analytics_options& options) const
    -> std::future<std::pair<error, std::vector<std::unique_ptr<management::analytics_link>>>>;

private:
  friend class cluster;

  explicit analytics_index_manager(core::cluster core);

  std::shared_ptr<analytics_index_manager_impl> impl_;
};

} // namespace couchbase
