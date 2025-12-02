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
#include <couchbase/cas.hxx>

namespace couchbase::core::protocol
{

class get_meta_response_body
{
public:
  static const inline client_opcode opcode = client_opcode::get_meta;

private:
  std::uint32_t deleted_{};
  std::uint32_t flags_{};
  std::uint32_t expiry_{};
  std::uint64_t sequence_number_{};
  std::uint8_t datatype_{};

public:
  [[nodiscard]] auto is_deleted() const -> bool
  {
    return deleted_ != 0;
  }

  [[nodiscard]] auto flags() const -> std::uint32_t
  {
    return flags_;
  }

  [[nodiscard]] auto expiry() const -> std::uint32_t
  {
    return expiry_;
  }

  [[nodiscard]] auto sequence_number() const -> std::uint64_t
  {
    return sequence_number_;
  }

  [[nodiscard]] auto datatype() const -> std::uint8_t
  {
    return datatype_;
  }

  auto parse(key_value_status_code status,
             const header_buffer& header,
             std::uint8_t framing_extras_size,
             std::uint16_t key_size,
             std::uint8_t extras_size,
             const std::vector<std::byte>& body,
             const cmd_info& info) -> bool;
};

class get_meta_request_body
{
public:
  using response_body_type = get_meta_response_body;
  static const inline client_opcode opcode = client_opcode::get_meta;

private:
  std::vector<std::byte> key_;
  std::vector<std::byte> extras_{
    std::byte{ 0x02 },
    /* format version, supported since Couchbase Server 5.0, includes datatype into response */
  };

public:
  void id(const document_id& id);

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
    return extras_;
  }

  [[nodiscard]] auto value() -> const auto&
  {
    return empty_buffer;
  }

  [[nodiscard]] auto size() -> std::size_t
  {
    return extras_.size() + key_.size();
  }
};

} // namespace couchbase::core::protocol
