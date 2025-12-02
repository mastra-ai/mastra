//
// redirect_error.hpp
// ~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_REDIRECT_ERROR_HPP
#define ASIO_REDIRECT_ERROR_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/error_code.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

/// A @ref completion_token adapter used to specify that an error produced by an
/// asynchronous operation is captured to an error_code variable.
/**
 * The redirect_error_t class is used to indicate that any error_code produced
 * by an asynchronous operation is captured to a specified variable.
 */
template <typename CompletionToken>
class redirect_error_t
{
public:
  /// Constructor.
  template <typename T>
  redirect_error_t(T&& completion_token, asio::error_code& ec)
    : token_(static_cast<T&&>(completion_token)),
      ec_(ec)
  {
  }

//private:
  CompletionToken token_;
  asio::error_code& ec_;
};

/// A function object type that adapts a @ref completion_token to capture
/// error_code values to a variable.
/**
 * May also be used directly as a completion token, in which case it adapts the
 * asynchronous operation's default completion token (or asio::deferred
 * if no default is available).
 */
class partial_redirect_error
{
public:
  /// Constructor that specifies the variable used to capture error_code values.
  explicit partial_redirect_error(asio::error_code& ec)
    : ec_(ec)
  {
  }

  /// Adapt a @ref completion_token to specify that the completion handler
  /// should capture error_code values to a variable.
  template <typename CompletionToken>
  ASIO_NODISCARD inline
  constexpr redirect_error_t<decay_t<CompletionToken>>
  operator()(CompletionToken&& completion_token) const
  {
    return redirect_error_t<decay_t<CompletionToken>>(
        static_cast<CompletionToken&&>(completion_token), ec_);
  }

//private:
  asio::error_code& ec_;
};

/// Create a partial completion token adapter that captures error_code values
/// to a variable.
ASIO_NODISCARD inline partial_redirect_error
redirect_error(asio::error_code& ec)
{
  return partial_redirect_error(ec);
}

/// Adapt a @ref completion_token to capture error_code values to a variable.
template <typename CompletionToken>
ASIO_NODISCARD inline redirect_error_t<decay_t<CompletionToken>>
redirect_error(CompletionToken&& completion_token,
    asio::error_code& ec)
{
  return redirect_error_t<decay_t<CompletionToken>>(
      static_cast<CompletionToken&&>(completion_token), ec);
}

} // namespace asio

#include "asio/detail/pop_options.hpp"

#include "asio/impl/redirect_error.hpp"

#endif // ASIO_REDIRECT_ERROR_HPP
