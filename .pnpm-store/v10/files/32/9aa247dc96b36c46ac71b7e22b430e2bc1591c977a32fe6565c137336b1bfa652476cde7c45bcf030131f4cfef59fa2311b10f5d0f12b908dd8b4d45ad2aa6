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

#include "agent.hxx"

#include "agent_config.hxx"
#include "core/free_form_http_request.hxx"
#include "core/http_component.hxx"
#include "core/logger/logger.hxx"
#include "database_management_options.hxx"
#include "management_component.hxx"
#include "query_component.hxx"
#include "query_options.hxx"

#include <asio/io_context.hpp>
#include <system_error>
#include <tl/expected.hpp>

#include <utility>

namespace couchbase::core::columnar
{
class agent_impl
{
public:
  agent_impl(asio::io_context& io, agent_config config)
    : io_{ io }
    , config_{ std::move(config) }
    , http_{ io_, config_.shim }
    , query_{ io_, http_, config_.timeouts.query_timeout }
    , mgmt_{ http_, config_.timeouts.management_timeout }
  {
    CB_LOG_DEBUG("creating new columnar cluster agent: {}", config_.to_string());
  }

  auto free_form_http_request(const http_request& request,
                              free_form_http_request_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, error_union>
  {
    return http_.do_http_request(request, std::move(callback));
  }

  auto free_form_http_request_buffered(const http_request& request,
                                       buffered_free_form_http_request_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>
  {
    return http_.do_http_request_buffered(request, std::move(callback));
  }

  auto execute_query(const query_options& options, query_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, error>
  {
    return query_.execute_query(options, std::move(callback));
  }

  auto database_fetch_all(const fetch_all_databases_options& options,
                          fetch_all_databases_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, error>
  {
    return mgmt_.database_fetch_all(options, std::move(callback));
  }

  auto database_drop(const drop_database_options& options, drop_database_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, error>
  {
    return mgmt_.database_drop(options, std::move(callback));
  }

  auto database_create(const create_database_options& options, create_database_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, error>
  {
    return mgmt_.database_create(options, std::move(callback));
  }

private:
  asio::io_context& io_;
  const agent_config config_;
  http_component http_;
  query_component query_;
  management_component mgmt_;
};

agent::agent(asio::io_context& io, couchbase::core::columnar::agent_config config)
  : impl_{ std::make_shared<agent_impl>(io, std::move(config)) }
{
}

auto
agent::free_form_http_request(const http_request& request,
                              free_form_http_request_callback&& callback)
  -> tl::expected<std::shared_ptr<pending_operation>, error_union>
{
  return impl_->free_form_http_request(request, std::move(callback));
}

auto
agent::free_form_http_request_buffered(
  const couchbase::core::http_request& request,
  couchbase::core::buffered_free_form_http_request_callback&& callback)
  -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>
{
  return impl_->free_form_http_request_buffered(request, std::move(callback));
}

auto
agent::execute_query(const query_options& options, query_callback&& callback)
  -> tl::expected<std::shared_ptr<pending_operation>, error>
{
  return impl_->execute_query(options, std::move(callback));
}

auto
agent::database_fetch_all(const fetch_all_databases_options& options,
                          fetch_all_databases_callback&& callback)
  -> tl::expected<std::shared_ptr<pending_operation>, error>
{
  return impl_->database_fetch_all(options, std::move(callback));
}

auto
agent::database_create(const create_database_options& options, create_database_callback&& callback)
  -> tl::expected<std::shared_ptr<pending_operation>, error>
{
  return impl_->database_create(options, std::move(callback));
}

auto
agent::database_drop(const drop_database_options& options, drop_database_callback&& callback)
  -> tl::expected<std::shared_ptr<pending_operation>, error>
{
  return impl_->database_drop(options, std::move(callback));
}
} // namespace couchbase::core::columnar
