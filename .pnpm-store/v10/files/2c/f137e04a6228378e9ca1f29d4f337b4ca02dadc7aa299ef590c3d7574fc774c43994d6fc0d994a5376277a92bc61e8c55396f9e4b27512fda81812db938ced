//
// use_awaitable.hpp
// ~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_USE_AWAITABLE_HPP
#define ASIO_USE_AWAITABLE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_CO_AWAIT) || defined(GENERATING_DOCUMENTATION)

#include "asio/awaitable.hpp"
#include "asio/detail/handler_tracking.hpp"

#if defined(ASIO_ENABLE_HANDLER_TRACKING)
# if defined(ASIO_HAS_SOURCE_LOCATION)
#  include "asio/detail/source_location.hpp"
# endif // defined(ASIO_HAS_SOURCE_LOCATION)
#endif // defined(ASIO_ENABLE_HANDLER_TRACKING)

#include "asio/detail/push_options.hpp"

namespace asio {

/// A @ref completion_token that represents the currently executing coroutine.
/**
 * The @c use_awaitable_t class, with its value @c use_awaitable, is used to
 * represent the currently executing coroutine. This completion token may be
 * passed as a handler to an asynchronous operation. For example:
 *
 * @code awaitable<void> my_coroutine()
 * {
 *   std::size_t n = co_await my_socket.async_read_some(buffer, use_awaitable);
 *   ...
 * } @endcode
 *
 * When used with co_await, the initiating function (@c async_read_some in the
 * above example) suspends the current coroutine. The coroutine is resumed when
 * the asynchronous operation completes, and the result of the operation is
 * returned.
 */
template <typename Executor = any_io_executor>
struct use_awaitable_t
{
  /// Default constructor.
  constexpr use_awaitable_t(
#if defined(ASIO_ENABLE_HANDLER_TRACKING)
# if defined(ASIO_HAS_SOURCE_LOCATION)
      detail::source_location location = detail::source_location::current()
# endif // defined(ASIO_HAS_SOURCE_LOCATION)
#endif // defined(ASIO_ENABLE_HANDLER_TRACKING)
    )
#if defined(ASIO_ENABLE_HANDLER_TRACKING)
# if defined(ASIO_HAS_SOURCE_LOCATION)
    : file_name_(location.file_name()),
      line_(location.line()),
      function_name_(location.function_name())
# else // defined(ASIO_HAS_SOURCE_LOCATION)
    : file_name_(0),
      line_(0),
      function_name_(0)
# endif // defined(ASIO_HAS_SOURCE_LOCATION)
#endif // defined(ASIO_ENABLE_HANDLER_TRACKING)
  {
  }

  /// Constructor used to specify file name, line, and function name.
  constexpr use_awaitable_t(const char* file_name,
      int line, const char* function_name)
#if defined(ASIO_ENABLE_HANDLER_TRACKING)
    : file_name_(file_name),
      line_(line),
      function_name_(function_name)
#endif // defined(ASIO_ENABLE_HANDLER_TRACKING)
  {
#if !defined(ASIO_ENABLE_HANDLER_TRACKING)
    (void)file_name;
    (void)line;
    (void)function_name;
#endif // !defined(ASIO_ENABLE_HANDLER_TRACKING)
  }

  /// Adapts an executor to add the @c use_awaitable_t completion token as the
  /// default.
  template <typename InnerExecutor>
  struct executor_with_default : InnerExecutor
  {
    /// Specify @c use_awaitable_t as the default completion token type.
    typedef use_awaitable_t default_completion_token_type;

    /// Construct the adapted executor from the inner executor type.
    template <typename InnerExecutor1>
    executor_with_default(const InnerExecutor1& ex,
        constraint_t<
          conditional_t<
            !is_same<InnerExecutor1, executor_with_default>::value,
            is_convertible<InnerExecutor1, InnerExecutor>,
            false_type
          >::value
        > = 0) noexcept
      : InnerExecutor(ex)
    {
    }
  };

  /// Type alias to adapt an I/O object to use @c use_awaitable_t as its
  /// default completion token type.
  template <typename T>
  using as_default_on_t = typename T::template rebind_executor<
      executor_with_default<typename T::executor_type>>::other;

  /// Function helper to adapt an I/O object to use @c use_awaitable_t as its
  /// default completion token type.
  template <typename T>
  static typename decay_t<T>::template rebind_executor<
      executor_with_default<typename decay_t<T>::executor_type>
    >::other
  as_default_on(T&& object)
  {
    return typename decay_t<T>::template rebind_executor<
        executor_with_default<typename decay_t<T>::executor_type>
      >::other(static_cast<T&&>(object));
  }

#if defined(ASIO_ENABLE_HANDLER_TRACKING)
  const char* file_name_;
  int line_;
  const char* function_name_;
#endif // defined(ASIO_ENABLE_HANDLER_TRACKING)
};

/// A @ref completion_token object that represents the currently executing
/// coroutine.
/**
 * See the documentation for asio::use_awaitable_t for a usage example.
 */
#if defined(GENERATING_DOCUMENTATION)
ASIO_INLINE_VARIABLE constexpr use_awaitable_t<> use_awaitable;
#else
ASIO_INLINE_VARIABLE constexpr use_awaitable_t<> use_awaitable(0, 0, 0);
#endif

} // namespace asio

#include "asio/detail/pop_options.hpp"

#include "asio/impl/use_awaitable.hpp"

#endif // defined(ASIO_HAS_CO_AWAIT) || defined(GENERATING_DOCUMENTATION)

#endif // ASIO_USE_AWAITABLE_HPP
