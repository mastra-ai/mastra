/*
 *     Copyright 2018 Couchbase, Inc.
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

#include "plain.h"

#include <iterator>

namespace couchbase::core::sasl::mechanism::plain
{

auto
ClientBackend::start() -> std::pair<error, std::string_view>
{
  auto usernm = usernameCallback();
  auto passwd = passwordCallback();

  buffer.reserve(usernm.size() + passwd.size() + 2);
  buffer.push_back(0);
  std::copy(usernm.begin(), usernm.end(), std::back_insert_iterator(buffer));
  buffer.push_back(0);
  std::copy(passwd.begin(), passwd.end(), std::back_insert_iterator(buffer));

  return { error::OK, { buffer.data(), buffer.size() } };
}

} // namespace couchbase::core::sasl::mechanism::plain
