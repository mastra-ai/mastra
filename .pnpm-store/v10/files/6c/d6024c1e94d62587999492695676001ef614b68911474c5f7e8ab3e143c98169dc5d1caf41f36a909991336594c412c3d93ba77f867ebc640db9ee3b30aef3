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

#include "../io/mcbp_message.hxx"
#include "cmd_info.hxx"
#include "datatype.hxx"
#include "magic.hxx"
#include "server_opcode.hxx"
#include "status.hxx"

#include <couchbase/cas.hxx>

#include <gsl/assert>

#include <cstring>

namespace couchbase::core::protocol
{

template<typename Body>
class server_request
{
private:
  static const inline magic magic_ = magic::server_request;

  Body body_;
  server_opcode opcode_{ server_opcode::invalid };
  header_buffer header_{};
  std::uint8_t data_type_{};
  std::vector<std::byte> data_;
  std::size_t body_size_{};
  std::uint32_t opaque_{};
  std::uint64_t cas_{};
  cmd_info info_{};

public:
  server_request() = default;
  explicit server_request(io::mcbp_message&& msg)
    : server_request(std::move(msg), {})
  {
  }

  server_request(io::mcbp_message&& msg, const cmd_info& info)
    : header_(msg.header_data())
    , data_(std::move(msg.body))
    , info_(info)
  {
    verify_header();
    parse_body();
  }

  [[nodiscard]] auto opcode() const -> server_opcode
  {
    return opcode_;
  }

  [[nodiscard]] auto body_size() const -> std::size_t
  {
    return body_size_;
  }

  [[nodiscard]] auto cas() const -> couchbase::cas
  {
    return couchbase::cas{ cas_ };
  }

  [[nodiscard]] auto opaque() const -> std::uint32_t
  {
    return opaque_;
  }

  [[nodiscard]] auto body() -> Body&
  {
    return body_;
  }

  [[nodiscard]] auto header() -> header_buffer&
  {
    return header_;
  }

  void verify_header()
  {
    Expects(header_[0] == static_cast<std::byte>(magic_));
    Expects(header_[1] == static_cast<std::byte>(Body::opcode));
    opcode_ = static_cast<server_opcode>(header_[1]);
    data_type_ = std::to_integer<std::uint8_t>(header_[5]);

    std::uint32_t field = 0;
    memcpy(&field, header_.data() + 8, sizeof(field));
    body_size_ = utils::byte_swap(field);
    data_.resize(body_size_);

    memcpy(&opaque_, header_.data() + 12, sizeof(opaque_));

    memcpy(&cas_, header_.data() + 16, sizeof(cas_));
  }

  void parse_body()
  {
    body_.parse(header_, data_, info_);
  }

  [[nodiscard]] auto data() -> std::vector<std::byte>&
  {
    return data_;
  }
};
} // namespace couchbase::core::protocol
