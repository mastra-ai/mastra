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

#include "cmd_info.hxx"
#include "core/io/mcbp_message.hxx"
#include "core/topology/configuration.hxx"
#include "server_opcode.hxx"

namespace couchbase::core::protocol
{

class cluster_map_change_notification_request_body
{
public:
  static const inline server_opcode opcode = server_opcode::cluster_map_change_notification;

private:
  std::uint32_t protocol_revision_{};
  std::string bucket_{};
  std::optional<topology::configuration> config_{};
  std::optional<std::string_view> config_text_;

public:
  [[nodiscard]] auto protocol_revision() const -> std::uint32_t
  {
    return protocol_revision_;
  }

  [[nodiscard]] auto bucket() const -> const std::string&
  {
    return bucket_;
  }

  [[nodiscard]] auto config() -> std::optional<topology::configuration>
  {
    return config_;
  }

  [[nodiscard]] auto config_text() const -> const std::optional<std::string_view>&
  {
    return config_text_;
  }

  auto parse(const header_buffer& header,
             const std::vector<std::byte>& body,
             const cmd_info& info) -> bool;
};

} // namespace couchbase::core::protocol
