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

#include <couchbase/codec/codec_flags.hxx>
#include <couchbase/codec/encoded_value.hxx>
#include <couchbase/error_codes.hxx>

#include <string>

namespace couchbase::codec
{
template<typename Serializer>
class json_transcoder
{
public:
  template<typename Document>
  static auto encode(Document document) -> encoded_value
  {
    return { Serializer::serialize(document), codec_flags::json_common_flags };
  }

  template<typename Document>
  static auto decode(const encoded_value& encoded) -> Document
  {
    if (encoded.flags != 0 &&
        !codec_flags::has_common_flags(encoded.flags, codec_flags::json_common_flags)) {
      throw std::system_error(errc::common::decoding_failure,
                              "json_transcoder expects document to have JSON common flags, flags=" +
                                std::to_string(encoded.flags));
    }

    return Serializer::template deserialize<Document>(encoded.data);
  }
};
} // namespace couchbase::codec
