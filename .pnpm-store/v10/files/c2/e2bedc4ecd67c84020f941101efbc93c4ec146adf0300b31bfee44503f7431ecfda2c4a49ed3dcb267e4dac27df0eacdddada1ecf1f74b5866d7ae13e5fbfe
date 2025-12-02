//
// impl/awaitable.hpp
// ~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_AWAITABLE_HPP
#define ASIO_IMPL_AWAITABLE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <exception>
#include <new>
#include <tuple>
#include "asio/cancellation_signal.hpp"
#include "asio/cancellation_state.hpp"
#include "asio/detail/memory.hpp"
#include "asio/detail/thread_context.hpp"
#include "asio/detail/thread_info_base.hpp"
#include "asio/detail/throw_error.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/disposition.hpp"
#include "asio/error.hpp"
#include "asio/post.hpp"
#include "asio/system_error.hpp"
#include "asio/this_coro.hpp"

#if defined(ASIO_ENABLE_HANDLER_TRACKING)
# if defined(ASIO_HAS_SOURCE_LOCATION)
#  include "asio/detail/source_location.hpp"
# endif // defined(ASIO_HAS_SOURCE_LOCATION)
#endif // defined(ASIO_ENABLE_HANDLER_TRACKING)

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

struct awaitable_thread_has_context_switched {};
template <typename, typename, typename> class awaitable_async_op_handler;
template <typename, typename, typename> class awaitable_async_op;

// An awaitable_thread represents a thread-of-execution that is composed of one
// or more "stack frames", with each frame represented by an awaitable_frame.
// All execution occurs in the context of the awaitable_thread's executor. An
// awaitable_thread continues to "pump" the stack frames by repeatedly resuming
// the top stack frame until the stack is empty, or until ownership of the
// stack is transferred to another awaitable_thread object.
//
//                +------------------------------------+
//                | top_of_stack_                      |
//                |                                    V
// +--------------+---+                            +-----------------+
// |                  |                            |                 |
// | awaitable_thread |<---------------------------+ awaitable_frame |
// |                  |           attached_thread_ |                 |
// +--------------+---+           (Set only when   +---+-------------+
//                |               frames are being     |
//                |               actively pumped      | caller_
//                |               by a thread, and     |
//                |               then only for        V
//                |               the top frame.)  +-----------------+
//                |                                |                 |
//                |                                | awaitable_frame |
//                |                                |                 |
//                |                                +---+-------------+
//                |                                    |
//                |                                    | caller_
//                |                                    :
//                |                                    :
//                |                                    |
//                |                                    V
//                |                                +-----------------+
//                | bottom_of_stack_               |                 |
//                +------------------------------->| awaitable_frame |
//                                                 |                 |
//                                                 +-----------------+

template <typename Executor>
class awaitable_frame_base
{
public:
#if !defined(ASIO_DISABLE_AWAITABLE_FRAME_RECYCLING)
  void* operator new(std::size_t size)
  {
    return asio::detail::thread_info_base::allocate(
        asio::detail::thread_info_base::awaitable_frame_tag(),
        asio::detail::thread_context::top_of_thread_call_stack(),
        size);
  }

  void operator delete(void* pointer, std::size_t size)
  {
    asio::detail::thread_info_base::deallocate(
        asio::detail::thread_info_base::awaitable_frame_tag(),
        asio::detail::thread_context::top_of_thread_call_stack(),
        pointer, size);
  }
#endif // !defined(ASIO_DISABLE_AWAITABLE_FRAME_RECYCLING)

  // The frame starts in a suspended state until the awaitable_thread object
  // pumps the stack.
  auto initial_suspend() noexcept
  {
    return suspend_always();
  }

  // On final suspension the frame is popped from the top of the stack.
  auto final_suspend() noexcept
  {
    struct result
    {
      awaitable_frame_base* this_;

      bool await_ready() const noexcept
      {
        return false;
      }

      void await_suspend(coroutine_handle<void>) noexcept
      {
        this->this_->pop_frame();
      }

      void await_resume() const noexcept
      {
      }
    };

    return result{this};
  }

  template <typename Disposition>
  void set_disposition(Disposition&& d) noexcept
  {
    pending_exception_ = (to_exception_ptr)(static_cast<Disposition&&>(d));
  }

  void unhandled_exception()
  {
    set_disposition(std::current_exception());
  }

  void rethrow_exception()
  {
    if (pending_exception_)
    {
      std::exception_ptr ex = std::exchange(pending_exception_, nullptr);
      std::rethrow_exception(ex);
    }
  }

  void clear_cancellation_slot()
  {
    this->attached_thread_->entry_point()->cancellation_state_.slot().clear();
  }

  template <typename T>
  auto await_transform(awaitable<T, Executor> a) const
  {
    if (attached_thread_->entry_point()->throw_if_cancelled_)
      if (!!attached_thread_->get_cancellation_state().cancelled())
        throw_error(asio::error::operation_aborted, "co_await");
    return a;
  }

  template <typename Op>
  auto await_transform(Op&& op,
      constraint_t<is_async_operation<Op>::value> = 0
#if defined(ASIO_ENABLE_HANDLER_TRACKING)
# if defined(ASIO_HAS_SOURCE_LOCATION)
      , detail::source_location location = detail::source_location::current()
# endif // defined(ASIO_HAS_SOURCE_LOCATION)
#endif // defined(ASIO_ENABLE_HANDLER_TRACKING)
    )
  {
    if (attached_thread_->entry_point()->throw_if_cancelled_)
      if (!!attached_thread_->get_cancellation_state().cancelled())
        throw_error(asio::error::operation_aborted, "co_await");

    return awaitable_async_op<
      completion_signature_of_t<Op>, decay_t<Op>, Executor>{
        std::forward<Op>(op), this
#if defined(ASIO_ENABLE_HANDLER_TRACKING)
# if defined(ASIO_HAS_SOURCE_LOCATION)
        , location
# endif // defined(ASIO_HAS_SOURCE_LOCATION)
#endif // defined(ASIO_ENABLE_HANDLER_TRACKING)
      };
  }

  // This await transformation obtains the associated executor of the thread of
  // execution.
  auto await_transform(this_coro::executor_t) noexcept
  {
    struct result
    {
      awaitable_frame_base* this_;

      bool await_ready() const noexcept
      {
        return true;
      }

      void await_suspend(coroutine_handle<void>) noexcept
      {
      }

      auto await_resume() const noexcept
      {
        return this_->attached_thread_->get_executor();
      }
    };

    return result{this};
  }

  // This await transformation obtains the associated cancellation state of the
  // thread of execution.
  auto await_transform(this_coro::cancellation_state_t) noexcept
  {
    struct result
    {
      awaitable_frame_base* this_;

      bool await_ready() const noexcept
      {
        return true;
      }

      void await_suspend(coroutine_handle<void>) noexcept
      {
      }

      auto await_resume() const noexcept
      {
        return this_->attached_thread_->get_cancellation_state();
      }
    };

    return result{this};
  }

  // This await transformation resets the associated cancellation state.
  auto await_transform(this_coro::reset_cancellation_state_0_t) noexcept
  {
    struct result
    {
      awaitable_frame_base* this_;

      bool await_ready() const noexcept
      {
        return true;
      }

      void await_suspend(coroutine_handle<void>) noexcept
      {
      }

      auto await_resume() const
      {
        return this_->attached_thread_->reset_cancellation_state();
      }
    };

    return result{this};
  }

  // This await transformation resets the associated cancellation state.
  template <typename Filter>
  auto await_transform(
      this_coro::reset_cancellation_state_1_t<Filter> reset) noexcept
  {
    struct result
    {
      awaitable_frame_base* this_;
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
        return this_->attached_thread_->reset_cancellation_state(
            static_cast<Filter&&>(filter_));
      }
    };

    return result{this, static_cast<Filter&&>(reset.filter)};
  }

  // This await transformation resets the associated cancellation state.
  template <typename InFilter, typename OutFilter>
  auto await_transform(
      this_coro::reset_cancellation_state_2_t<InFilter, OutFilter> reset)
    noexcept
  {
    struct result
    {
      awaitable_frame_base* this_;
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
        return this_->attached_thread_->reset_cancellation_state(
            static_cast<InFilter&&>(in_filter_),
            static_cast<OutFilter&&>(out_filter_));
      }
    };

    return result{this,
        static_cast<InFilter&&>(reset.in_filter),
        static_cast<OutFilter&&>(reset.out_filter)};
  }

  // This await transformation determines whether cancellation is propagated as
  // an exception.
  auto await_transform(this_coro::throw_if_cancelled_0_t)
    noexcept
  {
    struct result
    {
      awaitable_frame_base* this_;

      bool await_ready() const noexcept
      {
        return true;
      }

      void await_suspend(coroutine_handle<void>) noexcept
      {
      }

      auto await_resume()
      {
        return this_->attached_thread_->throw_if_cancelled();
      }
    };

    return result{this};
  }

  // This await transformation sets whether cancellation is propagated as an
  // exception.
  auto await_transform(this_coro::throw_if_cancelled_1_t throw_if_cancelled)
    noexcept
  {
    struct result
    {
      awaitable_frame_base* this_;
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
        this_->attached_thread_->throw_if_cancelled(value_);
      }
    };

    return result{this, throw_if_cancelled.value};
  }

  // This await transformation is used to run an async operation's initiation
  // function object after the coroutine has been suspended. This ensures that
  // immediate resumption of the coroutine in another thread does not cause a
  // race condition.
  template <typename Function>
  auto await_transform(Function f,
      enable_if_t<
        is_convertible<
          result_of_t<Function(awaitable_frame_base*)>,
          awaitable_thread<Executor>*
        >::value
      >* = nullptr)
  {
    struct result
    {
      Function function_;
      awaitable_frame_base* this_;

      bool await_ready() const noexcept
      {
        return false;
      }

      void await_suspend(coroutine_handle<void>) noexcept
      {
        this_->after_suspend(
            [](void* arg)
            {
              result* r = static_cast<result*>(arg);
              r->function_(r->this_);
            }, this);
      }

      void await_resume() const noexcept
      {
      }
    };

    return result{std::move(f), this};
  }

  // Access the awaitable thread's has_context_switched_ flag.
  auto await_transform(detail::awaitable_thread_has_context_switched) noexcept
  {
    struct result
    {
      awaitable_frame_base* this_;

      bool await_ready() const noexcept
      {
        return true;
      }

      void await_suspend(coroutine_handle<void>) noexcept
      {
      }

      bool& await_resume() const noexcept
      {
        return this_->attached_thread_->entry_point()->has_context_switched_;
      }
    };

    return result{this};
  }

  void attach_thread(awaitable_thread<Executor>* handler) noexcept
  {
    attached_thread_ = handler;
  }

  awaitable_thread<Executor>* detach_thread() noexcept
  {
    attached_thread_->entry_point()->has_context_switched_ = true;
    return std::exchange(attached_thread_, nullptr);
  }

  void push_frame(awaitable_frame_base<Executor>* caller) noexcept
  {
    caller_ = caller;
    attached_thread_ = caller_->attached_thread_;
    attached_thread_->entry_point()->top_of_stack_ = this;
    caller_->attached_thread_ = nullptr;
  }

  void pop_frame() noexcept
  {
    if (caller_)
      caller_->attached_thread_ = attached_thread_;
    attached_thread_->entry_point()->top_of_stack_ = caller_;
    attached_thread_ = nullptr;
    caller_ = nullptr;
  }

  struct resume_context
  {
    void (*after_suspend_fn_)(void*) = nullptr;
    void *after_suspend_arg_ = nullptr;
  };

  void resume()
  {
    resume_context context;
    resume_context_ = &context;
    coro_.resume();
    if (context.after_suspend_fn_)
      context.after_suspend_fn_(context.after_suspend_arg_);
  }

  void after_suspend(void (*fn)(void*), void* arg)
  {
    resume_context_->after_suspend_fn_ = fn;
    resume_context_->after_suspend_arg_ = arg;
  }

  void destroy()
  {
    coro_.destroy();
  }

protected:
  coroutine_handle<void> coro_ = nullptr;
  awaitable_thread<Executor>* attached_thread_ = nullptr;
  awaitable_frame_base<Executor>* caller_ = nullptr;
  std::exception_ptr pending_exception_ = nullptr;
  resume_context* resume_context_ = nullptr;
};

template <typename T, typename Executor>
class awaitable_frame
  : public awaitable_frame_base<Executor>
{
public:
  awaitable_frame() noexcept
  {
  }

  awaitable_frame(awaitable_frame&& other) noexcept
    : awaitable_frame_base<Executor>(std::move(other))
  {
  }

  ~awaitable_frame()
  {
    if (has_result_)
      std::launder(static_cast<T*>(static_cast<void*>(result_)))->~T();
  }

  awaitable<T, Executor> get_return_object() noexcept
  {
    this->coro_ = coroutine_handle<awaitable_frame>::from_promise(*this);
    return awaitable<T, Executor>(this);
  }

  template <typename U>
  void return_value(U&& u)
  {
    new (&result_) T(std::forward<U>(u));
    has_result_ = true;
  }

  template <typename... Us>
  void return_values(Us&&... us)
  {
    this->return_value(std::forward_as_tuple(std::forward<Us>(us)...));
  }

  T get()
  {
    this->caller_ = nullptr;
    this->rethrow_exception();
    return std::move(*std::launder(
          static_cast<T*>(static_cast<void*>(result_))));
  }

private:
  alignas(T) unsigned char result_[sizeof(T)];
  bool has_result_ = false;
};

template <typename Executor>
class awaitable_frame<void, Executor>
  : public awaitable_frame_base<Executor>
{
public:
  awaitable<void, Executor> get_return_object()
  {
    this->coro_ = coroutine_handle<awaitable_frame>::from_promise(*this);
    return awaitable<void, Executor>(this);
  }

  void return_void()
  {
  }

  void get()
  {
    this->caller_ = nullptr;
    this->rethrow_exception();
  }
};

struct awaitable_thread_entry_point {};

template <typename Executor>
class awaitable_frame<awaitable_thread_entry_point, Executor>
  : public awaitable_frame_base<Executor>
{
public:
  awaitable_frame()
    : top_of_stack_(0),
      has_executor_(false),
      has_context_switched_(false),
      throw_if_cancelled_(true)
  {
  }

  ~awaitable_frame()
  {
    if (has_executor_)
      u_.executor_.~Executor();
  }

  awaitable<awaitable_thread_entry_point, Executor> get_return_object()
  {
    this->coro_ = coroutine_handle<awaitable_frame>::from_promise(*this);
    return awaitable<awaitable_thread_entry_point, Executor>(this);
  }

  void return_void()
  {
  }

  void get()
  {
    this->caller_ = nullptr;
    this->rethrow_exception();
  }

private:
  template <typename> friend class awaitable_frame_base;
  template <typename, typename, typename>
    friend class awaitable_async_op_handler;
  template <typename, typename> friend class awaitable_handler_base;
  template <typename> friend class awaitable_thread;

  union u
  {
    u() {}
    ~u() {}
    char c_;
    Executor executor_;
  } u_;

  awaitable_frame_base<Executor>* top_of_stack_;
  asio::cancellation_slot parent_cancellation_slot_;
  asio::cancellation_state cancellation_state_;
  bool has_executor_;
  bool has_context_switched_;
  bool throw_if_cancelled_;
};

template <typename Executor>
class awaitable_thread
{
public:
  typedef Executor executor_type;
  typedef cancellation_slot cancellation_slot_type;

  // Construct from the entry point of a new thread of execution.
  awaitable_thread(awaitable<awaitable_thread_entry_point, Executor> p,
      const Executor& ex, cancellation_slot parent_cancel_slot,
      cancellation_state cancel_state)
    : bottom_of_stack_(std::move(p))
  {
    bottom_of_stack_.frame_->top_of_stack_ = bottom_of_stack_.frame_;
    new (&bottom_of_stack_.frame_->u_.executor_) Executor(ex);
    bottom_of_stack_.frame_->has_executor_ = true;
    bottom_of_stack_.frame_->parent_cancellation_slot_ = parent_cancel_slot;
    bottom_of_stack_.frame_->cancellation_state_ = cancel_state;
  }

  // Transfer ownership from another awaitable_thread.
  awaitable_thread(awaitable_thread&& other) noexcept
    : bottom_of_stack_(std::move(other.bottom_of_stack_))
  {
  }

  // Clean up with a last ditch effort to ensure the thread is unwound within
  // the context of the executor.
  ~awaitable_thread()
  {
    if (bottom_of_stack_.valid())
    {
      // Coroutine "stack unwinding" must be performed through the executor.
      auto* bottom_frame = bottom_of_stack_.frame_;
      (post)(bottom_frame->u_.executor_,
          [a = std::move(bottom_of_stack_)]() mutable
          {
            (void)awaitable<awaitable_thread_entry_point, Executor>(
                std::move(a));
          });
    }
  }

  awaitable_frame<awaitable_thread_entry_point, Executor>* entry_point()
  {
    return bottom_of_stack_.frame_;
  }

  executor_type get_executor() const noexcept
  {
    return bottom_of_stack_.frame_->u_.executor_;
  }

  cancellation_state get_cancellation_state() const noexcept
  {
    return bottom_of_stack_.frame_->cancellation_state_;
  }

  void reset_cancellation_state()
  {
    bottom_of_stack_.frame_->cancellation_state_ =
      cancellation_state(bottom_of_stack_.frame_->parent_cancellation_slot_);
  }

  template <typename Filter>
  void reset_cancellation_state(Filter&& filter)
  {
    bottom_of_stack_.frame_->cancellation_state_ =
      cancellation_state(bottom_of_stack_.frame_->parent_cancellation_slot_,
        static_cast<Filter&&>(filter));
  }

  template <typename InFilter, typename OutFilter>
  void reset_cancellation_state(InFilter&& in_filter,
      OutFilter&& out_filter)
  {
    bottom_of_stack_.frame_->cancellation_state_ =
      cancellation_state(bottom_of_stack_.frame_->parent_cancellation_slot_,
        static_cast<InFilter&&>(in_filter),
        static_cast<OutFilter&&>(out_filter));
  }

  bool throw_if_cancelled() const
  {
    return bottom_of_stack_.frame_->throw_if_cancelled_;
  }

  void throw_if_cancelled(bool value)
  {
    bottom_of_stack_.frame_->throw_if_cancelled_ = value;
  }

  cancellation_slot_type get_cancellation_slot() const noexcept
  {
    return bottom_of_stack_.frame_->cancellation_state_.slot();
  }

  // Launch a new thread of execution.
  void launch()
  {
    bottom_of_stack_.frame_->top_of_stack_->attach_thread(this);
    pump();
  }

protected:
  template <typename> friend class awaitable_frame_base;

  // Repeatedly resume the top stack frame until the stack is empty or until it
  // has been transferred to another resumable_thread object.
  void pump()
  {
    do
      bottom_of_stack_.frame_->top_of_stack_->resume();
    while (bottom_of_stack_.frame_ && bottom_of_stack_.frame_->top_of_stack_);

    if (bottom_of_stack_.frame_)
    {
      awaitable<awaitable_thread_entry_point, Executor> a(
          std::move(bottom_of_stack_));
      a.frame_->rethrow_exception();
    }
  }

  awaitable<awaitable_thread_entry_point, Executor> bottom_of_stack_;
};

template <typename Signature, typename Executor, typename = void>
class awaitable_async_op_handler;

template <typename R, typename Executor>
class awaitable_async_op_handler<R(), Executor>
  : public awaitable_thread<Executor>
{
public:
  struct result_type {};

  awaitable_async_op_handler(
      awaitable_thread<Executor>* h, result_type&)
    : awaitable_thread<Executor>(std::move(*h))
  {
  }

  void operator()()
  {
    this->entry_point()->top_of_stack_->attach_thread(this);
    this->entry_point()->top_of_stack_->clear_cancellation_slot();
    this->pump();
  }

  static void resume(result_type&)
  {
  }
};

template <typename R, typename T, typename Executor>
class awaitable_async_op_handler<R(T), Executor,
    enable_if_t<!is_disposition<T>::value>>
  : public awaitable_thread<Executor>
{
public:
  typedef T* result_type;

  awaitable_async_op_handler(
      awaitable_thread<Executor>* h, result_type& result)
    : awaitable_thread<Executor>(std::move(*h)),
      result_(result)
  {
  }

  void operator()(T result)
  {
    result_ = detail::addressof(result);
    this->entry_point()->top_of_stack_->attach_thread(this);
    this->entry_point()->top_of_stack_->clear_cancellation_slot();
    this->pump();
  }

  static T resume(result_type& result)
  {
    return std::move(*result);
  }

private:
  result_type& result_;
};

template <typename R, typename Disposition, typename Executor>
class awaitable_async_op_handler<R(Disposition), Executor,
    enable_if_t<is_disposition<Disposition>::value>>
  : public awaitable_thread<Executor>
{
public:
  typedef Disposition* result_type;

  awaitable_async_op_handler(
      awaitable_thread<Executor>* h, result_type& result)
    : awaitable_thread<Executor>(std::move(*h)),
      result_(result)
  {
  }

  void operator()(Disposition d)
  {
    result_ = detail::addressof(d);
    this->entry_point()->top_of_stack_->attach_thread(this);
    this->entry_point()->top_of_stack_->clear_cancellation_slot();
    this->pump();
  }

  static void resume(result_type& result)
  {
    if (*result != no_error)
    {
      Disposition d = std::exchange(*result, Disposition());
      asio::throw_exception(static_cast<Disposition&&>(d));
    }
  }

private:
  result_type& result_;
};

template <typename R, typename Disposition, typename T, typename Executor>
class awaitable_async_op_handler<R(Disposition, T), Executor,
    enable_if_t<is_disposition<Disposition>::value>>
  : public awaitable_thread<Executor>
{
public:
  struct result_type
  {
    Disposition* disposition_;
    T* value_;
  };

  awaitable_async_op_handler(
      awaitable_thread<Executor>* h, result_type& result)
    : awaitable_thread<Executor>(std::move(*h)),
      result_(result)
  {
  }

  void operator()(Disposition d, T value)
  {
    result_.disposition_ = detail::addressof(d);
    result_.value_ = detail::addressof(value);
    this->entry_point()->top_of_stack_->attach_thread(this);
    this->entry_point()->top_of_stack_->clear_cancellation_slot();
    this->pump();
  }

  static T resume(result_type& result)
  {
    if (*result.disposition_ != no_error)
    {
      Disposition d = std::exchange(*result.disposition_, Disposition());
      asio::throw_exception(static_cast<Disposition&&>(d));
    }
    return std::move(*result.value_);
  }

private:
  result_type& result_;
};

template <typename R, typename T, typename... Ts, typename Executor>
class awaitable_async_op_handler<R(T, Ts...), Executor,
    enable_if_t<!is_disposition<T>::value>>
  : public awaitable_thread<Executor>
{
public:
  typedef std::tuple<T, Ts...>* result_type;

  awaitable_async_op_handler(
      awaitable_thread<Executor>* h, result_type& result)
    : awaitable_thread<Executor>(std::move(*h)),
      result_(result)
  {
  }

  template <typename... Args>
  void operator()(Args&&... args)
  {
    std::tuple<T, Ts...> result(std::forward<Args>(args)...);
    result_ = detail::addressof(result);
    this->entry_point()->top_of_stack_->attach_thread(this);
    this->entry_point()->top_of_stack_->clear_cancellation_slot();
    this->pump();
  }

  static std::tuple<T, Ts...> resume(result_type& result)
  {
    return std::move(*result);
  }

private:
  result_type& result_;
};

template <typename R, typename Disposition, typename... Ts, typename Executor>
class awaitable_async_op_handler<R(Disposition, Ts...), Executor,
    enable_if_t<is_disposition<Disposition>::value>>
  : public awaitable_thread<Executor>
{
public:
  struct result_type
  {
    Disposition* disposition_;
    std::tuple<Ts...>* value_;
  };

  awaitable_async_op_handler(
      awaitable_thread<Executor>* h, result_type& result)
    : awaitable_thread<Executor>(std::move(*h)),
      result_(result)
  {
  }

  template <typename... Args>
  void operator()(Disposition d, Args&&... args)
  {
    result_.disposition_ = detail::addressof(d);
    std::tuple<Ts...> value(std::forward<Args>(args)...);
    result_.value_ = detail::addressof(value);
    this->entry_point()->top_of_stack_->attach_thread(this);
    this->entry_point()->top_of_stack_->clear_cancellation_slot();
    this->pump();
  }

  static std::tuple<Ts...> resume(result_type& result)
  {
    if (*result.disposition_ != no_error)
    {
      Disposition d = std::exchange(*result.disposition_, Disposition());
      asio::throw_exception(static_cast<Disposition&&>(d));
    }
    return std::move(*result.value_);
  }

private:
  result_type& result_;
};

template <typename Signature, typename Op, typename Executor>
class awaitable_async_op
{
public:
  typedef awaitable_async_op_handler<Signature, Executor> handler_type;

  awaitable_async_op(Op&& o, awaitable_frame_base<Executor>* frame
#if defined(ASIO_ENABLE_HANDLER_TRACKING)
# if defined(ASIO_HAS_SOURCE_LOCATION)
      , const detail::source_location& location
# endif // defined(ASIO_HAS_SOURCE_LOCATION)
#endif // defined(ASIO_ENABLE_HANDLER_TRACKING)
    )
    : op_(std::forward<Op>(o)),
      frame_(frame),
      result_()
#if defined(ASIO_ENABLE_HANDLER_TRACKING)
# if defined(ASIO_HAS_SOURCE_LOCATION)
    , location_(location)
# endif // defined(ASIO_HAS_SOURCE_LOCATION)
#endif // defined(ASIO_ENABLE_HANDLER_TRACKING)
  {
  }

  bool await_ready() const noexcept
  {
    return false;
  }

  void await_suspend(coroutine_handle<void>)
  {
    frame_->after_suspend(
        [](void* arg)
        {
          awaitable_async_op* self = static_cast<awaitable_async_op*>(arg);
#if defined(ASIO_ENABLE_HANDLER_TRACKING)
# if defined(ASIO_HAS_SOURCE_LOCATION)
          ASIO_HANDLER_LOCATION((self->location_.file_name(),
              self->location_.line(), self->location_.function_name()));
# endif // defined(ASIO_HAS_SOURCE_LOCATION)
#endif // defined(ASIO_ENABLE_HANDLER_TRACKING)
          std::forward<Op&&>(self->op_)(
              handler_type(self->frame_->detach_thread(), self->result_));
        }, this);
  }

  auto await_resume()
  {
    return handler_type::resume(result_);
  }

private:
  Op&& op_;
  awaitable_frame_base<Executor>* frame_;
  typename handler_type::result_type result_;
#if defined(ASIO_ENABLE_HANDLER_TRACKING)
# if defined(ASIO_HAS_SOURCE_LOCATION)
  detail::source_location location_;
# endif // defined(ASIO_HAS_SOURCE_LOCATION)
#endif // defined(ASIO_ENABLE_HANDLER_TRACKING)
};

} // namespace detail
} // namespace asio

#if !defined(GENERATING_DOCUMENTATION)
# if defined(ASIO_HAS_STD_COROUTINE)

namespace std {

template <typename T, typename Executor, typename... Args>
struct coroutine_traits<asio::awaitable<T, Executor>, Args...>
{
  typedef asio::detail::awaitable_frame<T, Executor> promise_type;
};

} // namespace std

# else // defined(ASIO_HAS_STD_COROUTINE)

namespace std { namespace experimental {

template <typename T, typename Executor, typename... Args>
struct coroutine_traits<asio::awaitable<T, Executor>, Args...>
{
  typedef asio::detail::awaitable_frame<T, Executor> promise_type;
};

}} // namespace std::experimental

# endif // defined(ASIO_HAS_STD_COROUTINE)
#endif // !defined(GENERATING_DOCUMENTATION)

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IMPL_AWAITABLE_HPP
