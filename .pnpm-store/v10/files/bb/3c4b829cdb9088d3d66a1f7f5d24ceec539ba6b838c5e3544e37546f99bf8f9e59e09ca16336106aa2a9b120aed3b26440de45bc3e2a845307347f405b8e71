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

#include "frame_info_utils.hxx"

#include "core/utils/byteswap.hxx"
#include "frame_info_id.hxx"

#include <cstddef>
#include <cstring>

namespace couchbase::core::protocol
{

void
add_durability_frame_info(std::vector<std::byte>& framing_extras,
                          durability_level level,
                          std::optional<std::uint16_t> timeout)
{
  const auto frame_id =
    static_cast<std::byte>(protocol::request_frame_info_id::durability_requirement);
  const auto extras_old_size = framing_extras.size();
  if (timeout) {
    const std::byte frame_size{ 3 /* 1 for level + 2 for timeout */ };
    framing_extras.resize(extras_old_size + 1 + static_cast<std::size_t>(frame_size));
    framing_extras[extras_old_size + 0] = (frame_id << 4U) | frame_size;
    framing_extras[extras_old_size + 1] = static_cast<std::byte>(level);
    std::uint16_t val = utils::byte_swap(*timeout);
    memcpy(framing_extras.data() + extras_old_size + 2, &val, sizeof(val));
  } else {
    const std::byte frame_size{ 1 /* 1 for level */ };
    framing_extras.resize(extras_old_size + 1 + static_cast<std::size_t>(frame_size));
    framing_extras[extras_old_size + 0] = (frame_id << 4U) | frame_size;
    framing_extras[extras_old_size + 1] = static_cast<std::byte>(level);
  }
}

void
add_preserve_expiry_frame_info(std::vector<std::byte>& framing_extras)
{
  const auto frame_id = static_cast<std::byte>(protocol::request_frame_info_id::preserve_ttl);
  const std::byte frame_size{ 0 };
  const auto extras_old_size = framing_extras.size();

  framing_extras.resize(extras_old_size + 1);
  framing_extras[extras_old_size + 0] = (frame_id << 4U) | frame_size;
}
} // namespace couchbase::core::protocol
