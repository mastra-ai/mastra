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

#include "mcbp_parser.hxx"

#include "core/logger/logger.hxx"
#include "core/protocol/datatype.hxx"
#include "core/protocol/magic.hxx"
#include "core/utils/byteswap.hxx"

#include <snappy.h>
#include <spdlog/fmt/bin_to_hex.h>

#include <algorithm>
#include <cstring>

namespace couchbase::core::io
{
auto
mcbp_parser::next(mcbp_message& msg) -> mcbp_parser::result
{
  static const std::size_t header_size = 24;
  if (buf.size() < header_size) {
    return result::need_data;
  }
  std::memcpy(&msg.header, buf.data(), header_size);
  std::uint32_t body_size = utils::byte_swap(msg.header.bodylen);
  if (body_size > 0 && buf.size() - header_size < body_size) {
    return result::need_data;
  }
  msg.body.clear();
  msg.body.reserve(body_size);
  std::uint32_t key_size = utils::byte_swap(msg.header.keylen);
  std::uint32_t prefix_size = static_cast<std::uint32_t>(msg.header.extlen) + key_size;
  if (msg.header.magic == static_cast<std::uint8_t>(protocol::magic::alt_client_response)) {
    const std::uint8_t framing_extras_size = msg.header.keylen & 0xffU;
    key_size = static_cast<std::uint32_t>(msg.header.keylen >> 8U);
    prefix_size = static_cast<std::uint32_t>(framing_extras_size) +
                  static_cast<std::uint32_t>(msg.header.extlen) + key_size;
  }
  msg.body.insert(
    msg.body.end(), buf.begin() + header_size, buf.begin() + header_size + prefix_size);

  const bool is_compressed =
    (msg.header.datatype & static_cast<std::uint8_t>(protocol::datatype::snappy)) != 0;
  bool use_raw_value = true;
  if (is_compressed) {
    std::string uncompressed;
    const std::size_t offset = header_size + prefix_size;
    if (snappy::Uncompress(reinterpret_cast<const char*>(buf.data() + offset),
                           body_size - prefix_size,
                           &uncompressed)) {
      msg.body.insert(msg.body.end(),
                      reinterpret_cast<std::byte*>(uncompressed.data()),
                      reinterpret_cast<std::byte*>(uncompressed.data() + uncompressed.size()));
      use_raw_value = false;
      // patch header with new body size
      msg.header.bodylen =
        utils::byte_swap(static_cast<std::uint32_t>(prefix_size + uncompressed.size()));
    }
  }
  if (use_raw_value) {
    msg.body.insert(msg.body.end(),
                    buf.begin() + header_size + prefix_size,
                    buf.begin() + header_size + body_size);
  }
  buf.erase(buf.begin(), buf.begin() + header_size + body_size);
  if (!buf.empty() && !protocol::is_valid_magic(std::to_integer<std::uint8_t>(buf[0]))) {
    CB_LOG_WARNING("parsed frame for magic={:x}, opcode={:x}, opaque={}, body_len={}. Invalid "
                   "magic of the next frame: {:x}, {} "
                   "bytes to parse{}",
                   msg.header.magic,
                   msg.header.opcode,
                   msg.header.opaque,
                   body_size,
                   buf[0],
                   buf.size(),
                   spdlog::to_hex(buf));
    reset();
  }
  return result::ok;
}
} // namespace couchbase::core::io
