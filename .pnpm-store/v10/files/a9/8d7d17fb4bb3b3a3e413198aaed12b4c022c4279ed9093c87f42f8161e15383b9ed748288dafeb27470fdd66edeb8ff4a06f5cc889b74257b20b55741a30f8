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

namespace couchbase::transactions
{
/**
 * Results of a transaction
 * @volatile
 *
 * Contains internal information on a transaction,
 * returned by @ref couchbase::transactions::transactions::run()
 */
struct transaction_result {
  std::string transaction_id;
  bool unstaging_complete{};
};
} // namespace couchbase::transactions
