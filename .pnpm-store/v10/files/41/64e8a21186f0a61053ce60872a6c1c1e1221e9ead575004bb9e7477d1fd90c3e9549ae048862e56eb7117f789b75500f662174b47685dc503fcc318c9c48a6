/*
 *     Copyright 2022 Couchbase, Inc.
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

#include <couchbase/durability_level.hxx>
#include <couchbase/query_scan_consistency.hxx>
#include <couchbase/transactions/transactions_config.hxx>

#include <chrono>
#include <optional>

namespace couchbase
{
class collection;

namespace transactions
{
/**
 * The transaction_options can be passed in to override some elements of the global @ref
 * transactions_config.
 */
class transaction_options
{
public:
  transaction_options() = default;

  /**
   * Set durability for this transaction.
   *
   * @see couchbase::durability_level for details.
   *
   * @param level Durability level for this transaction.
   * @return reference to this object, convenient for chaining operations.
   */
  auto durability_level(durability_level level) -> transaction_options&;

  /**
   * Get the durability if it has been set.
   *
   * @see couchbase::durability_level for details.
   *
   * @return durability if set.
   */
  [[nodiscard]] auto durability_level() const -> std::optional<couchbase::durability_level>;

  /**
   * Set the @ref query_scan_consistency for this transaction.
   *
   * @see query_options::scan_consistency for details.
   *
   * @param scan_consistency The desired @ref query_scan_consistency for this transaction.
   * @return reference to this object, convenient for chaining operations.
   */
  auto scan_consistency(query_scan_consistency scan_consistency) -> transaction_options&;

  /**
   * Get the scan_consistency if it has been set.
   *
   * @see query_options::scan_consistency for details.
   *
   * @return The scan_consistency, if set.
   */
  [[nodiscard]] auto scan_consistency() const -> std::optional<query_scan_consistency>;

  /**
   * Set the timeout for this transaction.
   *
   * @tparam T timeout type, e.g. std::chrono::milliseconds, or similar
   * @param timeout Desired timeout
   * @return reference to this object, convenient for chaining operations.
   */
  template<typename T>
  auto timeout(T timeout) -> transaction_options&
  {
    timeout_ = std::chrono::duration_cast<std::chrono::nanoseconds>(timeout);
    return *this;
  }

  /**
   * Get the timeout, if set.
   *
   * @return the timeout, if set.
   */
  auto timeout() -> std::optional<std::chrono::nanoseconds>;

  /**
   * Set the metadata collection to use for this transaction
   *
   * Transactions involve a the creation and use of some metadata documents, which by default are
   * placed in the default collection of scope which the first document in the that has a mutating
   * operation performed on it.   However, you can set this to a specific collection to isolate
   * these documents from your documents, if desired.
   *
   * @param coll The desired collection to use.
   * @return reference to this object, convenient for chaining operations.
   */
  auto metadata_collection(const couchbase::collection& coll) -> transaction_options&;

  /**
   * Set metadata collection to use for this transaction
   *
   * @param keyspace The desired collection to use
   * @return reference to this object, convenient for chaining operations.
   */
  auto metadata_collection(const couchbase::transactions::transaction_keyspace& keyspace)
    -> transaction_options&
  {
    metadata_collection_.emplace(keyspace);
    return *this;
  }
  /**
   * Get the metadata collection, if set.
   *
   * @return the metadata collection, as a @ref transaction_keyspace, if set.
   */
  [[nodiscard]] auto metadata_collection() const -> std::optional<transaction_keyspace>;

  /** @private */
  auto test_factories(std::shared_ptr<core::transactions::attempt_context_testing_hooks> hooks,
                      std::shared_ptr<core::transactions::cleanup_testing_hooks> cleanup_hooks)
    -> transaction_options&;
  /** @private */
  [[nodiscard]] auto apply(const transactions_config::built& conf) const
    -> transactions_config::built;

private:
  std::optional<couchbase::durability_level> durability_;
  std::optional<couchbase::query_scan_consistency> scan_consistency_;
  std::optional<std::chrono::nanoseconds> timeout_;
  std::optional<transaction_keyspace> metadata_collection_;
  std::shared_ptr<core::transactions::attempt_context_testing_hooks> attempt_context_hooks_;
  std::shared_ptr<core::transactions::cleanup_testing_hooks> cleanup_hooks_;
};
} // namespace transactions
} // namespace couchbase
