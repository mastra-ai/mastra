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

#include "codec.hxx"

#include "big_endian.hxx"
#include "buffer_writer.hxx"
#include "server_duration.hxx"

#include "core/logger/logger.hxx"
#include "core/utils/unsigned_leb128.hxx"

#include <algorithm>
#include <couchbase/error_codes.hxx>
#include <cstdint>

namespace couchbase::core::mcbp
{
codec::codec(std::set<protocol::hello_feature> enabled_features)
  : enabled_features_{ std::move(enabled_features) }
  , collections_enabled_{ enabled_features_.count(protocol::hello_feature::collections) > 0 }
{
}

void
codec::enable_feature(protocol::hello_feature feature)
{
  enabled_features_.insert(feature);
  if (feature == protocol::hello_feature::collections) {
    collections_enabled_ = true;
  }
}

auto
codec::is_feature_enabled(protocol::hello_feature feature) const -> bool
{
  return enabled_features_.count(feature) > 0;
}

auto
codec::encode_packet(const couchbase::core::mcbp::packet& packet) const
  -> tl::expected<std::vector<std::byte>, std::error_code>
{
  auto encoded_key = packet.key_;
  auto extras = packet.extras_;

  if (collections_enabled_) {
    if (packet.command_ == protocol::client_opcode::observe) {
      // While it's possible that the Observe operation is in fact supported with collections
      // enabled, we don't currently implement that operation for simplicity, as the key is
      // actually hidden away in the value data instead of the usual key data.
      CB_LOG_DEBUG("the observe operation is not supported with collections enabled");
      return tl::unexpected(errc::common::unsupported_operation);
    }
    if (supports_collection_id(packet.command_)) {
      const core::utils::unsigned_leb128<std::uint32_t> encoded(packet.collection_id_);
      encoded_key.reserve(encoded_key.size() + encoded.size());
      encoded_key.insert(encoded_key.begin(), encoded.begin(), encoded.end());
    } else if (packet.command_ == protocol::client_opcode::get_random_key) {
      // GetRandom expects the cid to be in the extras
      // GetRandom MUST not have any extras if not using collections, so we're ok to just set it.
      // It also doesn't expect the collection ID to be leb encoded.
      extras.resize(sizeof(std::uint32_t));
      big_endian::put_uint32(extras, packet.collection_id_);
    }
    if (packet.collection_id_ > 0) {
      CB_LOG_DEBUG("cannot encode collection id with a non-collection command");
      return tl::unexpected(errc::common::invalid_argument);
    }
  }

  const std::size_t ext_len = extras.size();
  const std::size_t key_len = encoded_key.size();
  const std::size_t val_len = packet.value_.size();
  std::size_t frames_len = 0;

  if (packet.barrier_frame_) {
    frames_len += 1;
  }
  if (packet.durability_level_frame_) {
    frames_len += 2;
    if (packet.durability_timeout_frame_) {
      frames_len += 2;
    }
  }
  if (packet.stream_id_frame_) {
    frames_len += 3;
  }
  if (packet.open_tracing_frame_) {
    const std::size_t trace_ctx_len = packet.open_tracing_frame_->trace_context.size();
    frames_len = trace_ctx_len;
    if (trace_ctx_len < 15) {
      frames_len += 1;
    } else {
      frames_len += 2;
    }
  }
  if (packet.server_duration_frame_) {
    frames_len += 3;
  }
  if (packet.user_impersonation_frame_) {
    const std::size_t user_len = packet.user_impersonation_frame_->user.size();
    frames_len += user_len;
    if (user_len < 15) {
      frames_len += 1;
    } else {
      frames_len += 2;
    }
  }
  if (packet.preserve_expiry_frame_) {
    frames_len += 1;
  }

  // We automatically upgrade a packet from normal Req or Res magic into the frame variant depending
  // on the usage of them.
  auto packet_magic = packet.magic_;
  if (frames_len > 0) {
    switch (packet_magic) {
      case protocol::magic::client_request:
        if (!is_feature_enabled(protocol::hello_feature::alt_request_support)) {
          CB_LOG_DEBUG("cannot use frames in req packets without enabling the feature");
          return tl::unexpected(errc::common::unsupported_operation);
        }
        packet_magic = protocol::magic::alt_client_request;
        break;
      case protocol::magic::client_response:
        packet_magic = protocol::magic::alt_client_response;
        break;
      default:
        CB_LOG_DEBUG("cannot use frames with an unsupported magic");
        return tl::unexpected(errc::common::unsupported_operation);
    }
  }
  const std::size_t packet_len = 24 + ext_len + frames_len + key_len + val_len;
  buffer_writer buffer{ packet_len };
  buffer.write_byte(static_cast<std::byte>(packet_magic));
  buffer.write_byte(static_cast<std::byte>(packet.command_));

  // This is safe to do without checking the magic as we check the magic above before incrementing
  // the framesLen variable
  if (frames_len > 0) {
    buffer.write_byte(static_cast<std::byte>(frames_len));
    buffer.write_byte(static_cast<std::byte>(key_len));
  } else {
    buffer.write_uint16(static_cast<std::uint16_t>(key_len));
  }
  buffer.write_byte(static_cast<std::byte>(ext_len));
  buffer.write_byte(packet.datatype_);

  switch (packet.magic_) {
    case protocol::magic::client_request:
    case protocol::magic::alt_client_request:
      if (static_cast<std::uint32_t>(packet.status_) != 0) {
        CB_LOG_DEBUG("cannot specify status in a request packet");
        return tl::unexpected(errc::common::invalid_argument);
      }
      buffer.write_uint16(packet.vbucket_);
      break;

    case protocol::magic::client_response:
    case protocol::magic::alt_client_response:
      if (static_cast<std::uint32_t>(packet.vbucket_) != 0) {
        CB_LOG_DEBUG("cannot specify vbucket in a response packet");
        return tl::unexpected(errc::common::invalid_argument);
      }
      buffer.write_uint16(packet.status_);
      break;

    default:
      CB_LOG_DEBUG("cannot encode status/vbucket for unknown packet magic");
      return tl::unexpected(errc::common::invalid_argument);
  }

  buffer.write_uint32(static_cast<std::uint32_t>(key_len + ext_len + val_len + frames_len));
  buffer.write_uint32(packet.opaque_);
  buffer.write_uint64(packet.cas_);

  // Generate the framing extra data

  if (packet.barrier_frame_) {
    if (packet.magic_ != protocol::magic::client_request) {
      CB_LOG_DEBUG("cannot use barrier frame in non-request packets");
      return tl::unexpected(errc::common::invalid_argument);
    }
    buffer.write_frame_header(mcbp::request_barrier, 0);
  }

  if (packet.durability_level_frame_) {
    if (packet.magic_ != protocol::magic::client_request) {
      CB_LOG_DEBUG("cannot use durability level frame in non-request packets");
      return tl::unexpected(errc::common::invalid_argument);
    }

    if (!is_feature_enabled(protocol::hello_feature::sync_replication)) {
      CB_LOG_DEBUG("cannot use sync replication frames without enabling the feature");
      return tl::unexpected(errc::common::feature_not_available);
    }

    if (packet.durability_timeout_frame_) {
      std::int64_t millis = packet.durability_timeout_frame_->timeout.count();
      millis =
        std::min(millis, static_cast<std::int64_t>(std::numeric_limits<std::uint16_t>::max()));
      buffer.write_frame_header(mcbp::request_sync_durability, 3);
      buffer.write_byte(static_cast<std::byte>(packet.durability_level_frame_->level));
      buffer.write_uint16(static_cast<std::uint16_t>(millis));
    } else {
      buffer.write_frame_header(mcbp::request_sync_durability, 1);
      buffer.write_byte(static_cast<std::byte>(packet.durability_level_frame_->level));
    }
  }

  if (packet.stream_id_frame_) {
    if (packet.magic_ != protocol::magic::client_request) {
      CB_LOG_DEBUG("cannot use stream id frame in non-request packets");
      return tl::unexpected(errc::common::invalid_argument);
    }

    buffer.write_frame_header(mcbp::request_stream_id, 2);
    buffer.write_uint16(packet.stream_id_frame_->stream_id);
  }

  if (packet.open_tracing_frame_) {
    if (packet.magic_ != protocol::magic::client_request) {
      CB_LOG_DEBUG("cannot use open tracing frame in non-request packets");
      return tl::unexpected(errc::common::invalid_argument);
    }

    if (!is_feature_enabled(protocol::hello_feature::open_tracing)) {
      CB_LOG_DEBUG("cannot use open tracing frames without enabling the feature");
      return tl::unexpected(errc::common::feature_not_available);
    }

    const std::size_t trace_ctx_len = packet.open_tracing_frame_->trace_context.size();
    if (trace_ctx_len < 15) {
      buffer.write_frame_header(mcbp::request_open_tracing, trace_ctx_len);
      buffer.write(packet.open_tracing_frame_->trace_context);
    } else {
      buffer.write_frame_header(mcbp::request_open_tracing, 15);
      buffer.write_byte(static_cast<std::byte>(trace_ctx_len - 15));
      buffer.write(packet.open_tracing_frame_->trace_context);
    }
  }

  if (packet.server_duration_frame_) {
    if (packet.magic_ != protocol::magic::client_response) {
      CB_LOG_DEBUG("cannot use server duration frame in non-response packets");
      return tl::unexpected(errc::common::invalid_argument);
    }

    if (!is_feature_enabled(protocol::hello_feature::tracing)) {
      buffer.write_frame_header(mcbp::response_server_duration, 2);
      buffer.write_uint16(
        mcbp::encode_server_duration(packet.server_duration_frame_->server_duration));
    }
  }

  if (packet.user_impersonation_frame_) {
    if (packet.magic_ != protocol::magic::client_request) {
      CB_LOG_DEBUG("cannot use user impersonation frame in non-request packets");
      return tl::unexpected(errc::common::invalid_argument);
    }

    const std::size_t user_len = packet.user_impersonation_frame_->user.size();
    if (user_len < 15) {
      buffer.write_frame_header(mcbp::request_user_impersonation, user_len);
      buffer.write(packet.user_impersonation_frame_->user);
    } else {
      buffer.write_frame_header(mcbp::request_user_impersonation, 15);
      buffer.write_byte(static_cast<std::byte>(user_len - 15));
      buffer.write(packet.user_impersonation_frame_->user);
    }
  }

  if (packet.preserve_expiry_frame_) {
    if (packet.magic_ != protocol::magic::client_request) {
      CB_LOG_DEBUG("cannot use preserve expiry frame in non-request packets");
      return tl::unexpected(errc::common::invalid_argument);
    }

    if (!is_feature_enabled(protocol::hello_feature::preserve_ttl)) {
      CB_LOG_DEBUG("cannot use preserve expiry frame without enabling the feature");
      return tl::unexpected(errc::common::feature_not_available);
    }

    buffer.write_frame_header(mcbp::request_preserve_expiry, 0);
  }

  if (!packet.unsupported_frames_.empty()) {
    CB_LOG_DEBUG("cannot use send packets with unsupported frames");
    return tl::unexpected(errc::common::invalid_argument);
  }

  // Copy the extras into the body of the packet
  buffer.write(extras);

  // Copy the encoded key into the body of the packet
  buffer.write(encoded_key);

  // Copy the value into the body of the packet
  buffer.write(packet.value_);

  return buffer.store_;
}

auto
codec::decode_packet(gsl::span<std::byte> input) const
  -> std::tuple<packet, std::size_t, std::error_code>
{
  if (input.empty()) {
    return { {}, {}, errc::network::end_of_stream };
  }

  constexpr std::size_t header_len{ 24 };
  // Read the entire 24-byte header first
  if (input.size() < header_len) {
    return { {}, {}, errc::network::need_more_data };
  }
  const gsl::span<std::byte> header{ input.data(), header_len };

  // grab the length of the full body
  const std::uint32_t body_len = big_endian::read_uint32(header, 8);
  // Read the remaining bytes of the body
  if (input.size() < header_len + body_len) {
    return { {}, {}, errc::network::need_more_data };
  }
  const gsl::span<std::byte> body{ input.data() + header_len, body_len };

  return decode_packet(header, body);
}

auto
codec::decode_packet(gsl::span<std::byte> header, gsl::span<std::byte> body) const
  -> std::tuple<packet, std::size_t, std::error_code>
{
  packet pkt;

  auto magic = static_cast<protocol::magic>(header[0]);
  pkt.command_ = static_cast<protocol::client_opcode>(header[1]);

  switch (magic) {
    case protocol::magic::client_request:
    case protocol::magic::alt_client_request:
      pkt.magic_ = protocol::magic::client_request;
      pkt.vbucket_ = big_endian::read_uint16(header, 6);
      break;

    case protocol::magic::client_response:
    case protocol::magic::alt_client_response:
      pkt.magic_ = protocol::magic::client_response;
      pkt.status_ = big_endian::read_uint16(header, 6);
      if (protocol::is_valid_status(pkt.status_)) {
        pkt.status_code_ = static_cast<key_value_status_code>(pkt.status_);
      } else {
        pkt.status_code_ = key_value_status_code::unknown;
      }
      break;

    default:
      CB_LOG_DEBUG("cannot decode status/vbucket for unknown pkt magic");
      return { {}, {}, errc::network::protocol_error };
  }

  pkt.datatype_ = header[5];
  pkt.opaque_ = big_endian::read_uint32(header, 12);
  pkt.cas_ = big_endian::read_uint64(header, 16);

  const std::size_t header_len = header.size();
  std::size_t body_len = body.size();
  std::size_t ext_len = big_endian::read_uint8(header, 4);
  std::size_t key_len = big_endian::read_uint16(header, 2);
  std::size_t frames_len = 0;

  switch (magic) {
    case protocol::magic::alt_client_request:
    case protocol::magic::alt_client_response:
      key_len = big_endian::read_uint8(header, 3);
      frames_len = big_endian::read_uint8(header, 2);
      break;

    default:
      break;
  }

  if (frames_len + ext_len + key_len > body_len) {
    CB_LOG_DEBUG("frames_len ({}) + ext_len ({}) + key_len ({}) > body_len ({})",
                 frames_len,
                 ext_len,
                 key_len,
                 body_len);
    return { {}, {}, errc::network::protocol_error };
  }
  const std::size_t value_len = body_len - (frames_len + ext_len + key_len);

  if (frames_len > 0) {
    std::size_t frame_offset = 0;

    while (frame_offset < frames_len) {
      const std::byte frame_header = body[frame_offset];
      ++frame_offset;

      auto frame_type = std::to_integer<std::uint8_t>((frame_header & std::byte{ 0xf0 }) >> 4);
      if (frame_type == 0x0f) {
        frame_type =
          static_cast<std::uint8_t>(frame_type + std::to_integer<std::uint8_t>(body[frame_offset]));
        ++frame_offset;
      }

      auto frame_len = std::to_integer<std::size_t>(frame_header & std::byte{ 0x0f });
      if (frame_len == 0x0f) {
        frame_len += std::to_integer<std::size_t>(body[frame_offset]);
        ++frame_offset;
      }

      switch (magic) {
        case protocol::magic::alt_client_request:
          if (frame_type == mcbp::request_barrier && frame_len == 0) {
            pkt.barrier_frame_ = mcbp::barrier_frame{};
          } else if (frame_type == mcbp::request_sync_durability &&
                     (frame_len == 1 || frame_len == 3)) {
            pkt.durability_level_frame_ = mcbp::durability_level_frame{
              static_cast<mcbp::durability_level>(body[frame_offset])
            };
            if (frame_len == 3) {
              pkt.durability_timeout_frame_ = mcbp::durability_timeout_frame{
                std::chrono::milliseconds{ big_endian::read_uint16(body, frame_offset + 1) }
              };
            } else {
              // We follow the semantic that duplicate frames overwrite previous ones, since the
              // timeout frame is 'virtual' to us, we need to clear it in case this is a duplicate
              // frame.
              pkt.durability_timeout_frame_.reset();
            }
          } else if (frame_type == mcbp::request_stream_id && frame_len == 2) {
            pkt.stream_id_frame_ =
              mcbp::stream_id_frame{ big_endian::read_uint16(body, frame_offset) };
          } else if (frame_type == mcbp::request_open_tracing && frame_len > 0) {
            pkt.open_tracing_frame_ =
              mcbp::open_tracing_frame{ big_endian::read(body, frame_offset, frame_len) };
          } else if (frame_type == mcbp::request_preserve_expiry && frame_len == 0) {
            pkt.preserve_expiry_frame_ = mcbp::preserve_expiry_frame{};
          } else if (frame_type == mcbp::request_user_impersonation && frame_len > 0) {
            pkt.user_impersonation_frame_ =
              mcbp::user_impersonation_frame{ big_endian::read(body, frame_offset, frame_len) };
          } else {
            // If we don't understand this frame type, we record it as an UnsupportedFrame (as
            // opposed to dropping it blindly)
            pkt.unsupported_frames_.emplace_back(mcbp::unsupported_frame{
              frame_type, big_endian::read(body, frame_offset, frame_len) });
          }
          break;

        case protocol::magic::alt_client_response:
          if (frame_type == mcbp::response_server_duration && frame_len == 2) {
            pkt.server_duration_frame_ = mcbp::server_duration_frame{ mcbp::decode_server_duration(
              big_endian::read_uint16(body, frame_offset)) };
          } else if (frame_type == mcbp::response_read_units && frame_len == 2) {
            pkt.read_units_frame_ =
              mcbp::read_units_frame{ big_endian::read_uint16(body, frame_offset) };
          } else if (frame_type == mcbp::response_write_units && frame_len == 2) {
            pkt.write_units_frame_ =
              mcbp::write_units_frame{ big_endian::read_uint16(body, frame_offset) };
          } else {
            // If we don't understand this frame type, we record it as an UnsupportedFrame (as
            // opposed to dropping it blindly)
            pkt.unsupported_frames_.emplace_back(mcbp::unsupported_frame{
              frame_type, big_endian::read(body, frame_offset, frame_len) });
          }
          break;

        default:
          CB_LOG_DEBUG("got unexpected magic when decoding frames");
          return { {}, {}, errc::network::protocol_error };
      }
      frame_offset += frame_len;
    }
  }

  if (ext_len > 0) {
    pkt.extras_ = big_endian::read(body, frames_len, ext_len);
  }
  if (key_len > 0) {
    pkt.key_ = big_endian::read(body, frames_len + ext_len, key_len);
  }
  if (value_len > 0) {
    pkt.value_ = big_endian::read(body, frames_len + ext_len + key_len, value_len);
  }

  if (collections_enabled_) {
    if (pkt.command_ == protocol::client_opcode::observe) {
      // While it's possible that the Observe operation is in fact supported with collections
      // enabled, we don't currently implement that operation for simplicity, as the key is
      // actually hidden away in the value data instead of the usual key data.
      CB_LOG_DEBUG("the observe operation is not supported with collections enabled");
      return { {}, {}, errc::common::feature_not_available };
    }
    if (key_len > 0 && supports_collection_id(pkt.command_)) {
      auto [id, remaining] = core::utils::decode_unsigned_leb128<std::uint32_t>(
        pkt.key_, core::utils::leb_128_no_throw{});
      if (remaining.empty()) {
        CB_LOG_DEBUG("unable to decode collection id");
        return { {}, {}, errc::network::protocol_error };
      }
      pkt.collection_id_ = id;
      auto prefix_length = static_cast<std::ptrdiff_t>(pkt.key_.size() - remaining.size());
      pkt.key_.erase(pkt.key_.begin(), pkt.key_.begin() + prefix_length);
    }
  }

  return { pkt, header_len + body_len, {} };
}
} // namespace couchbase::core::mcbp
