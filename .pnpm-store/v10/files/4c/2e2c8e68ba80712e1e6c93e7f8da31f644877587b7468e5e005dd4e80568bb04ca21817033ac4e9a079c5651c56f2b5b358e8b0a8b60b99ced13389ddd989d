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
 * @brief  Offline, serializable representation of a bucket, scope, and collection
 */
struct transaction_keyspace {
  transaction_keyspace(std::string bucket_name,
                       std::string scope_name,
                       std::string collection_name);

  explicit transaction_keyspace(const std::string& bucket_name);

  auto operator==(const transaction_keyspace& keyspace) const -> bool
  {
    return bucket == keyspace.bucket && scope == keyspace.scope &&
           collection == keyspace.collection;
  }

  /**
   * Check if a keyspace is valid.
   *
   * A valid transaction_keyspace must have the bucket, scope, and collection all set.   Note that
   * both the scope and collection default to _default, but there is no default for the bucket so it
   * must be set.
   *
   * @return true if valid.
   */
  auto valid() const -> bool;

  /** @private */
  template<typename OStream>
  friend auto operator<<(OStream& os, const transaction_keyspace& keyspace) -> OStream&
  {
    os << "transaction_keyspace{";
    os << "bucket: " << keyspace.bucket;
    os << ", scope: " << keyspace.scope;
    os << ", collection: " << keyspace.collection;
    os << "}";
    return os;
  }

  std::string bucket;
  std::string scope;
  std::string collection;
};
} // namespace couchbase::transactions
