/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-Present Couchbase, Inc.
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

#include <couchbase/transactions/async_attempt_context.hxx>
#include <couchbase/transactions/attempt_context.hxx>
#include <couchbase/transactions/transaction_options.hxx>
#include <couchbase/transactions/transaction_result.hxx>

#include <functional>

namespace couchbase::transactions
{
using txn_logic = std::function<error(std::shared_ptr<attempt_context>)>;
using async_txn_logic = std::function<error(std::shared_ptr<async_attempt_context>)>;
using async_txn_complete_logic = std::function<void(error, transaction_result)>;

/**
 * The transactions object is used to initiate a transaction.
 *
 *
 */
class transactions
{
public:
  virtual ~transactions() = default;

  /**
   * Run a blocking transaction.
   *
   * You can supply a lambda or function which uses a yielded {@link attempt_context} to perform a
   * transaction, where each transaction operation is blocking.  A simple usage would be to get a
   * document and replace the contents:
   *
   * @snippet{trimleft} test/test_transaction_examples.cxx simple-blocking-txn
   *
   * @param logic a lambda or function which uses the yielded {@link attempt_context} to perform the
   * desired transactional operations.
   * @param cfg if passed in, these options override the defaults, or those set in the {@link
   * cluster_options}.
   * @return an {@link error}, and a {@link transaction_result} representing the results of the
   * transaction.
   */
  virtual auto run(txn_logic&& logic,
                   const transaction_options& cfg) -> std::pair<error, transaction_result> = 0;

  auto run(txn_logic&& logic) -> std::pair<error, transaction_result>
  {
    return run(std::move(logic), {});
  }

  /**
   * Run an asynchronous transaction.
   *
   * You can supply a lambda or function which uses a yielded {@link async_attempt_context} to
   * perform a transaction, where each transaction operation is asynchronous.  A simple usage would
   * be to get 3 document and replace the contents of each.   In the example below, we get the 3
   * documents in parallel, and update each when the get returns the document.   This can be
   * significantly faster than getting each document in serial, and updating it using the blocking
   * api:
   *
   * @snippet{trimleft} test/test_transaction_examples.cxx simple-async-txn
   *
   * @param logic a lambda or function which uses the yielded {@link async_attempt_context} to
   * perform the desired transactional operations.
   * @param complete_callback a lambda or function to which is yielded a {transaction_error_context}
   * and {transaction_result}.
   * @param cfg if passed in, these options override the defaults, or those set in the {@link
   * cluster_options}.
   */
  virtual void run(async_txn_logic&& logic,
                   async_txn_complete_logic&& complete_callback,
                   const transaction_options& cfg) = 0;

  void run(async_txn_logic&& logic, async_txn_complete_logic&& complete_callback)
  {
    return run(std::move(logic), std::move(complete_callback), {});
  }
};
} // namespace couchbase::transactions
