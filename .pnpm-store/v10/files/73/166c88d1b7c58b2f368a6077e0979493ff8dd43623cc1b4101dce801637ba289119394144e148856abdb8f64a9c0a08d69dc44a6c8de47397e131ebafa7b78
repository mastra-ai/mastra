//
// this_coro.hpp
// ~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_THIS_CORO_HPP
#define ASIO_THIS_CORO_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/type_traits.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace this_coro {

/// Awaitable type that returns the executor of the current coroutine.
struct executor_t
{
  constexpr executor_t()
  {
  }
};

/// Awaitable object that returns the executor of the current coroutine.
ASIO_INLINE_VARIABLE constexpr executor_t executor;

/// Awaitable type that returns the cancellation state of the current coroutine.
struct cancellation_state_t
{
  constexpr cancellation_state_t()
  {
  }
};

/// Awaitable object that returns the cancellation state of the current
/// coroutine.
/**
 * @par Example
 * @code asio::awaitable<void> my_coroutine()
 * {
 *   asio::cancellation_state cs
 *     = co_await asio::this_coro::cancellation_state;
 *
 *   // ...
 *
 *   if (cs.cancelled() != asio::cancellation_type::none)
 *     // ...
 * } @endcode
 */
ASIO_INLINE_VARIABLE constexpr cancellation_state_t cancellation_state;

#if defined(GENERATING_DOCUMENTATION)

/// Returns an awaitable object that may be used to reset the cancellation state
/// of the current coroutine.
/**
 * Let <tt>P</tt> be the cancellation slot associated with the current
 * coroutine's @ref co_spawn completion handler. Assigns a new
 * asio::cancellation_state object <tt>S</tt>, constructed as
 * <tt>S(P)</tt>, into the current coroutine's cancellation state object.
 *
 * @par Example
 * @code asio::awaitable<void> my_coroutine()
 * {
 *   co_await asio::this_coro::reset_cancellation_state();
 *
 *   // ...
 * } @endcode
 *
 * @note The cancellation state is shared by all coroutines in the same "thread
 * of execution" that was created using asio::co_spawn.
 */
ASIO_NODISCARD constexpr unspecified
reset_cancellation_state();

/// Returns an awaitable object that may be used to reset the cancellation state
/// of the current coroutine.
/**
 * Let <tt>P</tt> be the cancellation slot associated with the current
 * coroutine's @ref co_spawn completion handler. Assigns a new
 * asio::cancellation_state object <tt>S</tt>, constructed as <tt>S(P,
 * std::forward<Filter>(filter))</tt>, into the current coroutine's
 * cancellation state object.
 *
 * @par Example
 * @code asio::awaitable<void> my_coroutine()
 * {
 *   co_await asio::this_coro::reset_cancellation_state(
 *       asio::enable_partial_cancellation());
 *
 *   // ...
 * } @endcode
 *
 * @note The cancellation state is shared by all coroutines in the same "thread
 * of execution" that was created using asio::co_spawn.
 */
template <typename Filter>
ASIO_NODISCARD constexpr unspecified
reset_cancellation_state(Filter&& filter);

/// Returns an awaitable object that may be used to reset the cancellation state
/// of the current coroutine.
/**
 * Let <tt>P</tt> be the cancellation slot associated with the current
 * coroutine's @ref co_spawn completion handler. Assigns a new
 * asio::cancellation_state object <tt>S</tt>, constructed as <tt>S(P,
 * std::forward<InFilter>(in_filter),
 * std::forward<OutFilter>(out_filter))</tt>, into the current coroutine's
 * cancellation state object.
 *
 * @par Example
 * @code asio::awaitable<void> my_coroutine()
 * {
 *   co_await asio::this_coro::reset_cancellation_state(
 *       asio::enable_partial_cancellation(),
 *       asio::disable_cancellation());
 *
 *   // ...
 * } @endcode
 *
 * @note The cancellation state is shared by all coroutines in the same "thread
 * of execution" that was created using asio::co_spawn.
 */
template <typename InFilter, typename OutFilter>
ASIO_NODISCARD constexpr unspecified
reset_cancellation_state(
    InFilter&& in_filter,
    OutFilter&& out_filter);

/// Returns an awaitable object that may be used to determine whether the
/// coroutine throws if trying to suspend when it has been cancelled.
/**
 * @par Example
 * @code asio::awaitable<void> my_coroutine()
 * {
 *   if (co_await asio::this_coro::throw_if_cancelled)
 *     // ...
 *
 *   // ...
 * } @endcode
 */
ASIO_NODISCARD constexpr unspecified
throw_if_cancelled();

/// Returns an awaitable object that may be used to specify whether the
/// coroutine throws if trying to suspend when it has been cancelled.
/**
 * @par Example
 * @code asio::awaitable<void> my_coroutine()
 * {
 *   co_await asio::this_coro::throw_if_cancelled(false);
 *
 *   // ...
 * } @endcode
 */
ASIO_NODISCARD constexpr unspecified
throw_if_cancelled(bool value);

#else // defined(GENERATING_DOCUMENTATION)

struct reset_cancellation_state_0_t
{
  constexpr reset_cancellation_state_0_t()
  {
  }
};

ASIO_NODISCARD inline constexpr reset_cancellation_state_0_t
reset_cancellation_state()
{
  return reset_cancellation_state_0_t();
}

template <typename Filter>
struct reset_cancellation_state_1_t
{
  template <typename F>
  explicit constexpr reset_cancellation_state_1_t(
      F&& filt)
    : filter(static_cast<F&&>(filt))
  {
  }

  Filter filter;
};

template <typename Filter>
ASIO_NODISCARD inline constexpr reset_cancellation_state_1_t<
    decay_t<Filter>>
reset_cancellation_state(Filter&& filter)
{
  return reset_cancellation_state_1_t<decay_t<Filter>>(
      static_cast<Filter&&>(filter));
}

template <typename InFilter, typename OutFilter>
struct reset_cancellation_state_2_t
{
  template <typename F1, typename F2>
  constexpr reset_cancellation_state_2_t(
      F1&& in_filt, F2&& out_filt)
    : in_filter(static_cast<F1&&>(in_filt)),
      out_filter(static_cast<F2&&>(out_filt))
  {
  }

  InFilter in_filter;
  OutFilter out_filter;
};

template <typename InFilter, typename OutFilter>
ASIO_NODISCARD inline constexpr
reset_cancellation_state_2_t<decay_t<InFilter>, decay_t<OutFilter>>
reset_cancellation_state(InFilter&& in_filter, OutFilter&& out_filter)
{
  return reset_cancellation_state_2_t<decay_t<InFilter>, decay_t<OutFilter>>(
      static_cast<InFilter&&>(in_filter),
      static_cast<OutFilter&&>(out_filter));
}

struct throw_if_cancelled_0_t
{
  constexpr throw_if_cancelled_0_t()
  {
  }
};

ASIO_NODISCARD inline constexpr throw_if_cancelled_0_t
throw_if_cancelled()
{
  return throw_if_cancelled_0_t();
}

struct throw_if_cancelled_1_t
{
  explicit constexpr throw_if_cancelled_1_t(bool val)
    : value(val)
  {
  }

  bool value;
};

ASIO_NODISCARD inline constexpr throw_if_cancelled_1_t
throw_if_cancelled(bool value)
{
  return throw_if_cancelled_1_t(value);
}

#endif // defined(GENERATING_DOCUMENTATION)

} // namespace this_coro
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_THIS_CORO_HPP
