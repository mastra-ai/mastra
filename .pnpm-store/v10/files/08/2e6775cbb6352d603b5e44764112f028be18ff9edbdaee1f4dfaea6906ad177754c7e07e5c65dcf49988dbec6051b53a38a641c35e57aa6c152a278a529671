//
// experimental/as_single.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXPERIMENTAL_AS_SINGLE_HPP
#define ASIO_EXPERIMENTAL_AS_SINGLE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/type_traits.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace experimental {

/// A @ref completion_token adapter used to specify that the completion handler
/// arguments should be combined into a single argument.
/**
 * The as_single_t class is used to indicate that any arguments to the
 * completion handler should be combined and passed as a single argument.
 * If there is already one argument, that argument is passed as-is. If
 * there is more than argument, the arguments are first moved into a
 * @c std::tuple and that tuple is then passed to the completion handler.
 */
template <typename CompletionToken>
class as_single_t
{
public:
  /// Tag type used to prevent the "default" constructor from being used for
  /// conversions.
  struct default_constructor_tag {};

  /// Default constructor.
  /**
   * This constructor is only valid if the underlying completion token is
   * default constructible and move constructible. The underlying completion
   * token is itself defaulted as an argument to allow it to capture a source
   * location.
   */
  constexpr as_single_t(
      default_constructor_tag = default_constructor_tag(),
      CompletionToken token = CompletionToken())
    : token_(static_cast<CompletionToken&&>(token))
  {
  }

  /// Constructor.
  template <typename T>
  constexpr explicit as_single_t(
      T&& completion_token)
    : token_(static_cast<T&&>(completion_token))
  {
  }

  /// Adapts an executor to add the @c as_single_t completion token as the
  /// default.
  template <typename InnerExecutor>
  struct executor_with_default : InnerExecutor
  {
    /// Specify @c as_single_t as the default completion token type.
    typedef as_single_t default_completion_token_type;

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

  /// Type alias to adapt an I/O object to use @c as_single_t as its
  /// default completion token type.
  template <typename T>
  using as_default_on_t = typename T::template rebind_executor<
      executor_with_default<typename T::executor_type>>::other;

  /// Function helper to adapt an I/O object to use @c as_single_t as its
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

//private:
  CompletionToken token_;
};

/// Adapt a @ref completion_token to specify that the completion handler
/// arguments should be combined into a single argument.
template <typename CompletionToken>
ASIO_NODISCARD inline
constexpr as_single_t<decay_t<CompletionToken>>
as_single(CompletionToken&& completion_token)
{
  return as_single_t<decay_t<CompletionToken>>(
      static_cast<CompletionToken&&>(completion_token));
}

} // namespace experimental
} // namespace asio

#include "asio/detail/pop_options.hpp"

#include "asio/experimental/impl/as_single.hpp"

#endif // ASIO_EXPERIMENTAL_AS_SINGLE_HPP
