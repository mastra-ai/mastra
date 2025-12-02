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

#include "core_sdk_shim.hxx"
#include "free_form_http_request.hxx"
#include "pending_operation.hxx"

#include <tl/expected.hpp>

#include <memory>
#include <system_error>

namespace asio
{
class io_context;
} // namespace asio

namespace couchbase
{
class retry_strategy;
} // namespace couchbase

namespace couchbase::core
{
class http_session_manager;
class http_component_impl;

class http_component
{
public:
  http_component(asio::io_context& io,
                 core_sdk_shim shim,
                 std::shared_ptr<retry_strategy> default_retry_strategy = {});

  auto do_http_request(const http_request& request, free_form_http_request_callback&& callback)
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    -> tl::expected<std::shared_ptr<pending_operation>, error_union>;
#else
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;
#endif

  auto do_http_request_buffered(const http_request& request,
                                buffered_free_form_http_request_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

private:
  std::shared_ptr<http_component_impl> impl_;
};
} // namespace couchbase::core
