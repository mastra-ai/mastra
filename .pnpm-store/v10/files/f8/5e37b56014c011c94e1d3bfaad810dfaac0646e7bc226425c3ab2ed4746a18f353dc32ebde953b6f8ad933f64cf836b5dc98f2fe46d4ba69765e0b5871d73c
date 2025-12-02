//
// cancel_at.hpp
// ~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_CANCEL_AT_HPP
#define ASIO_CANCEL_AT_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/basic_waitable_timer.hpp"
#include "asio/cancellation_type.hpp"
#include "asio/detail/chrono.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/wait_traits.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

/// A @ref completion_token adapter that cancels an operation at a given time.
/**
 * The cancel_at_t class is used to indicate that an asynchronous operation
 * should be cancelled if not complete at the specified absolute time.
 */
template <typename CompletionToken, typename Clock,
    typename WaitTraits = asio::wait_traits<Clock>>
class cancel_at_t
{
public:
  /// Constructor.
  template <typename T>
  cancel_at_t(T&& completion_token, const typename Clock::time_point& expiry,
      cancellation_type_t cancel_type = cancellation_type::terminal)
    : token_(static_cast<T&&>(completion_token)),
      expiry_(expiry),
      cancel_type_(cancel_type)
  {
  }

//private:
  CompletionToken token_;
  typename Clock::time_point expiry_;
  cancellation_type_t cancel_type_;
};

/// A @ref completion_token adapter that cancels an operation at a given time.
/**
 * The cancel_at_timer class is used to indicate that an asynchronous operation
 * should be cancelled if not complete at the specified absolute time.
 */
template <typename CompletionToken, typename Clock,
    typename WaitTraits = asio::wait_traits<Clock>,
    typename Executor = any_io_executor>
class cancel_at_timer
{
public:
  /// Constructor.
  template <typename T>
  cancel_at_timer(T&& completion_token,
      basic_waitable_timer<Clock, WaitTraits, Executor>& timer,
      const typename Clock::time_point& expiry,
      cancellation_type_t cancel_type = cancellation_type::terminal)
    : token_(static_cast<T&&>(completion_token)),
      timer_(timer),
      expiry_(expiry),
      cancel_type_(cancel_type)
  {
  }

//private:
  CompletionToken token_;
  basic_waitable_timer<Clock, WaitTraits, Executor>& timer_;
  typename Clock::time_point expiry_;
  cancellation_type_t cancel_type_;
};

/// A function object type that adapts a @ref completion_token to cancel an
/// operation at a given time.
/**
 * May also be used directly as a completion token, in which case it adapts the
 * asynchronous operation's default completion token (or asio::deferred
 * if no default is available).
 */
template <typename Clock, typename WaitTraits = asio::wait_traits<Clock>>
class partial_cancel_at
{
public:
  /// Constructor that specifies the expiry and cancellation type.
  explicit partial_cancel_at(const typename Clock::time_point& expiry,
      cancellation_type_t cancel_type = cancellation_type::terminal)
    : expiry_(expiry),
      cancel_type_(cancel_type)
  {
  }

  /// Adapt a @ref completion_token to specify that the completion handler
  /// arguments should be combined into a single tuple argument.
  template <typename CompletionToken>
  ASIO_NODISCARD inline
  constexpr cancel_at_t<decay_t<CompletionToken>, Clock, WaitTraits>
  operator()(CompletionToken&& completion_token) const
  {
    return cancel_at_t<decay_t<CompletionToken>, Clock, WaitTraits>(
        static_cast<CompletionToken&&>(completion_token),
        expiry_, cancel_type_);
  }

//private:
  typename Clock::time_point expiry_;
  cancellation_type_t cancel_type_;
};

/// A function object type that adapts a @ref completion_token to cancel an
/// operation at a given time.
/**
 * May also be used directly as a completion token, in which case it adapts the
 * asynchronous operation's default completion token (or asio::deferred
 * if no default is available).
 */
template <typename Clock, typename WaitTraits = asio::wait_traits<Clock>,
    typename Executor = any_io_executor>
class partial_cancel_at_timer
{
public:
  /// Constructor that specifies the expiry and cancellation type.
  explicit partial_cancel_at_timer(
      basic_waitable_timer<Clock, WaitTraits, Executor>& timer,
      const typename Clock::time_point& expiry,
      cancellation_type_t cancel_type = cancellation_type::terminal)
    : timer_(timer),
      expiry_(expiry),
      cancel_type_(cancel_type)
  {
  }

  /// Adapt a @ref completion_token to specify that the completion handler
  /// arguments should be combined into a single tuple argument.
  template <typename CompletionToken>
  ASIO_NODISCARD inline
  cancel_at_timer<decay_t<CompletionToken>, Clock, WaitTraits, Executor>
  operator()(CompletionToken&& completion_token) const
  {
    return cancel_at_timer<decay_t<CompletionToken>,
      Clock, WaitTraits, Executor>(
        static_cast<CompletionToken&&>(completion_token),
        timer_, expiry_, cancel_type_);
  }

//private:
  basic_waitable_timer<Clock, WaitTraits, Executor>& timer_;
  typename Clock::time_point expiry_;
  cancellation_type_t cancel_type_;
};

/// Create a partial completion token adapter that cancels an operation if not
/// complete by the specified absolute time.
/**
 * @par Thread Safety
 * When an asynchronous operation is used with cancel_at, a timer async_wait
 * operation is performed in parallel to the main operation. If this parallel
 * async_wait completes first, a cancellation request is emitted to cancel the
 * main operation. Consequently, the application must ensure that the
 * asynchronous operation is performed within an implicit or explicit strand.
 */
template <typename Clock, typename Duration>
ASIO_NODISCARD inline partial_cancel_at<Clock>
cancel_at(const chrono::time_point<Clock, Duration>& expiry,
    cancellation_type_t cancel_type = cancellation_type::terminal)
{
  return partial_cancel_at<Clock>(expiry, cancel_type);
}

/// Create a partial completion token adapter that cancels an operation if not
/// complete by the specified absolute time.
/**
 * @par Thread Safety
 * When an asynchronous operation is used with cancel_at, a timer async_wait
 * operation is performed in parallel to the main operation. If this parallel
 * async_wait completes first, a cancellation request is emitted to cancel the
 * main operation. Consequently, the application must ensure that the
 * asynchronous operation is performed within an implicit or explicit strand.
 */
template <typename Clock, typename WaitTraits,
    typename Executor, typename Duration>
ASIO_NODISCARD inline partial_cancel_at_timer<Clock, WaitTraits, Executor>
cancel_at(basic_waitable_timer<Clock, WaitTraits, Executor>& timer,
    const chrono::time_point<Clock, Duration>& expiry,
    cancellation_type_t cancel_type = cancellation_type::terminal)
{
  return partial_cancel_at_timer<Clock, WaitTraits, Executor>(
      timer, expiry, cancel_type);
}

/// Adapt a @ref completion_token to cancel an operation if not complete by the
/// specified absolute time.
/**
 * @par Thread Safety
 * When an asynchronous operation is used with cancel_at, a timer async_wait
 * operation is performed in parallel to the main operation. If this parallel
 * async_wait completes first, a cancellation request is emitted to cancel the
 * main operation. Consequently, the application must ensure that the
 * asynchronous operation is performed within an implicit or explicit strand.
 */
template <typename CompletionToken, typename Clock, typename Duration>
ASIO_NODISCARD inline cancel_at_t<decay_t<CompletionToken>, Clock>
cancel_at(const chrono::time_point<Clock, Duration>& expiry,
    CompletionToken&& completion_token)
{
  return cancel_at_t<decay_t<CompletionToken>, Clock>(
      static_cast<CompletionToken&&>(completion_token),
      expiry, cancellation_type::terminal);
}

/// Adapt a @ref completion_token to cancel an operation if not complete by the
/// specified absolute time.
/**
 * @par Thread Safety
 * When an asynchronous operation is used with cancel_at, a timer async_wait
 * operation is performed in parallel to the main operation. If this parallel
 * async_wait completes first, a cancellation request is emitted to cancel the
 * main operation. Consequently, the application must ensure that the
 * asynchronous operation is performed within an implicit or explicit strand.
 */
template <typename CompletionToken, typename Clock, typename Duration>
ASIO_NODISCARD inline cancel_at_t<decay_t<CompletionToken>, Clock>
cancel_at(const chrono::time_point<Clock, Duration>& expiry,
    cancellation_type_t cancel_type, CompletionToken&& completion_token)
{
  return cancel_at_t<decay_t<CompletionToken>, Clock>(
      static_cast<CompletionToken&&>(completion_token), expiry, cancel_type);
}

/// Adapt a @ref completion_token to cancel an operation if not complete by the
/// specified absolute time.
/**
 * @par Thread Safety
 * When an asynchronous operation is used with cancel_at, a timer async_wait
 * operation is performed in parallel to the main operation. If this parallel
 * async_wait completes first, a cancellation request is emitted to cancel the
 * main operation. Consequently, the application must ensure that the
 * asynchronous operation is performed within an implicit or explicit strand.
 */
template <typename CompletionToken, typename Clock,
    typename WaitTraits, typename Executor, typename Duration>
ASIO_NODISCARD inline
cancel_at_timer<decay_t<CompletionToken>, Clock, WaitTraits, Executor>
cancel_at(basic_waitable_timer<Clock, WaitTraits, Executor>& timer,
    const chrono::time_point<Clock, Duration>& expiry,
    CompletionToken&& completion_token)
{
  return cancel_at_timer<decay_t<CompletionToken>, Clock, WaitTraits, Executor>(
      static_cast<CompletionToken&&>(completion_token),
      timer, expiry, cancellation_type::terminal);
}

/// Adapt a @ref completion_token to cancel an operation if not complete by the
/// specified absolute time.
/**
 * @par Thread Safety
 * When an asynchronous operation is used with cancel_at, a timer async_wait
 * operation is performed in parallel to the main operation. If this parallel
 * async_wait completes first, a cancellation request is emitted to cancel the
 * main operation. Consequently, the application must ensure that the
 * asynchronous operation is performed within an implicit or explicit strand.
 */
template <typename CompletionToken, typename Clock,
    typename WaitTraits, typename Executor, typename Duration>
ASIO_NODISCARD inline
cancel_at_timer<decay_t<CompletionToken>, Clock, WaitTraits, Executor>
cancel_at(basic_waitable_timer<Clock, WaitTraits, Executor>& timer,
    const chrono::time_point<Clock, Duration>& expiry,
    cancellation_type_t cancel_type, CompletionToken&& completion_token)
{
  return cancel_at_timer<decay_t<CompletionToken>, Clock, WaitTraits, Executor>(
      static_cast<CompletionToken&&>(completion_token),
      timer, expiry, cancel_type);
}

} // namespace asio

#include "asio/detail/pop_options.hpp"

#include "asio/impl/cancel_at.hpp"

#endif // ASIO_CANCEL_AT_HPP
