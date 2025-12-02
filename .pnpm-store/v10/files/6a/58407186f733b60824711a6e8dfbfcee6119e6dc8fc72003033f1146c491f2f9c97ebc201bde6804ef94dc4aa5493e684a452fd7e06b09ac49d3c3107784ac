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

#include "internal/logging.hxx"

#include <condition_variable>
#include <mutex>

namespace couchbase::core::transactions
{

class async_operation_conflict : public std::runtime_error
{
public:
  async_operation_conflict(const std::string& msg)
    : std::runtime_error(msg)
  {
  }
};
struct attempt_mode {
  enum class modes {
    KV,
    QUERY
  };
  modes mode;
  std::string query_node;

  attempt_mode()
    : mode(modes::KV)
  {
  }

  auto is_query() -> bool
  {
    return mode == modes::QUERY;
  }
};

class waitable_op_list
{
public:
  waitable_op_list()
    : count_(0)
    , allow_ops_(true)
    , mode_()
    , in_flight_(0)
  {
  }

  void increment_ops()
  {
    change_count(1);
  }
  void decrement_ops()
  {
    change_count(-1);
  }
  void wait_and_block_ops()
  {
    std::unique_lock<std::mutex> lock(mutex_);
    cv_ops_.wait(lock, [this]() {
      return (0 == count_);
    });
    // we have the lock.  Block all further ops
    allow_ops_ = false;
  }
  auto get_mode() -> attempt_mode
  {
    std::unique_lock<std::mutex> lock(mutex_);
    if (mode_.mode == attempt_mode::modes::KV) {
      return {};
    }
    if (!mode_.query_node.empty()) {
      return mode_;
    }
    // Another op has set the query_mode_, and hasn't set the
    // query_node_ yet.   So we wait.
    cv_query_.wait(lock, [this]() {
      return !mode_.query_node.empty();
    });
    return mode_;
  }

  template<typename BeginWorkHandler, typename DoQueryHandler>
  void set_query_mode(BeginWorkHandler&& begin_work_cb, DoQueryHandler&& cb)
  {
    std::unique_lock<std::mutex> lock(mutex_);
    // called within an op, so decrement in_flight from that op, wait for
    // other in_flight to complete.
    in_flight_--;
    if (mode_.mode == attempt_mode::modes::KV) {
      // wait until all in_flight ops are done
      CB_TXN_LOG_TRACE("set_query_mode: waiting for in_flight ops to go to 0...");
      cv_in_flight_.wait(lock, [this]() {
        return (0 == in_flight_);
      });
      // ok, now no outstanding ops(apart from the query that called this), and I have the lock,
      // so...
      if (mode_.mode == attempt_mode::modes::KV) {
        CB_TXN_LOG_TRACE("set_query_mode: in_flight ops = 0, we were kv, setting mode to query");
        // still kv, so now (while blocking) set the mode
        mode_.mode = attempt_mode::modes::QUERY;
        // ok to unlock now, as any racing set_query_mode will wait for
        // a node to be set.
        in_flight_++;
        lock.unlock();
        // now (outside the lock), call the callback, which does the begin_work
        // when initially setting query mode.
        begin_work_cb();
        return;
      }
    }
    // you make it here, and someone else is currently setting the node (a byproduct of
    // calling the callback).  So wait for that.
    CB_TXN_LOG_TRACE("set_query_mode: mode already query, waiting for node to be set...");
    cv_query_.wait(lock, [this]() {
      return !mode_.query_node.empty();
    });
    cv_in_flight_.wait(lock, [this]() {
      return 0 == in_flight_;
    });
    in_flight_++;
    CB_TXN_LOG_TRACE("set_query_mode: node set, continuing...");
    lock.unlock();
    cb();
  }
  void reset_query_mode()
  {
    // when begin work errors out, it is fatal, so reset to kv mode here, allowing
    // rollback to function properly.
    std::unique_lock<std::mutex> lock;
    mode_.mode = attempt_mode::modes::KV;
    cv_query_.notify_all();
  }

  void set_query_node(const std::string& node)
  {
    std::unique_lock<std::mutex> lock(mutex_);
    assert(mode_.mode == attempt_mode::modes::QUERY);
    mode_.query_node = node;
    // now notify everyone waiting in get_mode()
    cv_query_.notify_all();
  }
  void decrement_in_flight()
  {
    std::lock_guard<std::mutex> lock(mutex_);
    in_flight_--;
    CB_TXN_LOG_TRACE("in_flight decremented to {}", in_flight_);
    assert(in_flight_ >= 0);
    if (0 == in_flight_) {
      cv_in_flight_.notify_all();
    }
  }

private:
  void change_count(int32_t val)
  {
    std::lock_guard<std::mutex> lock(mutex_);
    if (allow_ops_) {
      count_ += val;
      if (val > 0) {
        in_flight_ += val;
      }
      CB_TXN_LOG_TRACE("op count changed by {} to {}, {} in_flight", val, count_, in_flight_);
      assert(count_ >= 0);
      assert(in_flight_ >= 0);
      if (0 == count_) {
        cv_ops_.notify_all();
      }
      if (0 == in_flight_) {
        cv_in_flight_.notify_all();
      }
    } else {
      CB_TXN_LOG_ERROR("operation attempted after commit/rollback");
      throw async_operation_conflict("Operation attempted after commit or rollback");
    }
  }

private:
  int32_t count_;
  bool allow_ops_;
  attempt_mode mode_;
  int32_t in_flight_;
  std::condition_variable cv_ops_;
  std::condition_variable cv_query_;
  std::condition_variable cv_in_flight_;
  std::mutex mutex_;
};
} // namespace couchbase::core::transactions
