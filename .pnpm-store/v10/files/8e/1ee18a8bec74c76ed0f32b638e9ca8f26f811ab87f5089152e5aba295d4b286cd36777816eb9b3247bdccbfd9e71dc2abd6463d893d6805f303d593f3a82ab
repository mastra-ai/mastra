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

#include <couchbase/transactions.hxx>

#include <couchbase/fork_event.hxx>
#include <couchbase/transactions/transaction_options.hxx>
#include <couchbase/transactions/transaction_result.hxx>
#include <couchbase/transactions/transactions_config.hxx>

#include "transactions/async_attempt_context.hxx"
#include "transactions/attempt_context.hxx"
#include "transactions/exceptions.hxx"

#include "core/cluster.hxx"
#include "core/logger/logger.hxx"
#include "core/utils/movable_function.hxx"

#include <functional>
#include <system_error>

// workaround for MSVC define overlap with log levels
#undef ERROR

/**
 * @file
 * Main header file for Couchbase Transactions
 */

namespace couchbase::core
{
class cluster;

namespace transactions
{
/** @internal
 */
class transactions_cleanup;

/** @brief Transaction logic should be contained in a lambda of this form */
using logic = std::function<void(std::shared_ptr<attempt_context>)>;

/** @brief AsyncTransaction logic should be contained in a lambda of this form */
using async_logic = std::function<void(std::shared_ptr<async_attempt_context>)>;

/** @brief AsyncTransaction callback when transaction has completed */
using txn_complete_callback =
  std::function<void(std::optional<transaction_exception>,
                     std::optional<::couchbase::transactions::transaction_result>)>;

/**
 * @mainpage
 * A transaction consists of a lambda containing all the operations you wish to perform within a
 * transaction. The @ref transactions.run() call yields an @ref attempt_context which you use for
 * those operations.
 *
 * @section txn_overview Overview
 *
 * A very simple transaction:
 *
 * @code{.cpp}
 * cluster c("couchbase://127.0.0.1", "Administrator", "password");
 * transactions_config config;
 * config.durability_level(transactions::durability_level::MAJORITY);
 * auto b = cluster.bucket("default");
 * auto coll = b->default_collection();
 * transactions txn(c, config);
 *
 * try {
 *     txn.run([&](std::shared_ptr<transactions::attempt_context> ctx) {
 *         ctx.upsert(coll, "somekey", nlohmann::json::parse("{\"a\":\"thing\"}"));
 *         ctx.insert(coll, "someotherkey", nlohmann::json::parse("{"\a\":\"different thing\"}"));
 *     });
 *     cout << "txn successful" << endl;
 * } catch (const transaction_failed& failed) {
 *     cerr << "txn failed: " << failed.what() << endl;
 * } catch (const transaction_expired& expired) {
 *    cerr << "txn timed out" << expired.what() << endl;
 * }
 * @endcode
 *
 * This upserts a document, and inserts another into the default collection in the bucket named
 * "default".  If unsuccessful, an exception will be raised.
 *
 * For a much more detailed example, see @ref examples/game_server.cxx
 *
 * @section txn_best_practices Best Practices
 *
 * Each @ref transactions instances spins up background threads to perform cleanup of metadata
 * that could be left behind after failed transactions.  For that reason, creating many
 * @ref transactions objects, especially if they are long-lived, will consume resources.  We
 * recommend simply creating one @ref transactions object per process, and using that for the life
 * of the process, when possible.
 *
 * The @ref transactions, @ref cluster, @ref bucket, and @ref collection instances are all safe to
 * use across threads.  The @ref cluster and @ref bucket use libcouchbase internally, and manage a
 * pool of libcouchbase instances, since those instances are not to be used across threads.  The
 * maximum number of instances in the pools (for either the @ref cluster or @ref bucket) can be
 * specified at the time you construct the @ref cluster.  See @ref cluster_options for details.
 *
 * Since a @ref transactions instance spins up one thread per bucket for background cleanup tasks, a
 * reasonable starting point for sizing the @ref cluster_options::max_bucket_instances would be one
 * per bucket, plus one per thread that uses the @ref cluster (or the @ref transactions object
 * constructed with that @ref cluster). This could be tuned lower potentially, but this is a the
 * maxmimum one should need.  The pool only creates a new instance when it needs one, so the actual
 * number created may never hit the max.  When the maximum is reached, the thread will block until
 * one is available.
 *
 * @example examples/game_server.cxx
 */

/** @brief Main class for creating a transaction
 *
 */
class transactions : public couchbase::transactions::transactions
{
public:
  /**
   * @brief Create a transactions object.
   *
   * Creates a transactions object, which can be used to run transactions within the current thread.
   *
   * @param cluster The cluster to use for the transactions.
   * @param config The configuration parameters to use for the transactions.
   * @param cb Called when the transactions object has been created or an error has occurred during
   * the creation.
   */
  static void create(
    core::cluster cluster,
    const couchbase::transactions::transactions_config::built&,
    utils::movable_function<void(std::error_code, std::shared_ptr<transactions>)>&& cb);
  static void create(
    core::cluster cluster,
    const couchbase::transactions::transactions_config&,
    utils::movable_function<void(std::error_code, std::shared_ptr<transactions>)>&& cb);

  /**
   * @brief Create a transactions object.
   *
   * Creates a transactions object, which can be used to run transactions within the current thread.
   *
   * @param cluster The cluster to use for the transactions.
   * @param config The configuration parameters to use for the transactions.
   * @return a future containing the error that occurred or the transactions object.
   */
  static auto create(core::cluster cluster,
                     const couchbase::transactions::transactions_config::built& config)
    -> std::future<std::pair<std::error_code, std::shared_ptr<transactions>>>;
  static auto create(core::cluster cluster,
                     const couchbase::transactions::transactions_config& config)
    -> std::future<std::pair<std::error_code, std::shared_ptr<transactions>>>;

  /**
   * @brief Run a transaction
   *
   * Expects a lambda, which it calls with an @ref attempt_context reference to be used in the
   * lambda for the transaction operations.
   *
   * @param logic The lambda containing the transaction logic.
   * @return A struct containing some internal state information about the transaction.
   * @throws @ref transaction_failed, @ref errc::transaction::expired, @ref
   * transaction_commit_ambiguous, all of which share a common base class @ref
   * transaction_exception.
   */
  auto run(logic&& code) -> couchbase::transactions::transaction_result;

  auto run(const couchbase::transactions::transaction_options& config,
           logic&& code) -> couchbase::transactions::transaction_result;

  auto run(::couchbase::transactions::txn_logic&& code,
           const couchbase::transactions::transaction_options& config)
    -> std::pair<couchbase::error, couchbase::transactions::transaction_result> override;

  /**
   * @brief Run a transaction
   *
   * Expects a lambda, which it calls with an @ref async_attempt_context reference to be used in the
   * lambda for the asynchronous transaction operations. Upon completion, calls the callback.
   *
   * @param logic The lambda containing the async transaction logic.
   * @param cb Called when the transaction is complete.
   * @return A struct containing some internal state information about the transaction.
   * @throws @ref errc::transaction::failed, @ref errc::transaction::expired, @ref
   * errc::transaction::ambiguous.
   */
  void run(async_logic&& code, txn_complete_callback&& cb);

  void run(const couchbase::transactions::transaction_options& config,
           async_logic&& code,
           txn_complete_callback&& cb);

  void run(couchbase::transactions::async_txn_logic&& code,
           couchbase::transactions::async_txn_complete_logic&& complete_cb,
           const couchbase::transactions::transaction_options& config) override;
  /**
   * @internal
   * called internally - will likely move
   */
  void commit(std::shared_ptr<attempt_context> ctx)
  {
    ctx->commit();
  }

  /**
   * @internal
   * called internally - will likely move
   */
  void rollback(std::shared_ptr<attempt_context> ctx)
  {
    ctx->rollback();
  }

  void notify_fork(fork_event event);

  /**
   * @brief Shut down the transactions object
   *
   * The transaction object cannot be used after this call.  Called in destructor, but
   * available to call sooner if needed.
   */
  void close();

  /**
   * @brief Return reference to @ref transactions_config.
   *
   * @return config for this transactions instance.
   */
  [[nodiscard]] auto config() -> couchbase::transactions::transactions_config::built&
  {
    return config_;
  }

  /**
   * @internal
   * Called internally
   */
  [[nodiscard]] auto cleanup() const -> const transactions_cleanup&
  {
    return *cleanup_;
  }

  /**
   * @internal
   * Called internally
   */
  [[nodiscard]] auto cleanup() -> transactions_cleanup&
  {
    return *cleanup_;
  }

  /**
   * @brief Return a reference to the @ref core::cluster
   *
   * @return Ref to the cluster used by this transaction object.
   */
  [[nodiscard]] auto cluster_ref() -> core::cluster&
  {
    return cluster_;
  }

  /**
   * @internal
   */
  transactions(core::cluster cluster, couchbase::transactions::transactions_config::built config);
  transactions(core::cluster cluster, const couchbase::transactions::transactions_config& config);

  ~transactions() override;

private:
  core::cluster cluster_;
  couchbase::transactions::transactions_config::built config_;
  std::unique_ptr<transactions_cleanup> cleanup_;
  const std::size_t max_attempts_{ 1000 };
  const std::chrono::milliseconds min_retry_delay_{ 1 };
};
} // namespace transactions
} // namespace couchbase::core
