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

#include <couchbase/transactions/transaction_get_multi_replicas_from_preferred_server_group_spec.hxx>

#include <couchbase/collection.hxx>

namespace couchbase::transactions
{
transaction_get_multi_replicas_from_preferred_server_group_spec::
  transaction_get_multi_replicas_from_preferred_server_group_spec(const collection& collection,
                                                                  std::string id)
  : bucket_{ collection.bucket_name() }
  , scope_{ collection.scope_name() }
  , collection_{ collection.name() }
  , id_{ std::move(id) }
{
}
} // namespace couchbase::transactions
