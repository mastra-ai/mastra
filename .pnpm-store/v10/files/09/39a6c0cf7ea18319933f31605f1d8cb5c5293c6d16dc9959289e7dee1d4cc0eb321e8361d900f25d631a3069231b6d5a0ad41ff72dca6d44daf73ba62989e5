/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2022-Present Couchbase, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

#pragma once

#include "range_scan_options.hxx"
#include "range_scan_orchestrator_options.hxx"
#include "scan_result.hxx"
#include "topology/configuration.hxx"

#include <tl/expected.hpp>

#include <cstdint>
#include <system_error>

namespace asio
{
class io_context;
} // namespace asio

namespace couchbase::core
{
class agent;
class range_scan_orchestrator_impl;

class scan_stream_manager
{
public:
  virtual ~scan_stream_manager() = default;
  virtual void stream_start_failed_awaiting_retry(std::int16_t node_id,
                                                  std::uint16_t vbucket_id) = 0;
  virtual void stream_received_item(range_scan_item item) = 0;
  virtual void stream_failed(std::int16_t node_id,
                             std::uint16_t vbucket_id,
                             std::error_code ec,
                             bool fatal) = 0;
  virtual void stream_completed(std::int16_t node_id, std::uint16_t vbucket_id) = 0;
};

using scan_callback = utils::movable_function<void(std::error_code, scan_result result)>;

class range_scan_orchestrator
{
public:
  range_scan_orchestrator(
    asio::io_context& io,
    agent kv_provider,
    topology::configuration::vbucket_map vbucket_map,
    std::string scope_name,
    std::string collection_name,
    std::variant<std::monostate, range_scan, prefix_scan, sampling_scan> scan_type,
    range_scan_orchestrator_options options);

  auto scan() -> tl::expected<scan_result, std::error_code>;
  void scan(scan_callback&& cb);

private:
  std::shared_ptr<range_scan_orchestrator_impl> impl_;
};
} // namespace couchbase::core
