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

#include <couchbase/create_bucket_options.hxx>
#include <couchbase/drop_bucket_options.hxx>
#include <couchbase/error.hxx>
#include <couchbase/flush_bucket_options.hxx>
#include <couchbase/get_all_buckets_options.hxx>
#include <couchbase/get_bucket_options.hxx>
#include <couchbase/update_bucket_options.hxx>

#include <future>
#include <memory>

#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
namespace couchbase
{
namespace core
{
class cluster;
} // namespace core
class bucket_manager_impl;
} // namespace couchbase
#endif

namespace couchbase
{
class cluster;

class bucket_manager
{
public:
  /**
   * Get specific bucket within the cluster
   *
   * @param bucket_name the name of the bucket to get
   * @param options optional parameters
   * @param handler  handler that implements @ref get_bucket_handler
   *
   * @since 1.0.0
   * @committed
   */
  void get_bucket(std::string bucket_name,
                  const get_bucket_options& options,
                  get_bucket_handler&& handler) const;

  [[nodiscard]] auto get_bucket(std::string bucket_name, const get_bucket_options& options = {})
    const -> std::future<std::pair<error, management::cluster::bucket_settings>>;

  /**
   * Get all buckets on the cluster
   *
   * @param options optional parameters
   * @param handler handler that implements @ref get_all_buckets_handler
   *
   * @since 1.0.0
   * @committed
   */
  void get_all_buckets(const get_all_buckets_options& options,
                       get_all_buckets_handler&& handler) const;

  [[nodiscard]] auto get_all_buckets(const get_all_buckets_options& options = {}) const
    -> std::future<std::pair<error, std::vector<management::cluster::bucket_settings>>>;

  /**
   * Create a bucket on the cluster
   *
   * @param bucket_settings the settings for the bucket
   * @param options optional parameters
   * @param handler handler that implements @ref create_bucket_handler
   */
  void create_bucket(const management::cluster::bucket_settings& bucket_settings,
                     const create_bucket_options& options,
                     create_bucket_handler&& handler) const;

  [[nodiscard]] auto create_bucket(const management::cluster::bucket_settings& bucket_settings,
                                   const create_bucket_options& options = {}) const
    -> std::future<error>;

  /**
   * Update an existing bucket
   *
   * @param bucket_settings the settings for the bucket
   * @param options optional parameters
   * @param handler handler that implements @ref update_bucket_handler
   */
  void update_bucket(const management::cluster::bucket_settings& bucket_settings,
                     const update_bucket_options& options,
                     update_bucket_handler&& handler) const;

  [[nodiscard]] auto update_bucket(const management::cluster::bucket_settings& bucket_settings,
                                   const update_bucket_options& options = {}) const
    -> std::future<error>;

  /**
   * Drop an existing bucket
   *
   * @param bucket_name the name of the bucket to drop
   * @param options optional parameters
   * @param handler handler that implements @ref drop_bucket_handler
   */
  void drop_bucket(std::string bucket_name,
                   const drop_bucket_options& options,
                   drop_bucket_handler&& handler) const;

  [[nodiscard]] auto drop_bucket(std::string bucket_name, const drop_bucket_options& options = {})
    const -> std::future<error>;

  /**
   * Flush an existing bucket
   *
   * @param bucket_name the name of the bucket to flush
   * @param options optional parameters
   * @param handler handler that implements @ref flush_bucket_handler
   */
  void flush_bucket(std::string bucket_name,
                    const flush_bucket_options& options,
                    flush_bucket_handler&& handler) const;

  [[nodiscard]] auto flush_bucket(std::string bucket_name, const flush_bucket_options& options = {})
    const -> std::future<error>;

private:
  friend class cluster;

  explicit bucket_manager(core::cluster core);

  std::shared_ptr<bucket_manager_impl> impl_;
};
} // namespace couchbase
