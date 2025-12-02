//
// impl/executor.hpp
// ~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_EXECUTOR_HPP
#define ASIO_IMPL_EXECUTOR_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if !defined(ASIO_NO_TS_EXECUTORS)

#include <new>
#include "asio/detail/atomic_count.hpp"
#include "asio/detail/global.hpp"
#include "asio/detail/memory.hpp"
#include "asio/executor.hpp"
#include "asio/system_executor.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

#if !defined(GENERATING_DOCUMENTATION)

// Default polymorphic executor implementation.
template <typename Executor, typename Allocator>
class executor::impl
  : public executor::impl_base
{
public:
  typedef ASIO_REBIND_ALLOC(Allocator, impl) allocator_type;

  static impl_base* create(const Executor& e, Allocator a = Allocator())
  {
    raw_mem mem(a);
    impl* p = new (mem.ptr_) impl(e, a);
    mem.ptr_ = 0;
    return p;
  }

  static impl_base* create(std::nothrow_t, const Executor& e) noexcept
  {
    return new (std::nothrow) impl(e, std::allocator<void>());
  }

  impl(const Executor& e, const Allocator& a) noexcept
    : impl_base(false),
      ref_count_(1),
      executor_(e),
      allocator_(a)
  {
  }

  impl_base* clone() const noexcept
  {
    detail::ref_count_up(ref_count_);
    return const_cast<impl_base*>(static_cast<const impl_base*>(this));
  }

  void destroy() noexcept
  {
    if (detail::ref_count_down(ref_count_))
    {
      allocator_type alloc(allocator_);
      impl* p = this;
      p->~impl();
      alloc.deallocate(p, 1);
    }
  }

  void on_work_started() noexcept
  {
    executor_.on_work_started();
  }

  void on_work_finished() noexcept
  {
    executor_.on_work_finished();
  }

  execution_context& context() noexcept
  {
    return executor_.context();
  }

  void dispatch(function&& f)
  {
    executor_.dispatch(static_cast<function&&>(f), allocator_);
  }

  void post(function&& f)
  {
    executor_.post(static_cast<function&&>(f), allocator_);
  }

  void defer(function&& f)
  {
    executor_.defer(static_cast<function&&>(f), allocator_);
  }

  type_id_result_type target_type() const noexcept
  {
    return type_id<Executor>();
  }

  void* target() noexcept
  {
    return &executor_;
  }

  const void* target() const noexcept
  {
    return &executor_;
  }

  bool equals(const impl_base* e) const noexcept
  {
    if (this == e)
      return true;
    if (target_type() != e->target_type())
      return false;
    return executor_ == *static_cast<const Executor*>(e->target());
  }

private:
  mutable detail::atomic_count ref_count_;
  Executor executor_;
  Allocator allocator_;

  struct raw_mem
  {
    allocator_type allocator_;
    impl* ptr_;

    explicit raw_mem(const Allocator& a)
      : allocator_(a),
        ptr_(allocator_.allocate(1))
    {
    }

    ~raw_mem()
    {
      if (ptr_)
        allocator_.deallocate(ptr_, 1);
    }

  private:
    // Disallow copying and assignment.
    raw_mem(const raw_mem&);
    raw_mem operator=(const raw_mem&);
  };
};

// Polymorphic executor specialisation for system_executor.
template <typename Allocator>
class executor::impl<system_executor, Allocator>
  : public executor::impl_base
{
public:
  static impl_base* create(const system_executor&,
      const Allocator& = Allocator())
  {
    return &detail::global<impl<system_executor, std::allocator<void>> >();
  }

  static impl_base* create(std::nothrow_t, const system_executor&) noexcept
  {
    return &detail::global<impl<system_executor, std::allocator<void>> >();
  }

  impl()
    : impl_base(true)
  {
  }

  impl_base* clone() const noexcept
  {
    return const_cast<impl_base*>(static_cast<const impl_base*>(this));
  }

  void destroy() noexcept
  {
  }

  void on_work_started() noexcept
  {
    executor_.on_work_started();
  }

  void on_work_finished() noexcept
  {
    executor_.on_work_finished();
  }

  execution_context& context() noexcept
  {
    return executor_.context();
  }

  void dispatch(function&& f)
  {
    executor_.dispatch(static_cast<function&&>(f),
        std::allocator<void>());
  }

  void post(function&& f)
  {
    executor_.post(static_cast<function&&>(f),
        std::allocator<void>());
  }

  void defer(function&& f)
  {
    executor_.defer(static_cast<function&&>(f),
        std::allocator<void>());
  }

  type_id_result_type target_type() const noexcept
  {
    return type_id<system_executor>();
  }

  void* target() noexcept
  {
    return &executor_;
  }

  const void* target() const noexcept
  {
    return &executor_;
  }

  bool equals(const impl_base* e) const noexcept
  {
    return this == e;
  }

private:
  system_executor executor_;
};

template <typename Executor>
executor::executor(Executor e)
  : impl_(impl<Executor, std::allocator<void>>::create(e))
{
}

template <typename Executor>
executor::executor(std::nothrow_t, Executor e) noexcept
  : impl_(impl<Executor, std::allocator<void>>::create(std::nothrow, e))
{
}

template <typename Executor, typename Allocator>
executor::executor(allocator_arg_t, const Allocator& a, Executor e)
  : impl_(impl<Executor, Allocator>::create(e, a))
{
}

template <typename Function, typename Allocator>
void executor::dispatch(Function&& f,
    const Allocator& a) const
{
  impl_base* i = get_impl();
  if (i->fast_dispatch_)
    system_executor().dispatch(static_cast<Function&&>(f), a);
  else
    i->dispatch(function(static_cast<Function&&>(f), a));
}

template <typename Function, typename Allocator>
void executor::post(Function&& f,
    const Allocator& a) const
{
  get_impl()->post(function(static_cast<Function&&>(f), a));
}

template <typename Function, typename Allocator>
void executor::defer(Function&& f,
    const Allocator& a) const
{
  get_impl()->defer(function(static_cast<Function&&>(f), a));
}

template <typename Executor>
Executor* executor::target() noexcept
{
  return impl_ && impl_->target_type() == type_id<Executor>()
    ? static_cast<Executor*>(impl_->target()) : 0;
}

template <typename Executor>
const Executor* executor::target() const noexcept
{
  return impl_ && impl_->target_type() == type_id<Executor>()
    ? static_cast<Executor*>(impl_->target()) : 0;
}

#endif // !defined(GENERATING_DOCUMENTATION)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // !defined(ASIO_NO_TS_EXECUTORS)

#endif // ASIO_IMPL_EXECUTOR_HPP
