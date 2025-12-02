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
#include "core/impl/subdoc/command.hxx"
#include "core/io/mcbp_message.hxx"
#include "status.hxx"

#include <gsl/assert>

namespace couchbase::core::protocol
{

class lookup_in_response_body
{
public:
  static const inline client_opcode opcode = client_opcode::subdoc_multi_lookup;

  struct lookup_in_field {
    key_value_status_code status{};
    std::string value;
  };

private:
  std::vector<lookup_in_field> fields_;

public:
  [[nodiscard]] auto fields() const -> const std::vector<lookup_in_field>&
  {
    return fields_;
  }

  auto parse(key_value_status_code status,
             const header_buffer& header,
             std::uint8_t framing_extras_size,
             std::uint16_t key_size,
             std::uint8_t extras_size,
             const std::vector<std::byte>& body,
             const cmd_info& info) -> bool;
};

class lookup_in_request_body
{
public:
  using response_body_type = lookup_in_response_body;
  static const inline client_opcode opcode = client_opcode::subdoc_multi_lookup;

  /**
   * Allow access to XATTRs for deleted documents (instead of returning KEY_ENOENT).
   */
  static const inline std::uint8_t doc_flag_access_deleted = 0b0000'0100;

private:
  std::vector<std::byte> key_;
  std::vector<std::byte> extras_{};
  std::vector<std::byte> value_{};

  std::uint8_t flags_{ 0 };
  std::vector<couchbase::core::impl::subdoc::command> specs_;

public:
  void id(const document_id& id);

  void access_deleted(bool value)
  {
    if (value) {
      flags_ = doc_flag_access_deleted;
    } else {
      flags_ = 0;
    }
  }

  void specs(const std::vector<couchbase::core::impl::subdoc::command>& specs)
  {
    specs_ = specs;
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

  [[nodiscard]] auto value() -> const auto&
  {
    if (value_.empty()) {
      fill_value();
    }
    return value_;
  }

  [[nodiscard]] auto size() -> std::size_t
  {
    if (extras_.empty()) {
      fill_extras();
    }
    if (value_.empty()) {
      fill_value();
    }
    return key_.size() + extras_.size() + value_.size();
  }

private:
  void fill_extras();

  void fill_value();
};

} // namespace couchbase::core::protocol
