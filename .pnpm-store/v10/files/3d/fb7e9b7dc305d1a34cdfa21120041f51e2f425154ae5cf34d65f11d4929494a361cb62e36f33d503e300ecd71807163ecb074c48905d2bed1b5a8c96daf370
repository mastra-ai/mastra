//
// detached.hpp
// ~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETACHED_HPP
#define ASIO_DETACHED_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <memory>
#include "asio/detail/type_traits.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

/// A @ref completion_token type used to specify that an asynchronous operation
/// is detached.
/**
 * The detached_t class is used to indicate that an asynchronous operation is
 * detached. That is, there is no completion handler waiting for the
 * operation's result. A detached_t object may be passed as a handler to an
 * asynchronous operation, typically using the special value
 * @c asio::detached. For example:
 *
 * @code my_socket.async_send(my_buffer, asio::detached);
 * @endcode
 */
class detached_t
{
public:
  /// Constructor.
  constexpr detached_t()
  {
  }

  /// Adapts an executor to add the @c detached_t completion token as the
  /// default.
  template <typename InnerExecutor>
  struct executor_with_default : InnerExecutor
  {
    /// Specify @c detached_t as the default completion token type.
    typedef detached_t default_completion_token_type;

    /// Construct the adapted executor from the inner executor type.
    executor_with_default(const InnerExecutor& ex) noexcept
      : InnerExecutor(ex)
    {
    }

    /// Convert the specified executor to the inner executor type, then use
    /// that to construct the adapted executor.
    template <typename OtherExecutor>
    executor_with_default(const OtherExecutor& ex,
        constraint_t<
          is_convertible<OtherExecutor, InnerExecutor>::value
        > = 0) noexcept
      : InnerExecutor(ex)
    {
    }
  };

  /// Type alias to adapt an I/O object to use @c detached_t as its
  /// default completion token type.
  template <typename T>
  using as_default_on_t = typename T::template rebind_executor<
      executor_with_default<typename T::executor_type>>::other;

  /// Function helper to adapt an I/O object to use @c detached_t as its
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
};

/// A @ref completion_token object used to specify that an asynchronous
/// operation is detached.
/**
 * See the documentation for asio::detached_t for a usage example.
 */
ASIO_INLINE_VARIABLE constexpr detached_t detached;

} // namespace asio

#include "asio/detail/pop_options.hpp"

#include "asio/impl/detached.hpp"

#endif // ASIO_DETACHED_HPP
