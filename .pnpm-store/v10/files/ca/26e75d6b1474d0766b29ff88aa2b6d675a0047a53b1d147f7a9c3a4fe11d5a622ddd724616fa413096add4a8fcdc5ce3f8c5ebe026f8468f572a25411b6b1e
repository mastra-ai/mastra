/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2024. Couchbase, Inc.
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

#include "core/topology/configuration.hxx"

#include <mutex>
#include <queue>

namespace couchbase::core
{
class range_scan_node_state
{
public:
  explicit range_scan_node_state(std::queue<std::uint16_t> vbuckets);

  auto fetch_vbucket_id() -> std::optional<std::uint16_t>;
  void notify_stream_ended();
  void enqueue_vbucket(std::uint16_t vbucket_id);
  auto active_stream_count() -> std::uint16_t;
  auto pending_vbucket_count() -> std::size_t;

private:
  std::uint16_t active_stream_count_{ 0 };
  std::queue<std::uint16_t> pending_vbuckets_{};
  std::mutex mutex_{};
};

class range_scan_load_balancer
{
public:
  explicit range_scan_load_balancer(const topology::configuration::vbucket_map& vbucket_map,
                                    std::optional<std::uint64_t> seed = {});

  void seed(std::uint64_t seed);

  /**
   * Returns the ID of a vbucket that corresponds to the node with the lowest number of active
   * streams. Returns "std::nullopt" if there are no pending vbuckets
   */
  auto select_vbucket() -> std::optional<std::uint16_t>;

  void notify_stream_ended(std::int16_t node_id);
  void enqueue_vbucket(std::int16_t node_id, std::uint16_t vbucket_id);

private:
  std::map<std::int16_t, range_scan_node_state> nodes_{};
  std::mutex select_vbucket_mutex_{};
  std::optional<std::uint64_t> seed_{};
};
} // namespace couchbase::core
