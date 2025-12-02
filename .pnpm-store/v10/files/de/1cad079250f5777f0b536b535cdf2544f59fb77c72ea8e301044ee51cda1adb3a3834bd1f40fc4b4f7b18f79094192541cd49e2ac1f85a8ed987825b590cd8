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

#include "cmd_lookup_in.hxx"

#include "core/utils/byteswap.hxx"
#include "core/utils/unsigned_leb128.hxx"

#include "core/logger/logger.hxx"
#include <cstring>
#include <gsl/assert>

namespace couchbase::core::protocol
{
auto
lookup_in_response_body::parse(key_value_status_code status,
                               const header_buffer& header,
                               std::uint8_t framing_extras_size,
                               std::uint16_t key_size,
                               std::uint8_t extras_size,
                               const std::vector<std::byte>& body,
                               const cmd_info& /* info */) -> bool
{
  Expects(header[1] == static_cast<std::byte>(opcode));
  if (status == key_value_status_code::success ||
      status == key_value_status_code::subdoc_multi_path_failure ||
      status == key_value_status_code::subdoc_success_deleted ||
      status == key_value_status_code::subdoc_multi_path_failure_deleted) {
    using offset_type = std::vector<std::byte>::difference_type;
    offset_type offset = framing_extras_size + key_size + extras_size;
    fields_.reserve(16); /* we won't have more than 16 entries anyway */
    while (static_cast<std::size_t>(offset) < body.size()) {
      lookup_in_field field;

      std::uint16_t entry_status = 0;
      memcpy(&entry_status, body.data() + offset, sizeof(entry_status));
      entry_status = utils::byte_swap(entry_status);
      Expects(is_valid_status(entry_status));
      field.status = static_cast<key_value_status_code>(entry_status);
      offset += static_cast<offset_type>(sizeof(entry_status));

      std::uint32_t entry_size = 0;
      memcpy(&entry_size, body.data() + offset, sizeof(entry_size));
      entry_size = utils::byte_swap(entry_size);
      Expects(entry_size < 20 * 1024 * 1024);
      offset += static_cast<offset_type>(sizeof(entry_size));

      field.value.resize(entry_size);
      memcpy(field.value.data(), body.data() + offset, entry_size);
      offset += static_cast<offset_type>(entry_size);

      fields_.emplace_back(field);
    }
    return true;
  }
  return false;
}

void
lookup_in_request_body::id(const document_id& id)
{
  key_ = make_protocol_key(id);
}

void
lookup_in_request_body::fill_extras()
{
  if (flags_ != 0) {
    extras_.resize(sizeof(flags_));
    extras_[0] = std::byte{ flags_ };
  }
}

void
lookup_in_request_body::fill_value()
{
  size_t value_size = 0;
  for (const auto& spec : specs_) {
    value_size +=
      sizeof(spec.opcode_) + sizeof(std::uint8_t) + sizeof(std::uint16_t) + spec.path_.size();
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
    std::memcpy(value_.data() + offset, spec.path_.data(), spec.path_.size());
    offset += spec.path_.size();
  }
}
} // namespace couchbase::core::protocol
