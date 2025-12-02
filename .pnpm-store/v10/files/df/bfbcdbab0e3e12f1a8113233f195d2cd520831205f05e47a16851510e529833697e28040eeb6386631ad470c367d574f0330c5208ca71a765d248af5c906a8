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

#include "big_endian.hxx"

namespace couchbase::core::mcbp::big_endian
{
auto
read_uint64(gsl::span<std::byte> buffer, std::size_t offset) -> std::uint64_t
{
  return (std::to_integer<std::uint64_t>(buffer[offset + 7])) |       //
         (std::to_integer<std::uint64_t>(buffer[offset + 6]) << 8) |  //
         (std::to_integer<std::uint64_t>(buffer[offset + 5]) << 16) | //
         (std::to_integer<std::uint64_t>(buffer[offset + 4]) << 24) | //
         (std::to_integer<std::uint64_t>(buffer[offset + 3]) << 32) | //
         (std::to_integer<std::uint64_t>(buffer[offset + 2]) << 40) | //
         (std::to_integer<std::uint64_t>(buffer[offset + 1]) << 48) | //
         (std::to_integer<std::uint64_t>(buffer[offset + 0]) << 56);
}

auto
read_uint32(gsl::span<std::byte> buffer, std::size_t offset) -> std::uint32_t
{
  return (std::to_integer<std::uint32_t>(buffer[offset + 3])) |       //
         (std::to_integer<std::uint32_t>(buffer[offset + 2]) << 8) |  //
         (std::to_integer<std::uint32_t>(buffer[offset + 1]) << 16) | //
         (std::to_integer<std::uint32_t>(buffer[offset + 0]) << 24);
}

auto
read_uint16(gsl::span<std::byte> buffer, std::size_t offset) -> std::uint16_t
{
  return static_cast<std::uint16_t>((std::to_integer<std::uint32_t>(buffer[offset + 1])) |
                                    (std::to_integer<std::uint32_t>(buffer[offset + 0]) << 8));
}

auto
read_uint8(gsl::span<std::byte> buffer, std::size_t offset) -> std::uint8_t
{
  return std::to_integer<std::uint8_t>(buffer[offset]);
}

auto
read(gsl::span<std::byte> buffer, std::size_t offset, std::size_t length) -> std::vector<std::byte>
{
  std::vector<std::byte> ret(length);
  std::memcpy(ret.data(), buffer.data() + offset, length);
  return ret;
}

void
put_uint32(gsl::span<std::byte> bytes, std::uint32_t value)
{
  bytes[0] = static_cast<std::byte>(value >> 24);
  bytes[1] = static_cast<std::byte>(value >> 16);
  bytes[2] = static_cast<std::byte>(value >> 8);
  bytes[3] = static_cast<std::byte>(value);
}

void
put_uint64(gsl::span<std::byte> bytes, std::uint64_t value)
{
  for (std::size_t i = 0; i < 8; ++i) {
    bytes[i] = static_cast<std::byte>(value >> (56 - i * 8));
  }
}
} // namespace couchbase::core::mcbp::big_endian
