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
#include "core/document_id.hxx"
#include "core/io/mcbp_message.hxx"
#include "status.hxx"

namespace couchbase::core::protocol
{

class get_and_lock_response_body
{
public:
  static const inline client_opcode opcode = client_opcode::get_and_lock;

private:
  std::uint32_t flags_{};
  std::vector<std::byte> value_;

public:
  [[nodiscard]] auto value() const -> const auto&
  {
    return value_;
  }

  [[nodiscard]] auto flags() const -> std::uint32_t
  {
    return flags_;
  }

  auto parse(key_value_status_code status,
             const header_buffer& header,
             std::uint8_t framing_extras_size,
             std::uint16_t key_size,
             std::uint8_t extras_size,
             const std::vector<std::byte>& body,
             const cmd_info& info) -> bool;
};

class get_and_lock_request_body
{
public:
  using response_body_type = get_and_lock_response_body;
  static const inline client_opcode opcode = client_opcode::get_and_lock;

private:
  std::vector<std::byte> key_;
  std::uint32_t lock_time_{ 0 };
  std::vector<std::byte> extras_{};

public:
  void id(const document_id& id);

  void lock_time(std::uint32_t seconds)
  {
    lock_time_ = seconds;
  }

  [[nodiscard]] auto key() const -> const auto&
  {
    return key_;
  }

  [[nodiscard]] auto framing_extras() const -> const auto&
  {
    return empty_buffer;
  }

  [[nodiscard]] auto extras() -> const auto&
  {
    if (extras_.empty()) {
      fill_extras();
    }
    return extras_;
  }

  [[nodiscard]] auto value() const -> const auto&
  {
    return empty_buffer;
  }

  [[nodiscard]] auto size() -> std::size_t
  {
    if (extras_.empty()) {
      fill_extras();
    }
    return key_.size() + extras_.size();
  }

private:
  void fill_extras();
};

} // namespace couchbase::core::protocol
