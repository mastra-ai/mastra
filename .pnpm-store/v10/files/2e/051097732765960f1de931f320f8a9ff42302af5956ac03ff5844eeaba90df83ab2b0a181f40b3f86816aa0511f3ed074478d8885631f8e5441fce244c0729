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

#include "atr_cleanup_entry.hxx"
#include "client_record.hxx"
#include "core/cluster.hxx"

#include <couchbase/transactions/transactions_config.hxx>

#include <atomic>
#include <condition_variable>
#include <thread>

namespace couchbase::core
{

class cluster;
namespace transactions
{
// only really used when we force cleanup, in tests
class transactions_cleanup_attempt
{
private:
  const core::document_id atr_id_;
  const std::string attempt_id_;
  const std::string atr_bucket_name_;
  bool success_;
  attempt_state state_;

public:
  explicit transactions_cleanup_attempt(const atr_cleanup_entry&);

  [[nodiscard]] auto success() const -> bool
  {
    return success_;
  }

  void success(bool success)
  {
    success_ = success;
  }

  [[nodiscard]] auto atr_id() const -> const core::document_id&
  {
    return atr_id_;
  }

  [[nodiscard]] auto attempt_id() const -> std::string
  {
    return attempt_id_;
  }

  [[nodiscard]] auto atr_bucket_name() const -> std::string
  {
    return atr_bucket_name_;
  }

  [[nodiscard]] auto state() const -> attempt_state
  {
    return state_;
  }

  void state(attempt_state state)
  {
    state_ = state;
  }
};

struct atr_cleanup_stats {
  bool exists{};
  std::size_t num_entries{};
};

class transactions_cleanup
{
public:
  transactions_cleanup(core::cluster cluster,
                       couchbase::transactions::transactions_config::built config);
  ~transactions_cleanup();

  [[nodiscard]] auto cluster_ref() const -> const core::cluster&
  {
    return cluster_;
  };

  [[nodiscard]] auto config() const -> const couchbase::transactions::transactions_config::built&
  {
    return config_;
  }
  [[nodiscard]] auto config() -> couchbase::transactions::transactions_config::built&
  {
    return config_;
  };

  // Add an attempt cleanup later.
  void add_attempt(const std::shared_ptr<attempt_context>& ctx);

  auto cleanup_queue_length() const -> std::size_t
  {
    return atr_queue_.size();
  }

  void add_collection(const couchbase::transactions::transaction_keyspace& keyspace);
  auto collections() -> std::list<couchbase::transactions::transaction_keyspace>
  {
    std::lock_guard<std::mutex> lock(mutex_);
    return collections_;
  }

  // only used for testing.
  void force_cleanup_attempts(std::vector<transactions_cleanup_attempt>& results);
  // only used for testing
  void force_cleanup_entry(atr_cleanup_entry& entry, transactions_cleanup_attempt& attempt);
  // only used for testing
  auto force_cleanup_atr(const core::document_id& atr_id,
                         std::vector<transactions_cleanup_attempt>& results) -> atr_cleanup_stats;
  auto get_active_clients(const couchbase::transactions::transaction_keyspace& keyspace,
                          const std::string& uuid) -> client_record_details;
  void remove_client_record_from_all_buckets(const std::string& uuid);
  void start();
  void stop();
  void close();

private:
  core::cluster cluster_;
  couchbase::transactions::transactions_config::built config_;
  const std::chrono::milliseconds cleanup_loop_delay_{ 100 };

  std::thread cleanup_thr_;
  atr_cleanup_queue atr_queue_;
  mutable std::condition_variable cv_;
  mutable std::mutex mutex_;
  std::list<std::thread> lost_attempt_cleanup_workers_;

  const std::string client_uuid_;
  std::list<couchbase::transactions::transaction_keyspace> collections_;

  void attempts_loop();

  auto is_running() -> bool
  {
    std::unique_lock<std::mutex> lock(mutex_);
    return running_;
  }

  template<class R, class P>
  auto interruptable_wait(std::chrono::duration<R, P> time) -> bool;

  void lost_attempts_loop();
  void clean_collection(const couchbase::transactions::transaction_keyspace& keyspace);
  void create_client_record(const couchbase::transactions::transaction_keyspace& keyspace);
  auto handle_atr_cleanup(const core::document_id& atr_id,
                          std::vector<transactions_cleanup_attempt>* result = nullptr)
    -> atr_cleanup_stats;
  bool running_{ false };
};
} // namespace transactions
} // namespace couchbase::core
