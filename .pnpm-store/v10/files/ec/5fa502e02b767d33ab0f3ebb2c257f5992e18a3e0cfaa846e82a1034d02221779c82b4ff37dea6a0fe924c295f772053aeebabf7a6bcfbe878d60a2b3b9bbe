/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2023-Present Couchbase, Inc.
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

#include <couchbase/boolean_query.hxx>

#include "encoded_search_query.hxx"

#include <couchbase/error_codes.hxx>

#include <tao/json/type.hpp>

namespace couchbase
{
auto
boolean_query::encode() const -> encoded_search_query
{
  if (!must_ && !should_ && !must_not_) {
    return { errc::common::invalid_argument };
  }

  encoded_search_query built;
  built.query = tao::json::empty_object;
  if (boost_) {
    built.query["boost"] = boost_.value();
  }
  if (must_) {
    auto encoded = must_->encode();
    if (encoded.ec) {
      return { encoded.ec };
    }
    built.query["must"] = encoded.query;
  }
  if (must_not_) {
    auto encoded = must_not_->encode();
    if (encoded.ec) {
      return { encoded.ec };
    }
    built.query["must_not"] = encoded.query;
  }
  if (should_) {
    auto encoded = should_->encode();
    if (encoded.ec) {
      return { encoded.ec };
    }
    built.query["should"] = encoded.query;
  }

  return built;
}
} // namespace couchbase
