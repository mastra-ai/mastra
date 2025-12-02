//
// detail/impl/strand_executor_service.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_IMPL_STRAND_EXECUTOR_SERVICE_HPP
#define ASIO_DETAIL_IMPL_STRAND_EXECUTOR_SERVICE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/fenced_block.hpp"
#include "asio/detail/recycling_allocator.hpp"
#include "asio/executor_work_guard.hpp"
#include "asio/defer.hpp"
#include "asio/dispatch.hpp"
#include "asio/post.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

template <typename F, typename Allocator>
class strand_executor_service::allocator_binder
{
public:
  typedef Allocator allocator_type;

  allocator_binder(F&& f, const Allocator& a)
    : f_(static_cast<F&&>(f)),
      allocator_(a)
  {
  }

  allocator_binder(const allocator_binder& other)
    : f_(other.f_),
      allocator_(other.allocator_)
  {
  }

  allocator_binder(allocator_binder&& other)
    : f_(static_cast<F&&>(other.f_)),
      allocator_(static_cast<allocator_type&&>(other.allocator_))
  {
  }

  allocator_type get_allocator() const noexcept
  {
    return allocator_;
  }

  void operator()()
  {
    f_();
  }

private:
  F f_;
  allocator_type allocator_;
};

template <typename Executor>
class strand_executor_service::invoker<Executor,
    enable_if_t<
      execution::is_executor<Executor>::value
    >>
{
public:
  invoker(const implementation_type& impl, Executor& ex)
    : impl_(impl),
      executor_(asio::prefer(ex, execution::outstanding_work.tracked))
  {
  }

  invoker(const invoker& other)
    : impl_(other.impl_),
      executor_(other.executor_)
  {
  }

  invoker(invoker&& other)
    : impl_(static_cast<implementation_type&&>(other.impl_)),
      executor_(static_cast<executor_type&&>(other.executor_))
  {
  }

  struct on_invoker_exit
  {
    invoker* this_;

    ~on_invoker_exit()
    {
      if (push_waiting_to_ready(this_->impl_))
      {
        recycling_allocator<void> allocator;
        executor_type ex = this_->executor_;
        asio::prefer(
            asio::require(
              static_cast<executor_type&&>(ex),
              execution::blocking.never),
            execution::allocator(allocator)
          ).execute(static_cast<invoker&&>(*this_));
      }
    }
  };

  void operator()()
  {
    // Ensure the next handler, if any, is scheduled on block exit.
    on_invoker_exit on_exit = { this };
    (void)on_exit;

    run_ready_handlers(impl_);
  }

private:
  typedef decay_t<
      prefer_result_t<
        Executor,
        execution::outstanding_work_t::tracked_t
      >
    > executor_type;

  implementation_type impl_;
  executor_type executor_;
};

#if !defined(ASIO_NO_TS_EXECUTORS)

template <typename Executor>
class strand_executor_service::invoker<Executor,
    enable_if_t<
      !execution::is_executor<Executor>::value
    >>
{
public:
  invoker(const implementation_type& impl, Executor& ex)
    : impl_(impl),
      work_(ex)
  {
  }

  invoker(const invoker& other)
    : impl_(other.impl_),
      work_(other.work_)
  {
  }

  invoker(invoker&& other)
    : impl_(static_cast<implementation_type&&>(other.impl_)),
      work_(static_cast<executor_work_guard<Executor>&&>(other.work_))
  {
  }

  struct on_invoker_exit
  {
    invoker* this_;

    ~on_invoker_exit()
    {
      if (push_waiting_to_ready(this_->impl_))
      {
        Executor ex(this_->work_.get_executor());
        recycling_allocator<void> allocator;
        ex.post(static_cast<invoker&&>(*this_), allocator);
      }
    }
  };

  void operator()()
  {
    // Ensure the next handler, if any, is scheduled on block exit.
    on_invoker_exit on_exit = { this };
    (void)on_exit;

    run_ready_handlers(impl_);
  }

private:
  implementation_type impl_;
  executor_work_guard<Executor> work_;
};

#endif // !defined(ASIO_NO_TS_EXECUTORS)

template <typename Executor, typename Function>
inline void strand_executor_service::execute(const implementation_type& impl,
    Executor& ex, Function&& function,
    enable_if_t<
      can_query<Executor, execution::allocator_t<void>>::value
    >*)
{
  return strand_executor_service::do_execute(impl, ex,
      static_cast<Function&&>(function),
      asio::query(ex, execution::allocator));
}

template <typename Executor, typename Function>
inline void strand_executor_service::execute(const implementation_type& impl,
    Executor& ex, Function&& function,
    enable_if_t<
      !can_query<Executor, execution::allocator_t<void>>::value
    >*)
{
  return strand_executor_service::do_execute(impl, ex,
      static_cast<Function&&>(function),
      std::allocator<void>());
}

template <typename Executor, typename Function, typename Allocator>
void strand_executor_service::do_execute(const implementation_type& impl,
    Executor& ex, Function&& function, const Allocator& a)
{
  typedef decay_t<Function> function_type;

  // If the executor is not never-blocking, and we are already in the strand,
  // then the function can run immediately.
  if (asio::query(ex, execution::blocking) != execution::blocking.never
      && running_in_this_thread(impl))
  {
    // Make a local, non-const copy of the function.
    function_type tmp(static_cast<Function&&>(function));

    fenced_block b(fenced_block::full);
    static_cast<function_type&&>(tmp)();
    return;
  }

  // Allocate and construct an operation to wrap the function.
  typedef executor_op<function_type, Allocator> op;
  typename op::ptr p = { detail::addressof(a), op::ptr::allocate(a), 0 };
  p.p = new (p.v) op(static_cast<Function&&>(function), a);

  ASIO_HANDLER_CREATION((impl->service_->context(), *p.p,
        "strand_executor", impl.get(), 0, "execute"));

  // Add the function to the strand and schedule the strand if required.
  bool first = enqueue(impl, p.p);
  p.v = p.p = 0;
  if (first)
  {
    ex.execute(invoker<Executor>(impl, ex));
  }
}

template <typename Executor, typename Function, typename Allocator>
void strand_executor_service::dispatch(const implementation_type& impl,
    Executor& ex, Function&& function, const Allocator& a)
{
  typedef decay_t<Function> function_type;

  // If we are already in the strand then the function can run immediately.
  if (running_in_this_thread(impl))
  {
    // Make a local, non-const copy of the function.
    function_type tmp(static_cast<Function&&>(function));

    fenced_block b(fenced_block::full);
    static_cast<function_type&&>(tmp)();
    return;
  }

  // Allocate and construct an operation to wrap the function.
  typedef executor_op<function_type, Allocator> op;
  typename op::ptr p = { detail::addressof(a), op::ptr::allocate(a), 0 };
  p.p = new (p.v) op(static_cast<Function&&>(function), a);

  ASIO_HANDLER_CREATION((impl->service_->context(), *p.p,
        "strand_executor", impl.get(), 0, "dispatch"));

  // Add the function to the strand and schedule the strand if required.
  bool first = enqueue(impl, p.p);
  p.v = p.p = 0;
  if (first)
  {
    asio::dispatch(ex,
        allocator_binder<invoker<Executor>, Allocator>(
          invoker<Executor>(impl, ex), a));
  }
}

// Request invocation of the given function and return immediately.
template <typename Executor, typename Function, typename Allocator>
void strand_executor_service::post(const implementation_type& impl,
    Executor& ex, Function&& function, const Allocator& a)
{
  typedef decay_t<Function> function_type;

  // Allocate and construct an operation to wrap the function.
  typedef executor_op<function_type, Allocator> op;
  typename op::ptr p = { detail::addressof(a), op::ptr::allocate(a), 0 };
  p.p = new (p.v) op(static_cast<Function&&>(function), a);

  ASIO_HANDLER_CREATION((impl->service_->context(), *p.p,
        "strand_executor", impl.get(), 0, "post"));

  // Add the function to the strand and schedule the strand if required.
  bool first = enqueue(impl, p.p);
  p.v = p.p = 0;
  if (first)
  {
    asio::post(ex,
        allocator_binder<invoker<Executor>, Allocator>(
          invoker<Executor>(impl, ex), a));
  }
}

// Request invocation of the given function and return immediately.
template <typename Executor, typename Function, typename Allocator>
void strand_executor_service::defer(const implementation_type& impl,
    Executor& ex, Function&& function, const Allocator& a)
{
  typedef decay_t<Function> function_type;

  // Allocate and construct an operation to wrap the function.
  typedef executor_op<function_type, Allocator> op;
  typename op::ptr p = { detail::addressof(a), op::ptr::allocate(a), 0 };
  p.p = new (p.v) op(static_cast<Function&&>(function), a);

  ASIO_HANDLER_CREATION((impl->service_->context(), *p.p,
        "strand_executor", impl.get(), 0, "defer"));

  // Add the function to the strand and schedule the strand if required.
  bool first = enqueue(impl, p.p);
  p.v = p.p = 0;
  if (first)
  {
    asio::defer(ex,
        allocator_binder<invoker<Executor>, Allocator>(
          invoker<Executor>(impl, ex), a));
  }
}

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DETAIL_IMPL_STRAND_EXECUTOR_SERVICE_HPP
