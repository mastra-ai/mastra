//
// impl/thread_pool.hpp
// ~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_THREAD_POOL_HPP
#define ASIO_IMPL_THREAD_POOL_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/blocking_executor_op.hpp"
#include "asio/detail/executor_op.hpp"
#include "asio/detail/fenced_block.hpp"
#include "asio/detail/non_const_lvalue.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/execution_context.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

inline thread_pool::executor_type
thread_pool::get_executor() noexcept
{
  return executor_type(*this);
}

inline thread_pool::executor_type
thread_pool::executor() noexcept
{
  return executor_type(*this);
}

template <typename Allocator, unsigned int Bits>
thread_pool::basic_executor_type<Allocator, Bits>&
thread_pool::basic_executor_type<Allocator, Bits>::operator=(
    const basic_executor_type& other) noexcept
{
  if (this != &other)
  {
    thread_pool* old_thread_pool = pool_;
    pool_ = other.pool_;
    allocator_ = other.allocator_;
    bits_ = other.bits_;
    if (Bits & outstanding_work_tracked)
    {
      if (pool_)
        pool_->scheduler_.work_started();
      if (old_thread_pool)
        old_thread_pool->scheduler_.work_finished();
    }
  }
  return *this;
}

template <typename Allocator, unsigned int Bits>
thread_pool::basic_executor_type<Allocator, Bits>&
thread_pool::basic_executor_type<Allocator, Bits>::operator=(
    basic_executor_type&& other) noexcept
{
  if (this != &other)
  {
    thread_pool* old_thread_pool = pool_;
    pool_ = other.pool_;
    allocator_ = std::move(other.allocator_);
    bits_ = other.bits_;
    if (Bits & outstanding_work_tracked)
    {
      other.pool_ = 0;
      if (old_thread_pool)
        old_thread_pool->scheduler_.work_finished();
    }
  }
  return *this;
}

template <typename Allocator, unsigned int Bits>
inline bool thread_pool::basic_executor_type<Allocator,
    Bits>::running_in_this_thread() const noexcept
{
  return pool_->scheduler_.can_dispatch();
}

template <typename Allocator, unsigned int Bits>
template <typename Function>
void thread_pool::basic_executor_type<Allocator,
    Bits>::do_execute(Function&& f, false_type) const
{
  typedef decay_t<Function> function_type;

  // Invoke immediately if the blocking.possibly property is enabled and we are
  // already inside the thread pool.
  if ((bits_ & blocking_never) == 0 && pool_->scheduler_.can_dispatch())
  {
    // Make a local, non-const copy of the function.
    function_type tmp(static_cast<Function&&>(f));

#if !defined(ASIO_NO_EXCEPTIONS)
    try
    {
#endif // !defined(ASIO_NO_EXCEPTIONS)
      detail::fenced_block b(detail::fenced_block::full);
      static_cast<function_type&&>(tmp)();
      return;
#if !defined(ASIO_NO_EXCEPTIONS)
    }
    catch (...)
    {
      pool_->scheduler_.capture_current_exception();
      return;
    }
#endif // !defined(ASIO_NO_EXCEPTIONS)
  }

  // Allocate and construct an operation to wrap the function.
  typedef detail::executor_op<function_type, Allocator> op;
  typename op::ptr p = { detail::addressof(allocator_),
      op::ptr::allocate(allocator_), 0 };
  p.p = new (p.v) op(static_cast<Function&&>(f), allocator_);

  if ((bits_ & relationship_continuation) != 0)
  {
    ASIO_HANDLER_CREATION((*pool_, *p.p,
          "thread_pool", pool_, 0, "execute(blk=never,rel=cont)"));
  }
  else
  {
    ASIO_HANDLER_CREATION((*pool_, *p.p,
          "thread_pool", pool_, 0, "execute(blk=never,rel=fork)"));
  }

  pool_->scheduler_.post_immediate_completion(p.p,
      (bits_ & relationship_continuation) != 0);
  p.v = p.p = 0;
}

template <typename Allocator, unsigned int Bits>
template <typename Function>
void thread_pool::basic_executor_type<Allocator,
    Bits>::do_execute(Function&& f, true_type) const
{
  // Obtain a non-const instance of the function.
  detail::non_const_lvalue<Function> f2(f);

  // Invoke immediately if we are already inside the thread pool.
  if (pool_->scheduler_.can_dispatch())
  {
#if !defined(ASIO_NO_EXCEPTIONS)
    try
    {
#endif // !defined(ASIO_NO_EXCEPTIONS)
      detail::fenced_block b(detail::fenced_block::full);
      static_cast<decay_t<Function>&&>(f2.value)();
      return;
#if !defined(ASIO_NO_EXCEPTIONS)
    }
    catch (...)
    {
      std::terminate();
    }
#endif // !defined(ASIO_NO_EXCEPTIONS)
  }

  // Construct an operation to wrap the function.
  typedef decay_t<Function> function_type;
  detail::blocking_executor_op<function_type> op(f2.value);

  ASIO_HANDLER_CREATION((*pool_, op,
        "thread_pool", pool_, 0, "execute(blk=always)"));

  pool_->scheduler_.post_immediate_completion(&op, false);
  op.wait();
}

#if !defined(ASIO_NO_TS_EXECUTORS)
template <typename Allocator, unsigned int Bits>
inline thread_pool& thread_pool::basic_executor_type<
    Allocator, Bits>::context() const noexcept
{
  return *pool_;
}

template <typename Allocator, unsigned int Bits>
inline void thread_pool::basic_executor_type<Allocator,
    Bits>::on_work_started() const noexcept
{
  pool_->scheduler_.work_started();
}

template <typename Allocator, unsigned int Bits>
inline void thread_pool::basic_executor_type<Allocator,
    Bits>::on_work_finished() const noexcept
{
  pool_->scheduler_.work_finished();
}

template <typename Allocator, unsigned int Bits>
template <typename Function, typename OtherAllocator>
void thread_pool::basic_executor_type<Allocator, Bits>::dispatch(
    Function&& f, const OtherAllocator& a) const
{
  typedef decay_t<Function> function_type;

  // Invoke immediately if we are already inside the thread pool.
  if (pool_->scheduler_.can_dispatch())
  {
    // Make a local, non-const copy of the function.
    function_type tmp(static_cast<Function&&>(f));

    detail::fenced_block b(detail::fenced_block::full);
    static_cast<function_type&&>(tmp)();
    return;
  }

  // Allocate and construct an operation to wrap the function.
  typedef detail::executor_op<function_type, OtherAllocator> op;
  typename op::ptr p = { detail::addressof(a), op::ptr::allocate(a), 0 };
  p.p = new (p.v) op(static_cast<Function&&>(f), a);

  ASIO_HANDLER_CREATION((*pool_, *p.p,
        "thread_pool", pool_, 0, "dispatch"));

  pool_->scheduler_.post_immediate_completion(p.p, false);
  p.v = p.p = 0;
}

template <typename Allocator, unsigned int Bits>
template <typename Function, typename OtherAllocator>
void thread_pool::basic_executor_type<Allocator, Bits>::post(
    Function&& f, const OtherAllocator& a) const
{
  typedef decay_t<Function> function_type;

  // Allocate and construct an operation to wrap the function.
  typedef detail::executor_op<function_type, OtherAllocator> op;
  typename op::ptr p = { detail::addressof(a), op::ptr::allocate(a), 0 };
  p.p = new (p.v) op(static_cast<Function&&>(f), a);

  ASIO_HANDLER_CREATION((*pool_, *p.p,
        "thread_pool", pool_, 0, "post"));

  pool_->scheduler_.post_immediate_completion(p.p, false);
  p.v = p.p = 0;
}

template <typename Allocator, unsigned int Bits>
template <typename Function, typename OtherAllocator>
void thread_pool::basic_executor_type<Allocator, Bits>::defer(
    Function&& f, const OtherAllocator& a) const
{
  typedef decay_t<Function> function_type;

  // Allocate and construct an operation to wrap the function.
  typedef detail::executor_op<function_type, OtherAllocator> op;
  typename op::ptr p = { detail::addressof(a), op::ptr::allocate(a), 0 };
  p.p = new (p.v) op(static_cast<Function&&>(f), a);

  ASIO_HANDLER_CREATION((*pool_, *p.p,
        "thread_pool", pool_, 0, "defer"));

  pool_->scheduler_.post_immediate_completion(p.p, true);
  p.v = p.p = 0;
}
#endif // !defined(ASIO_NO_TS_EXECUTORS)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IMPL_THREAD_POOL_HPP
