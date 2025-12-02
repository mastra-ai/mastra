//
// defer.hpp
// ~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DEFER_HPP
#define ASIO_DEFER_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/async_result.hpp"
#include "asio/detail/initiate_defer.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/execution_context.hpp"
#include "asio/execution/blocking.hpp"
#include "asio/execution/executor.hpp"
#include "asio/is_executor.hpp"
#include "asio/require.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

/// Submits a completion token or function object for execution.
/**
 * This function submits an object for execution using the object's associated
 * executor. The function object is queued for execution, and is never called
 * from the current thread prior to returning from <tt>defer()</tt>.
 *
 * The use of @c defer(), rather than @ref post(), indicates the caller's
 * preference that the executor defer the queueing of the function object. This
 * may allow the executor to optimise queueing for cases when the function
 * object represents a continuation of the current call context.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler. The function signature of the completion handler must be:
 * @code void handler(); @endcode
 *
 * @returns This function returns <tt>async_initiate<NullaryToken,
 * void()>(Init{}, token)</tt>, where @c Init is a function object type defined
 * as:
 *
 * @code class Init
 * {
 * public:
 *   template <typename CompletionHandler>
 *     void operator()(CompletionHandler&& completion_handler) const;
 * }; @endcode
 *
 * The function call operator of @c Init:
 *
 * @li Obtains the handler's associated executor object @c ex of type @c Ex by
 * performing @code auto ex = get_associated_executor(handler); @endcode
 *
 * @li Obtains the handler's associated allocator object @c alloc by performing
 * @code auto alloc = get_associated_allocator(handler); @endcode
 *
 * @li If <tt>execution::is_executor<Ex>::value</tt> is true, performs
 * @code prefer(
 *     require(ex, execution::blocking.never),
 *     execution::relationship.continuation,
 *     execution::allocator(alloc)
 *   ).execute(std::forward<CompletionHandler>(completion_handler)); @endcode
 *
 * @li If <tt>execution::is_executor<Ex>::value</tt> is false, performs
 * @code ex.defer(
 *     std::forward<CompletionHandler>(completion_handler),
 *     alloc); @endcode
 *
 * @par Completion Signature
 * @code void() @endcode
 */
template <ASIO_COMPLETION_TOKEN_FOR(void()) NullaryToken>
auto defer(NullaryToken&& token)
  -> decltype(
    async_initiate<NullaryToken, void()>(
      declval<detail::initiate_defer>(), token))
{
  return async_initiate<NullaryToken, void()>(
      detail::initiate_defer(), token);
}

/// Submits a completion token or function object for execution.
/**
 * This function submits an object for execution using the specified executor.
 * The function object is queued for execution, and is never called from the
 * current thread prior to returning from <tt>defer()</tt>.
 *
 * The use of @c defer(), rather than @ref post(), indicates the caller's
 * preference that the executor defer the queueing of the function object. This
 * may allow the executor to optimise queueing for cases when the function
 * object represents a continuation of the current call context.
 *
 * @param ex The target executor.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler. The function signature of the completion handler must be:
 * @code void handler(); @endcode
 *
 * @returns This function returns <tt>async_initiate<NullaryToken,
 * void()>(Init{ex}, token)</tt>, where @c Init is a function object type
 * defined as:
 *
 * @code class Init
 * {
 * public:
 *   using executor_type = Executor;
 *   explicit Init(const Executor& ex) : ex_(ex) {}
 *   executor_type get_executor() const noexcept { return ex_; }
 *   template <typename CompletionHandler>
 *     void operator()(CompletionHandler&& completion_handler) const;
 * private:
 *   Executor ex_; // exposition only
 * }; @endcode
 *
 * The function call operator of @c Init:
 *
 * @li Obtains the handler's associated executor object @c ex1 of type @c Ex1 by
 * performing @code auto ex1 = get_associated_executor(handler, ex); @endcode
 *
 * @li Obtains the handler's associated allocator object @c alloc by performing
 * @code auto alloc = get_associated_allocator(handler); @endcode
 *
 * @li If <tt>execution::is_executor<Ex1>::value</tt> is true, constructs a
 * function object @c f with a member @c executor_ that is initialised with
 * <tt>prefer(ex1, execution::outstanding_work.tracked)</tt>, a member @c
 * handler_ that is a decay-copy of @c completion_handler, and a function call
 * operator that performs:
 * @code auto a = get_associated_allocator(handler_);
 * prefer(executor_, execution::allocator(a)).execute(std::move(handler_));
 * @endcode
 *
 * @li If <tt>execution::is_executor<Ex1>::value</tt> is false, constructs a
 * function object @c f with a member @c work_ that is initialised with
 * <tt>make_work_guard(ex1)</tt>, a member @c handler_ that is a decay-copy of
 * @c completion_handler, and a function call operator that performs:
 * @code auto a = get_associated_allocator(handler_);
 * work_.get_executor().dispatch(std::move(handler_), a);
 * work_.reset(); @endcode
 *
 * @li If <tt>execution::is_executor<Ex>::value</tt> is true, performs
 * @code prefer(
 *     require(ex, execution::blocking.never),
 *     execution::relationship.continuation,
 *     execution::allocator(alloc)
 *   ).execute(std::move(f)); @endcode
 *
 * @li If <tt>execution::is_executor<Ex>::value</tt> is false, performs
 * @code ex.defer(std::move(f), alloc); @endcode
 *
 * @par Completion Signature
 * @code void() @endcode
 */
template <typename Executor,
    ASIO_COMPLETION_TOKEN_FOR(void()) NullaryToken
      = default_completion_token_t<Executor>>
auto defer(const Executor& ex,
    NullaryToken&& token
      = default_completion_token_t<Executor>(),
    constraint_t<
      (execution::is_executor<Executor>::value
          && can_require<Executor, execution::blocking_t::never_t>::value)
        || is_executor<Executor>::value
    > = 0)
  -> decltype(
    async_initiate<NullaryToken, void()>(
      declval<detail::initiate_defer_with_executor<Executor>>(), token))
{
  return async_initiate<NullaryToken, void()>(
      detail::initiate_defer_with_executor<Executor>(ex), token);
}

/// Submits a completion token or function object for execution.
/**
 * @param ctx An execution context, from which the target executor is obtained.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler. The function signature of the completion handler must be:
 * @code void handler(); @endcode
 *
 * @returns <tt>defer(ctx.get_executor(), forward<NullaryToken>(token))</tt>.
 *
 * @par Completion Signature
 * @code void() @endcode
 */
template <typename ExecutionContext,
    ASIO_COMPLETION_TOKEN_FOR(void()) NullaryToken
      = default_completion_token_t<typename ExecutionContext::executor_type>>
auto defer(ExecutionContext& ctx,
    NullaryToken&& token
      = default_completion_token_t<typename ExecutionContext::executor_type>(),
    constraint_t<
      is_convertible<ExecutionContext&, execution_context&>::value
    > = 0)
  -> decltype(
    async_initiate<NullaryToken, void()>(
      declval<detail::initiate_defer_with_executor<
        typename ExecutionContext::executor_type>>(), token))
{
  return async_initiate<NullaryToken, void()>(
      detail::initiate_defer_with_executor<
        typename ExecutionContext::executor_type>(
          ctx.get_executor()), token);
}

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DEFER_HPP
