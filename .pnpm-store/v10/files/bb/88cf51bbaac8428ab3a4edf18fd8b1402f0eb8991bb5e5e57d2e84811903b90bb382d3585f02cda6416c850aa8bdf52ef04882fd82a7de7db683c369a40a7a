//
// cancel_after.hpp
// ~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_CANCEL_AFTER_HPP
#define ASIO_CANCEL_AFTER_HPP

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

/// A @ref completion_token adapter that cancels an operation after a timeout.
/**
 * The cancel_after_t class is used to indicate that an asynchronous operation
 * should be cancelled if not complete before the specified duration has
 * elapsed.
 */
template <typename CompletionToken, typename Clock,
    typename WaitTraits = asio::wait_traits<Clock>>
class cancel_after_t
{
public:
  /// Constructor.
  template <typename T>
  cancel_after_t(T&& completion_token, const typename Clock::duration& timeout,
      cancellation_type_t cancel_type = cancellation_type::terminal)
    : token_(static_cast<T&&>(completion_token)),
      timeout_(timeout),
      cancel_type_(cancel_type)
  {
  }

//private:
  CompletionToken token_;
  typename Clock::duration timeout_;
  cancellation_type_t cancel_type_;
};

/// A @ref completion_token adapter that cancels an operation after a timeout.
/**
 * The cancel_after_timer class is used to indicate that an asynchronous
 * operation should be cancelled if not complete before the specified duration
 * has elapsed.
 */
template <typename CompletionToken, typename Clock,
    typename WaitTraits = asio::wait_traits<Clock>,
    typename Executor = any_io_executor>
class cancel_after_timer
{
public:
  /// Constructor.
  template <typename T>
  cancel_after_timer(T&& completion_token,
      basic_waitable_timer<Clock, WaitTraits, Executor>& timer,
      const typename Clock::duration& timeout,
      cancellation_type_t cancel_type = cancellation_type::terminal)
    : token_(static_cast<T&&>(completion_token)),
      timer_(timer),
      timeout_(timeout),
      cancel_type_(cancel_type)
  {
  }

//private:
  CompletionToken token_;
  basic_waitable_timer<Clock, WaitTraits, Executor>& timer_;
  typename Clock::duration timeout_;
  cancellation_type_t cancel_type_;
};

/// A function object type that adapts a @ref completion_token to cancel an
/// operation after a timeout.
/**
 * May also be used directly as a completion token, in which case it adapts the
 * asynchronous operation's default completion token (or asio::deferred
 * if no default is available).
 */
template <typename Clock, typename WaitTraits = asio::wait_traits<Clock>>
class partial_cancel_after
{
public:
  /// Constructor that specifies the timeout duration and cancellation type.
  explicit partial_cancel_after(const typename Clock::duration& timeout,
      cancellation_type_t cancel_type = cancellation_type::terminal)
    : timeout_(timeout),
      cancel_type_(cancel_type)
  {
  }

  /// Adapt a @ref completion_token to specify that the completion handler
  /// arguments should be combined into a single tuple argument.
  template <typename CompletionToken>
  ASIO_NODISCARD inline
  cancel_after_t<decay_t<CompletionToken>, Clock, WaitTraits>
  operator()(CompletionToken&& completion_token) const
  {
    return cancel_after_t<decay_t<CompletionToken>, Clock, WaitTraits>(
        static_cast<CompletionToken&&>(completion_token),
        timeout_, cancel_type_);
  }

//private:
  typename Clock::duration timeout_;
  cancellation_type_t cancel_type_;
};

/// A function object type that adapts a @ref completion_token to cancel an
/// operation after a timeout.
/**
 * May also be used directly as a completion token, in which case it adapts the
 * asynchronous operation's default completion token (or asio::deferred
 * if no default is available).
 */
template <typename Clock, typename WaitTraits = asio::wait_traits<Clock>,
    typename Executor = any_io_executor>
class partial_cancel_after_timer
{
public:
  /// Constructor that specifies the timeout duration and cancellation type.
  explicit partial_cancel_after_timer(
      basic_waitable_timer<Clock, WaitTraits, Executor>& timer,
      const typename Clock::duration& timeout,
      cancellation_type_t cancel_type = cancellation_type::terminal)
    : timer_(timer),
      timeout_(timeout),
      cancel_type_(cancel_type)
  {
  }

  /// Adapt a @ref completion_token to specify that the completion handler
  /// arguments should be combined into a single tuple argument.
  template <typename CompletionToken>
  ASIO_NODISCARD inline
  cancel_after_timer<decay_t<CompletionToken>, Clock, WaitTraits, Executor>
  operator()(CompletionToken&& completion_token) const
  {
    return cancel_after_timer<decay_t<CompletionToken>,
      Clock, WaitTraits, Executor>(
        static_cast<CompletionToken&&>(completion_token),
        timeout_, cancel_type_);
  }

//private:
  basic_waitable_timer<Clock, WaitTraits, Executor>& timer_;
  typename Clock::duration timeout_;
  cancellation_type_t cancel_type_;
};

/// Create a partial completion token adapter that cancels an operation if not
/// complete before the specified relative timeout has elapsed.
/**
 * @par Thread Safety
 * When an asynchronous operation is used with cancel_after, a timer async_wait
 * operation is performed in parallel to the main operation. If this parallel
 * async_wait completes first, a cancellation request is emitted to cancel the
 * main operation. Consequently, the application must ensure that the
 * asynchronous operation is performed within an implicit or explicit strand.
 */
template <typename Rep, typename Period>
ASIO_NODISCARD inline partial_cancel_after<chrono::steady_clock>
cancel_after(const chrono::duration<Rep, Period>& timeout,
    cancellation_type_t cancel_type = cancellation_type::terminal)
{
  return partial_cancel_after<chrono::steady_clock>(timeout, cancel_type);
}

/// Create a partial completion token adapter that cancels an operation if not
/// complete before the specified relative timeout has elapsed.
/**
 * @par Thread Safety
 * When an asynchronous operation is used with cancel_after, a timer async_wait
 * operation is performed in parallel to the main operation. If this parallel
 * async_wait completes first, a cancellation request is emitted to cancel the
 * main operation. Consequently, the application must ensure that the
 * asynchronous operation is performed within an implicit or explicit strand.
 */
template <typename Clock, typename WaitTraits,
    typename Executor, typename Rep, typename Period>
ASIO_NODISCARD inline
partial_cancel_after_timer<Clock, WaitTraits, Executor>
cancel_after(basic_waitable_timer<Clock, WaitTraits, Executor>& timer,
    const chrono::duration<Rep, Period>& timeout,
    cancellation_type_t cancel_type = cancellation_type::terminal)
{
  return partial_cancel_after_timer<Clock, WaitTraits, Executor>(
      timer, timeout, cancel_type);
}

/// Adapt a @ref completion_token to cancel an operation if not complete before
/// the specified relative timeout has elapsed.
/**
 * @par Thread Safety
 * When an asynchronous operation is used with cancel_after, a timer async_wait
 * operation is performed in parallel to the main operation. If this parallel
 * async_wait completes first, a cancellation request is emitted to cancel the
 * main operation. Consequently, the application must ensure that the
 * asynchronous operation is performed within an implicit or explicit strand.
 */
template <typename Rep, typename Period, typename CompletionToken>
ASIO_NODISCARD inline
cancel_after_t<decay_t<CompletionToken>, chrono::steady_clock>
cancel_after(const chrono::duration<Rep, Period>& timeout,
    CompletionToken&& completion_token)
{
  return cancel_after_t<decay_t<CompletionToken>, chrono::steady_clock>(
      static_cast<CompletionToken&&>(completion_token),
      timeout, cancellation_type::terminal);
}

/// Adapt a @ref completion_token to cancel an operation if not complete before
/// the specified relative timeout has elapsed.
/**
 * @par Thread Safety
 * When an asynchronous operation is used with cancel_after, a timer async_wait
 * operation is performed in parallel to the main operation. If this parallel
 * async_wait completes first, a cancellation request is emitted to cancel the
 * main operation. Consequently, the application must ensure that the
 * asynchronous operation is performed within an implicit or explicit strand.
 */
template <typename Rep, typename Period, typename CompletionToken>
ASIO_NODISCARD inline
cancel_after_t<decay_t<CompletionToken>, chrono::steady_clock>
cancel_after(const chrono::duration<Rep, Period>& timeout,
    cancellation_type_t cancel_type, CompletionToken&& completion_token)
{
  return cancel_after_t<decay_t<CompletionToken>, chrono::steady_clock>(
      static_cast<CompletionToken&&>(completion_token), timeout, cancel_type);
}

/// Adapt a @ref completion_token to cancel an operation if not complete before
/// the specified relative timeout has elapsed.
/**
 * @par Thread Safety
 * When an asynchronous operation is used with cancel_after, a timer async_wait
 * operation is performed in parallel to the main operation. If this parallel
 * async_wait completes first, a cancellation request is emitted to cancel the
 * main operation. Consequently, the application must ensure that the
 * asynchronous operation is performed within an implicit or explicit strand.
 */
template <typename Clock, typename WaitTraits, typename Executor,
    typename Rep, typename Period, typename CompletionToken>
ASIO_NODISCARD inline
cancel_after_timer<decay_t<CompletionToken>, Clock, WaitTraits, Executor>
cancel_after(basic_waitable_timer<Clock, WaitTraits, Executor>& timer,
    const chrono::duration<Rep, Period>& timeout,
    CompletionToken&& completion_token)
{
  return cancel_after_timer<decay_t<CompletionToken>,
    Clock, WaitTraits, Executor>(
      static_cast<CompletionToken&&>(completion_token),
      timer, timeout, cancellation_type::terminal);
}

/// Adapt a @ref completion_token to cancel an operation if not complete before
/// the specified relative timeout has elapsed.
/**
 * @par Thread Safety
 * When an asynchronous operation is used with cancel_after, a timer async_wait
 * operation is performed in parallel to the main operation. If this parallel
 * async_wait completes first, a cancellation request is emitted to cancel the
 * main operation. Consequently, the application must ensure that the
 * asynchronous operation is performed within an implicit or explicit strand.
 */
template <typename Clock, typename WaitTraits, typename Executor,
    typename Rep, typename Period, typename CompletionToken>
ASIO_NODISCARD inline
cancel_after_timer<decay_t<CompletionToken>, chrono::steady_clock>
cancel_after(basic_waitable_timer<Clock, WaitTraits, Executor>& timer,
    const chrono::duration<Rep, Period>& timeout,
    cancellation_type_t cancel_type, CompletionToken&& completion_token)
{
  return cancel_after_timer<decay_t<CompletionToken>,
    Clock, WaitTraits, Executor>(
      static_cast<CompletionToken&&>(completion_token),
      timer, timeout, cancel_type);
}

} // namespace asio

#include "asio/detail/pop_options.hpp"

#include "asio/impl/cancel_after.hpp"

#endif // ASIO_CANCEL_AFTER_HPP
