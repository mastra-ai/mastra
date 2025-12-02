//
// impl/co_spawn.hpp
// ~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_CO_SPAWN_HPP
#define ASIO_IMPL_CO_SPAWN_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/associated_cancellation_slot.hpp"
#include "asio/awaitable.hpp"
#include "asio/detail/memory.hpp"
#include "asio/detail/recycling_allocator.hpp"
#include "asio/dispatch.hpp"
#include "asio/execution/outstanding_work.hpp"
#include "asio/post.hpp"
#include "asio/prefer.hpp"
#include "asio/use_awaitable.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

template <typename Executor, typename = void>
class co_spawn_work_guard
{
public:
  typedef decay_t<
      prefer_result_t<Executor,
        execution::outstanding_work_t::tracked_t
      >
    > executor_type;

  co_spawn_work_guard(const Executor& ex)
    : executor_(asio::prefer(ex, execution::outstanding_work.tracked))
  {
  }

  executor_type get_executor() const noexcept
  {
    return executor_;
  }

private:
  executor_type executor_;
};

#if !defined(ASIO_NO_TS_EXECUTORS)

template <typename Executor>
struct co_spawn_work_guard<Executor,
    enable_if_t<
      !execution::is_executor<Executor>::value
    >> : executor_work_guard<Executor>
{
  co_spawn_work_guard(const Executor& ex)
    : executor_work_guard<Executor>(ex)
  {
  }
};

#endif // !defined(ASIO_NO_TS_EXECUTORS)

template <typename Handler, typename Executor,
    typename Function, typename = void>
struct co_spawn_state
{
  template <typename H, typename F>
  co_spawn_state(H&& h, const Executor& ex, F&& f)
    : handler(std::forward<H>(h)),
      spawn_work(ex),
      handler_work(asio::get_associated_executor(handler, ex)),
      function(std::forward<F>(f))
  {
  }

  Handler handler;
  co_spawn_work_guard<Executor> spawn_work;
  co_spawn_work_guard<associated_executor_t<Handler, Executor>> handler_work;
  Function function;
};

template <typename Handler, typename Executor, typename Function>
struct co_spawn_state<Handler, Executor, Function,
    enable_if_t<
      is_same<
        typename associated_executor<Handler,
          Executor>::asio_associated_executor_is_unspecialised,
        void
      >::value
    >>
{
  template <typename H, typename F>
  co_spawn_state(H&& h, const Executor& ex, F&& f)
    : handler(std::forward<H>(h)),
      handler_work(ex),
      function(std::forward<F>(f))
  {
  }

  Handler handler;
  co_spawn_work_guard<Executor> handler_work;
  Function function;
};

struct co_spawn_dispatch
{
  template <typename CompletionToken>
  auto operator()(CompletionToken&& token) const
    -> decltype(asio::dispatch(std::forward<CompletionToken>(token)))
  {
    return asio::dispatch(std::forward<CompletionToken>(token));
  }
};

struct co_spawn_post
{
  template <typename CompletionToken>
  auto operator()(CompletionToken&& token) const
    -> decltype(asio::post(std::forward<CompletionToken>(token)))
  {
    return asio::post(std::forward<CompletionToken>(token));
  }
};

template <typename T, typename Handler, typename Executor, typename Function>
awaitable<awaitable_thread_entry_point, Executor> co_spawn_entry_point(
    awaitable<T, Executor>*, co_spawn_state<Handler, Executor, Function> s)
{
  (void) co_await co_spawn_dispatch{};

  (co_await awaitable_thread_has_context_switched{}) = false;
  std::exception_ptr e = nullptr;
  bool done = false;
#if !defined(ASIO_NO_EXCEPTIONS)
  try
#endif // !defined(ASIO_NO_EXCEPTIONS)
  {
    T t = co_await s.function();

    done = true;

    bool switched = (co_await awaitable_thread_has_context_switched{});
    if (!switched)
    {
      co_await this_coro::throw_if_cancelled(false);
      (void) co_await co_spawn_post();
    }

    (dispatch)(s.handler_work.get_executor(),
        [handler = std::move(s.handler), t = std::move(t)]() mutable
        {
          std::move(handler)(std::exception_ptr(), std::move(t));
        });

    co_return;
  }
#if !defined(ASIO_NO_EXCEPTIONS)
  catch (...)
  {
    if (done)
      throw;

    e = std::current_exception();
  }
#endif // !defined(ASIO_NO_EXCEPTIONS)

  bool switched = (co_await awaitable_thread_has_context_switched{});
  if (!switched)
  {
    co_await this_coro::throw_if_cancelled(false);
    (void) co_await co_spawn_post();
  }

  (dispatch)(s.handler_work.get_executor(),
      [handler = std::move(s.handler), e]() mutable
      {
        std::move(handler)(e, T());
      });
}

template <typename Handler, typename Executor, typename Function>
awaitable<awaitable_thread_entry_point, Executor> co_spawn_entry_point(
    awaitable<void, Executor>*, co_spawn_state<Handler, Executor, Function> s)
{
  (void) co_await co_spawn_dispatch{};

  (co_await awaitable_thread_has_context_switched{}) = false;
  std::exception_ptr e = nullptr;
#if !defined(ASIO_NO_EXCEPTIONS)
  try
#endif // !defined(ASIO_NO_EXCEPTIONS)
  {
    co_await s.function();
  }
#if !defined(ASIO_NO_EXCEPTIONS)
  catch (...)
  {
    e = std::current_exception();
  }
#endif // !defined(ASIO_NO_EXCEPTIONS)

  bool switched = (co_await awaitable_thread_has_context_switched{});
  if (!switched)
  {
    co_await this_coro::throw_if_cancelled(false);
    (void) co_await co_spawn_post();
  }

  (dispatch)(s.handler_work.get_executor(),
      [handler = std::move(s.handler), e]() mutable
      {
        std::move(handler)(e);
      });
}

template <typename T, typename Executor>
class awaitable_as_function
{
public:
  explicit awaitable_as_function(awaitable<T, Executor>&& a)
    : awaitable_(std::move(a))
  {
  }

  awaitable<T, Executor> operator()()
  {
    return std::move(awaitable_);
  }

private:
  awaitable<T, Executor> awaitable_;
};

template <typename Handler, typename Executor, typename = void>
class co_spawn_cancellation_handler
{
public:
  co_spawn_cancellation_handler(const Handler&, const Executor& ex)
    : signal_(detail::allocate_shared<cancellation_signal>(
          detail::recycling_allocator<cancellation_signal,
            detail::thread_info_base::cancellation_signal_tag>())),
      ex_(ex)
  {
  }

  cancellation_slot slot()
  {
    return signal_->slot();
  }

  void operator()(cancellation_type_t type)
  {
    shared_ptr<cancellation_signal> sig = signal_;
    asio::dispatch(ex_, [sig, type]{ sig->emit(type); });
  }

private:
  shared_ptr<cancellation_signal> signal_;
  Executor ex_;
};

template <typename Handler, typename Executor>
class co_spawn_cancellation_handler<Handler, Executor,
    enable_if_t<
      is_same<
        typename associated_executor<Handler,
          Executor>::asio_associated_executor_is_unspecialised,
        void
      >::value
    >>
{
public:
  co_spawn_cancellation_handler(const Handler&, const Executor&)
  {
  }

  cancellation_slot slot()
  {
    return signal_.slot();
  }

  void operator()(cancellation_type_t type)
  {
    signal_.emit(type);
  }

private:
  cancellation_signal signal_;
};

template <typename Executor>
class initiate_co_spawn
{
public:
  typedef Executor executor_type;

  template <typename OtherExecutor>
  explicit initiate_co_spawn(const OtherExecutor& ex)
    : ex_(ex)
  {
  }

  executor_type get_executor() const noexcept
  {
    return ex_;
  }

  template <typename Handler, typename F>
  void operator()(Handler&& handler, F&& f) const
  {
    typedef result_of_t<F()> awaitable_type;
    typedef decay_t<Handler> handler_type;
    typedef decay_t<F> function_type;
    typedef co_spawn_cancellation_handler<
      handler_type, Executor> cancel_handler_type;

    auto slot = asio::get_associated_cancellation_slot(handler);
    cancel_handler_type* cancel_handler = slot.is_connected()
      ? &slot.template emplace<cancel_handler_type>(handler, ex_)
      : nullptr;

    cancellation_slot proxy_slot(
        cancel_handler
          ? cancel_handler->slot()
          : cancellation_slot());

    cancellation_state cancel_state(proxy_slot);

    auto a = (co_spawn_entry_point)(static_cast<awaitable_type*>(nullptr),
        co_spawn_state<handler_type, Executor, function_type>(
          std::forward<Handler>(handler), ex_, std::forward<F>(f)));
    awaitable_handler<executor_type, void>(std::move(a),
        ex_, proxy_slot, cancel_state).launch();
  }

private:
  Executor ex_;
};

} // namespace detail

template <typename Executor, typename T, typename AwaitableExecutor,
    ASIO_COMPLETION_TOKEN_FOR(
      void(std::exception_ptr, T)) CompletionToken>
inline ASIO_INITFN_AUTO_RESULT_TYPE(
    CompletionToken, void(std::exception_ptr, T))
co_spawn(const Executor& ex,
    awaitable<T, AwaitableExecutor> a, CompletionToken&& token,
    constraint_t<
      (is_executor<Executor>::value || execution::is_executor<Executor>::value)
        && is_convertible<Executor, AwaitableExecutor>::value
    >)
{
  return async_initiate<CompletionToken, void(std::exception_ptr, T)>(
      detail::initiate_co_spawn<AwaitableExecutor>(AwaitableExecutor(ex)),
      token, detail::awaitable_as_function<T, AwaitableExecutor>(std::move(a)));
}

template <typename Executor, typename AwaitableExecutor,
    ASIO_COMPLETION_TOKEN_FOR(
      void(std::exception_ptr)) CompletionToken>
inline ASIO_INITFN_AUTO_RESULT_TYPE(
    CompletionToken, void(std::exception_ptr))
co_spawn(const Executor& ex,
    awaitable<void, AwaitableExecutor> a, CompletionToken&& token,
    constraint_t<
      (is_executor<Executor>::value || execution::is_executor<Executor>::value)
        && is_convertible<Executor, AwaitableExecutor>::value
    >)
{
  return async_initiate<CompletionToken, void(std::exception_ptr)>(
      detail::initiate_co_spawn<AwaitableExecutor>(AwaitableExecutor(ex)),
      token, detail::awaitable_as_function<
        void, AwaitableExecutor>(std::move(a)));
}

template <typename ExecutionContext, typename T, typename AwaitableExecutor,
    ASIO_COMPLETION_TOKEN_FOR(
      void(std::exception_ptr, T)) CompletionToken>
inline ASIO_INITFN_AUTO_RESULT_TYPE(
    CompletionToken, void(std::exception_ptr, T))
co_spawn(ExecutionContext& ctx,
    awaitable<T, AwaitableExecutor> a, CompletionToken&& token,
    constraint_t<
      is_convertible<ExecutionContext&, execution_context&>::value
        && is_convertible<typename ExecutionContext::executor_type,
          AwaitableExecutor>::value
    >)
{
  return (co_spawn)(ctx.get_executor(), std::move(a),
      std::forward<CompletionToken>(token));
}

template <typename ExecutionContext, typename AwaitableExecutor,
    ASIO_COMPLETION_TOKEN_FOR(
      void(std::exception_ptr)) CompletionToken>
inline ASIO_INITFN_AUTO_RESULT_TYPE(
    CompletionToken, void(std::exception_ptr))
co_spawn(ExecutionContext& ctx,
    awaitable<void, AwaitableExecutor> a, CompletionToken&& token,
    constraint_t<
      is_convertible<ExecutionContext&, execution_context&>::value
        && is_convertible<typename ExecutionContext::executor_type,
          AwaitableExecutor>::value
    >)
{
  return (co_spawn)(ctx.get_executor(), std::move(a),
      std::forward<CompletionToken>(token));
}

template <typename Executor, typename F,
    ASIO_COMPLETION_TOKEN_FOR(typename detail::awaitable_signature<
      result_of_t<F()>>::type) CompletionToken>
inline ASIO_INITFN_AUTO_RESULT_TYPE(CompletionToken,
    typename detail::awaitable_signature<result_of_t<F()>>::type)
co_spawn(const Executor& ex, F&& f, CompletionToken&& token,
    constraint_t<
      is_executor<Executor>::value || execution::is_executor<Executor>::value
    >)
{
  return async_initiate<CompletionToken,
    typename detail::awaitable_signature<result_of_t<F()>>::type>(
      detail::initiate_co_spawn<
        typename result_of_t<F()>::executor_type>(ex),
      token, std::forward<F>(f));
}

template <typename ExecutionContext, typename F,
    ASIO_COMPLETION_TOKEN_FOR(typename detail::awaitable_signature<
      result_of_t<F()>>::type) CompletionToken>
inline ASIO_INITFN_AUTO_RESULT_TYPE(CompletionToken,
    typename detail::awaitable_signature<result_of_t<F()>>::type)
co_spawn(ExecutionContext& ctx, F&& f, CompletionToken&& token,
    constraint_t<
      is_convertible<ExecutionContext&, execution_context&>::value
    >)
{
  return (co_spawn)(ctx.get_executor(), std::forward<F>(f),
      std::forward<CompletionToken>(token));
}

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IMPL_CO_SPAWN_HPP
