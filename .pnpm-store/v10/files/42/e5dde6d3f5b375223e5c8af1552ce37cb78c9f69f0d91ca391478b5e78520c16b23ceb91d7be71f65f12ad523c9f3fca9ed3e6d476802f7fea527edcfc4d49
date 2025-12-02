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

#include <algorithm>
#include <cinttypes>
#include <vector>

namespace couchbase::core::impl::subdoc
{
auto
join_values(const std::vector<std::vector<std::byte>>& values) -> std::vector<std::byte>
{
  if (values.empty()) {
    return {};
  }
  if (values.size() == 1) {
    return values.front();
  }
  constexpr std::byte comma{ ',' };
  std::size_t total_length = values.size() - 1;
  for (const auto& v : values) {
    total_length += v.size();
  }

  std::vector<std::byte> result;
  result.resize(total_length);

  auto sentinel = std::end(values);
  auto output = result.begin();
  if (auto it = std::begin(values); it != sentinel) {
    output = std::copy(it->begin(), it->end(), output);
    ++it;
    while (it != sentinel) {
      *output = comma;
      ++output;
      output = std::copy(it->begin(), it->end(), output);
      ++it;
    }
  }
  return result;
}
} // namespace couchbase::core::impl::subdoc
