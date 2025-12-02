/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2022-Present Couchbase, Inc.
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

#include "packet.hxx"

#include "../protocol/client_opcode_fmt.hxx"
#include "../protocol/magic_fmt.hxx"

#include "core/fmt/key_value_status_code.hxx"

#include <spdlog/fmt/bin_to_hex.h>
#include <spdlog/fmt/bundled/core.h>

#include <iterator>

namespace couchbase::core::mcbp
{
auto
packet::debug_string() const -> std::string
{
  std::vector<char> out;
  fmt::format_to(
    std::back_insert_iterator(out),
    "mcbp::packet{{magic:{:02x}({}), command:{:02x}({}), datatype:{:02x}, status:{:02x}({}), "
    "vbucket:{}({:04x}), "
    "opaque:{:08x}, cas:{:08x}, collection_id:{}({:08x})\nkey: {:a}\nvalue: {:a}\nextras: {:a}",
    static_cast<std::uint8_t>(magic_),
    magic_,
    static_cast<std::uint8_t>(command_),
    command_,
    datatype_,
    static_cast<std::uint16_t>(status_),
    status_,
    vbucket_,
    vbucket_,
    opaque_,
    cas_,
    collection_id_,
    collection_id_,
    spdlog::to_hex(key_),
    spdlog::to_hex(value_),
    spdlog::to_hex(extras_));

  if (durability_level_frame_) {
    fmt::format_to(std::back_insert_iterator(out),
                   "\ndurability level: {:02x}",
                   static_cast<std::uint8_t>(durability_level_frame_->level));
    if (durability_timeout_frame_) {
      fmt::format_to(std::back_insert_iterator(out),
                     "\ndurability timeout: {}ms",
                     durability_timeout_frame_->timeout.count());
    }
  }

  if (preserve_expiry_frame_) {
    fmt::format_to(std::back_insert_iterator(out), "\npreserve expiry: true");
  }

  if (stream_id_frame_) {
    fmt::format_to(std::back_insert_iterator(out), "\nstream id: {}", stream_id_frame_->stream_id);
  }

  if (open_tracing_frame_) {
    fmt::format_to(std::back_insert_iterator(out),
                   "\ntrace context: {:a}",
                   spdlog::to_hex(open_tracing_frame_->trace_context));
  }

  if (server_duration_frame_) {
    fmt::format_to(std::back_insert_iterator(out),
                   "\nserver duration: {}ms",
                   server_duration_frame_->server_duration.count());
  }

  if (user_impersonation_frame_) {
    fmt::format_to(std::back_insert_iterator(out),
                   "\nuser: {:a}",
                   spdlog::to_hex(user_impersonation_frame_->user));
  }

  if (!unsupported_frames_.empty()) {
    fmt::format_to(std::back_insert_iterator(out), "\nunsupported frames:");
    for (const auto& frame : unsupported_frames_) {
      fmt::format_to(std::back_insert_iterator(out),
                     "\nframe type: {}, data: {:n}",
                     frame.type,
                     spdlog::to_hex(frame.data));
    }
  }

  fmt::format_to(std::back_insert_iterator(out), "}}");
  return { out.begin(), out.end() };
}
} // namespace couchbase::core::mcbp
