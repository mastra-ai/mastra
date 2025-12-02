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

#include "cmd_mutate_in.hxx"

#include "core/utils/byteswap.hxx"
#include "core/utils/mutation_token.hxx"
#include "core/utils/unsigned_leb128.hxx"
#include "frame_info_utils.hxx"

#include <cstring>
#include <gsl/assert>

namespace couchbase::core::protocol
{
auto
mutate_in_response_body::parse(key_value_status_code status,
                               const header_buffer& header,
                               std::uint8_t framing_extras_size,
                               std::uint16_t key_size,
                               std::uint8_t extras_size,
                               const std::vector<std::byte>& body,
                               const cmd_info& /* info */) -> bool
{
  Expects(header[1] == static_cast<std::byte>(opcode));
  if (status == key_value_status_code::success ||
      status == key_value_status_code::subdoc_multi_path_failure) {
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
    } else {
      offset += extras_size;
    }
    offset += key_size;
    fields_.reserve(16); /* we won't have more than 16 entries anyway */
    while (static_cast<std::size_t>(offset) < body.size()) {
      mutate_in_field field;

      field.index = std::to_integer<std::uint8_t>(body[static_cast<std::size_t>(offset)]);
      offset++;

      std::uint16_t entry_status = 0;
      memcpy(&entry_status, body.data() + offset, sizeof(entry_status));
      entry_status = utils::byte_swap(entry_status);
      Expects(is_valid_status(entry_status));
      field.status = static_cast<key_value_status_code>(entry_status);
      offset += static_cast<offset_type>(sizeof(entry_status));

      if (field.status == key_value_status_code::success) {
        std::uint32_t entry_size = 0;
        memcpy(&entry_size, body.data() + offset, sizeof(entry_size));
        entry_size = utils::byte_swap(entry_size);
        Expects(entry_size < 20 * 1024 * 1024);
        offset += static_cast<offset_type>(sizeof(entry_size));

        field.value.resize(entry_size);
        memcpy(field.value.data(), body.data() + offset, entry_size);
        offset += static_cast<offset_type>(entry_size);
      }

      fields_.emplace_back(field);
    }
    return true;
  }
  return false;
}

void
mutate_in_request_body::id(const document_id& id)
{
  key_ = make_protocol_key(id);
}

void
mutate_in_request_body::durability(durability_level level, std::optional<std::uint16_t> timeout)
{
  if (level == durability_level::none) {
    return;
  }

  add_durability_frame_info(framing_extras_, level, timeout);
}

void
mutate_in_request_body::preserve_expiry()
{
  add_preserve_expiry_frame_info(framing_extras_);
}

void
mutate_in_request_body::fill_extras()
{
  if (expiry_ != 0 || user_flags_) {
    extras_.resize(sizeof(expiry_));
    std::uint32_t field = utils::byte_swap(expiry_);
    memcpy(extras_.data(), &field, sizeof(field));
  }
  if (user_flags_) {
    const std::size_t offset = extras_.size();
    extras_.resize(offset + sizeof(std::uint32_t));
    std::uint32_t field = utils::byte_swap(user_flags_.value());
    memcpy(extras_.data() + offset, &field, sizeof(field));
  }
  if (flags_ != std::byte{ 0U }) {
    const std::size_t offset = extras_.size();
    extras_.resize(offset + sizeof(flags_));
    extras_[offset] = std::byte{ flags_ };
  }
}

void
mutate_in_request_body::fill_value()
{
  size_t value_size = 0;
  for (const auto& spec : specs_) {
    value_size += sizeof(spec.opcode_) + sizeof(std::uint8_t) + sizeof(std::uint16_t) +
                  spec.path_.size() + sizeof(std::uint32_t) + spec.value_.size();
  }
  Expects(value_size > 0);
  value_.resize(value_size);
  std::vector<std::byte>::size_type offset = 0;
  for (const auto& spec : specs_) {
    value_[offset] = static_cast<std::byte>(spec.opcode_);
    ++offset;
    value_[offset] = spec.flags_;
    ++offset;

    std::uint16_t path_size = utils::byte_swap(gsl::narrow_cast<std::uint16_t>(spec.path_.size()));
    std::memcpy(value_.data() + offset, &path_size, sizeof(path_size));
    offset += sizeof(path_size);

    std::uint32_t param_size =
      utils::byte_swap(gsl::narrow_cast<std::uint32_t>(spec.value_.size()));
    std::memcpy(value_.data() + offset, &param_size, sizeof(param_size));
    offset += sizeof(param_size);

    std::memcpy(value_.data() + offset, spec.path_.data(), spec.path_.size());
    offset += spec.path_.size();

    if (param_size != 0U) {
      std::memcpy(value_.data() + offset, spec.value_.data(), spec.value_.size());
      offset += spec.value_.size();
    }
  }
}
} // namespace couchbase::core::protocol
