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

#include <couchbase/transactions/transaction_query_result.hxx>
#include <couchbase/transactions/transactions_config.hxx>

#include "core/document_id.hxx"
#include "core/operations/document_lookup_in.hxx"
#include "core/transactions/result.hxx"
#include "core/utils/movable_function.hxx"
#include "exceptions_internal.hxx"

#include <chrono>
#include <cmath>
#include <functional>
#include <future>
#include <limits>
#include <optional>
#include <random>
#include <string>
#include <thread>

#include <asio/steady_timer.hpp>
#include <utility>

namespace couchbase::core
{
class cluster;
namespace transactions
{
// returns the parsed server time from the result of a
// lookup_in_spec::get(subdoc::lookup_in_macro::vbucket).xattr() call
std::uint64_t
now_ns_from_vbucket(const tao::json::value& vbucket);

std::string
jsonify(const tao::json::value& obj);

std::string
collection_spec_from_id(const core::document_id& id);

bool
document_ids_equal(const core::document_id& id1, const core::document_id& id2);

template<typename OStream>
OStream&
operator<<(OStream& os, const core::document_id& id)
{
  os << "document_id{bucket: " << id.bucket() << ", scope: " << id.scope()
     << ", collection: " << id.collection() << ", key: " << id.key() << "}";
  return os;
}

template<typename T>
T&
wrap_durable_request(T&& req, const couchbase::transactions::transactions_config::built& config)
{
  req.durability_level = config.level;
  return req;
}

template<typename T>
T&
wrap_durable_request(T&& req, durability_level level)
{
  req.durability_level = level;
  return req;
}

void
validate_operation_result(result& res, bool ignore_subdoc_errors = true);

result
wrap_operation_future(std::future<result>& fut, bool ignore_subdoc_errors = true);

std::optional<error_class>
wait_for_hook(
  const std::function<void(utils::movable_function<void(std::optional<error_class>)>)>& hook);

inline void
wrap_collection_call(result& res, const std::function<void(result&)>& call);

template<typename Resp>
bool
is_error(const Resp& resp)
{
  return !!resp.ctx.ec();
}

template<>
bool
is_error(const core::operations::mutate_in_response& resp);

template<typename Resp>
std::optional<error_class>
error_class_from_response_extras(const Resp&)
{
  return {};
}

template<>
std::optional<error_class>
error_class_from_response_extras(const core::operations::mutate_in_response& resp);

template<typename Resp>
std::optional<error_class>
error_class_from_response(const Resp& resp)
{
  if (!is_error(resp)) {
    return {};
  }
  if (resp.ctx.ec() == couchbase::errc::key_value::document_not_found) {
    return FAIL_DOC_NOT_FOUND;
  }
  if (resp.ctx.ec() == couchbase::errc::key_value::document_exists) {
    return FAIL_DOC_ALREADY_EXISTS;
  }
  if (resp.ctx.ec() == couchbase::errc::common::cas_mismatch) {
    return FAIL_CAS_MISMATCH;
  }
  if (resp.ctx.ec() == couchbase::errc::key_value::value_too_large) {
    return FAIL_ATR_FULL;
  }
  if (resp.ctx.ec() == couchbase::errc::common::unambiguous_timeout ||
      resp.ctx.ec() == couchbase::errc::common::temporary_failure ||
      resp.ctx.ec() == couchbase::errc::key_value::durable_write_in_progress) {
    return FAIL_TRANSIENT;
  }
  if (resp.ctx.ec() == couchbase::errc::key_value::durability_ambiguous ||
      resp.ctx.ec() == couchbase::errc::common::ambiguous_timeout ||
      resp.ctx.ec() == couchbase::errc::common::request_canceled) {
    return FAIL_AMBIGUOUS;
  }
  if (resp.ctx.ec() == couchbase::errc::key_value::path_not_found) {
    return FAIL_PATH_NOT_FOUND;
  }
  if (resp.ctx.ec() == couchbase::errc::key_value::path_exists) {
    return FAIL_PATH_ALREADY_EXISTS;
  }
  if (auto ec = error_class_from_response_extras(resp); ec) {
    return ec;
  }
  if (resp.ctx.ec()) {
    return FAIL_OTHER;
  }
  return {};
}

static constexpr std::chrono::milliseconds DEFAULT_RETRY_OP_DELAY{ 3 };
static constexpr std::chrono::milliseconds DEFAULT_RETRY_OP_EXP_DELAY{ 1 };
static constexpr std::chrono::milliseconds DEFAULT_RETRY_OP_MAX_EXP_DELAY{ 100 };
static constexpr std::size_t DEFAULT_RETRY_OP_MAX_RETRIES{ 100 };
static constexpr double RETRY_OP_JITTER{ 0.1 }; // means +/- 10% for jitter.
static constexpr std::size_t DEFAULT_RETRY_OP_EXPONENT_CAP{ 8 };

static inline double
jitter()
{
  static std::mutex mtx;
  static std::random_device rd;
  static std::mt19937 gen(rd());
  static std::uniform_real_distribution<> dist(1 - RETRY_OP_JITTER, 1 + RETRY_OP_JITTER);

  std::lock_guard<std::mutex> lock(mtx);
  return dist(gen);
}

template<typename R, typename R1, typename P1, typename R2, typename P2, typename R3, typename P3>
R
retry_op_exponential_backoff_timeout(std::chrono::duration<R1, P1> initial_delay,
                                     std::chrono::duration<R2, P2> max_delay,
                                     std::chrono::duration<R3, P3> timeout,
                                     std::function<R()> func)
{
  auto end_time = std::chrono::steady_clock::now() + timeout;
  std::uint32_t retries = 0;
  while (true) {
    try {
      return func();
    } catch (const retry_operation&) {
      auto now = std::chrono::steady_clock::now();
      if (now > end_time) {
        break;
      }
      auto delay = initial_delay * (jitter() * pow(2, retries++));
      if (delay > max_delay) {
        delay = max_delay;
      }
      if (now + delay > end_time) {
        std::this_thread::sleep_for(end_time - now);
      } else {
        std::this_thread::sleep_for(delay);
      }
    }
  }
  throw retry_operation_timeout("timed out");
}

template<typename R, typename Rep, typename Period>
R
retry_op_exponential_backoff(std::chrono::duration<Rep, Period> delay,
                             std::size_t max_retries,
                             std::function<R()> func)
{
  for (std::size_t retries = 0; retries <= max_retries; retries++) {
    try {
      return func();
    } catch (const retry_operation&) {
      // 2^7 = 128, so max delay fixed at 128 * delay
      std::this_thread::sleep_for(
        delay * (jitter() * std::pow(2, std::fmin(DEFAULT_RETRY_OP_EXPONENT_CAP, retries))));
    }
  }
  throw retry_operation_retries_exhausted("retry_op hit max retries!");
}

template<typename R>
R
retry_op_exp(std::function<R()> func)
{
  return retry_op_exponential_backoff<R>(
    DEFAULT_RETRY_OP_EXP_DELAY, DEFAULT_RETRY_OP_MAX_RETRIES, func);
}

template<typename R, typename Rep, typename Period>
R
retry_op_constant_delay(std::chrono::duration<Rep, Period> delay,
                        std::size_t max_retries,
                        std::function<R()> func)
{
  for (std::size_t retries = 0; retries <= max_retries; retries++) {
    try {
      return func();
    } catch (const retry_operation&) {
      std::this_thread::sleep_for(delay);
    }
  }
  throw retry_operation_retries_exhausted("retry_op hit max retries!");
}

template<typename R>
R
retry_op(std::function<R()> func)
{
  return retry_op_constant_delay<R>(
    DEFAULT_RETRY_OP_DELAY, std::numeric_limits<std::size_t>::max(), func);
}

struct exp_delay {
  std::chrono::nanoseconds initial_delay;
  std::chrono::nanoseconds max_delay;
  std::chrono::nanoseconds timeout;
  mutable std::uint32_t retries{ 0 };
  mutable std::optional<std::chrono::time_point<std::chrono::steady_clock>> end_time{};
  std::size_t max_retries{ 100 };

  template<typename R1, typename P1, typename R2, typename P2, typename R3, typename P3>
  exp_delay(std::chrono::duration<R1, P1> initial,
            std::chrono::duration<R2, P2> max,
            std::chrono::duration<R3, P3> limit)
    : initial_delay(std::chrono::duration_cast<std::chrono::nanoseconds>(initial))
    , max_delay(std::chrono::duration_cast<std::chrono::nanoseconds>(max))
    , timeout(std::chrono::duration_cast<std::chrono::nanoseconds>(limit))
  {
  }
  void operator()() const
  {
    auto now = std::chrono::steady_clock::now();
    if (retries >= max_retries) {
      throw retry_operation_retries_exhausted("retries exhausted");
    }
    if (!end_time) {
      end_time = std::chrono::steady_clock::now() + timeout;
      return;
    }
    if (now > *end_time) {
      throw retry_operation_timeout("timed out");
    }
    auto delay = initial_delay * (jitter() * pow(2, retries++));
    if (delay > max_delay) {
      delay = max_delay;
    }
    if (now + delay > *end_time) {
      std::this_thread::sleep_for(*end_time - now);
    } else {
      std::this_thread::sleep_for(delay);
    }
  }
};

template<typename R, typename P>
struct constant_delay {
  std::chrono::duration<R, P> delay;
  std::size_t max_retries;
  std::size_t retries{ 0 };

  constant_delay(std::chrono::duration<R, P> d = DEFAULT_RETRY_OP_DELAY,
                 std::size_t max = DEFAULT_RETRY_OP_MAX_RETRIES)
    : delay(d)
    , max_retries(max)
  {
  }
  void operator()()
  {
    if (retries++ >= max_retries) {
      throw retry_operation_retries_exhausted("retries exhausted");
    }
    std::this_thread::sleep_for(delay);
  }
};

struct async_exp_delay {
  std::shared_ptr<asio::steady_timer> timer;
  std::chrono::microseconds initial_delay;
  std::chrono::microseconds max_delay;
  std::size_t max_retries;
  mutable std::size_t retries;

  template<typename R1, typename P1, typename R2, typename P2>
  async_exp_delay(std::shared_ptr<asio::steady_timer> timer,
                  std::chrono::duration<R1, P1> initial,
                  std::chrono::duration<R2, P2> max,
                  std::size_t max_retries)
    : timer(std::move(timer))
    , initial_delay(std::chrono::duration_cast<std::chrono::microseconds>(initial))
    , max_delay(std::chrono::duration_cast<std::chrono::microseconds>(max))
    , max_retries(max_retries)
    , retries(0)
  {
  }

  async_exp_delay(std::shared_ptr<asio::steady_timer> timer)
    : async_exp_delay(std::move(timer),
                      DEFAULT_RETRY_OP_EXP_DELAY,
                      DEFAULT_RETRY_OP_MAX_EXP_DELAY,
                      DEFAULT_RETRY_OP_MAX_RETRIES)
  {
  }

  void operator()(utils::movable_function<void(std::exception_ptr)> callback) const
  {
    if (retries++ >= max_retries) {
      callback(std::make_exception_ptr(retry_operation_retries_exhausted("retries exhausted")));
      return;
    }
    auto delay = std::chrono::duration_cast<std::chrono::microseconds>(
      initial_delay * (jitter() * pow(2, static_cast<double>(retries++))));
    if (delay > max_delay) {
      delay = max_delay;
    }
    timer->expires_after(delay);
    timer->async_wait([callback = std::move(callback)](std::error_code ec) mutable {
      if (ec == asio::error::operation_aborted) {
        callback(std::make_exception_ptr(retry_operation_retries_exhausted("retry aborted")));
        return;
      }
      callback({});
    });
  }
};

struct async_constant_delay {
  std::shared_ptr<asio::steady_timer> timer;
  std::chrono::microseconds delay;
  std::size_t max_retries;
  std::size_t retries;

  template<typename R, typename P>
  async_constant_delay(std::shared_ptr<asio::steady_timer> timer,
                       std::chrono::duration<R, P> d,
                       std::size_t max)
    : timer(std::move(timer))
    , delay(std::chrono::duration_cast<std::chrono::microseconds>(d))
    , max_retries(max)
    , retries(0)
  {
  }

  explicit async_constant_delay(std::shared_ptr<asio::steady_timer> timer)
    : async_constant_delay(std::move(timer), DEFAULT_RETRY_OP_DELAY, DEFAULT_RETRY_OP_MAX_RETRIES)
  {
  }

  void operator()(utils::movable_function<void(std::exception_ptr)> callback)
  {
    if (retries++ >= max_retries) {
      callback(std::make_exception_ptr(retry_operation_retries_exhausted("retries exhausted")));
      return;
    }
    timer->expires_after(delay);
    timer->async_wait([callback = std::move(callback)](std::error_code ec) mutable {
      if (ec == asio::error::operation_aborted) {
        callback(std::make_exception_ptr(retry_operation_retries_exhausted("retry aborted")));
        return;
      }
      callback({});
    });
  }
};

std::list<std::string>
get_and_open_buckets(std::shared_ptr<core::cluster> c);

core::document_id
atr_id_from_bucket_and_key(const couchbase::transactions::transactions_config::built& cfg,
                           const std::string& bucket,
                           const std::string& key);

} // namespace transactions
} // namespace couchbase::core
