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

#include "observe_seqno.hxx"

#include <couchbase/error_codes.hxx>

namespace couchbase::core::impl
{
auto
observe_seqno_request::encode_to(observe_seqno_request::encoded_request_type& encoded,
                                 core::mcbp_context&& /* context */) const -> std::error_code
{
  encoded.opaque(opaque);
  encoded.partition(partition);
  encoded.body().partition_uuid(partition_uuid);
  return {};
}

auto
observe_seqno_request::make_response(key_value_error_context&& ctx,
                                     const encoded_response_type& encoded) const
  -> observe_seqno_response
{
  observe_seqno_response response{ std::move(ctx), active };
  if (!response.ctx.ec()) {
    response.partition = encoded.body().partition_id();
    response.partition_uuid = encoded.body().partition_uuid();
    response.last_persisted_sequence_number = encoded.body().last_persisted_sequence_number();
    response.current_sequence_number = encoded.body().current_sequence_number();
    response.old_partition_uuid = encoded.body().old_partition_uuid();
    response.last_received_sequence_number = encoded.body().last_persisted_sequence_number();
  }
  return response;
}
} // namespace couchbase::core::impl
