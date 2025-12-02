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

#include "attempt_context_impl.hxx"
#include "uid_generator.hxx"

#include "core/transactions.hxx"
#include "exceptions_fmt.hxx"
#include "internal/logging.hxx"
#include "internal/transaction_attempt.hxx"
#include "internal/transaction_context.hxx"
#include "internal/transactions_cleanup.hxx"
#include "internal/utils.hxx"

#include <asio/post.hpp>
#include <asio/steady_timer.hpp>
#include <utility>

namespace couchbase::core::transactions
{

auto
transaction_context::create(transactions& txns,
                            const couchbase::transactions::transaction_options& config)
  -> std::shared_ptr<transaction_context>
{
  // use empty wrapper to class to enable std::make_shared with private
  // constructor of transaction_context
  class transaction_context_wrapper : public transaction_context
  {
  public:
    transaction_context_wrapper(transactions& txns,
                                const couchbase::transactions::transaction_options& config)
      : transaction_context(txns, config)
    {
    }
  };
  return std::make_shared<transaction_context_wrapper>(txns, config);
}

transaction_context::transaction_context(transactions& txns,
                                         const couchbase::transactions::transaction_options& config)
  : transaction_id_(uid_generator::next())
  , start_time_client_(std::chrono::steady_clock::now())
  , transactions_(txns)
  , config_(config.apply(txns.config()))
  , deferred_elapsed_(0)
  , cleanup_(txns.cleanup())
  , delay_(new exp_delay(std::chrono::milliseconds(1),
                         std::chrono::milliseconds(100),
                         2 * config_.timeout))
{
  // add metadata_collection to cleanup, if present
  if (config_.metadata_collection) {
    transactions_.cleanup().add_collection({ config_.metadata_collection->bucket,
                                             config_.metadata_collection->scope,
                                             config_.metadata_collection->collection });
  }
}

transaction_context::~transaction_context() = default;

void
transaction_context::add_attempt()
{
  const transaction_attempt attempt{};
  const std::lock_guard<std::mutex> lock(mutex_);
  attempts_.push_back(attempt);
}

[[nodiscard]] auto
transaction_context::remaining() const -> std::chrono::nanoseconds
{
  const auto& now = std::chrono::steady_clock::now();
  auto expired_nanos =
    std::chrono::duration_cast<std::chrono::nanoseconds>(now - start_time_client_) +
    deferred_elapsed_;
  return config_.timeout - expired_nanos;
}

auto
transaction_context::expiry_time() const -> std::chrono::steady_clock::time_point
{
  return start_time_client_ + config_.timeout;
}

[[nodiscard]] auto
transaction_context::has_expired_client_side() -> bool
{
  // repeat code above - nice for logging.  Ponder changing this.
  const auto& now = std::chrono::steady_clock::now();
  auto expired_nanos =
    std::chrono::duration_cast<std::chrono::nanoseconds>(now - start_time_client_) +
    deferred_elapsed_;
  auto expired_millis = std::chrono::duration_cast<std::chrono::milliseconds>(expired_nanos);
  const bool is_expired = expired_nanos > config_.timeout;
  if (is_expired) {
    CB_ATTEMPT_CTX_LOG_INFO(
      current_attempt_context_,
      "has expired client side (now={}ns, start={}ns, deferred_elapsed={}ns, "
      "expired={}ns ({}ms), "
      "config={}ms)",
      now.time_since_epoch().count(),
      start_time_client_.time_since_epoch().count(),
      deferred_elapsed_.count(),
      expired_nanos.count(),
      expired_millis.count(),
      std::chrono::duration_cast<std::chrono::milliseconds>(config_.timeout).count());
  }
  return is_expired;
}

void
transaction_context::after_delay(std::chrono::milliseconds delay, const std::function<void()>& fn)
{
  auto timer = std::make_shared<asio::steady_timer>(this->transactions_.cluster_ref().io_context());
  timer->expires_after(delay);
  timer->async_wait([timer, fn](std::error_code) {
    // have to always call the function, even if timer was canceled.
    fn();
  });
}

void
transaction_context::new_attempt_context(async_attempt_context::VoidCallback&& cb)
{
  asio::post(transactions_.cluster_ref().io_context(),
             [self = shared_from_this(), cb = std::move(cb)]() {
               // the first time we call the delay, it just records an end time.  After
               // that, it actually delays.
               try {
                 (*self->delay_)();
                 self->current_attempt_context_ = attempt_context_impl::create(self);
                 CB_ATTEMPT_CTX_LOG_INFO(self->current_attempt_context_,
                                         "starting attempt {}/{}/{}/",
                                         self->num_attempts(),
                                         self->transaction_id(),
                                         self->current_attempt_context_->id());
                 cb(nullptr);
               } catch (...) {
                 cb(std::current_exception());
               }
             });
}

auto
transaction_context::current_attempt_context() -> std::shared_ptr<attempt_context_impl>
{
  return current_attempt_context_;
}

void
transaction_context::get(const core::document_id& id, async_attempt_context::Callback&& cb)
{
  if (current_attempt_context_) {
    return current_attempt_context_->get(id, std::move(cb));
  }
  throw transaction_operation_failed(FAIL_OTHER, "no current attempt context");
}

void
transaction_context::get_replica_from_preferred_server_group(const core::document_id& id,
                                                             async_attempt_context::Callback&& cb)
{
  if (current_attempt_context_) {
    return current_attempt_context_->get_replica_from_preferred_server_group(id, std::move(cb));
  }
  throw transaction_operation_failed(FAIL_OTHER, "no current attempt context");
}

void
transaction_context::get_multi_replicas_from_preferred_server_group(
  const std::vector<core::document_id>& ids,
  transaction_get_multi_replicas_from_preferred_server_group_mode mode,
  std::function<
    void(std::exception_ptr,
         std::optional<transaction_get_multi_replicas_from_preferred_server_group_result>)>&& cb)
{
  if (current_attempt_context_) {
    return current_attempt_context_->get_multi_replicas_from_preferred_server_group(
      ids, mode, std::move(cb));
  }
  throw transaction_operation_failed(FAIL_OTHER, "no current attempt context");
}

void
transaction_context::get_multi(
  const std::vector<core::document_id>& ids,
  transaction_get_multi_mode mode,
  std::function<void(std::exception_ptr, std::optional<transaction_get_multi_result>)>&& cb)
{
  if (current_attempt_context_) {
    return current_attempt_context_->get_multi(ids, mode, std::move(cb));
  }
  throw transaction_operation_failed(FAIL_OTHER, "no current attempt context");
}

void
transaction_context::get_optional(const core::document_id& id, async_attempt_context::Callback&& cb)
{
  if (current_attempt_context_) {
    return current_attempt_context_->get_optional(id, std::move(cb));
  }
  throw transaction_operation_failed(FAIL_OTHER, "no current attempt context");
}

void
transaction_context::insert(const core::document_id& id,
                            codec::encoded_value content,
                            async_attempt_context::Callback&& cb)
{
  if (current_attempt_context_) {
    return current_attempt_context_->insert(id, std::move(content), std::move(cb));
  }
  throw transaction_operation_failed(FAIL_OTHER, "no current attempt context");
}

void
transaction_context::replace(const transaction_get_result& doc,
                             codec::encoded_value content,
                             async_attempt_context::Callback&& cb)
{
  if (current_attempt_context_) {
    return current_attempt_context_->replace(doc, std::move(content), std::move(cb));
  }
  throw transaction_operation_failed(FAIL_OTHER, "no current attempt context");
}

void
transaction_context::remove(const transaction_get_result& doc,
                            async_attempt_context::VoidCallback&& cb)
{
  if (current_attempt_context_) {
    return current_attempt_context_->remove(doc, std::move(cb));
  }
  throw transaction_operation_failed(FAIL_OTHER, "no current attempt context");
}

void
transaction_context::query(const std::string& statement,
                           const couchbase::transactions::transaction_query_options& opts,
                           std::optional<std::string> query_context,
                           async_attempt_context::QueryCallback&& cb)
{
  if (current_attempt_context_) {
    return current_attempt_context_->query(
      statement, opts, std::move(query_context), std::move(cb));
  }
  throw(transaction_operation_failed(FAIL_OTHER, "no current attempt context"));
}

void
transaction_context::query(const std::string& statement,
                           const couchbase::transactions::transaction_query_options& opts,
                           async_attempt_context::QueryCallback&& cb)
{
  query(statement, opts, {}, std::move(cb));
}
void
transaction_context::commit(async_attempt_context::VoidCallback&& cb)
{
  if (current_attempt_context_) {
    return current_attempt_context_->commit(std::move(cb));
  }
  throw transaction_operation_failed(FAIL_OTHER, "no current attempt context").no_rollback();
}

void
transaction_context::rollback(async_attempt_context::VoidCallback&& cb)
{
  if (current_attempt_context_) {
    return current_attempt_context_->rollback(std::move(cb));
  }
  throw transaction_operation_failed(FAIL_OTHER, "no current attempt context").no_rollback();
}

void
transaction_context::existing_error(bool previous_op_failed)
{
  if (current_attempt_context_) {
    return current_attempt_context_->existing_error(previous_op_failed);
  }
  throw transaction_operation_failed(FAIL_OTHER, "no current attempt context").no_rollback();
}

void
transaction_context::handle_error(const std::exception_ptr& err, txn_complete_callback&& callback)
{
  try {
    try {
      std::rethrow_exception(err);
    } catch (const op_exception& e) {
      // turn this into a transaction_operation_failed
      throw transaction_operation_failed(FAIL_OTHER, e.what()).cause(e.cause());
    }
  } catch (const transaction_operation_failed& er) {
    CB_ATTEMPT_CTX_LOG_ERROR(current_attempt_context_,
                             "got transaction_operation_failed {}, cause={}, retry={}, rollback={}",
                             er.what(),
                             er.cause(),
                             er.should_retry(),
                             er.should_rollback());
    if (er.should_rollback()) {
      CB_ATTEMPT_CTX_LOG_TRACE(current_attempt_context_,
                               "got rollback-able exception, rolling back");
      try {
        current_attempt_context_->rollback();
      } catch (const std::exception& er_rollback) {
        cleanup().add_attempt(current_attempt_context_);
        CB_ATTEMPT_CTX_LOG_TRACE(
          current_attempt_context_,
          "got error \"{}\" while auto rolling back, throwing original error",
          er_rollback.what(),
          er.what());
        auto final = er.get_final_exception(*this);
        // if you get here, we didn't throw, yet we had an error.  Fall through
        // in this case.  Note the current logic is such that rollback will not
        // have a commit ambiguous error, so we should always throw.
        assert(final);
        return callback(final, std::nullopt);
      }
      if (er.should_retry() && has_expired_client_side()) {
        CB_ATTEMPT_CTX_LOG_TRACE(current_attempt_context_,
                                 "auto rollback succeeded, however we are expired so no retry");

        return callback(transaction_operation_failed(FAIL_EXPIRY, "expired in auto rollback")
                          .no_rollback()
                          .expired()
                          .get_final_exception(*this),
                        {});
      }
    }
    if (er.should_retry()) {
      CB_ATTEMPT_CTX_LOG_TRACE(current_attempt_context_, "got retryable exception, retrying");
      cleanup().add_attempt(current_attempt_context_);
      return callback(std::nullopt, std::nullopt);
    }

    // throw the expected exception here
    cleanup().add_attempt(current_attempt_context_);
    auto final = er.get_final_exception(*this);
    std::optional<::couchbase::transactions::transaction_result> res;
    if (!final) {
      res = get_transaction_result();
    }
    return callback(final, res);
  } catch (const std::exception& ex) {
    CB_ATTEMPT_CTX_LOG_ERROR(current_attempt_context_, "got runtime error \"{}\"", ex.what());
    try {
      current_attempt_context_->rollback();
    } catch (...) {
      CB_ATTEMPT_CTX_LOG_ERROR(
        current_attempt_context_, "got error rolling back \"{}\"", ex.what());
    }
    cleanup().add_attempt(current_attempt_context_);
    // the assumption here is this must come from the logic, not
    // our operations (which only throw transaction_operation_failed),
    auto op_failed = transaction_operation_failed(FAIL_OTHER, ex.what());
    return callback(op_failed.get_final_exception(*this), std::nullopt);
  } catch (...) {
    CB_ATTEMPT_CTX_LOG_ERROR(current_attempt_context_, "got unexpected error, rolling back");
    try {
      current_attempt_context_->rollback();
    } catch (...) {
      CB_ATTEMPT_CTX_LOG_ERROR(current_attempt_context_, "got error rolling back unexpected error");
    }
    cleanup().add_attempt(current_attempt_context_);
    // the assumption here is this must come from the logic, not
    // our operations (which only throw transaction_operation_failed),
    auto op_failed = transaction_operation_failed(FAIL_OTHER, "Unexpected error");
    return callback(op_failed.get_final_exception(*this), std::nullopt);
  }
}

void
transaction_context::finalize(txn_complete_callback&& cb)
{

  try {
    existing_error(false);
    if (current_attempt_context_->is_done()) {
      return cb(std::nullopt, get_transaction_result());
    }
    commit([self = shared_from_this(), cb = std::move(cb)](const std::exception_ptr& err) mutable {
      if (err) {
        return self->handle_error(err, std::move(cb));
      }
      cb(std::nullopt, self->get_transaction_result());
    });
  } catch (...) {
    return handle_error(std::current_exception(), std::move(cb));
  }
}

void
transaction_context::current_attempt_state(attempt_state s)
{
  const std::lock_guard<std::mutex> lock(mutex_);
  if (attempts_.empty()) {
    throw std::runtime_error("transaction_context has no attempts yet");
  }
  attempts_.back().state = s;
}

auto
transaction_context::cluster_ref() const -> const core::cluster&
{
  return transactions_.cluster_ref();
}

auto
transaction_context::config() const -> const couchbase::transactions::transactions_config::built&
{
  return config_;
}

auto
transaction_context::cleanup() -> transactions_cleanup&
{
  return cleanup_;
}

auto
transaction_context::start_time_client() const -> std::chrono::time_point<std::chrono::steady_clock>
{
  return start_time_client_;
}

auto
transaction_context::atr_id() const -> const std::string&
{
  return atr_id_;
}

void
transaction_context::atr_id(const std::string& id)
{
  atr_id_ = id;
}

auto
transaction_context::atr_collection() const -> const std::string&
{
  return atr_collection_;
}

void
transaction_context::atr_collection(const std::string& coll)
{
  atr_collection_ = coll;
}

auto
transaction_context::get_transaction_result() const -> ::couchbase::transactions::transaction_result
{
  return couchbase::transactions::transaction_result{
    transaction_id(), current_attempt().state == attempt_state::COMPLETED
  };
}

void
transaction_context::new_attempt_context()
{
  auto barrier = std::make_shared<std::promise<void>>();
  auto f = barrier->get_future();
  new_attempt_context([barrier](const std::exception_ptr& err) {
    if (err) {
      return barrier->set_exception(err);
    }
    return barrier->set_value();
  });
  f.get();
}

auto
transaction_context::current_attempt() const -> const transaction_attempt&
{
  const std::lock_guard<std::mutex> lock(mutex_);
  if (attempts_.empty()) {
    throw std::runtime_error("transaction context has no attempts yet");
  }
  return attempts_.back();
}

auto
transaction_context::num_attempts() const -> std::size_t
{
  const std::lock_guard<std::mutex> lock(mutex_);
  return attempts_.size();
}

auto
transaction_context::transaction_id() const -> const std::string&
{
  return transaction_id_;
}
} // namespace couchbase::core::transactions
