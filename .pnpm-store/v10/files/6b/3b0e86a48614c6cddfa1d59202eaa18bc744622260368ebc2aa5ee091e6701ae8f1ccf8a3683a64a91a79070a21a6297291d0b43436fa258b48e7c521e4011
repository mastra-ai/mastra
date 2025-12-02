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

#include "client_response.hxx"

#include "core/utils/json.hxx"

#include <cstring>
#include <gsl/assert>
#include <tao/json/value.hpp>

namespace couchbase::core::protocol
{
auto
parse_server_duration_us(const io::mcbp_message& msg) -> double
{
  if (msg.header.magic != static_cast<std::uint8_t>(magic::alt_client_response)) {
    return 0;
  }
  auto framing_extras_size = static_cast<std::uint8_t>(msg.header.keylen & 0xfU);
  if (framing_extras_size == 0) {
    return 0;
  }
  std::size_t offset = 0;
  while (offset < framing_extras_size) {
    auto frame_size = std::to_integer<std::uint8_t>(msg.body[offset] & std::byte{ 0b1111 });
    auto frame_id = std::to_integer<std::uint8_t>((msg.body[offset] >> 4U) & std::byte{ 0b1111 });
    ++offset;
    if (frame_id == static_cast<std::uint8_t>(response_frame_info_id::server_duration)) {
      if (frame_size == 2 && framing_extras_size - offset >= frame_size) {
        std::uint16_t encoded_duration{};
        std::memcpy(&encoded_duration, msg.body.data() + offset, sizeof(encoded_duration));
        encoded_duration = utils::byte_swap(encoded_duration);
        return std::pow(encoded_duration, 1.74) / 2;
      }
    }
    offset += frame_size;
  }
  return 0;
}

auto
parse_enhanced_error(std::string_view str, key_value_extended_error_info& info) -> bool
{
  if (auto error = utils::json::parse(str); error.is_object()) {
    if (const auto* err_obj = error.find("error"); err_obj != nullptr && err_obj->is_object()) {
      std::string reference;
      if (const auto* ref = err_obj->find("ref"); ref != nullptr && ref->is_string()) {
        reference = ref->get_string();
      }
      std::string context;
      if (const auto* ctx = err_obj->find("context"); ctx != nullptr && ctx->is_string()) {
        context = ctx->get_string();
      }

      info = key_value_extended_error_info{ reference, context };
      return true;
    }
  }
  return false;
}
} // namespace couchbase::core::protocol
