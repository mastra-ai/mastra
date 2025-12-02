//
// experimental/impl/coro.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2021-2023 Klemens D. Morgenstern
//                         (klemens dot morgenstern at gmx dot net)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)

//
#ifndef ASIO_EXPERIMENTAL_IMPL_CORO_HPP
#define ASIO_EXPERIMENTAL_IMPL_CORO_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/append.hpp"
#include "asio/associated_cancellation_slot.hpp"
#include "asio/bind_allocator.hpp"
#include "asio/deferred.hpp"
#include "asio/experimental/detail/coro_completion_handler.hpp"
#include "asio/detail/push_options.hpp"

namespace asio {
namespace experimental {

template <typename Yield, typename Return,
    typename Executor, typename Allocator>
struct coro;

namespace detail {

struct coro_cancellation_source
{
  cancellation_slot slot;
  cancellation_state state;
  bool throw_if_cancelled_ = true;

  void reset_cancellation_state()
  {
    state = cancellation_state(slot);
  }

  template <typename Filter>
  void reset_cancellation_state(Filter&& filter)
  {
    state = cancellation_state(slot, static_cast<Filter&&>(filter));
  }

  template <typename InFilter, typename OutFilter>
  void reset_cancellation_state(InFilter&& in_filter,
      OutFilter&& out_filter)
  {
    state = cancellation_state(slot,
        static_cast<InFilter&&>(in_filter),
        static_cast<OutFilter&&>(out_filter));
  }

  bool throw_if_cancelled() const
  {
    return throw_if_cancelled_;
  }

  void throw_if_cancelled(bool value)
  {
    throw_if_cancelled_ = value;
  }
};

template <typename Signature, typename Return,
    typename Executor, typename Allocator>
struct coro_promise;

template <typename T>
struct is_noexcept : std::false_type
{
};

template <typename Return, typename... Args>
struct is_noexcept<Return(Args...)> : std::false_type
{
};

template <typename Return, typename... Args>
struct is_noexcept<Return(Args...) noexcept> : std::true_type
{
};

template <typename T>
constexpr bool is_noexcept_v = is_noexcept<T>::value;

template <typename T>
struct coro_error;

template <>
struct coro_error<asio::error_code>
{
  static asio::error_code invalid()
  {
    return asio::error::fault;
  }

  static asio::error_code cancelled()
  {
    return asio::error::operation_aborted;
  }

  static asio::error_code interrupted()
  {
    return asio::error::interrupted;
  }

  static asio::error_code done()
  {
    return asio::error::broken_pipe;
  }
};

template <>
struct coro_error<std::exception_ptr>
{
  static std::exception_ptr invalid()
  {
    return std::make_exception_ptr(
        asio::system_error(
          coro_error<asio::error_code>::invalid()));
  }

  static std::exception_ptr cancelled()
  {
    return std::make_exception_ptr(
        asio::system_error(
          coro_error<asio::error_code>::cancelled()));
  }

  static std::exception_ptr interrupted()
  {
    return std::make_exception_ptr(
        asio::system_error(
          coro_error<asio::error_code>::interrupted()));
  }

  static std::exception_ptr done()
  {
    return std::make_exception_ptr(
        asio::system_error(
          coro_error<asio::error_code>::done()));
  }
};

template <typename T, typename Coroutine >
struct coro_with_arg
{
  using coro_t = Coroutine;
  T value;
  coro_t& coro;

  struct awaitable_t
  {
    T value;
    coro_t& coro;

    constexpr static bool await_ready() { return false; }

    template <typename Y, typename R, typename E, typename A>
    auto await_suspend(coroutine_handle<coro_promise<Y, R, E, A>> h)
      -> coroutine_handle<>
    {
      auto& hp = h.promise();

      if constexpr (!coro_promise<Y, R, E, A>::is_noexcept)
      {
        if ((hp.cancel->state.cancelled() != cancellation_type::none)
            && hp.cancel->throw_if_cancelled_)
        {
          asio::detail::throw_error(
              asio::error::operation_aborted, "coro-cancelled");
        }
      }

      if (hp.get_executor() == coro.get_executor())
      {
        coro.coro_->awaited_from = h;
        coro.coro_->reset_error();
        coro.coro_->input_ = std::move(value);
        coro.coro_->cancel = hp.cancel;
        return coro.coro_->get_handle();
      }
      else
      {
        coro.coro_->awaited_from =
          dispatch_coroutine(
              asio::prefer(hp.get_executor(),
                execution::outstanding_work.tracked),
                [h]() mutable { h.resume(); }).handle;

        coro.coro_->reset_error();
        coro.coro_->input_ = std::move(value);

        struct cancel_handler
        {
          using src = std::pair<cancellation_signal,
                detail::coro_cancellation_source>;

          std::shared_ptr<src> st = std::make_shared<src>();

          cancel_handler(E e, coro_t& coro) : e(e), coro_(coro.coro_)
          {
            st->second.state =
              cancellation_state(st->second.slot = st->first.slot());
          }

          E e;
          typename coro_t::promise_type* coro_;

          void operator()(cancellation_type ct)
          {
            asio::dispatch(e, [ct, st = st]() mutable
            {
              auto & [sig, state] = *st;
              sig.emit(ct);
            });
          }
        };

        if (hp.cancel->state.slot().is_connected())
        {
          hp.cancel->state.slot().template emplace<cancel_handler>(
              coro.get_executor(), coro);
        }

        auto hh = detail::coroutine_handle<
          typename coro_t::promise_type>::from_promise(*coro.coro_);

        return dispatch_coroutine(
            coro.coro_->get_executor(), [hh]() mutable { hh.resume(); }).handle;
      }
    }

    auto await_resume() -> typename coro_t::result_type
    {
      coro.coro_->cancel = nullptr;
      coro.coro_->rethrow_if();
      return std::move(coro.coro_->result_);
    }
  };

  template <typename CompletionToken>
  auto async_resume(CompletionToken&& token) &&
  {
    return coro.async_resume(std::move(value),
        std::forward<CompletionToken>(token));
  }

  auto operator co_await() &&
  {
    return awaitable_t{std::move(value), coro};
  }
};

template <bool IsNoexcept>
struct coro_promise_error;

template <>
struct coro_promise_error<false>
{
  std::exception_ptr error_;

  void reset_error()
  {
    error_ = std::exception_ptr{};
  }

  void unhandled_exception()
  {
    error_ = std::current_exception();
  }

  void rethrow_if()
  {
    if (error_)
      std::rethrow_exception(error_);
  }
};

#if defined(__GNUC__)
# pragma GCC diagnostic push
# if defined(__clang__)
#  pragma GCC diagnostic ignored "-Wexceptions"
# else
#  pragma GCC diagnostic ignored "-Wterminate"
# endif
#elif defined(_MSC_VER)
# pragma warning(push)
# pragma warning (disable:4297)
#endif

template <>
struct coro_promise_error<true>
{
  void reset_error()
  {
  }

  void unhandled_exception() noexcept
  {
    throw;
  }

  void rethrow_if()
  {
  }
};

#if defined(__GNUC__)
# pragma GCC diagnostic pop
#elif defined(_MSC_VER)
# pragma warning(pop)
#endif

template <typename T = void>
struct yield_input
{
  T& value;
  coroutine_handle<> awaited_from{noop_coroutine()};

  bool await_ready() const noexcept
  {
    return false;
  }

  template <typename U>
  coroutine_handle<> await_suspend(coroutine_handle<U>) noexcept
  {
    return std::exchange(awaited_from, noop_coroutine());
  }

  T await_resume() const noexcept
  {
    return std::move(value);
  }
};

template <>
struct yield_input<void>
{
  coroutine_handle<> awaited_from{noop_coroutine()};

  bool await_ready() const noexcept
  {
    return false;
  }

  auto await_suspend(coroutine_handle<>) noexcept
  {
    return std::exchange(awaited_from, noop_coroutine());
  }

  constexpr void await_resume() const noexcept
  {
  }
};

struct coro_awaited_from
{
  coroutine_handle<> awaited_from{noop_coroutine()};

  auto final_suspend() noexcept
  {
    struct suspendor
    {
      coroutine_handle<> awaited_from;

      constexpr static bool await_ready() noexcept
      {
        return false;
      }

      auto await_suspend(coroutine_handle<>) noexcept
      {
        return std::exchange(awaited_from, noop_coroutine());
      }

      constexpr static void await_resume() noexcept
      {
      }
    };

    return suspendor{std::exchange(awaited_from, noop_coroutine())};
  }

  ~coro_awaited_from()
  {
    awaited_from.resume();
  }//must be on the right executor
};

template <typename Yield, typename Input, typename Return>
struct coro_promise_exchange : coro_awaited_from
{
  using result_type = coro_result_t<Yield, Return>;

  result_type result_;
  Input input_;

  auto yield_value(Yield&& y)
  {
    result_ = std::move(y);
    return yield_input<Input>{std::move(input_),
        std::exchange(awaited_from, noop_coroutine())};
  }

  auto yield_value(const Yield& y)
  {
    result_ = y;
    return yield_input<Input>{std::move(input_),
        std::exchange(awaited_from, noop_coroutine())};
  }

  void return_value(const Return& r)
  {
    result_ = r;
  }

  void return_value(Return&& r)
  {
    result_ = std::move(r);
  }
};

template <typename YieldReturn>
struct coro_promise_exchange<YieldReturn, void, YieldReturn> : coro_awaited_from
{
  using result_type = coro_result_t<YieldReturn, YieldReturn>;

  result_type result_;

  auto yield_value(const YieldReturn& y)
  {
    result_ = y;
    return yield_input<void>{std::exchange(awaited_from, noop_coroutine())};
  }

  auto yield_value(YieldReturn&& y)
  {
    result_ = std::move(y);
    return yield_input<void>{std::exchange(awaited_from, noop_coroutine())};
  }

  void return_value(const YieldReturn& r)
  {
    result_ = r;
  }

  void return_value(YieldReturn&& r)
  {
    result_ = std::move(r);
  }
};

template <typename Yield, typename Return>
struct coro_promise_exchange<Yield, void, Return> : coro_awaited_from
{
  using result_type = coro_result_t<Yield, Return>;

  result_type result_;

  auto yield_value(const Yield& y)
  {
    result_.template emplace<0>(y);
    return yield_input<void>{std::exchange(awaited_from, noop_coroutine())};
  }

  auto yield_value(Yield&& y)
  {
    result_.template emplace<0>(std::move(y));
    return yield_input<void>{std::exchange(awaited_from, noop_coroutine())};
  }

  void return_value(const Return& r)
  {
    result_.template emplace<1>(r);
  }

  void return_value(Return&& r)
  {
    result_.template emplace<1>(std::move(r));
  }
};

template <typename Yield, typename Input>
struct coro_promise_exchange<Yield, Input, void> : coro_awaited_from
{
  using result_type = coro_result_t<Yield, void>;

  result_type result_;
  Input input_;

  auto yield_value(Yield&& y)
  {
    result_ = std::move(y);
    return yield_input<Input>{input_,
                              std::exchange(awaited_from, noop_coroutine())};
  }

  auto yield_value(const Yield& y)
  {
    result_ = y;
    return yield_input<Input>{input_,
                              std::exchange(awaited_from, noop_coroutine())};
  }

  void return_void()
  {
    result_.reset();
  }
};

template <typename Return>
struct coro_promise_exchange<void, void, Return> : coro_awaited_from
{
  using result_type = coro_result_t<void, Return>;

  result_type result_;

  void yield_value();

  void return_value(const Return& r)
  {
    result_ = r;
  }

  void return_value(Return&& r)
  {
    result_ = std::move(r);
  }
};

template <>
struct coro_promise_exchange<void, void, void> : coro_awaited_from
{
  void return_void() {}

  void yield_value();
};

template <typename Yield>
struct coro_promise_exchange<Yield, void, void> : coro_awaited_from
{
  using result_type = coro_result_t<Yield, void>;

  result_type result_;

  auto yield_value(const Yield& y)
  {
    result_ = y;
    return yield_input<void>{std::exchange(awaited_from, noop_coroutine())};
  }

  auto yield_value(Yield&& y)
  {
    result_ = std::move(y);
    return yield_input<void>{std::exchange(awaited_from, noop_coroutine())};
  }

  void return_void()
  {
    result_.reset();
  }
};

template <typename Yield, typename Return,
    typename Executor, typename Allocator>
struct coro_promise final :
  coro_promise_allocator<Allocator>,
  coro_promise_error<coro_traits<Yield, Return, Executor>::is_noexcept>,
  coro_promise_exchange<
      typename coro_traits<Yield, Return, Executor>::yield_type,
      typename coro_traits<Yield, Return, Executor>::input_type,
      typename coro_traits<Yield, Return, Executor>::return_type>
{
  using coro_type = coro<Yield, Return, Executor, Allocator>;

  auto handle()
  {
    return coroutine_handle<coro_promise>::from_promise(this);
  }

  using executor_type = Executor;

  executor_type executor_;

  std::optional<coro_cancellation_source> cancel_source;
  coro_cancellation_source * cancel;

  using cancellation_slot_type = asio::cancellation_slot;

  cancellation_slot_type get_cancellation_slot() const noexcept
  {
    return cancel ? cancel->state.slot() : cancellation_slot_type{};
  }

  using allocator_type =
    typename std::allocator_traits<associated_allocator_t<Executor>>::
      template rebind_alloc<std::byte>;
  using traits = coro_traits<Yield, Return, Executor>;

  using input_type = typename traits::input_type;
  using yield_type = typename traits::yield_type;
  using return_type = typename traits::return_type;
  using error_type = typename traits::error_type;
  using result_type = typename traits::result_type;
  constexpr static bool is_noexcept = traits::is_noexcept;

  auto get_executor() const -> Executor
  {
    return executor_;
  }

  auto get_handle()
  {
    return coroutine_handle<coro_promise>::from_promise(*this);
  }

  template <typename... Args>
  coro_promise(Executor executor, Args&&... args) noexcept
    : coro_promise_allocator<Allocator>(
        executor, std::forward<Args>(args)...),
      executor_(std::move(executor))
  {
  }

  template <typename First, typename... Args>
  coro_promise(First&& f, Executor executor, Args&&... args) noexcept
    : coro_promise_allocator<Allocator>(
        f, executor, std::forward<Args>(args)...),
      executor_(std::move(executor))
  {
  }

  template <typename First, detail::execution_context Context, typename... Args>
  coro_promise(First&& f, Context&& ctx, Args&&... args) noexcept
    : coro_promise_allocator<Allocator>(
        f, ctx, std::forward<Args>(args)...),
      executor_(ctx.get_executor())
  {
  }

  template <detail::execution_context Context, typename... Args>
  coro_promise(Context&& ctx, Args&&... args) noexcept
    : coro_promise_allocator<Allocator>(
        ctx, std::forward<Args>(args)...),
      executor_(ctx.get_executor())
  {
  }

  auto get_return_object()
  {
    return coro<Yield, Return, Executor, Allocator>{this};
  }

  auto initial_suspend() noexcept
  {
    return suspend_always{};
  }

  using coro_promise_exchange<
      typename coro_traits<Yield, Return, Executor>::yield_type,
      typename coro_traits<Yield, Return, Executor>::input_type,
      typename coro_traits<Yield, Return, Executor>::return_type>::yield_value;

  auto await_transform(this_coro::executor_t) const
  {
    struct exec_helper
    {
      const executor_type& value;

      constexpr static bool await_ready() noexcept
      {
        return true;
      }

      constexpr static void await_suspend(coroutine_handle<>) noexcept
      {
      }

      executor_type await_resume() const noexcept
      {
        return value;
      }
    };

    return exec_helper{executor_};
  }

  auto await_transform(this_coro::cancellation_state_t) const
  {
    struct exec_helper
    {
      const asio::cancellation_state& value;

      constexpr static bool await_ready() noexcept
      {
        return true;
      }

      constexpr static void await_suspend(coroutine_handle<>) noexcept
      {
      }

      asio::cancellation_state await_resume() const noexcept
      {
        return value;
      }
    };
    assert(cancel);
    return exec_helper{cancel->state};
  }

  // This await transformation resets the associated cancellation state.
  auto await_transform(this_coro::reset_cancellation_state_0_t) noexcept
  {
    struct result
    {
      detail::coro_cancellation_source * src_;

      bool await_ready() const noexcept
      {
        return true;
      }

      void await_suspend(coroutine_handle<void>) noexcept
      {
      }

      auto await_resume() const
      {
        return src_->reset_cancellation_state();
      }
    };

    return result{cancel};
  }

  // This await transformation resets the associated cancellation state.
  template <typename Filter>
  auto await_transform(
      this_coro::reset_cancellation_state_1_t<Filter> reset) noexcept
  {
    struct result
    {
      detail::coro_cancellation_source* src_;
      Filter filter_;

      bool await_ready() const noexcept
      {
        return true;
      }

      void await_suspend(coroutine_handle<void>) noexcept
      {
      }

      auto await_resume()
      {
        return src_->reset_cancellation_state(
            static_cast<Filter&&>(filter_));
      }
    };

    return result{cancel, static_cast<Filter&&>(reset.filter)};
  }

  // This await transformation resets the associated cancellation state.
  template <typename InFilter, typename OutFilter>
  auto await_transform(
      this_coro::reset_cancellation_state_2_t<InFilter, OutFilter> reset)
  noexcept
  {
    struct result
    {
      detail::coro_cancellation_source* src_;
      InFilter in_filter_;
      OutFilter out_filter_;

      bool await_ready() const noexcept
      {
        return true;
      }

      void await_suspend(coroutine_handle<void>) noexcept
      {
      }

      auto await_resume()
      {
        return src_->reset_cancellation_state(
            static_cast<InFilter&&>(in_filter_),
            static_cast<OutFilter&&>(out_filter_));
      }
    };

    return result{cancel,
        static_cast<InFilter&&>(reset.in_filter),
        static_cast<OutFilter&&>(reset.out_filter)};
  }

  // This await transformation determines whether cancellation is propagated as
  // an exception.
  auto await_transform(this_coro::throw_if_cancelled_0_t) noexcept
    requires (!is_noexcept)
  {
    struct result
    {
      detail::coro_cancellation_source* src_;

      bool await_ready() const noexcept
      {
        return true;
      }

      void await_suspend(coroutine_handle<void>) noexcept
      {
      }

      auto await_resume()
      {
        return src_->throw_if_cancelled();
      }
    };

    return result{cancel};
  }

  // This await transformation sets whether cancellation is propagated as an
  // exception.
  auto await_transform(
      this_coro::throw_if_cancelled_1_t throw_if_cancelled) noexcept
    requires (!is_noexcept)
  {
    struct result
    {
      detail::coro_cancellation_source* src_;
      bool value_;

      bool await_ready() const noexcept
      {
        return true;
      }

      void await_suspend(coroutine_handle<void>) noexcept
      {
      }

      auto await_resume()
      {
        src_->throw_if_cancelled(value_);
      }
    };

    return result{cancel, throw_if_cancelled.value};
  }

  template <typename Yield_, typename Return_,
      typename Executor_, typename Allocator_>
  auto await_transform(coro<Yield_, Return_, Executor_, Allocator_>& kr)
    -> decltype(auto)
  {
    return kr;
  }

  template <typename Yield_, typename Return_,
      typename Executor_, typename Allocator_>
  auto await_transform(coro<Yield_, Return_, Executor_, Allocator_>&& kr)
  {
    return std::move(kr);
  }

  template <typename T_, typename Coroutine >
  auto await_transform(coro_with_arg<T_, Coroutine>&& kr) -> decltype(auto)
  {
    return std::move(kr);
  }

  template <typename T_>
    requires requires(T_ t) {{ t.async_wait(deferred) }; }
  auto await_transform(T_& t) -> decltype(auto)
  {
    return await_transform(t.async_wait(deferred));
  }

  template <typename Op>
  auto await_transform(Op&& op,
      constraint_t<is_async_operation<Op>::value> = 0)
  {
    if ((cancel->state.cancelled() != cancellation_type::none)
        && cancel->throw_if_cancelled_)
    {
      asio::detail::throw_error(
          asio::error::operation_aborted, "coro-cancelled");
    }
    using signature = completion_signature_of_t<Op>;
    using result_type = detail::coro_completion_handler_type_t<signature>;
    using handler_type =
      typename detail::coro_completion_handler_type<signature>::template
        completion_handler<coro_promise>;

    struct aw_t
    {
      Op op;
      std::optional<result_type> result;

      constexpr static bool await_ready()
      {
        return false;
      }

      void await_suspend(coroutine_handle<coro_promise> h)
      {
        std::move(op)(handler_type{h, result});
      }

      auto await_resume()
      {
        if constexpr (is_noexcept)
        {
          if constexpr (std::tuple_size_v<result_type> == 0u)
            return;
          else if constexpr (std::tuple_size_v<result_type> == 1u)
            return std::get<0>(std::move(result).value());
          else
            return std::move(result).value();
        }
        else
          return detail::coro_interpret_result(std::move(result).value());
      }
    };

    return aw_t{std::move(op), {}};
  }
};

} // namespace detail

template <typename Yield, typename Return,
    typename Executor, typename Allocator>
struct coro<Yield, Return, Executor, Allocator>::awaitable_t
{
  coro& coro_;

  constexpr static bool await_ready() { return false; }

  template <typename Y, typename R, typename E, typename A>
  auto await_suspend(
      detail::coroutine_handle<detail::coro_promise<Y, R, E, A>> h)
    -> detail::coroutine_handle<>
  {
    auto& hp = h.promise();

    if constexpr (!detail::coro_promise<Y, R, E, A>::is_noexcept)
    {
      if ((hp.cancel->state.cancelled() != cancellation_type::none)
          && hp.cancel->throw_if_cancelled_)
      {
        asio::detail::throw_error(
            asio::error::operation_aborted, "coro-cancelled");
      }
    }

    if (hp.get_executor() == coro_.get_executor())
    {
      coro_.coro_->awaited_from  = h;
      coro_.coro_->cancel = hp.cancel;
      coro_.coro_->reset_error();

      return coro_.coro_->get_handle();
    }
    else
    {
      coro_.coro_->awaited_from = detail::dispatch_coroutine(
          asio::prefer(hp.get_executor(),
            execution::outstanding_work.tracked),
          [h]() mutable
          {
            h.resume();
          }).handle;

      coro_.coro_->reset_error();

      struct cancel_handler
      {
        std::shared_ptr<std::pair<cancellation_signal,
          detail::coro_cancellation_source>> st = std::make_shared<
            std::pair<cancellation_signal, detail::coro_cancellation_source>>();

        cancel_handler(E e, coro& coro) : e(e), coro_(coro.coro_)
        {
          st->second.state = cancellation_state(
              st->second.slot = st->first.slot());
        }

        E e;
        typename coro::promise_type* coro_;

        void operator()(cancellation_type ct)
        {
          asio::dispatch(e,
              [ct, st = st]() mutable
              {
                auto & [sig, state] = *st;
                sig.emit(ct);
              });
        }
      };

      if (hp.cancel->state.slot().is_connected())
      {
        hp.cancel->state.slot().template emplace<cancel_handler>(
            coro_.get_executor(), coro_);
      }

      auto hh = detail::coroutine_handle<
        detail::coro_promise<Yield, Return, Executor, Allocator>>::from_promise(
            *coro_.coro_);

      return detail::dispatch_coroutine(
          coro_.coro_->get_executor(),
          [hh]() mutable { hh.resume(); }).handle;
    }
  }

  auto await_resume() -> result_type
  {
    coro_.coro_->cancel = nullptr;
    coro_.coro_->rethrow_if();
    if constexpr (!std::is_void_v<result_type>)
      return std::move(coro_.coro_->result_);
  }
};

template <typename Yield, typename Return,
    typename Executor, typename Allocator>
struct coro<Yield, Return, Executor, Allocator>::initiate_async_resume
{
  typedef Executor executor_type;
  typedef Allocator allocator_type;
  typedef asio::cancellation_slot cancellation_slot_type;

  explicit initiate_async_resume(coro* self)
    : coro_(self->coro_)
  {
  }

  executor_type get_executor() const noexcept
  {
    return coro_->get_executor();
  }

  allocator_type get_allocator() const noexcept
  {
    return coro_->get_allocator();
  }

  template <typename E, typename WaitHandler>
  auto handle(E exec, WaitHandler&& handler,
      std::true_type /* error is noexcept */,
      std::true_type /* result is void */)  //noexcept
  {
    return [this, the_coro = coro_,
        h = std::forward<WaitHandler>(handler),
        exec = std::move(exec)]() mutable
    {
      assert(the_coro);

      auto ch = detail::coroutine_handle<promise_type>::from_promise(*the_coro);
      assert(ch && !ch.done());

      the_coro->awaited_from = post_coroutine(std::move(exec), std::move(h));
      the_coro->reset_error();
      ch.resume();
    };
  }

  template <typename E, typename WaitHandler>
  requires (!std::is_void_v<result_type>)
  auto handle(E exec, WaitHandler&& handler,
      std::true_type /* error is noexcept */,
      std::false_type  /* result is void */)  //noexcept
  {
    return [the_coro = coro_,
        h = std::forward<WaitHandler>(handler),
        exec = std::move(exec)]() mutable
    {
      assert(the_coro);

      auto ch = detail::coroutine_handle<promise_type>::from_promise(*the_coro);
      assert(ch && !ch.done());

      the_coro->awaited_from = detail::post_coroutine(
          exec, std::move(h), the_coro->result_).handle;
      the_coro->reset_error();
      ch.resume();
    };
  }

  template <typename E, typename WaitHandler>
  auto handle(E exec, WaitHandler&& handler,
      std::false_type /* error is noexcept */,
      std::true_type /* result is void */)
  {
    return [the_coro = coro_,
        h = std::forward<WaitHandler>(handler),
        exec = std::move(exec)]() mutable
    {
      if (!the_coro)
        return asio::post(exec,
            asio::append(std::move(h),
              detail::coro_error<error_type>::invalid()));

      auto ch = detail::coroutine_handle<promise_type>::from_promise(*the_coro);
      if (!ch)
        return asio::post(exec,
            asio::append(std::move(h),
              detail::coro_error<error_type>::invalid()));
      else if (ch.done())
        return asio::post(exec,
            asio::append(std::move(h),
              detail::coro_error<error_type>::done()));
      else
      {
        the_coro->awaited_from = detail::post_coroutine(
            exec, std::move(h), the_coro->error_).handle;
        the_coro->reset_error();
        ch.resume();
      }
    };
  }

  template <typename E, typename WaitHandler>
  auto handle(E exec, WaitHandler&& handler,
      std::false_type /* error is noexcept */,
      std::false_type  /* result is void */)
  {
    return [the_coro = coro_,
        h = std::forward<WaitHandler>(handler),
        exec = std::move(exec)]() mutable
    {
      if (!the_coro)
        return asio::post(exec,
            asio::append(std::move(h),
              detail::coro_error<error_type>::invalid(), result_type{}));

      auto ch =
        detail::coroutine_handle<promise_type>::from_promise(*the_coro);
      if (!ch)
        return asio::post(exec,
            asio::append(std::move(h),
              detail::coro_error<error_type>::invalid(), result_type{}));
      else if (ch.done())
        return asio::post(exec,
            asio::append(std::move(h),
              detail::coro_error<error_type>::done(), result_type{}));
      else
      {
        the_coro->awaited_from = detail::post_coroutine(
            exec, std::move(h), the_coro->error_, the_coro->result_).handle;
        the_coro->reset_error();
        ch.resume();
      }
    };
  }

  template <typename WaitHandler>
  void operator()(WaitHandler&& handler)
  {
    const auto exec = asio::prefer(
        get_associated_executor(handler, get_executor()),
        execution::outstanding_work.tracked);

    coro_->cancel = &coro_->cancel_source.emplace();
    coro_->cancel->state = cancellation_state(
        coro_->cancel->slot = get_associated_cancellation_slot(handler));
    asio::dispatch(get_executor(),
        handle(exec, std::forward<WaitHandler>(handler),
          std::integral_constant<bool, is_noexcept>{},
          std::is_void<result_type>{}));
  }

  template <typename WaitHandler, typename Input>
  void operator()(WaitHandler&& handler, Input&& input)
  {
    const auto exec = asio::prefer(
        get_associated_executor(handler, get_executor()),
        execution::outstanding_work.tracked);

    coro_->cancel = &coro_->cancel_source.emplace();
    coro_->cancel->state = cancellation_state(
        coro_->cancel->slot = get_associated_cancellation_slot(handler));
    asio::dispatch(get_executor(),
        [h = handle(exec, std::forward<WaitHandler>(handler),
            std::integral_constant<bool, is_noexcept>{},
            std::is_void<result_type>{}),
            in = std::forward<Input>(input), the_coro = coro_]() mutable
        {
          the_coro->input_ = std::move(in);
          std::move(h)();
        });
  }

private:
  typename coro::promise_type* coro_;
};

} // namespace experimental
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_EXPERIMENTAL_IMPL_CORO_HPP
