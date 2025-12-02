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

#include "encoded_search_sort.hxx"

#include <couchbase/search_sort_score.hxx>

namespace couchbase
{
auto
search_sort_score::descending(bool desc) -> search_sort_score&
{
  descending_ = desc;
  return *this;
}

auto
search_sort_score::encode() const -> encoded_search_sort
{
  encoded_search_sort built;
  built.sort = {
    { "by", "score" },
  };
  if (const auto& desc = descending_; desc.has_value()) {
    built.sort["desc"] = desc.value();
  }
  return built;
}
} // namespace couchbase
