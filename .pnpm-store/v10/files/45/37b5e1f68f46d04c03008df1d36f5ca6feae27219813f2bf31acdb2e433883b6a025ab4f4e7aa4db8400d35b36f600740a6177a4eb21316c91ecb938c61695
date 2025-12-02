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

#include "core/transactions/error_class.hxx"
#include "core/transactions/exceptions.hxx"
#include "core/transactions/result.hxx"

#include "core/error_context/transaction_op_error_context.hxx"

#include <algorithm>
#include <list>

namespace couchbase::core::transactions
{
class transaction_context;

//  only used in ambiguity resolution during atr_commit
class retry_atr_commit : public std::runtime_error
{
public:
  retry_atr_commit(const std::string& what)
    : std::runtime_error(what)
  {
  }
};

class retry_operation : public std::runtime_error
{
public:
  retry_operation(const std::string& what)
    : std::runtime_error(what)
  {
  }
};

class retry_operation_timeout : public std::runtime_error
{
public:
  retry_operation_timeout(const std::string& what)
    : std::runtime_error(what)
  {
  }
};

class retry_operation_retries_exhausted : public std::runtime_error
{
public:
  retry_operation_retries_exhausted(const std::string& what)
    : std::runtime_error(what)
  {
  }
};

external_exception
external_exception_from_error_class(error_class ec);

enum final_error {
  FAILED,
  EXPIRED,
  FAILED_POST_COMMIT,
  AMBIGUOUS
};

error_class
error_class_from_result(const result& res);

class client_error : public std::runtime_error
{
private:
  error_class ec_;
  std::optional<result> res_;

public:
  explicit client_error(const result& res)
    : runtime_error(res.strerror())
    , ec_(error_class_from_result(res))
    , res_(res)
  {
  }

  explicit client_error(error_class ec, const std::string& what)
    : runtime_error(what)
    , ec_(ec)
  {
  }

  [[nodiscard]] error_class ec() const
  {
    return ec_;
  }

  [[nodiscard]] std::optional<result> res() const
  {
    return res_;
  }
};

// Prefer this as it reads better than throw client_error(FAIL_EXPIRY, ...)
class attempt_expired : public client_error
{
public:
  attempt_expired(const std::string& what)
    : client_error(FAIL_EXPIRY, what)
  {
  }
};

/**
 * All exceptions within a transaction are, or are converted to, an exception
 * derived from this.  The transaction logic then consumes them to decide to
 * retry, or rollback the transaction.
 */
class transaction_operation_failed : public std::runtime_error
{
public:
  explicit transaction_operation_failed(error_class ec, const std::string& what)
    : std::runtime_error(what)
    , ec_(ec)
    , retry_(false)
    , rollback_(true)
    , to_raise_(FAILED)
    , cause_(external_exception_from_error_class(ec))
  {
  }
  explicit transaction_operation_failed(error_class ec,
                                        std::optional<external_exception> cause,
                                        const std::string& what)
    : std::runtime_error(what)
    , ec_(ec)
    , retry_(false)
    , rollback_(true)
    , to_raise_(FAILED)
    , cause_(cause.value_or(UNKNOWN) == UNKNOWN ? external_exception_from_error_class(ec)
                                                : cause.value_or(UNKNOWN))
  {
  }
  explicit transaction_operation_failed(const client_error& client_err)
    : std::runtime_error(client_err.what())
    , ec_(client_err.ec())
    , retry_(false)
    , rollback_(true)
    , to_raise_(FAILED)
    , cause_(UNKNOWN)
  {
  }

  static transaction_operation_failed merge_errors(std::list<transaction_operation_failed> errors,
                                                   std::optional<external_exception> cause = {},
                                                   bool do_throw = true)
  {
    // default would be to set retry false, rollback true.  If
    // _all_ errors set retry to true, we set retry to true.  If _any_ errors
    // set rollback to false, we set rollback to false.
    // For now lets retain the ec, to_raise, and cause for the first of the
    // retries (if they all are true), or the first of the rollbacks, if it
    // is false.  Not rolling back takes precedence over retry.  Otherwise, we
    // just retain the first.
    assert(errors.size() > 0);
    // start with first error
    auto error_to_throw = errors.front();
    for (auto& ex : errors) {
      if (!ex.retry_) {
        error_to_throw = ex;
      }
      if (!ex.rollback_) {
        // this takes precedence, (no_rollback means no_retry as well), so just
        // throw this
        error_to_throw = ex;
        break;
      }
    }
    if (cause) {
      error_to_throw.cause(*cause);
    }
    if (do_throw) {
      throw error_to_throw;
    }
    return error_to_throw;
  }
  // Retry is false by default, this makes it true
  transaction_operation_failed& retry()
  {
    retry_ = true;
    return *this;
  }

  // Rollback defaults to true, this sets it to false
  transaction_operation_failed& no_rollback()
  {
    rollback_ = false;
    return *this;
  }

  // Defaults to FAILED, this sets it to EXPIRED
  transaction_operation_failed& expired()
  {
    to_raise_ = EXPIRED;
    return *this;
  }

  // Defaults to FAILED, sets to FAILED_POST_COMMIT
  transaction_operation_failed& failed_post_commit()
  {
    to_raise_ = FAILED_POST_COMMIT;
    return *this;
  }

  // Defaults to FAILED, sets AMBIGUOUS
  transaction_operation_failed& ambiguous()
  {
    to_raise_ = AMBIGUOUS;
    return *this;
  }

  transaction_operation_failed& cause(external_exception cause)
  {
    cause_ = cause;
    return *this;
  }

  [[nodiscard]] bool should_rollback() const
  {
    return rollback_;
  }

  [[nodiscard]] bool should_retry() const
  {
    return retry_;
  }

  [[nodiscard]] error_class ec() const
  {
    return ec_;
  }

  [[nodiscard]] external_exception cause() const
  {
    return cause_;
  }

  [[nodiscard]] final_error to_raise() const
  {
    return to_raise_;
  }

  void do_throw(const transaction_context& context) const
  {
    if (to_raise_ == FAILED_POST_COMMIT) {
      return;
    }
    switch (to_raise_) {
      case EXPIRED:
        throw transaction_exception(*this, context, failure_type::EXPIRY);
      case AMBIGUOUS:
        throw transaction_exception(*this, context, failure_type::COMMIT_AMBIGUOUS);
      default:
        throw transaction_exception(*this, context, failure_type::FAIL);
    }
  }

  [[nodiscard]] std::optional<transaction_exception> get_final_exception(
    const transaction_context& context) const
  {
    switch (to_raise_) {
      case EXPIRED:
        return transaction_exception(*this, context, failure_type::EXPIRY);
      case AMBIGUOUS:
        return transaction_exception(*this, context, failure_type::COMMIT_AMBIGUOUS);
      case FAILED_POST_COMMIT:
        return std::nullopt;
      default:
        return transaction_exception(*this, context, failure_type::FAIL);
    }
  }

  [[nodiscard]] transaction_op_error_context get_error_ctx() const
  {
    std::error_code ec = transaction_op_errc_from_external_exception(cause_);
    return { ec };
  }

private:
  error_class ec_;
  bool retry_;
  bool rollback_;
  final_error to_raise_;
  external_exception cause_;
};

namespace internal
{
/**
 * Used only in testing: injects an error that will be handled as FAIL_HARD.
 *
 * This is not an error class the transaction library would ever raise
 * voluntarily.  It is designed to simulate an application crash or similar. The
 * transaction will not rollback and will stop abruptly.
 *
 * However, for testing purposes, a TransactionFailed will still be raised,
 * correct in all respects including the attempts field.
 */
class test_fail_hard : public client_error
{
public:
  explicit test_fail_hard()
    : client_error(FAIL_HARD, "Injecting a FAIL_HARD error")
  {
  }
};

/**
 * Used only in testing: injects an error that will be handled as
 * FAIL_AMBIGUOUS.
 *
 * E.g. either the server or SDK raised an error indicating the operation was
 * ambiguously successful.
 */
class test_fail_ambiguous : public client_error
{
public:
  explicit test_fail_ambiguous()
    : client_error(FAIL_AMBIGUOUS, "Injecting a FAIL_AMBIGUOUS error")
  {
  }
};

/**
 * Used only in testing: injects an error that will be handled as
 * FAIL_TRANSIENT.
 *
 * E.g. a transient server error that could be recovered with a retry of either
 * the operation or the transaction.
 */
class test_fail_transient : public client_error
{
public:
  explicit test_fail_transient()
    : client_error(FAIL_TRANSIENT, "Injecting a FAIL_TRANSIENT error")
  {
  }
};

/**
 * Used only in testing: injects an error that will be handled as FAIL_OTHER.
 *
 * E.g. an error which is not retryable.
 */
class test_fail_other : public client_error
{
public:
  explicit test_fail_other()
    : client_error(FAIL_OTHER, "Injecting a FAIL_OTHER error")
  {
  }
};
} // namespace internal
} // namespace couchbase::core::transactions
