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

#include <couchbase/create_collection_options.hxx>
#include <couchbase/create_scope_options.hxx>
#include <couchbase/drop_collection_options.hxx>
#include <couchbase/drop_scope_options.hxx>
#include <couchbase/get_all_scopes_options.hxx>
#include <couchbase/management/collection_spec.hxx>
#include <couchbase/update_collection_options.hxx>

#include <future>
#include <memory>

#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
namespace couchbase
{
namespace core
{
class cluster;
} // namespace core
class collection_manager_impl;
} // namespace couchbase
#endif

namespace couchbase
{
class bucket;

class collection_manager
{
public:
  /**
   * Get all scopes on the bucket
   *
   * @param options optional parameters
   * @param handler handler that implements @ref get_all_scopes_handler
   *
   * @since 1.0.0
   */
  void get_all_scopes(const get_all_scopes_options& options,
                      get_all_scopes_handler&& handler) const;

  [[nodiscard]] auto get_all_scopes(const get_all_scopes_options& options = {}) const
    -> std::future<std::pair<error, std::vector<management::bucket::scope_spec>>>;

  /**
   * Creates a new collection
   *
   * @param scope_name the name of the scope to create the collection on
   * @param collection_name the collection name
   * @param settings create collection settings
   * @param options optional parameters
   * @param handler handler that implements @ref create_collection_handler
   *
   * @since 1.0.0
   */
  void create_collection(std::string scope_name,
                         std::string collection_name,
                         const create_collection_settings& settings,
                         const create_collection_options& options,
                         create_collection_handler&& handler) const;

  [[nodiscard]] auto create_collection(std::string scope_name,
                                       std::string collection_name,
                                       const create_collection_settings& settings = {},
                                       const create_collection_options& options = {}) const
    -> std::future<error>;
  /**
   * Updates an existing collection
   *
   * @param scope_name the name of the scope on which the collection exists
   * @param collection_name the collection name
   * @param settings update collection settings
   * @param options optional parameters
   * @param handler handler that implements @ref update_collection_handler
   *
   * @since 1.0.0
   */
  void update_collection(std::string scope_name,
                         std::string collection_name,
                         const update_collection_settings& settings,
                         const update_collection_options& options,
                         update_collection_handler&& handler) const;

  [[nodiscard]] auto update_collection(std::string scope_name,
                                       std::string collection_name,
                                       const update_collection_settings& settings,
                                       const update_collection_options& options = {}) const
    -> std::future<error>;

  /**
   * Drops a collection
   *
   * @param scope_name the name of the scope on which the collection exists
   * @param collection_name the collection name
   * @param options optional parameters
   * @param handler handler that implements @ref drop_collection_handler
   *
   * @since 1.0.0
   */
  void drop_collection(std::string scope_name,
                       std::string collection_name,
                       const drop_collection_options& options,
                       drop_collection_handler&& handler) const;

  [[nodiscard]] auto drop_collection(std::string scope_name,
                                     std::string collection_name,
                                     const drop_collection_options& options = {}) const
    -> std::future<error>;

  /**
   * Creates a scope on the bucket
   *
   * @param scope_name the scope name
   * @param options optional parameters
   * @param handler handler that implements @ref create_scope_handler
   *
   * @since 1.0.0
   */
  void create_scope(std::string scope_name,
                    const create_scope_options& options,
                    create_scope_handler&& handler) const;

  [[nodiscard]] auto create_scope(std::string scope_name, const create_scope_options& options = {})
    const -> std::future<error>;

  /**
   * Drops a scope on the bucket
   *
   * @param scope_name the scope name
   * @param options optional parameters
   * @param handler handler that implements @ref drop_scope_handler
   *
   * @since 1.0.0
   */
  void drop_scope(std::string scope_name,
                  const drop_scope_options& options,
                  drop_scope_handler&& handler) const;

  [[nodiscard]] auto drop_scope(std::string scope_name,
                                const drop_scope_options& options = {}) const -> std::future<error>;

private:
  friend class bucket;

  collection_manager(core::cluster core, std::string_view bucket_name);

  std::shared_ptr<collection_manager_impl> impl_;
};
} // namespace couchbase
