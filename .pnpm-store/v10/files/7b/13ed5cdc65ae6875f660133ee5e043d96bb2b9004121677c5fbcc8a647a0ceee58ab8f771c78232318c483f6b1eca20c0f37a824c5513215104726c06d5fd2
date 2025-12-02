//
// detail/executor_function.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_EXECUTOR_FUNCTION_HPP
#define ASIO_DETAIL_EXECUTOR_FUNCTION_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/handler_alloc_helpers.hpp"
#include "asio/detail/memory.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

// Lightweight, move-only function object wrapper.
class executor_function
{
public:
  template <typename F, typename Alloc>
  explicit executor_function(F f, const Alloc& a)
  {
    // Allocate and construct an object to wrap the function.
    typedef impl<F, Alloc> impl_type;
    typename impl_type::ptr p = {
      detail::addressof(a), impl_type::ptr::allocate(a), 0 };
    impl_ = new (p.v) impl_type(static_cast<F&&>(f), a);
    p.v = 0;
  }

  executor_function(executor_function&& other) noexcept
    : impl_(other.impl_)
  {
    other.impl_ = 0;
  }

  ~executor_function()
  {
    if (impl_)
      impl_->complete_(impl_, false);
  }

  void operator()()
  {
    if (impl_)
    {
      impl_base* i = impl_;
      impl_ = 0;
      i->complete_(i, true);
    }
  }

private:
  // Base class for polymorphic function implementations.
  struct impl_base
  {
    void (*complete_)(impl_base*, bool);
  };

  // Polymorphic function implementation.
  template <typename Function, typename Alloc>
  struct impl : impl_base
  {
    ASIO_DEFINE_TAGGED_HANDLER_ALLOCATOR_PTR(
        thread_info_base::executor_function_tag, impl);

    template <typename F>
    impl(F&& f, const Alloc& a)
      : function_(static_cast<F&&>(f)),
        allocator_(a)
    {
      complete_ = &executor_function::complete<Function, Alloc>;
    }

    Function function_;
    Alloc allocator_;
  };

  // Helper to complete function invocation.
  template <typename Function, typename Alloc>
  static void complete(impl_base* base, bool call)
  {
    // Take ownership of the function object.
    impl<Function, Alloc>* i(static_cast<impl<Function, Alloc>*>(base));
    Alloc allocator(i->allocator_);
    typename impl<Function, Alloc>::ptr p = {
      detail::addressof(allocator), i, i };

    // Make a copy of the function so that the memory can be deallocated before
    // the upcall is made. Even if we're not about to make an upcall, a
    // sub-object of the function may be the true owner of the memory
    // associated with the function. Consequently, a local copy of the function
    // is required to ensure that any owning sub-object remains valid until
    // after we have deallocated the memory here.
    Function function(static_cast<Function&&>(i->function_));
    p.reset();

    // Make the upcall if required.
    if (call)
    {
      static_cast<Function&&>(function)();
    }
  }

  impl_base* impl_;
};

// Lightweight, non-owning, copyable function object wrapper.
class executor_function_view
{
public:
  template <typename F>
  explicit executor_function_view(F& f) noexcept
    : complete_(&executor_function_view::complete<F>),
      function_(&f)
  {
  }

  void operator()()
  {
    complete_(function_);
  }

private:
  // Helper to complete function invocation.
  template <typename F>
  static void complete(void* f)
  {
    (*static_cast<F*>(f))();
  }

  void (*complete_)(void*);
  void* function_;
};

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DETAIL_EXECUTOR_FUNCTION_HPP
