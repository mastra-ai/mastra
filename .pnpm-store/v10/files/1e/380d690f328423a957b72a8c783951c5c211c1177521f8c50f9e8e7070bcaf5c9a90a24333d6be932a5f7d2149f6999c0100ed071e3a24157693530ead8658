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

#include "cmd_cluster_map_change_notification.hxx"
#include "cmd_get_cluster_config.hxx"
#include "core/topology/configuration_json.hxx"
#include "core/utils/byteswap.hxx"
#include "core/utils/json.hxx"

#include <gsl/assert>

#include <cstddef>
#include <cstring>

namespace couchbase::core::protocol
{
auto
cluster_map_change_notification_request_body::parse(const header_buffer& header,
                                                    const std::vector<std::byte>& body,
                                                    const cmd_info& info) -> bool
{
  Expects(header[1] == static_cast<std::byte>(opcode));
  using offset_type = std::vector<std::byte>::difference_type;

  auto ext_size = std::to_integer<std::uint8_t>(header[4]);
  offset_type offset = ext_size;
  if (ext_size == 4) {
    memcpy(&protocol_revision_, body.data(), sizeof(protocol_revision_));
    protocol_revision_ = utils::byte_swap(protocol_revision_);
  }
  std::uint16_t key_size = 0;
  memcpy(&key_size, header.data() + 2, sizeof(key_size));
  key_size = utils::byte_swap(key_size);
  const auto* data_ptr = reinterpret_cast<const char*>(body.data());
  bucket_.assign(data_ptr + offset, data_ptr + offset + key_size);
  offset += key_size;
  if (body.size() > static_cast<std::size_t>(offset)) {
    const std::string_view config_text{ data_ptr + offset,
                                        body.size() - static_cast<std::size_t>(offset) };
    config_ = parse_config(config_text, info.endpoint_address, info.endpoint_port);
    config_text_.emplace(config_text);
  }
  return true;
}
} // namespace couchbase::core::protocol
