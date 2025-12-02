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
#include "core/topology/error_map.hxx"
#include "status.hxx"

namespace couchbase::core::protocol
{

class get_error_map_response_body
{
public:
  static const inline client_opcode opcode = client_opcode::get_error_map;

private:
  error_map errmap_{};

public:
  [[nodiscard]] auto errmap() const -> const couchbase::core::error_map&
  {
    return errmap_;
  }

  auto parse(key_value_status_code status,
             const header_buffer& header,
             std::uint8_t framing_extras_size,
             std::uint16_t key_size,
             std::uint8_t extras_size,
             const std::vector<std::byte>& body,
             const cmd_info& info) -> bool;
};

class get_error_map_request_body
{
public:
  using response_body_type = get_error_map_response_body;
  static const inline client_opcode opcode = client_opcode::get_error_map;

private:
  std::uint16_t version_{ 2 };
  std::vector<std::byte> value_;

public:
  void version(std::uint16_t version)
  {
    version_ = version;
  }

  [[nodiscard]] auto key() const -> const std::string&
  {
    return empty_string;
  }

  [[nodiscard]] auto framing_extras() const -> const auto&
  {
    return empty_buffer;
  }

  [[nodiscard]] auto extras() const -> const auto&
  {
    return empty_buffer;
  }

  [[nodiscard]] auto value() -> const auto&
  {
    if (value_.empty()) {
      fill_body();
    }
    return value_;
  }

  [[nodiscard]] auto size() -> std::size_t
  {
    if (value_.empty()) {
      fill_body();
    }
    return value_.size();
  }

private:
  void fill_body();
};

} // namespace couchbase::core::protocol
