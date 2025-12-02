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

#include "cmd_observe_seqno.hxx"

#include "core/utils/byteswap.hxx"
#include "core/utils/unsigned_leb128.hxx"

#include <gsl/assert>

#include <cstring>

namespace couchbase::core::protocol
{
auto
observe_seqno_response_body::parse(key_value_status_code status,
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
    offset_type offset = framing_extras_size + extras_size + key_size;

    const bool failover =
      std::to_integer<std::uint8_t>(body[static_cast<std::size_t>(offset)]) != 0U;
    ++offset;

    memcpy(&partition_id_, body.data() + offset, sizeof(partition_id_));
    partition_id_ = utils::byte_swap(partition_id_);
    offset += static_cast<offset_type>(sizeof(partition_id_));

    memcpy(&partition_uuid_, body.data() + offset, sizeof(partition_uuid_));
    partition_uuid_ = utils::byte_swap(partition_uuid_);
    offset += static_cast<offset_type>(sizeof(partition_uuid_));

    memcpy(&last_persisted_sequence_number_,
           body.data() + offset,
           sizeof(last_persisted_sequence_number_));
    last_persisted_sequence_number_ = utils::byte_swap(last_persisted_sequence_number_);
    offset += static_cast<offset_type>(sizeof(last_persisted_sequence_number_));

    memcpy(&current_sequence_number_, body.data() + offset, sizeof(current_sequence_number_));
    current_sequence_number_ = utils::byte_swap(current_sequence_number_);
    offset += static_cast<offset_type>(sizeof(current_sequence_number_));

    if (failover) {
      std::uint64_t field{};

      memcpy(&field, body.data() + offset, sizeof(field));
      old_partition_uuid_.emplace(utils::byte_swap(field));
      offset += static_cast<offset_type>(sizeof(field));

      memcpy(&field, body.data() + offset, sizeof(field));
      last_received_sequence_number_.emplace(utils::byte_swap(field));
    }
  }
  return false;
}

void
observe_seqno_request_body::partition_uuid(const uint64_t& uuid)
{
  partition_uuid_ = uuid;
}

void
observe_seqno_request_body::fill_body()
{
  const std::vector<std::byte>::size_type offset = 0;

  value_.resize(sizeof(std::uint64_t));

  std::uint64_t field = utils::byte_swap(partition_uuid_);
  memcpy(value_.data() + offset, &field, sizeof(field));
}
} // namespace couchbase::core::protocol
