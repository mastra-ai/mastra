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
#include "core/topology/collections_manifest.hxx"
#include "status.hxx"

namespace couchbase::core::protocol
{

class get_collections_manifest_response_body
{
public:
  static const inline client_opcode opcode = client_opcode::get_collections_manifest;

private:
  topology::collections_manifest manifest_;

public:
  [[nodiscard]] auto manifest() const -> const couchbase::core::topology::collections_manifest&
  {
    return manifest_;
  }

  auto parse(key_value_status_code status,
             const header_buffer& header,
             std::uint8_t framing_extras_size,
             std::uint16_t key_size,
             std::uint8_t extras_size,
             const std::vector<std::byte>& body,
             const cmd_info& info) -> bool;
};

class get_collections_manifest_request_body
{
public:
  using response_body_type = get_collections_manifest_response_body;
  static const inline client_opcode opcode = client_opcode::get_collections_manifest;

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

  [[nodiscard]] auto value() const -> const auto&
  {
    return empty_buffer;
  }

  [[nodiscard]] auto size() const -> std::size_t
  {
    return 0;
  }
};

} // namespace couchbase::core::protocol
