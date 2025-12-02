/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2024-Present Couchbase, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

#include "websocket_codec.hxx"

#include "core/crypto/cbcrypto.h"
#include "core/platform/base64.h"
#include "core/platform/random.h"

#include <llhttp.h>
#include <spdlog/fmt/bundled/core.h>

#include <algorithm>
#include <array>
#include <cstdint>
#include <cstring>
#include <map>
#include <optional>
#include <random>
#include <variant>

namespace couchbase::core
{
namespace
{
/*
     0                   1                   2                   3
     0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
    +-+-+-+-+-------+-+-------------+-------------------------------+
    |F|R|R|R| opcode|M| Payload len | Extended payload length       |
    |I|S|S|S|   (4) |A|     (7)     |          (16/64)              |
    |N|V|V|V|       |S|             | (if payload len==126/127)     |
    | |1|2|3|       |K|             |                               |
    +-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
    |     Extended payload length continued, if payload len == 127  |
    + - - - - - - - - - - - - - - - +-------------------------------+
    |                               | Masking-key, if MASK set to 1 |
    +-------------------------------+-------------------------------+
    | Masking-key (continued)       | Payload Data                  |
    +-------------------------------- - - - - - - - - - - - - - - - +
    :                        Payload Data continued ...             :
    + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
    |                        Payload Data continued ...             |
    +---------------------------------------------------------------+
 */
constexpr std::uint8_t flag_fin{ 0b1000'0000 };
constexpr std::uint8_t flag_mask{ 0b1000'0000 };

constexpr std::uint8_t reserved_bit_mask{ 0b0111'0000 };
constexpr std::uint8_t opcode_mask{ 0b0000'1111 };
constexpr std::uint8_t payload_length_7_mask{ 0b0111'1111 };

constexpr std::uint8_t opcode_continuation{ 0x00 };
constexpr std::uint8_t opcode_text{ 0x01 };
constexpr std::uint8_t opcode_binary{ 0x2 };
constexpr std::uint8_t opcode_close{ 0x08 };
constexpr std::uint8_t opcode_ping{ 0x09 };
constexpr std::uint8_t opcode_pong{ 0x0a };

auto
generate_masking_key() -> std::array<std::byte, 4>
{
  thread_local std::random_device rd;
  thread_local std::uniform_int_distribution<std::uint16_t> dist(0, 0xff);

  return {
    static_cast<std::byte>(dist(rd)),
    static_cast<std::byte>(dist(rd)),
    static_cast<std::byte>(dist(rd)),
    static_cast<std::byte>(dist(rd)),
  };
}

auto
generate_session_key() -> std::string
{
  const couchbase::core::RandomGenerator randomGenerator;
  std::array<std::byte, 16> key{};
  if (!core::RandomGenerator::getBytes(key.data(), key.size())) {
    throw std::bad_alloc();
  }
  return core::base64::encode(key, false);
}

auto
signature_is_valid(const std::string& session_key, const std::string& signature) -> bool
{
  // RFC 6455, Section 1.3
  static const std::string websocket_guid{ "258EAFA5-E914-47DA-95CA-C5AB0DC85B11" };
  const std::string salted_key{ fmt::format("{}{}", session_key, websocket_guid) };
  auto hash = core::crypto::digest(core::crypto::Algorithm::ALG_SHA1, salted_key);
  return core::base64::encode(hash, false) == signature;
}

auto
case_insensitive_equals(const std::string& str1, const std::string& str2) -> bool
{
  if (str1.size() != str2.size()) {
    return false;
  }

  return std::equal(str1.begin(), str1.end(), str2.begin(), [](unsigned char c1, unsigned char c2) {
    return std::tolower(c1) == std::tolower(c2);
  });
}

struct context {
  websocket_callbacks& callbacks;
  const websocket_codec& ws;
};
} // namespace

class websocket_handler
{
public:
  websocket_handler() = default;
  websocket_handler(const websocket_handler&) = delete;
  websocket_handler(websocket_handler&&) noexcept = delete;
  auto operator=(const websocket_handler&) -> websocket_handler& = delete;
  auto operator=(websocket_handler&&) noexcept -> websocket_handler& = delete;
  virtual ~websocket_handler() = default;

  virtual auto feed(gsl::span<std::byte> data, const context& ctx)
    -> std::unique_ptr<websocket_handler> = 0;
};

namespace
{

void
mask_payload_data(gsl::span<std::byte> masking_key, gsl::span<std::byte> payload)
{
  for (std::size_t i = 0; i < payload.size(); ++i) {
    payload[i] ^= masking_key[i % masking_key.size()];
  }
}

struct decoded_frame {
  std::uint8_t type;
  gsl::span<std::byte> payload;
  std::size_t consumed_bytes;
  bool expected_continuation;
};

struct partial_frame {
  std::uint8_t type;
  std::vector<std::byte> payload;
};

struct decoding_error {
  std::string message;
};

struct need_more_data {
};

using decode_status = std::variant<decoded_frame, decoding_error, need_more_data>;

auto
decode_frame(gsl::span<std::byte> data, bool expected_continuation) -> decode_status;

class error_handler : public websocket_handler
{
private:
  std::string message_;

public:
  error_handler(std::string message, const context& ctx)
    : message_{ std::move(message) }
  {
    ctx.callbacks.on_error(ctx.ws, message_);
  }

  auto feed(gsl::span<std::byte> /* data */, const context& ctx)
    -> std::unique_ptr<websocket_handler> override
  {
    ctx.callbacks.on_error(ctx.ws, message_);
    return nullptr;
  }
};

class data_handler : public websocket_handler
{
private:
  std::vector<std::byte> buffer_{};
  std::optional<partial_frame> partial_response_{};

public:
  explicit data_handler(const context& ctx, gsl::span<std::byte> remaining = {})
    : buffer_{ remaining.begin(), remaining.end() }
  {
    ctx.callbacks.on_ready(ctx.ws);
  }

  auto feed(gsl::span<std::byte> data, const context& ctx)
    -> std::unique_ptr<websocket_handler> override
  {
    std::vector<std::byte> buffer{};
    if (!buffer_.empty()) {
      std::swap(buffer_, buffer);
      std::copy(data.begin(), data.end(), std::back_insert_iterator(buffer));
      data = buffer;
    }
    while (!data.empty()) {
      auto status = decode_frame(data, partial_response_.has_value());
      if (std::holds_alternative<decoding_error>(status)) {
        return std::make_unique<error_handler>(
          fmt::format("Decoding error: {}", std::get<decoding_error>(status).message), ctx);
      }
      if (std::holds_alternative<need_more_data>(status)) {
        std::copy(data.begin(), data.end(), std::back_insert_iterator(buffer_));
        return nullptr;
      }
      if (std::holds_alternative<decoded_frame>(status)) {
        auto frame = std::get<decoded_frame>(status);
        switch (frame.type) {
          case opcode_text:
            if (frame.expected_continuation) {
              partial_response_ = partial_frame{
                frame.type,
                { frame.payload.begin(), frame.payload.end() },
              };
            } else {
              ctx.callbacks.on_text(ctx.ws, frame.payload);
            }
            break;
          case opcode_binary:
            if (frame.expected_continuation) {
              partial_response_ = partial_frame{
                frame.type,
                { frame.payload.begin(), frame.payload.end() },
              };
            } else {
              ctx.callbacks.on_binary(ctx.ws, frame.payload);
            }
            break;
          case opcode_close:
            ctx.callbacks.on_close(ctx.ws, frame.payload);
            break;
          case opcode_ping:
            ctx.callbacks.on_ping(ctx.ws, frame.payload);
            break;
          case opcode_pong:
            ctx.callbacks.on_pong(ctx.ws, frame.payload);
            break;
          case opcode_continuation:
            if (auto& response = partial_response_; response.has_value()) {
              if (frame.expected_continuation) {
                std::copy(frame.payload.begin(),
                          frame.payload.end(),
                          std::back_insert_iterator(response->payload));
              } else {
                if (response->type == opcode_text) {
                  ctx.callbacks.on_text(ctx.ws, response->payload);
                } else {
                  ctx.callbacks.on_binary(ctx.ws, response->payload);
                }
              }
            } else {
              return std::make_unique<error_handler>("Unexpected continuation frame", ctx);
            }
            break;
          default:
            return std::make_unique<error_handler>(
              fmt::format("Unexpected frame.type: {}", frame.type), ctx);
        }
        data = data.subspan(frame.consumed_bytes);
      }
    }

    return nullptr;
  }
};

class open_handshake : public websocket_handler
{
public:
  open_handshake()
  {
    llhttp_settings_init(&settings_);
    settings_.on_status = on_status;
    settings_.on_header_field = on_header_field;
    settings_.on_header_value = on_header_value;
    settings_.on_body = on_body;
    settings_.on_message_complete = on_message_complete;
    llhttp_init(&parser_, HTTP_RESPONSE, &settings_);
    parser_.data = this;
  }

  auto feed(gsl::span<std::byte> data, const context& ctx)
    -> std::unique_ptr<websocket_handler> override
  {
    auto error = llhttp_execute(&parser_, reinterpret_cast<const char*>(data.data()), data.size());
    if (error != HPE_OK && error != HPE_PAUSED_UPGRADE) {
      return std::make_unique<error_handler>(
        fmt::format("Failed to parse HTTP response: {}",
                    llhttp_errno_name(llhttp_get_errno(&parser_))),
        ctx);
    }
    if (complete_) {
      if (status_code_ != 101) {
        return std::make_unique<error_handler>(
          fmt::format("Response status must be 101. ({} {})", status_code_, status_message_), ctx);
      }
      if (!case_insensitive_equals(headers_["connection"], "upgrade")) {
        return std::make_unique<error_handler>(
          "Request has MUST contain Connection header field with value including \"Upgrade\"", ctx);
      }
      if (!case_insensitive_equals(headers_["upgrade"], "websocket")) {
        return std::make_unique<error_handler>(
          "Request has MUST contain Upgrade header field with value including \"websocket\"", ctx);
      }

      if (!signature_is_valid(ctx.ws.session_key(), headers_["sec-websocket-accept"])) {
        return std::make_unique<error_handler>(
          "Request has MUST contain Sec-WebSocket-Accept with valid key", ctx);
      }

      if (error == HPE_PAUSED_UPGRADE) {
        auto bytes_parsed =
          llhttp_get_error_pos(&parser_) - reinterpret_cast<const char*>(data.data());
        return std::make_unique<data_handler>(ctx,
                                              data.subspan(static_cast<std::size_t>(bytes_parsed)));
      }
      return std::make_unique<data_handler>(ctx);
    }
    return nullptr;
  }

private:
  static auto on_status(llhttp_t* parser, const char* at, std::size_t length) -> int
  {
    auto* self = static_cast<open_handshake*>(parser->data);
    self->status_message_.assign(at, length);
    self->status_code_ = parser->status_code;
    return 0;
  }

  static auto on_header_field(llhttp_t* parser, const char* at, std::size_t length) -> int
  {
    auto* self = static_cast<open_handshake*>(parser->data);
    self->header_field_.clear();
    self->header_field_.reserve(length);
    for (std::size_t i = 0; i < length; ++i) {
      self->header_field_ += static_cast<char>(std::tolower(at[i]));
    }
    return 0;
  }

  static auto on_header_value(llhttp_t* parser, const char* at, std::size_t length) -> int
  {
    auto* self = static_cast<open_handshake*>(parser->data);
    self->headers_[self->header_field_] = std::string(at, length);
    return 0;
  }

  static auto on_body(llhttp_t* parser, const char* at, std::size_t length) -> int
  {
    auto* self = static_cast<open_handshake*>(parser->data);
    self->body_.append(std::string_view{ at, length });
    return 0;
  }

  static auto on_body_after_upgrade(llhttp_t* parser, const char* at, std::size_t length) -> int
  {
    auto* self = static_cast<open_handshake*>(parser->data);
    self->body_ = std::string_view{ at, length };
    return 0;
  }

  static auto on_message_complete(llhttp_t* parser) -> int
  {
    auto* self = static_cast<open_handshake*>(parser->data);
    self->complete_ = true;
    return 0;
  }

  llhttp_settings_t settings_{};
  llhttp_t parser_{};

  std::string header_field_{};
  bool complete_{};

  std::uint32_t status_code_{ 0 };
  std::string status_message_{};
  std::map<std::string, std::string> headers_{};
  std::string body_{};
};

constexpr auto
is_data_frame(std::uint8_t opcode) -> bool
{
  switch (opcode) {
    case opcode_text:
    case opcode_binary:
      return true;
    default:
      break;
  }
  return false;
}

constexpr auto
is_control_frame(std::uint8_t opcode) -> bool
{
  switch (opcode) {
    case opcode_close:
    case opcode_ping:
    case opcode_pong:
      return true;
    default:
      break;
  }
  return false;
}

auto
encode_payload_length(std::size_t length) -> std::vector<std::byte>
{
  if (length <= 125) { // 7 bit
    const std::uint8_t field_7_bit = static_cast<std::uint8_t>(length) | flag_mask;
    return { std::byte{ field_7_bit } };
  }
  if (length <= 0xFFFF) { // 7 + 16 bit
    constexpr std::uint8_t field_7_bit = 126 | flag_mask;
    return {
      std::byte{ field_7_bit },
      static_cast<std::byte>((length >> 8) & 0xff),
      static_cast<std::byte>(length & 0xff),
    };
  }
  // 7 + 64
  constexpr std::uint8_t field_7_bit = 127 | flag_mask;
  return {
    std::byte{ field_7_bit },
    static_cast<std::byte>((length >> 56) & 0xff),
    static_cast<std::byte>((length >> 48) & 0xff),
    static_cast<std::byte>((length >> 40) & 0xff),
    static_cast<std::byte>((length >> 32) & 0xff),
    static_cast<std::byte>((length >> 24) & 0xff),
    static_cast<std::byte>((length >> 16) & 0xff),
    static_cast<std::byte>((length >> 8) & 0xff),
    static_cast<std::byte>(length & 0xff),
  };
}

auto
decode_uint64(gsl::span<std::byte> data) -> std::uint64_t
{
  std::uint64_t result{};
  std::memcpy(&result, data.data(), sizeof(result));

  return                                  //
    (result & 0x00000000000000FF) << 56 | //
    (result & 0x000000000000FF00) << 40 | //
    (result & 0x0000000000FF0000) << 24 | //
    (result & 0x00000000FF000000) << 8 |  //
    (result & 0x000000FF00000000) >> 8 |  //
    (result & 0x0000FF0000000000) >> 24 | //
    (result & 0x00FF000000000000) >> 40 | //
    (result & 0xFF00000000000000) >> 56;
}

auto
decode_uint16(gsl::span<std::byte> data) -> std::uint16_t
{
  std::uint16_t result{};
  std::memcpy(&result, data.data(), sizeof(result));

  return static_cast<std::uint16_t>(result << 8 | result >> 8);
}

auto
decode_frame(gsl::span<std::byte> data, bool expected_continuation) -> decode_status
{
  auto first_byte = static_cast<std::uint8_t>(data[0]);
  if ((first_byte & reserved_bit_mask) != 0) {
    return decoding_error{ "unsupported error: reserved bit used" };
  }

  const bool expect_more = (first_byte & flag_fin) == 0;
  const std::uint8_t frame_type = first_byte & opcode_mask;

  if (expect_more && is_control_frame(frame_type)) {
    return decoding_error{ "unsupported error: fragmented control frame" };
  }

  if (is_data_frame(frame_type) && expected_continuation) {
    return decoding_error{ "unsupported error: expected continuation frame" };
  }

  const auto second_byte = static_cast<std::uint8_t>(data[1]);

  const bool masked = (second_byte & flag_mask) != 0;

  const std::uint8_t length_7 = second_byte & payload_length_7_mask;
  if (is_control_frame(frame_type) && length_7 > 125) {
    return decoding_error{ "unsupported error: control frame is too long" };
  }

  std::size_t header_length{};
  std::size_t payload_length{};

  switch (length_7) {
    case 127:
      if (data.size() < 10) {
        return need_more_data{};
      }
      header_length = 10;
      payload_length = decode_uint64(data.subspan(2, sizeof(std::uint64_t)));
      break;

    case 126:
      if (data.size() < 4) {
        return need_more_data{};
      }
      header_length = 4;
      payload_length = decode_uint16(data.subspan(2, sizeof(std::uint16_t)));
      break;

    default:
      header_length = 2;
      payload_length = length_7;
  }

  constexpr std::size_t masking_key_size{ 4 };
  if (data.size() < header_length + payload_length + (masked ? masking_key_size : 0)) {
    return need_more_data{};
  }
  auto consumed_bytes = header_length;

  auto payload = data.subspan(header_length);
  if (masked) {
    auto masking_key = data.subspan(header_length, masking_key_size);
    consumed_bytes += masking_key.size();
    payload = data.subspan(header_length + masking_key.size());
    mask_payload_data(masking_key, payload);
  }
  consumed_bytes += payload.size();

  return decoded_frame{
    frame_type,
    payload,
    consumed_bytes,
    expect_more,
  };
}

template<typename T>
auto
encode_frame(std::uint8_t opcode, T message) -> std::vector<std::byte>
{
  std::vector<std::byte> payload{};
  payload.reserve(7 + message.size());
  payload.emplace_back(static_cast<std::byte>(opcode | flag_fin));
  auto encoded_length = encode_payload_length(message.size());
  std::copy(encoded_length.begin(), encoded_length.end(), std::back_insert_iterator(payload));
  auto masking_key = generate_masking_key();
  std::copy(masking_key.begin(), masking_key.end(), std::back_insert_iterator(payload));
  auto header_length = payload.size();
  std::for_each(message.begin(), message.end(), [&payload](auto ch) {
    payload.push_back(static_cast<std::byte>(ch));
  });
  mask_payload_data(masking_key,
                    { payload.data() + header_length, payload.size() - header_length });
  return payload;
}
} // namespace

websocket_codec::websocket_codec(websocket_callbacks* callbacks)
  : session_key_{ generate_session_key() }
  , callbacks_{ callbacks }
  , handler_{ std::make_unique<open_handshake>() }
{
}

auto
websocket_codec::session_key() const -> const std::string&
{
  return session_key_;
}

websocket_codec::~websocket_codec() = default;

void
websocket_codec::feed(gsl::span<std::byte> chunk)
{
  auto new_handler = handler_->feed(chunk,
                                    context{
                                      *callbacks_,
                                      *this,
                                    });
  if (new_handler) {
    std::swap(handler_, new_handler);
  }
}

void
websocket_codec::feed(std::string_view chunk)
{
  std::vector<std::byte> copy{ reinterpret_cast<const std::byte*>(chunk.data()),
                               reinterpret_cast<const std::byte*>(chunk.data()) + chunk.size() };
  feed(copy);
}

auto
websocket_codec::text(std::string_view message) const -> std::vector<std::byte>
{
  return encode_frame(opcode_text, message);
}

auto
websocket_codec::binary(gsl::span<std::byte> message) const -> std::vector<std::byte>
{
  return encode_frame(opcode_binary, message);
}

auto
websocket_codec::ping(gsl::span<std::byte> message) const -> std::vector<std::byte>
{
  return encode_frame(opcode_ping, message);
}

auto
websocket_codec::pong(gsl::span<std::byte> message) const -> std::vector<std::byte>
{
  return encode_frame(opcode_pong, message);
}

auto
websocket_codec::close(gsl::span<std::byte> message) const -> std::vector<std::byte>
{
  return encode_frame(opcode_close, message);
}
} // namespace couchbase::core
