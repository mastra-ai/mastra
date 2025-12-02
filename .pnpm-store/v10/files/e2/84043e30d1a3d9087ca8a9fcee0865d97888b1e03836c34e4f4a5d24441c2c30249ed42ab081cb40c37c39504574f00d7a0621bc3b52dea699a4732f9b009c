/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2021 Couchbase, Inc.
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

#include "search_get_stats.hxx"

#include <couchbase/error_codes.hxx>

namespace couchbase::core::operations::management
{
auto
search_get_stats_request::encode_to(encoded_request_type& encoded,
                                    http_context& /* context */) const -> std::error_code
{
  encoded.method = "GET";
  encoded.path = "/api/nsstats";
  return {};
}

auto
search_get_stats_request::make_response(error_context::http&& ctx,
                                        const encoded_response_type& encoded) const
  -> search_get_stats_response
{
  search_get_stats_response response{ std::move(ctx) };
  if (!response.ctx.ec) {
    response.stats = encoded.body.data();
  }
  return response;
}
} // namespace couchbase::core::operations::management
