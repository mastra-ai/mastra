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

#pragma once

#include "agent_config.hxx"
#include "core/free_form_http_request.hxx"
#include "core/pending_operation.hxx"
#include "database_management_options.hxx"
#include "error.hxx"
#include "query_options.hxx"

#include <asio/io_context.hpp>
#include <tl/expected.hpp>

#include <memory>
#include <system_error>

namespace couchbase
{
class retry_strategy;
} // namespace couchbase

namespace couchbase::core::columnar
{
class agent_impl;

class agent
{
public:
  explicit agent(asio::io_context& io, agent_config config);

  auto free_form_http_request(const http_request& request,
                              free_form_http_request_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, error_union>;

  auto free_form_http_request_buffered(const http_request& request,
                                       buffered_free_form_http_request_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto execute_query(const query_options& options, query_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, error>;

  auto database_fetch_all(const fetch_all_databases_options& options,
                          fetch_all_databases_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, error>;

  auto database_drop(const drop_database_options& options, drop_database_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, error>;

  auto database_create(const create_database_options& options, create_database_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, error>;

private:
  std::shared_ptr<agent_impl> impl_;
};
} // namespace couchbase::core::columnar
