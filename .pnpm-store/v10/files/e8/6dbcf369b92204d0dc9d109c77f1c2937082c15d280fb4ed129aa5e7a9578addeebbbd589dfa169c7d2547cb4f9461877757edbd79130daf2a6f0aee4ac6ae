/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-Present Couchbase, Inc.
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

namespace couchbase::codec::codec_flags
{

/**
 * 32bit flag is composed of:
 *  - 3 compression bits
 *  - 1 bit reserved for future use
 *  - 4 format flags bits. those 8 upper bits make up the common flags
 *  - 8 bits reserved for future use
 *  - 16 bits for legacy flags
 *
 * This mask allows to compare a 32 bits flags with the 4 common flag format bits
 * ("00001111 00000000 00000000 00000000").
 *
 * @see #extract_common_flags()
 * @see #has_common_flags()
 * @see #has_compression_flags()
 */
constexpr std::uint32_t common_format_mask = 0x0F000000;

enum class common_flags : std::uint32_t {
  reserved = 0x00,
  client_specific = 0x01, // called PRIVATE in RFC and other SDKs
  json = 0x02,
  binary = 0x03,
  string = 0x04
};

/**
 * Takes a enum representation of common flags and moves them to the common flags MSBs.
 *
 * @param flags the flags to shift.
 * @return an integer having the common flags set.
 */
constexpr auto
create_common_flags(common_flags flags) -> std::uint32_t
{
  return static_cast<std::uint32_t>(flags) << 24U;
}

/**
 * Returns only the common flags from the full flags.
 *
 * @note it returns common_flags::reserved for unknown flags structure.
 *
 * @param flags the flags to check.
 * @return only the common flags simple representation (8 bits).
 */
constexpr auto
extract_common_flags(std::uint32_t flags) -> common_flags
{
  switch (auto value = static_cast<common_flags>(flags >> 24U)) {
    case common_flags::client_specific:
    case common_flags::json:
    case common_flags::binary:
    case common_flags::string:
      return value;
    default:
      break;
  }
  return common_flags::reserved;
}

/**
 * Checks whether the upper 8 bits are set, indicating common flags presence.
 *
 * It does this by shifting bits to the right until only the most significant
 * bits are remaining and then checks if one of them is set.
 *
 * @param flags the flags to check.
 * @return true if set, false otherwise.
 */
constexpr auto
has_common_flags(std::uint32_t flags) -> bool
{
  return extract_common_flags(flags) != common_flags::reserved;
}

/**
 * Checks that flags has common flags bits set and that they correspond to expected common flags
 * format.
 *
 * @param flags the 32 bits flags to check
 * @param expected_common_flag the expected common flags format bits
 * @return true if common flags bits are set and correspond to expected_common_flag format
 */
constexpr auto
has_common_flags(std::uint32_t flags, std::uint32_t expected_common_flag) -> bool
{
  return has_common_flags(flags) && (flags & common_format_mask) == expected_common_flag;
}

/**
 * Checks that flags has common flags bits set and that they correspond to expected common flags
 * value.
 *
 * @param flags the 32 bits flags to check
 * @param expected_common_flag the expected common flags enum value
 * @return true if common flags bits are set and correspond to expected_common_flag format
 */
constexpr auto
has_common_flags(std::uint32_t flags, common_flags expected_common_flag) -> bool
{
  return has_common_flags(flags) &&
         (flags & common_format_mask) == create_common_flags(expected_common_flag);
}

/**
 * Checks whether the upper 3 bits are set, indicating compression presence.
 *
 * It does this by shifting bits to the right until only the most significant bits are remaining and
 * then checks if one of them is set.
 *
 * @param flags the flags to check.
 * @return true if compression set, false otherwise.
 */
constexpr auto
has_compression_flags(std::uint32_t flags) -> bool
{
  return (flags >> 29U) > 0;
}

constexpr std::uint32_t private_common_flags = create_common_flags(common_flags::client_specific);
constexpr std::uint32_t json_common_flags = create_common_flags(common_flags::json);
constexpr std::uint32_t binary_common_flags = create_common_flags(common_flags::binary);
constexpr std::uint32_t string_common_flags = create_common_flags(common_flags::string);
} // namespace couchbase::codec::codec_flags
