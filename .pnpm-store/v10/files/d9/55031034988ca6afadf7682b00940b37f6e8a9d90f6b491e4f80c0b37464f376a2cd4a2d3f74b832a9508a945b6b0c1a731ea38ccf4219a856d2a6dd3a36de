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

#include <couchbase/term_range_query.hxx>

#include <couchbase/error_codes.hxx>

namespace couchbase
{
auto
term_range_query::encode() const -> encoded_search_query
{
  if ((!min_ || min_->empty()) && (!max_ || max_->empty())) {
    return { errc::common::invalid_argument };
  }

  encoded_search_query built;
  built.query = tao::json::empty_object;
  if (boost_) {
    built.query["boost"] = boost_.value();
  }
  if (field_) {
    built.query["field"] = field_.value();
  }

  if (min_) {
    built.query["min"] = min_.value();
    if (inclusive_min_.has_value()) {
      built.query["inclusive_min"] = inclusive_min_.value();
    }
  }
  if (max_) {
    built.query["max"] = max_.value();
    if (inclusive_max_.has_value()) {
      built.query["inclusive_max"] = inclusive_max_.value();
    }
  }

  return built;
}
} // namespace couchbase
