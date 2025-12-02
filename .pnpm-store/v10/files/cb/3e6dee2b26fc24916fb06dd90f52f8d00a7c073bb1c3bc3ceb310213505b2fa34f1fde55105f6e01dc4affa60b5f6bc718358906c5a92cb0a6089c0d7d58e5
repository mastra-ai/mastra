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

#include <couchbase/durability_level.hxx>
#include <couchbase/mutation_token.hxx>

namespace couchbase::core::protocol
{

class replace_response_body
{
public:
  static const inline client_opcode opcode = client_opcode::replace;

private:
  mutation_token token_;

public:
  auto token() -> mutation_token&
  {
    return token_;
  }

  [[nodiscard]] auto token() const -> const mutation_token&
  {
    return token_;
  }

  auto parse(key_value_status_code status,
             const header_buffer& header,
             std::uint8_t framing_extras_size,
             std::uint16_t key_size,
             std::uint8_t extras_size,
             const std::vector<std::byte>& body,
             const cmd_info& info) -> bool;
};

class replace_request_body
{
public:
  using response_body_type = replace_response_body;
  static const inline client_opcode opcode = client_opcode::replace;

private:
  std::vector<std::byte> key_{};
  std::vector<std::byte> extras_{};
  std::vector<std::byte> content_{};
  std::uint32_t flags_{};
  std::uint32_t expiry_{};
  std::vector<std::byte> framing_extras_{};

public:
  void id(const document_id& id);

  void durability(durability_level level, std::optional<std::uint16_t> timeout);

  void preserve_expiry();

  void content(const std::vector<std::byte>& content)
  {
    content_ = { content.begin(), content.end() };
  }

  void flags(std::uint32_t flags)
  {
    flags_ = flags;
  }

  void expiry(std::uint32_t value)
  {
    expiry_ = value;
  }

  [[nodiscard]] auto key() const -> const auto&
  {
    return key_;
  }

  [[nodiscard]] auto framing_extras() const -> const auto&
  {
    return framing_extras_;
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
    return content_;
  }

  [[nodiscard]] auto size() -> std::size_t
  {
    if (extras_.empty()) {
      fill_extras();
    }
    return framing_extras_.size() + extras_.size() + key_.size() + content_.size();
  }

private:
  void fill_extras();
};

} // namespace couchbase::core::protocol
