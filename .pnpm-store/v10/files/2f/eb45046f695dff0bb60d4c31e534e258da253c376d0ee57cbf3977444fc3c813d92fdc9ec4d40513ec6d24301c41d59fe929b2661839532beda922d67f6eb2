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

#include "range_scan_load_balancer.hxx"

#include <algorithm>
#include <gsl/util>
#include <limits>
#include <map>
#include <numeric>
#include <queue>
#include <random>
#include <vector>

namespace couchbase::core
{
range_scan_node_state::range_scan_node_state(std::queue<std::uint16_t> vbuckets)
  : pending_vbuckets_{ std::move(vbuckets) }
{
}

auto
range_scan_node_state::fetch_vbucket_id() -> std::optional<std::uint16_t>
{
  const std::lock_guard<std::mutex> lock{ mutex_ };
  if (pending_vbuckets_.empty()) {
    return {};
  }
  active_stream_count_++;
  auto vbucket_id = pending_vbuckets_.front();
  pending_vbuckets_.pop();
  return vbucket_id;
}

void
range_scan_node_state::notify_stream_ended()
{
  const std::lock_guard<std::mutex> lock{ mutex_ };
  active_stream_count_--;
}

void
range_scan_node_state::enqueue_vbucket(std::uint16_t vbucket_id)
{
  const std::lock_guard<std::mutex> lock{ mutex_ };
  pending_vbuckets_.push(vbucket_id);
}

auto
range_scan_node_state::active_stream_count() -> std::uint16_t
{
  const std::lock_guard<std::mutex> lock{ mutex_ };
  return active_stream_count_;
}

auto
range_scan_node_state::pending_vbucket_count() -> std::size_t
{
  const std::lock_guard<std::mutex> lock{ mutex_ };
  return pending_vbuckets_.size();
}

range_scan_load_balancer::range_scan_load_balancer(
  const topology::configuration::vbucket_map& vbucket_map,
  std::optional<std::uint64_t> seed)
  : seed_{ seed }
{
  std::map<std::int16_t, std::queue<std::uint16_t>> node_to_vbucket_map{};
  for (std::size_t vbucket_id = 0; vbucket_id < vbucket_map.size(); vbucket_id++) {
    auto node_id = vbucket_map[vbucket_id][0];
    node_to_vbucket_map[node_id].push(gsl::narrow_cast<std::uint16_t>(vbucket_id));
  }
  for (auto [node_id, vbucket_ids] : node_to_vbucket_map) {
    nodes_.emplace(node_id, std::move(vbucket_ids));
  }
}

void
range_scan_load_balancer::seed(std::uint64_t seed)
{
  seed_ = seed;
}

auto
range_scan_load_balancer::select_vbucket() -> std::optional<std::uint16_t>
{
  const std::lock_guard<std::mutex> lock{ select_vbucket_mutex_ };

  auto min_stream_count = std::numeric_limits<std::uint16_t>::max();
  std::optional<std::int16_t> selected_node_id{};

  std::vector<std::map<int16_t, range_scan_node_state>::iterator> iterators{ nodes_.size() };

  std::iota(iterators.begin(), iterators.end(), nodes_.begin());
  std::mt19937_64 gen{ std::random_device{}() };
  if (seed_.has_value()) {
    gen.seed(seed_.value());
  }
  std::shuffle(iterators.begin(), iterators.end(), gen);

  for (auto it : iterators) {
    auto& [node_id, node_status] = *it; // cppcheck-suppress variableScope
    auto stream_count = node_status.active_stream_count();

    if (stream_count < min_stream_count && node_status.pending_vbucket_count() > 0) {
      min_stream_count = stream_count;
      selected_node_id = node_id;
    }
  }

  if (!selected_node_id) {
    return {};
  }

  return nodes_.at(selected_node_id.value()).fetch_vbucket_id();
}

void
range_scan_load_balancer::notify_stream_ended(std::int16_t node_id)
{
  nodes_.at(node_id).notify_stream_ended();
}

void
range_scan_load_balancer::enqueue_vbucket(std::int16_t node_id, std::uint16_t vbucket_id)
{
  nodes_.at(node_id).enqueue_vbucket(vbucket_id);
}
} // namespace couchbase::core
