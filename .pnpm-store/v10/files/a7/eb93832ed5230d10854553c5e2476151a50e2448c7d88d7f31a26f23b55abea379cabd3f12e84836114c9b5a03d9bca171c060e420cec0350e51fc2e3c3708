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

namespace couchbase::codec
{
class binary_noop_serializer
{
public:
  using document_type = binary;

  static auto serialize(binary document) -> binary
  {
    return document;
  }

  template<typename Document>
  static auto deserialize(binary data) -> binary
  {
    return data;
  }
};

#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
template<>
struct is_serializer<binary_noop_serializer> : public std::true_type {
};
#endif
} // namespace couchbase::codec
