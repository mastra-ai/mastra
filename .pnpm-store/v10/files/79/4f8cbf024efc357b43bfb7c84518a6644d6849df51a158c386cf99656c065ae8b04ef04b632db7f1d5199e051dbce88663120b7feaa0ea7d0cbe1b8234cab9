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

#include <array>
#include <cstdint>
#include <vector>

namespace couchbase::core
{
namespace protocol
{
static constexpr std::size_t header_size = 24;
using header_buffer = std::array<std::byte, header_size>;
} // namespace protocol

namespace io
{
struct binary_header {
  std::uint8_t magic;
  std::uint8_t opcode;
  std::uint16_t keylen;
  std::uint8_t extlen;
  std::uint8_t datatype;
  std::uint16_t specific;
  std::uint32_t bodylen;
  std::uint32_t opaque;
  std::uint64_t cas;

  [[nodiscard]] auto status() const -> std::uint16_t;
};

struct mcbp_message {
  binary_header header{};
  std::vector<std::byte> body{};

  mcbp_message() = default;
  mcbp_message(const mcbp_message& other) = delete;
  auto operator=(const mcbp_message& other) -> mcbp_message& = delete;
  mcbp_message(mcbp_message&& other) = default;
  auto operator=(mcbp_message&& other) -> mcbp_message& = default;

  [[nodiscard]] auto header_data() const -> protocol::header_buffer;
};
} // namespace io
} // namespace couchbase::core
