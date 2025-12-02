//
// experimental/detail/partial_promise.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2021-2023 Klemens D. Morgenstern
//                         (klemens dot morgenstern at gmx dot net)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXPERIMENTAL_DETAIL_PARTIAL_PROMISE_HPP
#define ASIO_EXPERIMENTAL_DETAIL_PARTIAL_PROMISE_HPP

#include "asio/detail/config.hpp"
#include "asio/append.hpp"
#include "asio/awaitable.hpp"
#include "asio/experimental/coro_traits.hpp"

#if defined(ASIO_HAS_STD_COROUTINE)
# include <coroutine>
#else // defined(ASIO_HAS_STD_COROUTINE)
# include <experimental/coroutine>
#endif // defined(ASIO_HAS_STD_COROUTINE)

namespace asio {
namespace experimental {
namespace detail {

#if defined(ASIO_HAS_STD_COROUTINE)

using std::coroutine_handle;
using std::coroutine_traits;
using std::suspend_never;
using std::suspend_always;
using std::noop_coroutine;

#else // defined(ASIO_HAS_STD_COROUTINE)

using std::experimental::coroutine_handle;
using std::experimental::coroutine_traits;
using std::experimental::suspend_never;
using std::experimental::suspend_always;
using std::experimental::noop_coroutine;

#endif // defined(ASIO_HAS_STD_COROUTINE)

struct partial_coro
{
  coroutine_handle<void> handle{nullptr};
};

template <typename Allocator>
struct partial_promise_base
{
  template <typename Executor, typename Token, typename... Args>
  void* operator new(std::size_t size, Executor&, Token& tk, Args&...)
  {
    return allocate_coroutine<Allocator>(size, get_associated_allocator(tk));
  }

  void operator delete(void* raw, std::size_t size)
  {
    deallocate_coroutine<Allocator>(raw, size);
  }
};

template <>
struct partial_promise_base<std::allocator<void>>
{
};

template <typename Allocator>
struct partial_promise : partial_promise_base<Allocator>
{
  auto initial_suspend() noexcept
  {
    return asio::detail::suspend_always{};
  }

  auto final_suspend() noexcept
  {
    struct awaitable_t
    {
      partial_promise *p;

      constexpr bool await_ready() noexcept { return true; }

      auto await_suspend(asio::detail::coroutine_handle<>) noexcept
      {
        p->get_return_object().handle.destroy();
      }

      constexpr void await_resume() noexcept {}
    };

    return awaitable_t{this};
  }

  void return_void() {}

  partial_coro get_return_object()
  {
    return partial_coro{coroutine_handle<partial_promise>::from_promise(*this)};
  }

  void unhandled_exception()
  {
    assert(false);
  }
};

} // namespace detail
} // namespace experimental
} // namespace asio

#if defined(ASIO_HAS_STD_COROUTINE)

namespace std {

template <typename Executor, typename Completion, typename... Args>
struct coroutine_traits<
    asio::experimental::detail::partial_coro,
    Executor, Completion, Args...>
{
  using promise_type =
    asio::experimental::detail::partial_promise<
      asio::associated_allocator_t<Completion>>;
};

} // namespace std

#else // defined(ASIO_HAS_STD_COROUTINE)

namespace std { namespace experimental {

template <typename Executor, typename Completion, typename... Args>
struct coroutine_traits<
    asio::experimental::detail::partial_coro,
    Executor, Completion, Args...>
{
  using promise_type =
    asio::experimental::detail::partial_promise<
      asio::associated_allocator_t<Completion>>;
};

}} // namespace std::experimental

#endif // defined(ASIO_HAS_STD_COROUTINE)

namespace asio {
namespace experimental {
namespace detail {

template <execution::executor Executor,
    typename CompletionToken, typename... Args>
partial_coro post_coroutine(Executor exec,
    CompletionToken token, Args&&... args) noexcept
{
  post(exec, asio::append(std::move(token), std::move(args)...));
  co_return;
}

template <detail::execution_context Context,
    typename CompletionToken, typename... Args>
partial_coro post_coroutine(Context& ctx,
    CompletionToken token, Args&&... args) noexcept
{
  post(ctx, asio::append(std::move(token), std::move(args)...));
  co_return;
}

template <execution::executor Executor,
    typename CompletionToken, typename... Args>
partial_coro dispatch_coroutine(Executor exec,
    CompletionToken token, Args&&... args) noexcept
{
  dispatch(exec, asio::append(std::move(token), std::move(args)...));
  co_return;
}

template <detail::execution_context Context,
    typename CompletionToken, typename... Args>
partial_coro dispatch_coroutine(Context& ctx,
    CompletionToken token, Args &&... args) noexcept
{
  dispatch(ctx, asio::append(std::move(token), std::move(args)...));
  co_return;
}

} // namespace detail
} // namespace experimental
} // namespace asio

#endif // ASIO_EXPERIMENTAL_DETAIL_PARTIAL_PROMISE_HPP
