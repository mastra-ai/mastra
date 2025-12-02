//
// impl/system_executor.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_SYSTEM_EXECUTOR_HPP
#define ASIO_IMPL_SYSTEM_EXECUTOR_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/executor_op.hpp"
#include "asio/detail/global.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/system_context.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

template <typename Blocking, typename Relationship, typename Allocator>
inline system_context&
basic_system_executor<Blocking, Relationship, Allocator>::query(
    execution::context_t) noexcept
{
  return detail::global<system_context>();
}

template <typename Blocking, typename Relationship, typename Allocator>
inline std::size_t
basic_system_executor<Blocking, Relationship, Allocator>::query(
    execution::occupancy_t) const noexcept
{
  return detail::global<system_context>().num_threads_;
}

template <typename Blocking, typename Relationship, typename Allocator>
template <typename Function>
inline void
basic_system_executor<Blocking, Relationship, Allocator>::do_execute(
    Function&& f, execution::blocking_t::possibly_t) const
{
  // Obtain a non-const instance of the function.
  detail::non_const_lvalue<Function> f2(f);

#if !defined(ASIO_NO_EXCEPTIONS)
  try
  {
#endif// !defined(ASIO_NO_EXCEPTIONS)
    detail::fenced_block b(detail::fenced_block::full);
    static_cast<decay_t<Function>&&>(f2.value)();
#if !defined(ASIO_NO_EXCEPTIONS)
  }
  catch (...)
  {
    std::terminate();
  }
#endif// !defined(ASIO_NO_EXCEPTIONS)
}

template <typename Blocking, typename Relationship, typename Allocator>
template <typename Function>
inline void
basic_system_executor<Blocking, Relationship, Allocator>::do_execute(
    Function&& f, execution::blocking_t::always_t) const
{
  // Obtain a non-const instance of the function.
  detail::non_const_lvalue<Function> f2(f);

#if !defined(ASIO_NO_EXCEPTIONS)
  try
  {
#endif// !defined(ASIO_NO_EXCEPTIONS)
    detail::fenced_block b(detail::fenced_block::full);
    static_cast<decay_t<Function>&&>(f2.value)();
#if !defined(ASIO_NO_EXCEPTIONS)
  }
  catch (...)
  {
    std::terminate();
  }
#endif// !defined(ASIO_NO_EXCEPTIONS)
}

template <typename Blocking, typename Relationship, typename Allocator>
template <typename Function>
void basic_system_executor<Blocking, Relationship, Allocator>::do_execute(
    Function&& f, execution::blocking_t::never_t) const
{
  system_context& ctx = detail::global<system_context>();

  // Allocate and construct an operation to wrap the function.
  typedef detail::executor_op<decay_t<Function>, Allocator> op;
  typename op::ptr p = { detail::addressof(allocator_),
      op::ptr::allocate(allocator_), 0 };
  p.p = new (p.v) op(static_cast<Function&&>(f), allocator_);

  if (is_same<Relationship, execution::relationship_t::continuation_t>::value)
  {
    ASIO_HANDLER_CREATION((ctx, *p.p,
          "system_executor", &ctx, 0, "execute(blk=never,rel=cont)"));
  }
  else
  {
    ASIO_HANDLER_CREATION((ctx, *p.p,
          "system_executor", &ctx, 0, "execute(blk=never,rel=fork)"));
  }

  ctx.scheduler_.post_immediate_completion(p.p,
      is_same<Relationship, execution::relationship_t::continuation_t>::value);
  p.v = p.p = 0;
}

#if !defined(ASIO_NO_TS_EXECUTORS)
template <typename Blocking, typename Relationship, typename Allocator>
inline system_context& basic_system_executor<
    Blocking, Relationship, Allocator>::context() const noexcept
{
  return detail::global<system_context>();
}

template <typename Blocking, typename Relationship, typename Allocator>
template <typename Function, typename OtherAllocator>
void basic_system_executor<Blocking, Relationship, Allocator>::dispatch(
    Function&& f, const OtherAllocator&) const
{
  decay_t<Function>(static_cast<Function&&>(f))();
}

template <typename Blocking, typename Relationship, typename Allocator>
template <typename Function, typename OtherAllocator>
void basic_system_executor<Blocking, Relationship, Allocator>::post(
    Function&& f, const OtherAllocator& a) const
{
  system_context& ctx = detail::global<system_context>();

  // Allocate and construct an operation to wrap the function.
  typedef detail::executor_op<decay_t<Function>, OtherAllocator> op;
  typename op::ptr p = { detail::addressof(a), op::ptr::allocate(a), 0 };
  p.p = new (p.v) op(static_cast<Function&&>(f), a);

  ASIO_HANDLER_CREATION((ctx, *p.p,
        "system_executor", &this->context(), 0, "post"));

  ctx.scheduler_.post_immediate_completion(p.p, false);
  p.v = p.p = 0;
}

template <typename Blocking, typename Relationship, typename Allocator>
template <typename Function, typename OtherAllocator>
void basic_system_executor<Blocking, Relationship, Allocator>::defer(
    Function&& f, const OtherAllocator& a) const
{
  system_context& ctx = detail::global<system_context>();

  // Allocate and construct an operation to wrap the function.
  typedef detail::executor_op<decay_t<Function>, OtherAllocator> op;
  typename op::ptr p = { detail::addressof(a), op::ptr::allocate(a), 0 };
  p.p = new (p.v) op(static_cast<Function&&>(f), a);

  ASIO_HANDLER_CREATION((ctx, *p.p,
        "system_executor", &this->context(), 0, "defer"));

  ctx.scheduler_.post_immediate_completion(p.p, true);
  p.v = p.p = 0;
}
#endif // !defined(ASIO_NO_TS_EXECUTORS)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IMPL_SYSTEM_EXECUTOR_HPP
