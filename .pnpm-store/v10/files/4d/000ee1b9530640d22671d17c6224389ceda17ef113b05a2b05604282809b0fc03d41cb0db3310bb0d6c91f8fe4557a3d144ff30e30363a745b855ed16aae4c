/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2021-Present Couchbase, Inc.
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

#include "split_string.hxx"

#include <sstream>

namespace couchbase::core::utils
{
auto
split_string(const std::string& input, char delimiter) -> std::vector<std::string>
{
  std::vector<std::string> elements;
  std::stringstream stream(input);
  std::string element;
  while (std::getline(stream, element, delimiter)) {
    elements.push_back(element);
  }
  return elements;
}
} // namespace couchbase::core::utils
