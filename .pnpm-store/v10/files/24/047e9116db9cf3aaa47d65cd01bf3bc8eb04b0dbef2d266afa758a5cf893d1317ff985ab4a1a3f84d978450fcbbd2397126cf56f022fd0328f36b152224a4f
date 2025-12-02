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

#pragma once

#include "core/fmt/key_value_extended_error_info.hxx"
#include "core/fmt/key_value_status_code.hxx"

#include "client_opcode.hxx"
#include "client_opcode_fmt.hxx"
#include "cmd_info.hxx"
#include "core/io/mcbp_message.hxx"
#include "core/utils/byteswap.hxx"
#include "datatype.hxx"
#include "enhanced_error_info.hxx"
#include "frame_info_id.hxx"
#include "magic.hxx"
#include "magic_fmt.hxx"
#include "status.hxx"
#include <couchbase/cas.hxx>

#include <gsl/assert>
#include <spdlog/fmt/bundled/core.h>

#include <cmath>
#include <cstring>
#include <optional>

namespace couchbase::core::protocol
{

auto
parse_server_duration_us(const io::mcbp_message& msg) -> double;

auto
parse_enhanced_error(std::string_view str, key_value_extended_error_info& info) -> bool;

template<typename Body>
class client_response
{
private:
  Body body_;
  magic magic_{ magic::client_response };
  client_opcode opcode_{ client_opcode::invalid };
  header_buffer header_{};
  std::uint8_t data_type_{ 0 };
  std::vector<std::byte> data_{};
  std::uint16_t key_size_{ 0 };
  std::uint8_t framing_extras_size_{ 0 };
  std::uint8_t extras_size_{ 0 };
  std::size_t body_size_{ 0 };
  key_value_status_code status_{};
  std::optional<key_value_extended_error_info> error_;
  std::uint32_t opaque_{};
  std::uint64_t cas_{};
  cmd_info info_{};

public:
  client_response() = default;
  explicit client_response(io::mcbp_message&& msg)
    : client_response(std::move(msg), {})
  {
  }

  client_response(io::mcbp_message&& msg, const cmd_info& info)
    : header_(msg.header_data())
    , data_(std::move(msg.body))
    , info_(info)
  {
    verify_header();
    parse_body();
  }

  [[nodiscard]] auto opcode() const -> client_opcode
  {
    return opcode_;
  }

  [[nodiscard]] auto status() const -> key_value_status_code
  {
    return status_;
  }

  [[nodiscard]] auto cas() const -> couchbase::cas
  {
    return couchbase::cas{ cas_ };
  }

  [[nodiscard]] auto opaque() const -> std::uint32_t
  {
    return opaque_;
  }

  auto body() -> Body&
  {
    return body_;
  }

  [[nodiscard]] auto body() const -> const Body&
  {
    return body_;
  }

  [[nodiscard]] auto header() -> header_buffer&
  {
    return header_;
  }

  void verify_header()
  {
    Expects(header_[0] == static_cast<std::byte>(magic::alt_client_response) ||
            header_[0] == static_cast<std::byte>(magic::client_response));
    Expects(header_[1] == static_cast<std::byte>(Body::opcode));
    magic_ = static_cast<magic>(header_[0]);
    opcode_ = static_cast<client_opcode>(header_[1]);
    data_type_ = std::to_integer<std::uint8_t>(header_[5]);

    std::uint16_t status = 0;
    memcpy(&status, header_.data() + 6, sizeof(status));
    status = utils::byte_swap(status);
    status_ = static_cast<key_value_status_code>(status);

    extras_size_ = std::to_integer<std::uint8_t>(header_[4]);
    if (magic_ == magic::alt_client_response) {
      framing_extras_size_ = std::to_integer<std::uint8_t>(header_[2]);
      key_size_ = std::to_integer<std::uint8_t>(header_[3]);
    } else {
      memcpy(&key_size_, header_.data() + 2, sizeof(key_size_));
      key_size_ = utils::byte_swap(key_size_);
    }

    std::uint32_t field = 0;
    memcpy(&field, header_.data() + 8, sizeof(field));
    body_size_ = utils::byte_swap(field);
    data_.resize(body_size_);

    memcpy(&opaque_, header_.data() + 12, sizeof(opaque_));
    opaque_ = utils::byte_swap(opaque_);

    memcpy(&cas_, header_.data() + 16, sizeof(cas_));
    cas_ = utils::byte_swap(cas_);
  }

  [[nodiscard]] auto error_info() const -> std::optional<key_value_extended_error_info>
  {
    return error_;
  }

  [[nodiscard]] auto error_message() const -> std::string
  {
    if (error_) {
      return fmt::format(
        R"(magic={}, opcode={}, status={}, error={})", magic_, opcode_, status_, *error_);
    }
    return fmt::format("magic={}, opcode={}, status={}", magic_, opcode_, status_);
  }

  void parse_body()
  {
    parse_framing_extras();
    bool parsed =
      body_.parse(status_, header_, framing_extras_size_, key_size_, extras_size_, data_, info_);
    if (status_ != key_value_status_code::success && !parsed && has_json_datatype(data_type_)) {
      key_value_extended_error_info err;
      std::vector<std::uint8_t>::difference_type offset =
        framing_extras_size_ + extras_size_ + key_size_;
      std::string_view enhanced_error_text{ reinterpret_cast<const char*>(data_.data()) + offset,
                                            data_.size() - static_cast<std::size_t>(offset) };
      if (parse_enhanced_error(enhanced_error_text, err)) {
        error_.emplace(err);
      }
    }
  }

  void parse_framing_extras()
  {
    if (framing_extras_size_ == 0) {
      return;
    }
    size_t offset = 0;
    while (offset < framing_extras_size_) {
      auto frame_size = std::to_integer<std::uint8_t>(data_[offset] & std::byte{ 0b1111 });
      auto frame_id = std::to_integer<std::uint8_t>((data_[offset] >> 4U) & std::byte{ 0b1111 });
      ++offset;
      if (frame_id == static_cast<std::uint8_t>(response_frame_info_id::server_duration) &&
          frame_size == 2 && framing_extras_size_ - offset >= frame_size) {
        std::uint16_t encoded_duration{};
        std::memcpy(&encoded_duration, data_.data() + offset, sizeof(encoded_duration));
        encoded_duration = utils::byte_swap(encoded_duration);
        info_.server_duration_us = std::pow(encoded_duration, 1.74) / 2;
      }
      offset += frame_size;
    }
  }

  [[nodiscard]] auto data() -> std::vector<std::byte>&
  {
    return data_;
  }
};
} // namespace couchbase::core::protocol
