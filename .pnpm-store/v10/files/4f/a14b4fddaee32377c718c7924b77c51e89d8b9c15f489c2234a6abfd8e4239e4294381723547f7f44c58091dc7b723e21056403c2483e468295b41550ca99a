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

#include "cmd_get_collection_id.hxx"

#include "core/utils/binary.hxx"
#include "core/utils/byteswap.hxx"

#include <gsl/assert>

#include <algorithm>
#include <cstring>

namespace couchbase::core::protocol
{
auto
get_collection_id_response_body::parse(key_value_status_code status,
                                       const header_buffer& header,
                                       std::uint8_t framing_extras_size,
                                       std::uint16_t key_size,
                                       std::uint8_t extras_size,
                                       const std::vector<std::byte>& body,
                                       const cmd_info& /* info */) -> bool
{
  Expects(header[1] == static_cast<std::byte>(opcode));
  if (status == key_value_status_code::success && extras_size == 12) {
    std::vector<std::uint8_t>::difference_type offset = framing_extras_size + key_size;

    std::memcpy(&manifest_uid_, body.data() + offset, sizeof(manifest_uid_));
    manifest_uid_ = utils::byte_swap(manifest_uid_);
    offset += 8;

    std::memcpy(&collection_uid_, body.data() + offset, sizeof(collection_uid_));
    collection_uid_ = utils::byte_swap(collection_uid_);
    return true;
  }
  return false;
}

void
get_collection_id_request_body::collection_path(const std::string_view& path)
{
  value_.reserve(path.size());
  utils::to_binary(path, std::back_insert_iterator(value_));
}
} // namespace couchbase::core::protocol
