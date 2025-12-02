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

#include "cluster_agent_config.hxx"
#include "free_form_http_request.hxx"
#include "pending_operation.hxx"

#include <tl/expected.hpp>

#include <memory>
#include <system_error>

namespace asio
{
class io_context;
} // namespace asio

namespace couchbase::core
{
class cluster_agent_impl;

class cluster_agent
{
public:
  explicit cluster_agent(asio::io_context& io, cluster_agent_config config);

  auto free_form_http_request(const http_request& request,
                              free_form_http_request_callback&& callback)
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    -> tl::expected<std::shared_ptr<pending_operation>, error_union>;
#else
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;
#endif

private:
  std::shared_ptr<cluster_agent_impl> impl_;
};
} // namespace couchbase::core
