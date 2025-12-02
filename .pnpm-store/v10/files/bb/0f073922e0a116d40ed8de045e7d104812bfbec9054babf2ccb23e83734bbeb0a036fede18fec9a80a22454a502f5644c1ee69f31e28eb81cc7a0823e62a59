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

#include "encoded_search_query.hxx"

#include <couchbase/vector_query.hxx>

namespace couchbase
{
auto
vector_query::encode() const -> encoded_search_query
{
  encoded_search_query built;
  built.query = tao::json::empty_object;
  if (prefilter_) {
    auto [ec, encoded_prefilter] = prefilter_->encode();
    if (ec) {
      built.ec = ec;
      return built;
    }
    built.query["filter"] = encoded_prefilter;
  }
  if (boost_) {
    built.query["boost"] = boost_.value();
  }
  built.query["field"] = vector_field_name_;

  if (vector_query_.has_value()) {
    tao::json::value vector_values = tao::json::empty_array;
    for (const auto value : vector_query_.value()) {
      vector_values.push_back(value);
    }
    built.query["vector"] = vector_values;
  } else if (base64_vector_query_.has_value()) {
    built.query["vector_base64"] = base64_vector_query_.value();
  }

  built.query["k"] = num_candidates_;
  return built;
}
} // namespace couchbase
