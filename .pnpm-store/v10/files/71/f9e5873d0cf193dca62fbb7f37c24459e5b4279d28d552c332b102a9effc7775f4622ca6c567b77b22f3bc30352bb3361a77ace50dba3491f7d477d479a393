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

#include <couchbase/query_result.hxx>

namespace couchbase::transactions
{
/**
 * Transactional queries will return a transaction_query_result.   Note that this is currently
 * identical to a @ref query_result.   See @ref query_result for details.
 */
class transaction_query_result : public query_result
{
public:
  transaction_query_result(query_meta_data meta_data, std::vector<codec::binary> rows)
    : query_result(std::move(meta_data), std::move(rows))
  {
  }

  transaction_query_result()
    : query_result()
  {
  }
};
} // namespace couchbase::transactions
