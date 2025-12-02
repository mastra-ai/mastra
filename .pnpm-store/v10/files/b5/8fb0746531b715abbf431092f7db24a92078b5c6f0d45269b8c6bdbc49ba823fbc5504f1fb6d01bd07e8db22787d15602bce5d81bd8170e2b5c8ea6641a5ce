/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2016-Present Couchbase, Inc.
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

/*
 * Function to base64 encode and decode text as described in RFC 4648
 *
 * @author Trond Norbye
 */

#include "base64.h"

#include <gsl/span>

#include <array>
#include <cctype>
#include <cstddef>
#include <cstdint>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

namespace
{
/**
 * An array of the legal characters used for direct lookup
 */
const std::array codemap{ 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
                          'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
                          'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
                          'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
                          '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '/' };

/**
 * A method to map the code back to the value
 *
 * @param code the code to map
 * @return the byte value for the code character
 */
auto
code2val(const char code) -> std::uint32_t
{
  if (code >= 'A' && code <= 'Z') {
    return static_cast<std::uint32_t>(code) - static_cast<std::uint32_t>('A');
  }
  if (code >= 'a' && code <= 'z') {
    return static_cast<std::uint32_t>(code) - static_cast<std::uint32_t>('a') + 26U;
  }
  if (code >= '0' && code <= '9') {
    return static_cast<std::uint32_t>(code) - static_cast<std::uint32_t>('0') + 52U;
  }
  if (code == '+') {
    return 62U;
  }
  if (code == '/') {
    return 63U;
  }
  throw std::invalid_argument("couchbase::core::base64::code2val Invalid input character");
}

// TODO(CXXCBC-549): clang-tidy-19 reports subscript with non-const index
// NOLINTBEGIN(cppcoreguidelines-pro-bounds-constant-array-index)
/**
 * Encode up to 3 characters to 4 output character.
 *
 * @param s pointer to the input stream
 * @param d pointer to the output stream
 * @param num the number of characters from s to encode
 */
void
encode_rest(const std::byte* s, std::string& result, size_t num)
{
  std::uint32_t val = 0;

  switch (num) {
    case 2:
      val = (static_cast<std::uint32_t>(*s) << 16U) | (static_cast<std::uint32_t>(*(s + 1)) << 8U);
      break;
    case 1:
      val = static_cast<std::uint32_t>(*s) << 16U;
      break;
    default:
      throw std::invalid_argument("base64::encode_rest num may be 1 or 2");
  }

  result.push_back(codemap[(val >> 18U) & 63]);
  result.push_back(codemap[(val >> 12U) & 63]);
  if (num == 2) {
    result.push_back(codemap[(val >> 6U) & 63]);
  } else {
    result.push_back('=');
  }
  result.push_back('=');
}

/**
 * Encode 3 bytes to 4 output character.
 *
 * @param s pointer to the input stream
 * @param d pointer to the output stream
 */
void
encode_triplet(const std::byte* s, std::string& str)
{
  auto val = (static_cast<std::uint32_t>(*s) << 16U) |      //
             (static_cast<std::uint32_t>(*(s + 1)) << 8U) | //
             static_cast<std::uint32_t>(*(s + 2));
  str.push_back(codemap[(val >> 18U) & 63]);
  str.push_back(codemap[(val >> 12U) & 63]);
  str.push_back(codemap[(val >> 6U) & 63]);
  str.push_back(codemap[val & 63]);
}
// NOLINTEND(cppcoreguidelines-pro-bounds-constant-array-index)

/**
 * decode 4 input characters to up to two output bytes
 *
 * @param s source string
 * @param d destination
 * @return the number of characters inserted
 */
auto
decode_quad(const char* s, std::vector<std::byte>& d) -> int
{
  std::uint32_t value = code2val(s[0]) << 18U;
  value |= code2val(s[1]) << 12U;

  int ret = 3;

  if (s[2] == '=') {
    ret = 1;
  } else {
    value |= code2val(s[2]) << 6U;
    if (s[3] == '=') {
      ret = 2;
    } else {
      value |= code2val(s[3]);
    }
  }

  d.push_back(static_cast<std::byte>(value >> 16U));
  if (ret > 1) {
    d.push_back(static_cast<std::byte>(value >> 8U));
    if (ret > 2) {
      d.push_back(static_cast<std::byte>(value));
    }
  }

  return ret;
}
} // namespace

namespace couchbase::core::base64
{
auto
encode(gsl::span<const std::byte> blob, bool pretty_print) -> std::string
{
  // base64 encodes up to 3 input characters to 4 output
  // characters in the alphabet above.
  auto triplets = blob.size() / 3;
  auto rest = blob.size() % 3;
  auto chunks = triplets;
  if (rest != 0) {
    ++chunks;
  }

  std::string result;
  if (pretty_print) {
    // In pretty-print mode we insert a newline after adding
    // 16 chunks (four characters).
    result.reserve((chunks * 4) + (chunks / 16));
  } else {
    result.reserve(chunks * 4);
  }

  const auto* in = blob.data();

  chunks = 0;
  for (size_t ii = 0; ii < triplets; ++ii) {
    encode_triplet(in, result);
    in += 3;

    if (pretty_print && (++chunks % 16) == 0) {
      result.push_back('\n');
    }
  }

  if (rest > 0) {
    encode_rest(in, result, rest);
  }

  if (pretty_print && result.back() != '\n') {
    result.push_back('\n');
  }

  return result;
}

auto
decode(std::string_view blob) -> std::vector<std::byte>
{
  std::vector<std::byte> destination;

  if (blob.empty()) {
    return destination;
  }

  // To reduce the number of reallocations, start by reserving an
  // output buffer of 75% of the input size (and add 3 to avoid dealing
  // with zero)
  const size_t estimate = blob.size() / 100 * 75;
  destination.reserve(estimate + 3);

  const auto* in = blob.data();
  size_t offset = 0;
  while (offset < blob.size()) {
    if (std::isspace(static_cast<int>(*in)) != 0) {
      ++offset;
      ++in;
      continue;
    }

    // We need at least 4 bytes
    if ((offset + 4) > blob.size()) {
      throw std::invalid_argument("couchbase::core::base64::decode invalid input");
    }

    decode_quad(in, destination);
    in += 4;
    offset += 4;
  }

  return destination;
}

auto
decode_to_string(std::string_view blob) -> std::string
{
  auto decoded = decode(blob);
  return { reinterpret_cast<const char*>(decoded.data()), decoded.size() };
}

auto
encode(std::string_view blob, bool pretty_print) -> std::string
{
  return encode(gsl::as_bytes(gsl::span{ blob.data(), blob.size() }), pretty_print);
}

} // namespace couchbase::core::base64
