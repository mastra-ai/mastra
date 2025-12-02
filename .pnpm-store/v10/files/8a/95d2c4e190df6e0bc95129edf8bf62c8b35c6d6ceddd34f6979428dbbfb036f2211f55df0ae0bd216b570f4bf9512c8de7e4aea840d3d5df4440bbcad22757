/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2017 Couchbase, Inc.
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

#include "string_hex.h"

#include <array>
#include <cinttypes>
#include <cstdint>
#include <cstdio>
#include <iomanip>
#include <ios>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>

namespace
{
inline auto
from_hex_digit(char c) -> std::uint8_t
{
  if ('0' <= c && c <= '9') {
    return static_cast<std::uint8_t>(c - '0');
  }
  if ('A' <= c && c <= 'F') {
    return static_cast<std::uint8_t>(c + 10 - 'A');
  }
  if ('a' <= c && c <= 'f') {
    return static_cast<std::uint8_t>(c + 10 - 'a');
  }
  throw std::invalid_argument(
    "couchbase::core::from_hex_digit: character was not in hexadecimal range");
}
} // namespace

auto
couchbase::core::from_hex(std::string_view buffer) -> std::uint64_t
{
  std::uint64_t ret = 0;
  if (buffer.size() > 16) {
    throw std::overflow_error("couchbase::core::from_hex: input string too long: " +
                              std::to_string(buffer.size()));
  }

  for (const char digit : buffer) {
    ret = (ret << 4) | from_hex_digit(digit);
  }

  return ret;
}

auto
couchbase::core::to_hex(std::uint8_t val) -> std::string
{
  std::array<char, 32> buf{};
  snprintf(buf.data(), buf.size(), "0x%02" PRIx8, val);
  return std::string{ buf.data() };
}

auto
couchbase::core::to_hex(std::uint16_t val) -> std::string
{
  std::array<char, 32> buf{};
  snprintf(buf.data(), buf.size(), "0x%04" PRIx16, val);
  return std::string{ buf.data() };
}

auto
couchbase::core::to_hex(std::uint32_t val) -> std::string
{
  std::array<char, 32> buf{};
  snprintf(buf.data(), buf.size(), "0x%08" PRIx32, val);
  return std::string{ buf.data() };
}

auto
couchbase::core::to_hex(std::uint64_t val) -> std::string
{
  std::array<char, 32> buf{};
  snprintf(buf.data(), buf.size(), "0x%016" PRIx64, val);
  return std::string{ buf.data() };
}

auto
couchbase::core::to_hex(std::string_view buffer) -> std::string
{
  if (buffer.empty()) {
    return "";
  }
  std::stringstream ss;
  for (const auto& c : buffer) {
    ss << "0x" << std::hex << std::setfill('0') << std::setw(2) << static_cast<std::uint32_t>(c)
       << " ";
  }
  auto ret = ss.str();
  ret.resize(ret.size() - 1);
  return ret;
}
