/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-Present Couchbase, Inc.
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

#include "get_replica.hxx"

#include "core/error_context/key_value_error_context.hxx"
#include "core/io/mcbp_context.hxx"

#include <system_error>
#include <utility>

namespace couchbase::core::impl
{
auto
get_replica_request::encode_to(get_replica_request::encoded_request_type& encoded,
                               core::mcbp_context&& /* context */) const -> std::error_code
{
  encoded.opaque(opaque);
  encoded.partition(partition);
  encoded.body().id(id);
  return {};
}

auto
get_replica_request::make_response(key_value_error_context&& ctx,
                                   const encoded_response_type& encoded) const
  -> get_replica_response
{
  get_replica_response response{ std::move(ctx) };
  if (!response.ctx.ec()) {
    response.value = encoded.body().value();
    response.cas = encoded.cas();
    response.flags = encoded.body().flags();
  }
  return response;
}
} // namespace couchbase::core::impl
