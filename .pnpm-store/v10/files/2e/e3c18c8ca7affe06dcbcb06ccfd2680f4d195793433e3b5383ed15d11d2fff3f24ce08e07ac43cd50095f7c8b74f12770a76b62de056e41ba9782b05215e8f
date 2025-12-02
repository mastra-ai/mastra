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

#include "agent_config.hxx"
#include "analytics_query_options.hxx"
#include "collections_options.hxx"
#include "crud_options.hxx"
#include "diagntostics_options.hxx"
#include "durability_options.hxx"
#include "free_form_http_request.hxx"
#include "n1ql_query_options.hxx"
#include "pending_operation.hxx"
#include "ping_options.hxx"
#include "range_scan_options.hxx"
#include "search_query_options.hxx"
#include "stats_options.hxx"
#include "subdoc_options.hxx"
#include "view_query_options.hxx"
#include "wait_until_ready_options.hxx"

#include <tl/expected.hpp>

#include <memory>

namespace asio
{
class io_context;
} // namespace asio

namespace couchbase::core
{
class agent_impl;
class agent_unit_test_api;

class agent
{
public:
  agent(asio::io_context& io, agent_config config);

  [[nodiscard]] auto bucket_name() const -> const std::string&;

  auto get(const get_options& options, get_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto get_and_touch(const get_and_touch_options& options, get_and_touch_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto get_and_lock(const get_and_lock_options& options, get_and_touch_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto get_one_replica(const get_one_replica_options& options, get_one_replica_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto touch(const touch_options& options, touch_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto unlock(const unlock_options& options, unlock_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto remove(const remove_options& options, remove_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto insert(const insert_options& options, insert_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto upsert(const upsert_options& options, upsert_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto replace(const replace_options& options, replace_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto append(const adjoin_options& options, adjoin_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto prepend(const adjoin_options& options, adjoin_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto increment(const counter_options& options, counter_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto decrement(const counter_options& options, counter_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto get_random(const get_random_options& options, get_random_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto get_with_meta(const get_with_meta_options& options, get_with_meta_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto upsert_with_meta(const upsert_with_meta_options& options,
                        upsert_with_meta_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto remove_with_meta(const remove_with_meta_options& options,
                        remove_with_meta_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto observe(const observe_options& options, observe_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto observe_seqno(const observe_seqno_options& options, observe_seqno_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto lookup_in(const lookup_in_options& options, lookup_in_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto mutate_in(const mutate_in_options& options, mutate_in_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto n1ql_query(const n1ql_query_options& options, n1ql_query_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto prepared_n1ql_query(const n1ql_query_options& options, n1ql_query_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto analytics_query(const analytics_query_options& options, analytics_query_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto search_query(const search_query_options& options, search_query_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto view_query(const view_query_options& options, view_query_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto free_form_http_request(const http_request& request,
                              free_form_http_request_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto stats(const stats_options& options, stats_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto get_collection_id(std::string scope_name,
                         std::string collection_name,
                         const get_collection_id_options& options,
                         get_collection_id_callback callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto wait_until_ready(std::chrono::milliseconds timeout,
                        const wait_until_ready_options& options,
                        wait_until_ready_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto ping(const ping_options& options, ping_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto diagnostics(diagnostics_options options) -> tl::expected<diagnostic_info, std::error_code>;

  auto range_scan_create(std::uint16_t vbucket_id,
                         const range_scan_create_options& options,
                         range_scan_create_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto range_scan_continue(const std::vector<std::byte>& scan_uuid,
                           std::uint16_t vbucket_id,
                           const range_scan_continue_options& options,
                           range_scan_item_callback&& item_callback,
                           range_scan_continue_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto range_scan_cancel(std::vector<std::byte> scan_uuid,
                         std::uint16_t vbucket_id,
                         const range_scan_cancel_options& options,
                         range_scan_cancel_callback&& callback) const
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  /// Integration point for unit testing. Not for public usage.
  [[nodiscard]] auto unit_test_api() -> agent_unit_test_api;

private:
  std::shared_ptr<agent_impl> impl_;
};
} // namespace couchbase::core
