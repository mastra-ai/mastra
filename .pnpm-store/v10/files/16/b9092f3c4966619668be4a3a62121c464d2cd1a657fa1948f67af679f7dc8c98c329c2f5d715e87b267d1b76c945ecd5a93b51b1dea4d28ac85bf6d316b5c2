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

#include "cmd_decrement.hxx"

#include "core/utils/byteswap.hxx"
#include "core/utils/mutation_token.hxx"
#include "core/utils/unsigned_leb128.hxx"
#include "frame_info_utils.hxx"

#include <cstring>

namespace couchbase::core::protocol
{
auto
decrement_response_body::parse(key_value_status_code status,
                               const header_buffer& header,
                               std::uint8_t framing_extras_size,
                               std::uint16_t key_size,
                               std::uint8_t extras_size,
                               const std::vector<std::byte>& body,
                               const cmd_info& /* info */) -> bool
{
  Expects(header[1] == static_cast<std::byte>(opcode));
  if (status == key_value_status_code::success) {
    using offset_type = std::vector<std::byte>::difference_type;
    offset_type offset = framing_extras_size;
    if (extras_size == 16) {
      std::uint64_t partition_uuid{};
      memcpy(&partition_uuid, body.data() + offset, sizeof(partition_uuid));
      partition_uuid = utils::byte_swap(partition_uuid);
      offset += 8;

      std::uint64_t sequence_number{};
      memcpy(&sequence_number, body.data() + offset, sizeof(sequence_number));
      sequence_number = utils::byte_swap(sequence_number);

      token_ = couchbase::utils::build_mutation_token(partition_uuid, sequence_number);
      offset += 8;
    }
    offset += key_size;
    memcpy(&content_, body.data() + offset, sizeof(content_));
    content_ = utils::byte_swap(content_);
    return true;
  }
  return false;
}

void
decrement_request_body::id(const document_id& id)
{
  key_ = make_protocol_key(id);
}

void
decrement_request_body::durability(durability_level level, std::optional<std::uint16_t> timeout)
{
  if (level == durability_level::none) {
    return;
  }
  add_durability_frame_info(framing_extras_, level, timeout);
}

void
decrement_request_body::fill_extras()
{
  extras_.resize(sizeof(delta_) + sizeof(initial_value_) + sizeof(expiry_));
  using offset_type = std::vector<std::byte>::difference_type;
  offset_type offset = 0;

  std::uint64_t num = utils::byte_swap(delta_);
  memcpy(extras_.data() + offset, &num, sizeof(num));
  offset += static_cast<offset_type>(sizeof(delta_));

  num = utils::byte_swap(initial_value_);
  memcpy(extras_.data() + offset, &num, sizeof(num));
  offset += static_cast<offset_type>(sizeof(delta_));

  std::uint32_t ttl = utils::byte_swap(expiry_);
  memcpy(extras_.data() + offset, &ttl, sizeof(ttl));
}
} // namespace couchbase::core::protocol
