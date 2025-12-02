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

#include "cluster_agent.hxx"

#include "cluster_agent_config.hxx"
#include "core/free_form_http_request.hxx"
#include "core/logger/logger.hxx"
#include "core/pending_operation.hxx"
#include "http_component.hxx"

#include <tl/expected.hpp>

#include <memory>
#include <system_error>
#include <utility>

namespace couchbase::core
{
class cluster_agent_impl
{
public:
  cluster_agent_impl(asio::io_context& io, cluster_agent_config config)
    : io_{ io }
    , config_{ std::move(config) }
    , http_{ io_, config_.shim, config_.default_retry_strategy }
  {
    CB_LOG_DEBUG("creating new cluster agent: {}", config_.to_string());
  }

  auto free_form_http_request(const http_request& request,
                              free_form_http_request_callback&& callback)
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    -> tl::expected<std::shared_ptr<pending_operation>, error_union>
#else
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>
#endif
  {
    return http_.do_http_request(request, std::move(callback));
  }

private:
  asio::io_context& io_;
  const cluster_agent_config config_;
  http_component http_;
};

cluster_agent::cluster_agent(asio::io_context& io, cluster_agent_config config)
  : impl_{ std::make_shared<cluster_agent_impl>(io, std::move(config)) }
{
}

auto
cluster_agent::free_form_http_request(const couchbase::core::http_request& request,
                                      couchbase::core::free_form_http_request_callback&& callback)
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  -> tl::expected<std::shared_ptr<pending_operation>, error_union>
#else
  -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>
#endif
{
  return impl_->free_form_http_request(request, std::move(callback));
}
} // namespace couchbase::core
