//
// immediate.hpp
// ~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMMEDIATE_HPP
#define ASIO_IMMEDIATE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/associated_immediate_executor.hpp"
#include "asio/async_result.hpp"
#include "asio/dispatch.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

template <typename Executor>
class initiate_immediate
{
public:
  typedef Executor executor_type;

  explicit initiate_immediate(const Executor& ex)
    : ex_(ex)
  {
  }

  executor_type get_executor() const noexcept
  {
    return ex_;
  }

  template <typename CompletionHandler>
  void operator()(CompletionHandler&& handler) const
  {
    typename associated_immediate_executor<
      CompletionHandler, executor_type>::type ex =
        (get_associated_immediate_executor)(handler, ex_);
    (dispatch)(ex, static_cast<CompletionHandler&&>(handler));
  }

private:
  Executor ex_;
};

} // namespace detail

/// Launch a trivial asynchronous operation that completes immediately.
/**
 * The async_immediate function is intended for use by composed operations,
 * which can delegate to this operation in order to implement the correct
 * semantics for immediate completion.
 *
 * @param ex The asynchronous operation's I/O executor.
 *
 * @param token The completion token.
 *
 * The completion handler is immediately submitted for execution by calling
 * asio::dispatch() on the handler's associated immediate executor.
 *
 * If the completion handler does not have a customised associated immediate
 * executor, then the handler is submitted as if by calling asio::post()
 * on the supplied I/O executor.
 *
 * @par Completion Signature
 * @code void() @endcode
 */
template <typename Executor,
    ASIO_COMPLETION_TOKEN_FOR(void()) NullaryToken
      = default_completion_token_t<Executor>>
inline auto async_immediate(const Executor& ex,
    NullaryToken&& token = default_completion_token_t<Executor>(),
    constraint_t<
      (execution::is_executor<Executor>::value
          && can_require<Executor, execution::blocking_t::never_t>::value)
        || is_executor<Executor>::value
    > = 0)
  -> decltype(
    async_initiate<NullaryToken, void()>(
      declval<detail::initiate_immediate<Executor>>(), token))
{
  return async_initiate<NullaryToken, void()>(
      detail::initiate_immediate<Executor>(ex), token);
}

/// Launch a trivial asynchronous operation that completes immediately.
/**
 * The async_immediate function is intended for use by composed operations,
 * which can delegate to this operation in order to implement the correct
 * semantics for immediate completion.
 *
 * @param ex The execution context used to obtain the asynchronous operation's
 * I/O executor.
 *
 * @param token The completion token.
 *
 * The completion handler is immediately submitted for execution by calling
 * asio::dispatch() on the handler's associated immediate executor.
 *
 * If the completion handler does not have a customised associated immediate
 * executor, then the handler is submitted as if by calling asio::post()
 * on the I/O executor obtained from the supplied execution context.
 *
 * @par Completion Signature
 * @code void() @endcode
 */
template <typename ExecutionContext,
    ASIO_COMPLETION_TOKEN_FOR(void()) NullaryToken
      = default_completion_token_t<typename ExecutionContext::executor_type>>
inline auto async_immediate(ExecutionContext& ctx,
    NullaryToken&& token = default_completion_token_t<
      typename ExecutionContext::executor_type>(),
    constraint_t<
      is_convertible<ExecutionContext&, execution_context&>::value
    > = 0)
  -> decltype(
    async_initiate<NullaryToken, void()>(
      declval<detail::initiate_immediate<
        typename ExecutionContext::executor_type>>(), token))
{
  return async_initiate<NullaryToken, void()>(
      detail::initiate_immediate<
        typename ExecutionContext::executor_type>(
          ctx.get_executor()), token);
}

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IMMEDIATE_HPP
