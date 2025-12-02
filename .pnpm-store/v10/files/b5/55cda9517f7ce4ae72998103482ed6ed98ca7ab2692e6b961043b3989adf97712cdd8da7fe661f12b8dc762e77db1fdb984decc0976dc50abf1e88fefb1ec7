//
// impl/spawn.hpp
// ~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_SPAWN_HPP
#define ASIO_IMPL_SPAWN_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <tuple>
#include "asio/associated_allocator.hpp"
#include "asio/associated_cancellation_slot.hpp"
#include "asio/associated_executor.hpp"
#include "asio/async_result.hpp"
#include "asio/bind_executor.hpp"
#include "asio/detail/atomic_count.hpp"
#include "asio/detail/bind_handler.hpp"
#include "asio/detail/handler_cont_helpers.hpp"
#include "asio/detail/memory.hpp"
#include "asio/detail/noncopyable.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/detail/utility.hpp"
#include "asio/disposition.hpp"
#include "asio/error.hpp"
#include "asio/system_error.hpp"

#if defined(ASIO_HAS_BOOST_CONTEXT_FIBER)
# include <boost/context/fiber.hpp>
#endif // defined(ASIO_HAS_BOOST_CONTEXT_FIBER)

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

#if !defined(ASIO_NO_EXCEPTIONS)
inline void spawned_thread_rethrow(void* ex)
{
  if (*static_cast<exception_ptr*>(ex))
    rethrow_exception(*static_cast<exception_ptr*>(ex));
}
#endif // !defined(ASIO_NO_EXCEPTIONS)

#if defined(ASIO_HAS_BOOST_CONTEXT_FIBER)

// Spawned thread implementation using Boost.Context's fiber.
class spawned_fiber_thread : public spawned_thread_base
{
public:
  typedef boost::context::fiber fiber_type;

  spawned_fiber_thread(fiber_type&& caller)
    : caller_(static_cast<fiber_type&&>(caller)),
      on_suspend_fn_(0),
      on_suspend_arg_(0)
  {
  }

  template <typename StackAllocator, typename F>
  static spawned_thread_base* spawn(allocator_arg_t,
      StackAllocator&& stack_allocator,
      F&& f,
      cancellation_slot parent_cancel_slot = cancellation_slot(),
      cancellation_state cancel_state = cancellation_state())
  {
    spawned_fiber_thread* spawned_thread = 0;
    fiber_type callee(allocator_arg_t(),
        static_cast<StackAllocator&&>(stack_allocator),
        entry_point<decay_t<F>>(
          static_cast<F&&>(f), &spawned_thread));
    callee = fiber_type(static_cast<fiber_type&&>(callee)).resume();
    spawned_thread->callee_ = static_cast<fiber_type&&>(callee);
    spawned_thread->parent_cancellation_slot_ = parent_cancel_slot;
    spawned_thread->cancellation_state_ = cancel_state;
    return spawned_thread;
  }

  template <typename F>
  static spawned_thread_base* spawn(F&& f,
      cancellation_slot parent_cancel_slot = cancellation_slot(),
      cancellation_state cancel_state = cancellation_state())
  {
    return spawn(allocator_arg_t(), boost::context::fixedsize_stack(),
        static_cast<F&&>(f), parent_cancel_slot, cancel_state);
  }

  void resume()
  {
    callee_ = fiber_type(static_cast<fiber_type&&>(callee_)).resume();
    if (on_suspend_fn_)
    {
      void (*fn)(void*) = on_suspend_fn_;
      void* arg = on_suspend_arg_;
      on_suspend_fn_ = 0;
      fn(arg);
    }
  }

  void suspend_with(void (*fn)(void*), void* arg)
  {
    if (throw_if_cancelled_)
      if (!!cancellation_state_.cancelled())
        throw_error(asio::error::operation_aborted, "yield");
    has_context_switched_ = true;
    on_suspend_fn_ = fn;
    on_suspend_arg_ = arg;
    caller_ = fiber_type(static_cast<fiber_type&&>(caller_)).resume();
  }

  void destroy()
  {
    fiber_type callee = static_cast<fiber_type&&>(callee_);
    if (terminal_)
      fiber_type(static_cast<fiber_type&&>(callee)).resume();
  }

private:
  template <typename Function>
  class entry_point
  {
  public:
    template <typename F>
    entry_point(F&& f,
        spawned_fiber_thread** spawned_thread_out)
      : function_(static_cast<F&&>(f)),
        spawned_thread_out_(spawned_thread_out)
    {
    }

    fiber_type operator()(fiber_type&& caller)
    {
      Function function(static_cast<Function&&>(function_));
      spawned_fiber_thread spawned_thread(
          static_cast<fiber_type&&>(caller));
      *spawned_thread_out_ = &spawned_thread;
      spawned_thread_out_ = 0;
      spawned_thread.suspend();
#if !defined(ASIO_NO_EXCEPTIONS)
      try
#endif // !defined(ASIO_NO_EXCEPTIONS)
      {
        function(&spawned_thread);
        spawned_thread.terminal_ = true;
        spawned_thread.suspend();
      }
#if !defined(ASIO_NO_EXCEPTIONS)
      catch (const boost::context::detail::forced_unwind&)
      {
        throw;
      }
      catch (...)
      {
        exception_ptr ex = current_exception();
        spawned_thread.terminal_ = true;
        spawned_thread.suspend_with(spawned_thread_rethrow, &ex);
      }
#endif // !defined(ASIO_NO_EXCEPTIONS)
      return static_cast<fiber_type&&>(spawned_thread.caller_);
    }

  private:
    Function function_;
    spawned_fiber_thread** spawned_thread_out_;
  };

  fiber_type caller_;
  fiber_type callee_;
  void (*on_suspend_fn_)(void*);
  void* on_suspend_arg_;
};

#endif // defined(ASIO_HAS_BOOST_CONTEXT_FIBER)

#if defined(ASIO_HAS_BOOST_CONTEXT_FIBER)
typedef spawned_fiber_thread default_spawned_thread_type;
#else
# error No spawn() implementation available
#endif

// Helper class to perform the initial resume on the correct executor.
class spawned_thread_resumer
{
public:
  explicit spawned_thread_resumer(spawned_thread_base* spawned_thread)
    : spawned_thread_(spawned_thread)
  {
  }

  spawned_thread_resumer(spawned_thread_resumer&& other) noexcept
    : spawned_thread_(other.spawned_thread_)
  {
    other.spawned_thread_ = 0;
  }

  ~spawned_thread_resumer()
  {
    if (spawned_thread_)
      spawned_thread_->destroy();
  }

  void operator()()
  {
    spawned_thread_->attach(&spawned_thread_);
    spawned_thread_->resume();
  }

private:
  spawned_thread_base* spawned_thread_;
};

// Helper class to ensure spawned threads are destroyed on the correct executor.
class spawned_thread_destroyer
{
public:
  explicit spawned_thread_destroyer(spawned_thread_base* spawned_thread)
    : spawned_thread_(spawned_thread)
  {
    spawned_thread->detach();
  }

  spawned_thread_destroyer(spawned_thread_destroyer&& other) noexcept
    : spawned_thread_(other.spawned_thread_)
  {
    other.spawned_thread_ = 0;
  }

  ~spawned_thread_destroyer()
  {
    if (spawned_thread_)
      spawned_thread_->destroy();
  }

  void operator()()
  {
    if (spawned_thread_)
    {
      spawned_thread_->destroy();
      spawned_thread_ = 0;
    }
  }

private:
  spawned_thread_base* spawned_thread_;
};

// Base class for all completion handlers associated with a spawned thread.
template <typename Executor>
class spawn_handler_base
{
public:
  typedef Executor executor_type;
  typedef cancellation_slot cancellation_slot_type;

  spawn_handler_base(const basic_yield_context<Executor>& yield)
    : yield_(yield),
      spawned_thread_(yield.spawned_thread_)
  {
    spawned_thread_->detach();
  }

  spawn_handler_base(spawn_handler_base&& other) noexcept
    : yield_(other.yield_),
      spawned_thread_(other.spawned_thread_)

  {
    other.spawned_thread_ = 0;
  }

  ~spawn_handler_base()
  {
    if (spawned_thread_)
      (post)(yield_.executor_, spawned_thread_destroyer(spawned_thread_));
  }

  executor_type get_executor() const noexcept
  {
    return yield_.executor_;
  }

  cancellation_slot_type get_cancellation_slot() const noexcept
  {
    return spawned_thread_->get_cancellation_slot();
  }

  void resume()
  {
    spawned_thread_resumer resumer(spawned_thread_);
    spawned_thread_ = 0;
    resumer();
  }

protected:
  const basic_yield_context<Executor>& yield_;
  spawned_thread_base* spawned_thread_;
};

// Completion handlers for when basic_yield_context is used as a token.
template <typename Executor, typename Signature, typename = void>
class spawn_handler;

template <typename Executor, typename R>
class spawn_handler<Executor, R()>
  : public spawn_handler_base<Executor>
{
public:
  typedef void return_type;

  struct result_type {};

  spawn_handler(const basic_yield_context<Executor>& yield, result_type&)
    : spawn_handler_base<Executor>(yield)
  {
  }

  void operator()()
  {
    this->resume();
  }

  static return_type on_resume(result_type&)
  {
  }
};

template <typename Executor, typename R>
class spawn_handler<Executor, R(asio::error_code)>
  : public spawn_handler_base<Executor>
{
public:
  typedef void return_type;
  typedef asio::error_code* result_type;

  spawn_handler(const basic_yield_context<Executor>& yield, result_type& result)
    : spawn_handler_base<Executor>(yield),
      result_(result)
  {
  }

  void operator()(asio::error_code ec)
  {
    if (this->yield_.ec_)
    {
      *this->yield_.ec_ = ec;
      result_ = 0;
    }
    else
      result_ = &ec;
    this->resume();
  }

  static return_type on_resume(result_type& result)
  {
    if (result)
      throw_error(*result);
  }

private:
  result_type& result_;
};

template <typename Executor, typename R, typename Disposition>
class spawn_handler<Executor, R(Disposition),
    enable_if_t<is_disposition<Disposition>::value>
  > : public spawn_handler_base<Executor>
{
public:
  typedef void return_type;
  typedef Disposition* result_type;

  spawn_handler(const basic_yield_context<Executor>& yield, result_type& result)
    : spawn_handler_base<Executor>(yield),
      result_(result)
  {
  }

  void operator()(Disposition d)
  {
    result_ = detail::addressof(d);
    this->resume();
  }

  static return_type on_resume(result_type& result)
  {
    if (*result != no_error)
      asio::throw_exception(static_cast<Disposition&&>(*result));
  }

private:
  result_type& result_;
};

template <typename Executor, typename R, typename T>
class spawn_handler<Executor, R(T),
    enable_if_t<!is_disposition<T>::value>
  > : public spawn_handler_base<Executor>
{
public:
  typedef T return_type;
  typedef return_type* result_type;

  spawn_handler(const basic_yield_context<Executor>& yield, result_type& result)
    : spawn_handler_base<Executor>(yield),
      result_(result)
  {
  }

  void operator()(T value)
  {
    result_ = detail::addressof(value);
    this->resume();
  }

  static return_type on_resume(result_type& result)
  {
    return static_cast<return_type&&>(*result);
  }

private:
  result_type& result_;
};

template <typename Executor, typename R, typename T>
class spawn_handler<Executor, R(asio::error_code, T)>
  : public spawn_handler_base<Executor>
{
public:
  typedef T return_type;

  struct result_type
  {
    asio::error_code* ec_;
    return_type* value_;
  };

  spawn_handler(const basic_yield_context<Executor>& yield, result_type& result)
    : spawn_handler_base<Executor>(yield),
      result_(result)
  {
  }

  void operator()(asio::error_code ec, T value)
  {
    if (this->yield_.ec_)
    {
      *this->yield_.ec_ = ec;
      result_.ec_ = 0;
    }
    else
      result_.ec_ = &ec;
    result_.value_ = detail::addressof(value);
    this->resume();
  }

  static return_type on_resume(result_type& result)
  {
    if (result.ec_)
      throw_error(*result.ec_);
    return static_cast<return_type&&>(*result.value_);
  }

private:
  result_type& result_;
};

template <typename Executor, typename R, typename Disposition, typename T>
class spawn_handler<Executor, R(Disposition, T),
    enable_if_t<is_disposition<Disposition>::value>
  > : public spawn_handler_base<Executor>
{
public:
  typedef T return_type;

  struct result_type
  {
    Disposition* disposition_;
    return_type* value_;
  };

  spawn_handler(const basic_yield_context<Executor>& yield, result_type& result)
    : spawn_handler_base<Executor>(yield),
      result_(result)
  {
  }

  void operator()(Disposition d, T value)
  {
    result_.disposition_ = detail::addressof(d);
    result_.value_ = detail::addressof(value);
    this->resume();
  }

  static return_type on_resume(result_type& result)
  {
    if (*result.disposition_ != no_error)
    {
      asio::throw_exception(
          static_cast<Disposition&&>(*result.disposition_));
    }
    return static_cast<return_type&&>(*result.value_);
  }

private:
  result_type& result_;
};

template <typename Executor, typename R, typename T, typename... Ts>
class spawn_handler<Executor, R(T, Ts...),
    enable_if_t<!is_disposition<T>::value>
  > : public spawn_handler_base<Executor>
{
public:
  typedef std::tuple<T, Ts...> return_type;

  typedef return_type* result_type;

  spawn_handler(const basic_yield_context<Executor>& yield, result_type& result)
    : spawn_handler_base<Executor>(yield),
      result_(result)
  {
  }

  template <typename... Args>
  void operator()(Args&&... args)
  {
    return_type value(static_cast<Args&&>(args)...);
    result_ = detail::addressof(value);
    this->resume();
  }

  static return_type on_resume(result_type& result)
  {
    return static_cast<return_type&&>(*result);
  }

private:
  result_type& result_;
};

template <typename Executor, typename R, typename... Ts>
class spawn_handler<Executor, R(asio::error_code, Ts...)>
  : public spawn_handler_base<Executor>
{
public:
  typedef std::tuple<Ts...> return_type;

  struct result_type
  {
    asio::error_code* ec_;
    return_type* value_;
  };

  spawn_handler(const basic_yield_context<Executor>& yield, result_type& result)
    : spawn_handler_base<Executor>(yield),
      result_(result)
  {
  }

  template <typename... Args>
  void operator()(asio::error_code ec,
      Args&&... args)
  {
    return_type value(static_cast<Args&&>(args)...);
    if (this->yield_.ec_)
    {
      *this->yield_.ec_ = ec;
      result_.ec_ = 0;
    }
    else
      result_.ec_ = &ec;
    result_.value_ = detail::addressof(value);
    this->resume();
  }

  static return_type on_resume(result_type& result)
  {
    if (result.ec_)
      throw_error(*result.ec_);
    return static_cast<return_type&&>(*result.value_);
  }

private:
  result_type& result_;
};

template <typename Executor, typename R, typename Disposition, typename... Ts>
class spawn_handler<Executor, R(Disposition, Ts...),
    enable_if_t<is_disposition<Disposition>::value>
  > : public spawn_handler_base<Executor>
{
public:
  typedef std::tuple<Ts...> return_type;

  struct result_type
  {
    Disposition* disposition_;
    return_type* value_;
  };

  spawn_handler(const basic_yield_context<Executor>& yield, result_type& result)
    : spawn_handler_base<Executor>(yield),
      result_(result)
  {
  }

  template <typename... Args>
  void operator()(Disposition d, Args&&... args)
  {
    return_type value(static_cast<Args&&>(args)...);
    result_.disposition_ = detail::addressof(d);
    result_.value_ = detail::addressof(value);
    this->resume();
  }

  static return_type on_resume(result_type& result)
  {
    if (*result.disposition_ != no_error)
    {
      asio::throw_exception(
          static_cast<Disposition&&>(*result.disposition_));
    }
    return static_cast<return_type&&>(*result.value_);
  }

private:
  result_type& result_;
};

template <typename Executor, typename Signature>
inline bool asio_handler_is_continuation(spawn_handler<Executor, Signature>*)
{
  return true;
}

} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <typename Executor, typename Signature>
class async_result<basic_yield_context<Executor>, Signature>
{
public:
  typedef typename detail::spawn_handler<Executor, Signature> handler_type;
  typedef typename handler_type::return_type return_type;

#if defined(ASIO_HAS_VARIADIC_LAMBDA_CAPTURES)

  template <typename Initiation, typename... InitArgs>
  static return_type initiate(Initiation&& init,
      const basic_yield_context<Executor>& yield,
      InitArgs&&... init_args)
  {
    typename handler_type::result_type result
      = typename handler_type::result_type();

    yield.spawned_thread_->suspend_with(
        [&]()
        {
          static_cast<Initiation&&>(init)(
              handler_type(yield, result),
              static_cast<InitArgs&&>(init_args)...);
        });

    return handler_type::on_resume(result);
  }

#else // defined(ASIO_HAS_VARIADIC_LAMBDA_CAPTURES)

  template <typename Initiation, typename... InitArgs>
  struct suspend_with_helper
  {
    typename handler_type::result_type& result_;
    Initiation&& init_;
    const basic_yield_context<Executor>& yield_;
    std::tuple<InitArgs&&...> init_args_;

    template <std::size_t... I>
    void do_invoke(detail::index_sequence<I...>)
    {
      static_cast<Initiation&&>(init_)(
          handler_type(yield_, result_),
          static_cast<InitArgs&&>(std::get<I>(init_args_))...);
    }

    void operator()()
    {
      this->do_invoke(detail::make_index_sequence<sizeof...(InitArgs)>());
    }
  };

  template <typename Initiation, typename... InitArgs>
  static return_type initiate(Initiation&& init,
      const basic_yield_context<Executor>& yield,
      InitArgs&&... init_args)
  {
    typename handler_type::result_type result
      = typename handler_type::result_type();

    yield.spawned_thread_->suspend_with(
      suspend_with_helper<Initiation, InitArgs...>{
          result, static_cast<Initiation&&>(init), yield,
          std::tuple<InitArgs&&...>(
            static_cast<InitArgs&&>(init_args)...)});

    return handler_type::on_resume(result);
  }

#endif // defined(ASIO_HAS_VARIADIC_LAMBDA_CAPTURES)
};

#endif // !defined(GENERATING_DOCUMENTATION)

namespace detail {

template <typename Executor, typename Function, typename Handler>
class spawn_entry_point
{
public:
  template <typename F, typename H>
  spawn_entry_point(const Executor& ex,
      F&& f, H&& h)
    : executor_(ex),
      function_(static_cast<F&&>(f)),
      handler_(static_cast<H&&>(h)),
      work_(handler_, executor_)
  {
  }

  void operator()(spawned_thread_base* spawned_thread)
  {
    const basic_yield_context<Executor> yield(spawned_thread, executor_);
    this->call(yield,
        void_type<result_of_t<Function(basic_yield_context<Executor>)>>());
  }

private:
  void call(const basic_yield_context<Executor>& yield, void_type<void>)
  {
#if !defined(ASIO_NO_EXCEPTIONS)
    try
#endif // !defined(ASIO_NO_EXCEPTIONS)
    {
      function_(yield);
      if (!yield.spawned_thread_->has_context_switched())
        (post)(yield);
      detail::binder1<Handler, exception_ptr>
        handler(handler_, exception_ptr());
      work_.complete(handler, handler.handler_);
    }
#if !defined(ASIO_NO_EXCEPTIONS)
# if defined(ASIO_HAS_BOOST_CONTEXT_FIBER)
    catch (const boost::context::detail::forced_unwind&)
    {
      throw;
    }
# endif // defined(ASIO_HAS_BOOST_CONTEXT_FIBER)
    catch (...)
    {
      exception_ptr ex = current_exception();
      if (!yield.spawned_thread_->has_context_switched())
        (post)(yield);
      detail::binder1<Handler, exception_ptr> handler(handler_, ex);
      work_.complete(handler, handler.handler_);
    }
#endif // !defined(ASIO_NO_EXCEPTIONS)
  }

  template <typename T>
  void call(const basic_yield_context<Executor>& yield, void_type<T>)
  {
#if !defined(ASIO_NO_EXCEPTIONS)
    try
#endif // !defined(ASIO_NO_EXCEPTIONS)
    {
      T result(function_(yield));
      if (!yield.spawned_thread_->has_context_switched())
        (post)(yield);
      detail::move_binder2<Handler, exception_ptr, T>
        handler(0, static_cast<Handler&&>(handler_),
          exception_ptr(), static_cast<T&&>(result));
      work_.complete(handler, handler.handler_);
    }
#if !defined(ASIO_NO_EXCEPTIONS)
# if defined(ASIO_HAS_BOOST_CONTEXT_FIBER)
    catch (const boost::context::detail::forced_unwind&)
    {
      throw;
    }
# endif // defined(ASIO_HAS_BOOST_CONTEXT_FIBER)
    catch (...)
    {
      exception_ptr ex = current_exception();
      if (!yield.spawned_thread_->has_context_switched())
        (post)(yield);
      detail::move_binder2<Handler, exception_ptr, T>
        handler(0, static_cast<Handler&&>(handler_), ex, T());
      work_.complete(handler, handler.handler_);
    }
#endif // !defined(ASIO_NO_EXCEPTIONS)
  }

  Executor executor_;
  Function function_;
  Handler handler_;
  handler_work<Handler, Executor> work_;
};

struct spawn_cancellation_signal_emitter
{
  cancellation_signal* signal_;
  cancellation_type_t type_;

  void operator()()
  {
    signal_->emit(type_);
  }
};

template <typename Handler, typename Executor, typename = void>
class spawn_cancellation_handler
{
public:
  spawn_cancellation_handler(const Handler&, const Executor& ex)
    : ex_(ex)
  {
  }

  cancellation_slot slot()
  {
    return signal_.slot();
  }

  void operator()(cancellation_type_t type)
  {
    spawn_cancellation_signal_emitter emitter = { &signal_, type };
    (dispatch)(ex_, emitter);
  }

private:
  cancellation_signal signal_;
  Executor ex_;
};

template <typename Handler, typename Executor>
class spawn_cancellation_handler<Handler, Executor,
    enable_if_t<
      is_same<
        typename associated_executor<Handler,
          Executor>::asio_associated_executor_is_unspecialised,
        void
      >::value
    >>
{
public:
  spawn_cancellation_handler(const Handler&, const Executor&)
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
class initiate_spawn
{
public:
  typedef Executor executor_type;

  explicit initiate_spawn(const executor_type& ex)
    : executor_(ex)
  {
  }

  executor_type get_executor() const noexcept
  {
    return executor_;
  }

  template <typename Handler, typename F>
  void operator()(Handler&& handler,
      F&& f) const
  {
    typedef decay_t<Handler> handler_type;
    typedef decay_t<F> function_type;
    typedef spawn_cancellation_handler<
      handler_type, Executor> cancel_handler_type;

    associated_cancellation_slot_t<handler_type> slot
      = asio::get_associated_cancellation_slot(handler);

    cancel_handler_type* cancel_handler = slot.is_connected()
      ? &slot.template emplace<cancel_handler_type>(handler, executor_)
      : 0;

    cancellation_slot proxy_slot(
        cancel_handler
          ? cancel_handler->slot()
          : cancellation_slot());

    cancellation_state cancel_state(proxy_slot);

    (dispatch)(executor_,
        spawned_thread_resumer(
          default_spawned_thread_type::spawn(
            spawn_entry_point<Executor, function_type, handler_type>(
              executor_, static_cast<F&&>(f),
              static_cast<Handler&&>(handler)),
            proxy_slot, cancel_state)));
  }

#if defined(ASIO_HAS_BOOST_CONTEXT_FIBER)

  template <typename Handler, typename StackAllocator, typename F>
  void operator()(Handler&& handler, allocator_arg_t,
      StackAllocator&& stack_allocator,
      F&& f) const
  {
    typedef decay_t<Handler> handler_type;
    typedef decay_t<F> function_type;
    typedef spawn_cancellation_handler<
      handler_type, Executor> cancel_handler_type;

    associated_cancellation_slot_t<handler_type> slot
      = asio::get_associated_cancellation_slot(handler);

    cancel_handler_type* cancel_handler = slot.is_connected()
      ? &slot.template emplace<cancel_handler_type>(handler, executor_)
      : 0;

    cancellation_slot proxy_slot(
        cancel_handler
          ? cancel_handler->slot()
          : cancellation_slot());

    cancellation_state cancel_state(proxy_slot);

    (dispatch)(executor_,
        spawned_thread_resumer(
          spawned_fiber_thread::spawn(allocator_arg_t(),
            static_cast<StackAllocator&&>(stack_allocator),
            spawn_entry_point<Executor, function_type, handler_type>(
              executor_, static_cast<F&&>(f),
              static_cast<Handler&&>(handler)),
            proxy_slot, cancel_state)));
  }

#endif // defined(ASIO_HAS_BOOST_CONTEXT_FIBER)

private:
  executor_type executor_;
};

} // namespace detail

template <typename Executor, typename F,
    ASIO_COMPLETION_TOKEN_FOR(typename detail::spawn_signature<
      result_of_t<F(basic_yield_context<Executor>)>>::type) CompletionToken>
inline auto spawn(const Executor& ex, F&& function, CompletionToken&& token,
    constraint_t<
      is_executor<Executor>::value || execution::is_executor<Executor>::value
    >)
  -> decltype(
    async_initiate<CompletionToken,
      typename detail::spawn_signature<
        result_of_t<F(basic_yield_context<Executor>)>>::type>(
          declval<detail::initiate_spawn<Executor>>(),
          token, static_cast<F&&>(function)))
{
  return async_initiate<CompletionToken,
    typename detail::spawn_signature<
      result_of_t<F(basic_yield_context<Executor>)>>::type>(
        detail::initiate_spawn<Executor>(ex),
        token, static_cast<F&&>(function));
}

template <typename ExecutionContext, typename F,
    ASIO_COMPLETION_TOKEN_FOR(typename detail::spawn_signature<
      result_of_t<F(basic_yield_context<
        typename ExecutionContext::executor_type>)>>::type) CompletionToken>
inline auto spawn(ExecutionContext& ctx, F&& function, CompletionToken&& token,
    constraint_t<
      is_convertible<ExecutionContext&, execution_context&>::value
    >)
  -> decltype(
    async_initiate<CompletionToken,
      typename detail::spawn_signature<
        result_of_t<F(basic_yield_context<
          typename ExecutionContext::executor_type>)>>::type>(
            declval<detail::initiate_spawn<
              typename ExecutionContext::executor_type>>(),
            token, static_cast<F&&>(function)))
{
  return (spawn)(ctx.get_executor(), static_cast<F&&>(function),
      static_cast<CompletionToken&&>(token));
}

template <typename Executor, typename F,
    ASIO_COMPLETION_TOKEN_FOR(typename detail::spawn_signature<
      result_of_t<F(basic_yield_context<Executor>)>>::type)
        CompletionToken>
inline auto spawn(const basic_yield_context<Executor>& ctx,
    F&& function, CompletionToken&& token,
    constraint_t<
      is_executor<Executor>::value || execution::is_executor<Executor>::value
    >)
  -> decltype(
    async_initiate<CompletionToken,
      typename detail::spawn_signature<
        result_of_t<F(basic_yield_context<Executor>)>>::type>(
          declval<detail::initiate_spawn<Executor>>(),
          token, static_cast<F&&>(function)))
{
  return (spawn)(ctx.get_executor(), static_cast<F&&>(function),
      static_cast<CompletionToken&&>(token));
}

#if defined(ASIO_HAS_BOOST_CONTEXT_FIBER)

template <typename Executor, typename StackAllocator, typename F,
    ASIO_COMPLETION_TOKEN_FOR(typename detail::spawn_signature<
      result_of_t<F(basic_yield_context<Executor>)>>::type)
        CompletionToken>
inline auto spawn(const Executor& ex, allocator_arg_t,
    StackAllocator&& stack_allocator, F&& function, CompletionToken&& token,
    constraint_t<
      is_executor<Executor>::value || execution::is_executor<Executor>::value
    >)
  -> decltype(
    async_initiate<CompletionToken,
      typename detail::spawn_signature<
        result_of_t<F(basic_yield_context<Executor>)>>::type>(
          declval<detail::initiate_spawn<Executor>>(),
          token, allocator_arg_t(),
          static_cast<StackAllocator&&>(stack_allocator),
          static_cast<F&&>(function)))
{
  return async_initiate<CompletionToken,
    typename detail::spawn_signature<
      result_of_t<F(basic_yield_context<Executor>)>>::type>(
        detail::initiate_spawn<Executor>(ex), token, allocator_arg_t(),
        static_cast<StackAllocator&&>(stack_allocator),
        static_cast<F&&>(function));
}

template <typename ExecutionContext, typename StackAllocator, typename F,
    ASIO_COMPLETION_TOKEN_FOR(typename detail::spawn_signature<
      result_of_t<F(basic_yield_context<
        typename ExecutionContext::executor_type>)>>::type) CompletionToken>
inline auto spawn(ExecutionContext& ctx, allocator_arg_t,
    StackAllocator&& stack_allocator, F&& function, CompletionToken&& token,
    constraint_t<
      is_convertible<ExecutionContext&, execution_context&>::value
    >)
  -> decltype(
    async_initiate<CompletionToken,
      typename detail::spawn_signature<
        result_of_t<F(basic_yield_context<
          typename ExecutionContext::executor_type>)>>::type>(
            declval<detail::initiate_spawn<
              typename ExecutionContext::executor_type>>(),
            token, allocator_arg_t(),
            static_cast<StackAllocator&&>(stack_allocator),
            static_cast<F&&>(function)))
{
  return (spawn)(ctx.get_executor(), allocator_arg_t(),
      static_cast<StackAllocator&&>(stack_allocator),
      static_cast<F&&>(function), static_cast<CompletionToken&&>(token));
}

template <typename Executor, typename StackAllocator, typename F,
    ASIO_COMPLETION_TOKEN_FOR(typename detail::spawn_signature<
      result_of_t<F(basic_yield_context<Executor>)>>::type) CompletionToken>
inline auto spawn(const basic_yield_context<Executor>& ctx, allocator_arg_t,
    StackAllocator&& stack_allocator, F&& function, CompletionToken&& token,
    constraint_t<
      is_executor<Executor>::value || execution::is_executor<Executor>::value
    >)
  -> decltype(
    async_initiate<CompletionToken,
      typename detail::spawn_signature<
        result_of_t<F(basic_yield_context<Executor>)>>::type>(
          declval<detail::initiate_spawn<Executor>>(), token,
          allocator_arg_t(), static_cast<StackAllocator&&>(stack_allocator),
          static_cast<F&&>(function)))
{
  return (spawn)(ctx.get_executor(), allocator_arg_t(),
      static_cast<StackAllocator&&>(stack_allocator),
      static_cast<F&&>(function), static_cast<CompletionToken&&>(token));
}

#endif // defined(ASIO_HAS_BOOST_CONTEXT_FIBER)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IMPL_SPAWN_HPP
