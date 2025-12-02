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

#include "dispatcher.hxx"

#include "cluster.hxx"
#include "core/core_sdk_shim.hxx"

#include <memory>
#include <string>
#include <system_error>
#include <utility>

namespace couchbase::core
{
dispatcher::dispatcher(std::string bucket_name, core_sdk_shim shim)
  : bucket_name_{ std::move(bucket_name) }
  , shim_{ std::move(shim) }
{
}

auto
dispatcher::direct_dispatch(std::shared_ptr<mcbp::queue_request> req) const -> std::error_code
{
  return shim_.cluster.direct_dispatch(bucket_name_, std::move(req));
}

auto
dispatcher::direct_re_queue(std::shared_ptr<mcbp::queue_request> req,
                            bool is_retry) const -> std::error_code
{
  return shim_.cluster.direct_re_queue(bucket_name_, std::move(req), is_retry);
}
} // namespace couchbase::core
