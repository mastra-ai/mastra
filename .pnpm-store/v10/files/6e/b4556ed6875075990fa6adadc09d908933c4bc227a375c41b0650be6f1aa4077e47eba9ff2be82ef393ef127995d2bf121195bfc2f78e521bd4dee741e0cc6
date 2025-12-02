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

#include "client_opcode.hxx"
#include "cmd_info.hxx"
#include "core/io/mcbp_message.hxx"
#include "status.hxx"

namespace couchbase::core::protocol
{
class sasl_auth_response_body
{
public:
  static const inline client_opcode opcode = client_opcode::sasl_auth;

private:
  std::string value_;

public:
  auto parse(key_value_status_code status,
             const header_buffer& header,
             std::uint8_t framing_extras_size,
             std::uint16_t key_size,
             std::uint8_t extras_size,
             const std::vector<std::byte>& body,
             const cmd_info& info) -> bool;

  [[nodiscard]] auto value() const -> std::string_view
  {
    return value_;
  }
};

class sasl_auth_request_body
{
public:
  using response_body_type = sasl_auth_response_body;
  static const inline client_opcode opcode = client_opcode::sasl_auth;

private:
  std::vector<std::byte> key_;
  std::vector<std::byte> value_;

public:
  void mechanism(std::string_view mech);

  void sasl_data(std::string_view data);

  [[nodiscard]] auto key() const -> const auto&
  {
    return key_;
  }

  [[nodiscard]] auto framing_extras() const -> const auto&
  {
    return empty_buffer;
  }

  [[nodiscard]] auto extras() const -> const auto&
  {
    return empty_buffer;
  }

  [[nodiscard]] auto value() const -> const auto&
  {
    return value_;
  }

  [[nodiscard]] auto size() const -> std::size_t
  {
    return key_.size() + value_.size();
  }
};

} // namespace couchbase::core::protocol
