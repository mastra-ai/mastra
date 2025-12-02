//
// experimental/use_coro.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2021-2023 Klemens D. Morgenstern
//                         (klemens dot morgenstern at gmx dot net)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXPERIMENTAL_USE_CORO_HPP
#define ASIO_EXPERIMENTAL_USE_CORO_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <memory>
#include "asio/deferred.hpp"
#include "asio/detail/source_location.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

class any_io_executor;

namespace experimental {

/// A @ref completion_token that creates another coro for the task completion.
/**
 * The @c use_coro_t class, with its value @c use_coro, is used to represent an
 * operation that can be awaited by the current resumable coroutine. This
 * completion token may be passed as a handler to an asynchronous operation.
 * For example:
 *
 * @code coro<void> my_coroutine(tcp::socket my_socket)
 * {
 *   std::size_t n = co_await my_socket.async_read_some(buffer, use_coro);
 *   ...
 * } @endcode
 *
 * When used with co_await, the initiating function (@c async_read_some in the
 * above example) suspends the current coroutine. The coroutine is resumed when
 * the asynchronous operation completes, and the result of the operation is
 * returned.
 *
 * Note that this token is not the most efficient (use the default completion
 * token @c asio::deferred for that) but does provide type erasure, as it
 * will always return a @c coro.
 */
template <typename Allocator = std::allocator<void>>
struct use_coro_t
{

  /// The allocator type. The allocator is used when constructing the
  /// @c std::promise object for a given asynchronous operation.
  typedef Allocator allocator_type;

  /// Default constructor.
  constexpr use_coro_t(
      allocator_type allocator = allocator_type{}
#if defined(ASIO_ENABLE_HANDLER_TRACKING)
# if defined(ASIO_HAS_SOURCE_LOCATION)
      , asio::detail::source_location location =
        asio::detail::source_location::current()
# endif // defined(ASIO_HAS_SOURCE_LOCATION)
#endif // defined(ASIO_ENABLE_HANDLER_TRACKING)
    )
    : allocator_(allocator)
#if defined(ASIO_ENABLE_HANDLER_TRACKING)
# if defined(ASIO_HAS_SOURCE_LOCATION)
    , file_name_(location.file_name()),
      line_(location.line()),
      function_name_(location.function_name())
# else // defined(ASIO_HAS_SOURCE_LOCATION)
    , file_name_(0),
      line_(0),
      function_name_(0)
# endif // defined(ASIO_HAS_SOURCE_LOCATION)
#endif // defined(ASIO_ENABLE_HANDLER_TRACKING)
  {
  }

  /// Specify an alternate allocator.
  template <typename OtherAllocator>
  use_coro_t<OtherAllocator> rebind(const OtherAllocator& allocator) const
  {
    return use_future_t<OtherAllocator>(allocator);
  }

  /// Obtain allocator.
  allocator_type get_allocator() const
  {
    return allocator_;
  }

  /// Constructor used to specify file name, line, and function name.
  constexpr use_coro_t(const char* file_name,
      int line, const char* function_name,
      allocator_type allocator = allocator_type{}) :
#if defined(ASIO_ENABLE_HANDLER_TRACKING)
      file_name_(file_name),
      line_(line),
      function_name_(function_name),
#endif // defined(ASIO_ENABLE_HANDLER_TRACKING)
      allocator_(allocator)
  {
#if !defined(ASIO_ENABLE_HANDLER_TRACKING)
    (void)file_name;
    (void)line;
    (void)function_name;
#endif // !defined(ASIO_ENABLE_HANDLER_TRACKING)
  }

  /// Adapts an executor to add the @c use_coro_t completion token as the
  /// default.
  template <typename InnerExecutor>
  struct executor_with_default : InnerExecutor
  {
    /// Specify @c use_coro_t as the default completion token type.
    typedef use_coro_t default_completion_token_type;

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

  /// Type alias to adapt an I/O object to use @c use_coro_t as its
  /// default completion token type.
  template <typename T>
  using as_default_on_t = typename T::template rebind_executor<
      executor_with_default<typename T::executor_type>>::other;

  /// Function helper to adapt an I/O object to use @c use_coro_t as its
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

private:
  Allocator allocator_;
};

/// A @ref completion_token object that represents the currently executing
/// resumable coroutine.
/**
 * See the documentation for asio::use_coro_t for a usage example.
 */
#if defined(GENERATING_DOCUMENTATION)
ASIO_INLINE_VARIABLE constexpr use_coro_t<> use_coro;
#else
ASIO_INLINE_VARIABLE constexpr use_coro_t<> use_coro(0, 0, 0);
#endif

} // namespace experimental
} // namespace asio

#include "asio/detail/pop_options.hpp"

#include "asio/experimental/impl/use_coro.hpp"
#include "asio/experimental/coro.hpp"

#endif // ASIO_EXPERIMENTAL_USE_CORO_HPP
