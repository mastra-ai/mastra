/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2018 Couchbase, Inc.
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

#include <gsl/span>
#include <gsl/util>

#include <array>
#include <cstdint>
#include <optional>
#include <stdexcept>
#include <type_traits>

namespace couchbase::core::utils
{

/**
 * Helper code for encode and decode of LEB128 values.
 * - mcbp encodes collection-ID as an unsigned LEB128
 * - see https://en.wikipedia.org/wiki/LEB128
 */
struct leb_128_no_throw {
};

/**
 * decode_unsigned_leb128 returns the decoded T and a const_byte_buffer
 * initialised with the data following the leb128 data. This form of the decode
 * does not throw for invalid input and the caller should always check
 * second.data() for success or error (see returns info).
 *
 * @param buf buffer containing a leb128 encoded value (of size T)
 * @returns On error a std::pair where first is set to 0 and second is nullptr/0
 *          const_byte_buffer. On success a std::pair where first is the decoded
 *          value and second is a buffer initialised with the data following the
 *          leb128 data.
 */
template<class T>
auto
decode_unsigned_leb128(gsl::span<std::byte> buf, struct leb_128_no_throw /* unused */) ->
  typename std::enable_if_t<std::is_unsigned_v<T>, std::pair<T, gsl::span<std::byte>>>
{
  T rv = std::to_integer<T>(buf[0] & std::byte{ 0b0111'1111 });
  std::size_t end = 0;
  if ((buf[0] & std::byte{ 0b1000'0000 }) == std::byte{ 0b1000'0000 }) {
    T shift = 7;
    // shift in the remaining data
    for (end = 1; end < buf.size(); end++) {
      rv |= std::to_integer<T>(buf[end] & std::byte{ 0b0111'1111 }) << shift;
      if ((buf[end] & std::byte{ 0b1000'0000 }) == std::byte{ 0 }) {
        break; // no more
      }
      shift += 7;
    }

    // We should be stopped for a stop byte, not the end of the buffer
    if (end == buf.size()) {
      return { 0U, {} };
    }
  }
  // Return the decoded value and a buffer for any remaining data
  return { rv, { buf.data() + end + 1, buf.size() - (end + 1) } };
}

/**
 * decode_unsigned_leb128 returns the decoded T and a const_byte_buffer
 * initialised with the data following the leb128 data. This form of the decode
 * throws for invalid input.
 *
 * @param buf buffer containing a leb128 encoded value (of size T)
 * @returns std::pair first is the decoded value and second a buffer for the
 *          remaining data (size will be 0 for no more data)
 * @throws std::invalid_argument if buf[0] does not encode a leb128 value with
 *         a stop byte.
 */
template<class T>
auto
decode_unsigned_leb128(gsl::span<std::byte> buf) ->
  typename std::enable_if_t<std::is_unsigned_v<T>, std::pair<T, gsl::span<std::byte>>>
{
  if (!buf.empty()) {
    auto rv = decode_unsigned_leb128<T>(buf, leb_128_no_throw{});
    if (rv.second.data()) {
      return rv;
    }
  }
  throw std::invalid_argument("decode_unsigned_leb128: invalid buf size:" +
                              std::to_string(buf.size()));
}

/**
 * @return a buffer to the data after the leb128 prefix
 */
template<class T>
auto
skip_unsigned_leb128(gsl::span<std::byte> buf) ->
  typename std::enable_if_t<std::is_unsigned_v<T>, gsl::span<std::byte>>
{
  return decode_unsigned_leb128<T>(buf).second;
}

// Empty, non-specialised version of the decoder class
template<class T, class Enable = void>
class unsigned_leb128
{
};

/**
 * For encoding a unsigned T leb128, class constructs from a T value and
 * provides a const_byte_buffer for access to the encoded
 */
template<class T>
class unsigned_leb128<T, typename std::enable_if_t<std::is_unsigned_v<T>>>
{
public:
  explicit unsigned_leb128(T in)
  {
    while (in > 0) {
      auto byte = gsl::narrow_cast<std::byte>(in) & std::byte{ 0b0111'1111 };
      in >>= 7;

      // In has more data?
      if (in > 0) {
        byte |= std::byte{ 0b1000'0000 };
        encoded_data_[encoded_size_ - 1U] = byte;
        // Increase the size
        encoded_size_++;
      } else {
        encoded_data_[encoded_size_ - 1U] = byte;
      }
    }
  }

  [[nodiscard]] auto get() const -> std::string
  {
    return { begin(), end() };
  }

  [[nodiscard]] auto begin() const -> const std::byte*
  {
    return encoded_data_.data();
  }

  [[nodiscard]] auto end() const -> const std::byte*
  {
    return encoded_data_.data() + encoded_size_;
  }

  [[nodiscard]] auto data() const -> const std::byte*
  {
    return encoded_data_.data();
  }

  [[nodiscard]] auto size() const -> std::size_t
  {
    return encoded_size_;
  }

  constexpr static auto get_max_size() -> std::size_t
  {
    return max_size;
  }

private:
  // Larger T may need a larger array
  static_assert(sizeof(T) <= 8, "Class is only valid for uint 8/16/64");

  // value is large enough to store ~0 as leb128
  static constexpr std::size_t max_size = sizeof(T) + (((sizeof(T) + 1) / 8) + 1);
  std::array<std::byte, max_size> encoded_data_{};
  std::size_t encoded_size_{ 1 };
};

} // namespace couchbase::core::utils
