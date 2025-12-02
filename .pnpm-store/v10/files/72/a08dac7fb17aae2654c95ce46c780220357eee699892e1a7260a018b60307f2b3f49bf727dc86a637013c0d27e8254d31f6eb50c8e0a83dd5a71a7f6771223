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

#include "cmd_get_replica.hxx"

#include "core/utils/byteswap.hxx"
#include "core/utils/unsigned_leb128.hxx"

#include <cstring>
#include <gsl/assert>

namespace couchbase::core::protocol
{
auto
get_replica_response_body::flags() const -> std::uint32_t
{
  return flags_;
}

auto
get_replica_response_body::parse(key_value_status_code status,
                                 const header_buffer& header,
                                 std::uint8_t framing_extras_size,
                                 std::uint16_t key_size,
                                 std::uint8_t extras_size,
                                 const std::vector<std::byte>& body,
                                 const cmd_info& /* info */) -> bool
{
  Expects(header[1] == static_cast<std::byte>(opcode));
  if (status == key_value_status_code::success) {
    std::vector<std::uint8_t>::difference_type offset = framing_extras_size;
    if (extras_size == 4) {
      memcpy(&flags_, body.data() + offset, sizeof(flags_));
      flags_ = utils::byte_swap(flags_);
      offset += 4;
    } else {
      offset += extras_size;
    }
    offset += key_size;
    value_.assign(body.begin() + offset, body.end());
    return true;
  }
  return false;
}

void
get_replica_request_body::id(const document_id& id)
{
  key_ = make_protocol_key(id);
}

auto
get_replica_request_body::size() const -> std::size_t
{
  return key_.size();
}
} // namespace couchbase::core::protocol
