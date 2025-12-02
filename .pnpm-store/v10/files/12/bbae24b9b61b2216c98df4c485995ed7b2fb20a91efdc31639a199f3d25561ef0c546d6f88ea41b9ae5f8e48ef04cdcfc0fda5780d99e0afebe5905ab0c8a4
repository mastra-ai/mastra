/*
 *     Copyright 2021-Present Couchbase, Inc.
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

#include <string>

namespace couchbase
{
class collection;
namespace core::transactions
{
class attempt_context_impl;
} // namespace core::transactions

namespace transactions
{
class transaction_get_multi_replicas_from_preferred_server_group_spec
{
public:
  transaction_get_multi_replicas_from_preferred_server_group_spec(
    const couchbase::collection& collection,
    std::string id);

private:
  friend class core::transactions::attempt_context_impl;

  std::string bucket_;
  std::string scope_;
  std::string collection_;
  std::string id_;
};

} // namespace transactions
} // namespace couchbase
