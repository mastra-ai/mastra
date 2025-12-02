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

#include <couchbase/codec/encoded_value.hxx>
#include <couchbase/codec/serializer_traits.hxx>
#include <couchbase/error_codes.hxx>

#include <tao/json/value.hpp>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
namespace core::utils::json
{
auto
generate_binary(const tao::json::value& object) -> std::vector<std::byte>;

auto
parse_binary(const std::vector<std::byte>& input) -> tao::json::value;
} // namespace core::utils::json
#endif

namespace codec
{
class tao_json_serializer
{
public:
  using document_type = tao::json::value;

  template<typename Document>
  static auto serialize([[maybe_unused]] Document document) -> binary
  {
    try {
      if constexpr (std::is_null_pointer_v<std::remove_reference_t<Document>>) {
        return core::utils::json::generate_binary(tao::json::null);
      } else {
        return core::utils::json::generate_binary(tao::json::value(document));
      }
    } catch (const tao::pegtl::parse_error& e) {
      throw std::system_error(
        errc::common::encoding_failure,
        std::string("json_transcoder cannot generate document as JSON: ").append(e.message()));
    }
  }

  template<typename Document>
  static auto deserialize(const binary& data) -> Document
  {
    try {
      if constexpr (std::is_same_v<Document, tao::json::value>) {
        return core::utils::json::parse_binary(data);
      } else {
        return core::utils::json::parse_binary(data).as<Document>();
      }
    } catch (const tao::pegtl::parse_error& e) {
      throw std::system_error(
        errc::common::decoding_failure,
        std::string("json_transcoder cannot parse document as JSON: ").append(e.message()));
    } catch (const std::out_of_range& e) {
      throw std::system_error(
        errc::common::decoding_failure,
        std::string("json_transcoder cannot parse document: ").append(e.what()));
    }
  }
};

#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
template<>
struct is_serializer<tao_json_serializer> : public std::true_type {
};
#endif
} // namespace codec
} // namespace couchbase
