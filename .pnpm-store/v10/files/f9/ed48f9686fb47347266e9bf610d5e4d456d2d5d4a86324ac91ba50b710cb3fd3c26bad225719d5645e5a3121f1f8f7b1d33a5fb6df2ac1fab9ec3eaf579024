/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2024. Couchbase, Inc.
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

#include <couchbase/codec/codec_flags.hxx>
#include <couchbase/codec/encoded_value.hxx>
#include <couchbase/codec/transcoder_traits.hxx>
#include <couchbase/error_codes.hxx>

#include <cstddef>
#include <string>
#include <string_view>
#include <type_traits>
#include <vector>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
namespace core::utils
{
auto
to_binary(std::string_view value) noexcept -> std::vector<std::byte>;
} // namespace core::utils
#endif

namespace codec
{
class raw_json_transcoder
{
public:
  template<
    typename Document,
    std::enable_if_t<std::is_same_v<Document, std::string> || std::is_same_v<Document, binary>,
                     bool> = true>
  static auto encode(const Document& document) -> encoded_value
  {
    if constexpr (std::is_same_v<Document, std::string>) {
      return { core::utils::to_binary(document), codec_flags::json_common_flags };
    } else {
      return { std::move(document), codec_flags::json_common_flags };
    }
  }

  template<
    typename Document,
    std::enable_if_t<std::is_same_v<Document, std::string> || std::is_same_v<Document, binary>,
                     bool> = true>
  static auto decode(const encoded_value& encoded) -> Document
  {
    if (!codec_flags::has_common_flags(encoded.flags, codec_flags::json_common_flags)) {
      throw std::system_error(
        errc::common::decoding_failure,
        "raw_json_transcoder expects document to have JSON common flags, flags=" +
          std::to_string(encoded.flags));
    }
    if constexpr (std::is_same_v<Document, std::string>) {
      return std::string{ reinterpret_cast<const char*>(encoded.data.data()), encoded.data.size() };
    } else {
      return encoded.data;
    }
  }
};

#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
template<>
struct is_transcoder<raw_json_transcoder> : public std::true_type {
};
#endif
} // namespace codec
} // namespace couchbase
