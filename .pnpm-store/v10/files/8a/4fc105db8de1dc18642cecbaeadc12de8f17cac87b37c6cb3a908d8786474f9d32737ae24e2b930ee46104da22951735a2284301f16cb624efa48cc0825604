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

namespace couchbase::core::protocol
{
enum class server_opcode : std::uint8_t {
  cluster_map_change_notification = 0x01,
  invalid = 0xff,
};

constexpr auto
is_valid_server_request_opcode(std::uint8_t code) -> bool
{
  switch (server_opcode(code)) {
    case server_opcode::cluster_map_change_notification:
      return true;
    case server_opcode::invalid:
      break;
  }
  return false;
}

} // namespace couchbase::core::protocol
