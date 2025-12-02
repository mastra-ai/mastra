/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2022-Present Couchbase, Inc.
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

#include <cinttypes>
#include <vector>

namespace couchbase::core::mcbp
{
struct buffer_writer {
  explicit buffer_writer(std::size_t size);

  void write_byte(std::byte val);
  void write_uint16(std::uint16_t val);
  void write_uint32(std::uint32_t val);
  void write_uint64(std::uint64_t val);
  void write_frame_header(std::uint8_t type, std::size_t length);
  void write(const std::vector<std::byte>& val);

  std::vector<std::byte> store_;
  std::size_t offset_{ 0 };
};
} // namespace couchbase::core::mcbp
