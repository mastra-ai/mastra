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

#include "mcbp_message.hxx"

#include "core/utils/byteswap.hxx"

#include <cstring>

namespace couchbase::core::io
{
auto
binary_header::status() const -> std::uint16_t
{
  return utils::byte_swap(specific);
}

auto
mcbp_message::header_data() const -> protocol::header_buffer
{
  protocol::header_buffer buf;
  std::memcpy(buf.data(), &header, sizeof(header));
  return buf;
}
} // namespace couchbase::core::io
