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

#include <couchbase/transactions/transaction_keyspace.hxx>

#include <chrono>
#include <list>

namespace couchbase::transactions
{
/**
 * Configuration parameters for the background transaction cleanup threads.
 */
class transactions_cleanup_config
{
public:
  /**
   * @brief Enable/disable the lost attempts cleanup loop.
   * @see @ref cleanup_window() for description of the cleanup lost attempts loop.
   *
   * @param value If false, do not start the lost attempts cleanup threads.
   * @return reference to this, so calls can be chained.
   */
  auto cleanup_lost_attempts(bool value) -> transactions_cleanup_config&
  {
    cleanup_lost_attempts_ = value;
    return *this;
  }
  /**
   * @brief Get lost attempts cleanup loop status.
   * @see @ref cleanup_window() for description of the lost attempts cleanup loop.
   *
   * @return If false, no lost attempts cleanup threads will be launched.
   */
  [[nodiscard]] auto cleanup_lost_attempts() const -> bool
  {
    return cleanup_lost_attempts_;
  }

  /**
   * @brief Set state for the client attempts cleanup loop.
   * @see @ref cleanup_client_attempts()
   *
   * @param value If true, run the cleanup client attempts loop.
   * @return reference to this, so calls can be chained.
   */
  auto cleanup_client_attempts(bool value) -> transactions_cleanup_config&
  {
    cleanup_client_attempts_ = value;
    return *this;
  }

  /**
   * @brief Get state of client attempts cleanup loop.
   *
   * A transactions object will create a background thread to do any cleanup necessary
   * for the transactions it has attempted.  This can be disabled if set to false.
   *
   * @return true if the thread is enabled, false if not.
   */
  [[nodiscard]] auto cleanup_client_attempts() const -> bool
  {
    return cleanup_client_attempts_;
  }

  /**
   * @brief Get cleanup window
   *
   * Each @ref transactions instance has background threads which looks for evidence of
   * transactions that somehow were not cleaned up during ordinary processing.  There is one
   * of these per bucket.  The thread looks through the active transaction records on that bucket
   * once during each window.  There are potentially 1024 of these records, so over one cleanup
   * window period, the thread will look for all 1024 of these, and examine any it finds.  Note
   * you can disable this by setting @ref cleanup_lost_attempts() false.
   *
   * @return The cleanup window.
   */
  [[nodiscard]] auto cleanup_window() const -> std::chrono::milliseconds
  {
    return cleanup_window_;
  }

  /**
   * @brief Set cleanup window
   *
   * @see cleanup_window() for more info.
   * @param duration An std::chrono::duration representing the cleanup window duration.
   * @return reference to this, so calls can be chained.
   */
  template<typename T>
  auto cleanup_window(T duration) -> transactions_cleanup_config&
  {
    cleanup_window_ = std::chrono::duration_cast<std::chrono::milliseconds>(duration);
    return *this;
  }

  /**
   * @brief Add a collection to be cleaned
   *
   * This can be called multiple times, to add several collections, if needed.
   *
   */
  auto add_collection(const couchbase::transactions::transaction_keyspace& keyspace)
    -> transactions_cleanup_config&
  {
    collections_.emplace_back(keyspace);
    return *this;
  }

  /** @private */
  struct built {
    bool cleanup_lost_attempts;
    bool cleanup_client_attempts;
    std::chrono::milliseconds cleanup_window;
    std::list<couchbase::transactions::transaction_keyspace> collections;
  };

  /** @private */
  [[nodiscard]] auto build() const -> built
  {
    return { cleanup_lost_attempts_, cleanup_client_attempts_, cleanup_window_, collections_ };
  }

private:
  bool cleanup_lost_attempts_{ true };
  bool cleanup_client_attempts_{ true };
  std::chrono::milliseconds cleanup_window_{ std::chrono::seconds(60) };
  std::list<couchbase::transactions::transaction_keyspace> collections_{};
};
} // namespace couchbase::transactions
