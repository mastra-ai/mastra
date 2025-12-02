//
// experimental/impl/promise.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2021-2023 Klemens D. Morgenstern
//                         (klemens dot morgenstern at gmx dot net)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//
#ifndef ASIO_EXPERIMENTAL_IMPL_PROMISE_HPP
#define ASIO_EXPERIMENTAL_IMPL_PROMISE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/cancellation_signal.hpp"
#include "asio/detail/utility.hpp"
#include "asio/error.hpp"
#include "asio/system_error.hpp"
#include <tuple>

#include "asio/detail/push_options.hpp"

namespace asio {
namespace experimental {

template<typename Signature = void(),
    typename Executor = asio::any_io_executor,
    typename Allocator = std::allocator<void>>
struct promise;

namespace detail {

template<typename Signature, typename Executor, typename Allocator>
struct promise_impl;

template<typename... Ts, typename Executor, typename Allocator>
struct promise_impl<void(Ts...), Executor, Allocator>
{
  using result_type = std::tuple<Ts...>;

  promise_impl(Allocator allocator, Executor executor)
    : allocator(std::move(allocator)), executor(std::move(executor))
  {
  }

  promise_impl(const promise_impl&) = delete;

  ~promise_impl()
  {
    if (completion)
      this->cancel_();

    if (done)
      reinterpret_cast<result_type*>(&result)->~result_type();
  }

  aligned_storage_t<sizeof(result_type), alignof(result_type)> result;
  std::atomic<bool> done{false};
  cancellation_signal cancel;
  Allocator allocator;
  Executor executor;

  template<typename Func, std::size_t... Idx>
  void apply_impl(Func f, asio::detail::index_sequence<Idx...>)
  {
    auto& result_type = *reinterpret_cast<promise_impl::result_type*>(&result);
    f(std::get<Idx>(std::move(result_type))...);
  }

  using allocator_type = Allocator;
  allocator_type get_allocator() {return allocator;}

  using executor_type = Executor;
  executor_type get_executor() {return executor;}

  template<typename Func>
  void apply(Func f)
  {
    apply_impl(std::forward<Func>(f),
        asio::detail::make_index_sequence<sizeof...(Ts)>{});
  }

  struct completion_base
  {
    virtual void invoke(Ts&&...ts) = 0;
  };

  template<typename Alloc, typename WaitHandler_>
  struct completion_impl final : completion_base
  {
    WaitHandler_ handler;
    Alloc allocator;
    void invoke(Ts&&... ts)
    {
      auto h = std::move(handler);

      using alloc_t = typename std::allocator_traits<
        typename asio::decay<Alloc>::type>::template
          rebind_alloc<completion_impl>;

      alloc_t alloc_{allocator};
      this->~completion_impl();
      std::allocator_traits<alloc_t>::deallocate(alloc_, this, 1u);
      std::move(h)(std::forward<Ts>(ts)...);
    }

    template<typename Alloc_, typename Handler_>
    completion_impl(Alloc_&& alloc, Handler_&& wh)
      : handler(std::forward<Handler_>(wh)),
        allocator(std::forward<Alloc_>(alloc))
    {
    }
  };

  completion_base* completion = nullptr;
  typename asio::aligned_storage<sizeof(void*) * 4,
    alignof(completion_base)>::type completion_opt;

  template<typename Alloc, typename Handler>
  void set_completion(Alloc&& alloc, Handler&& handler)
  {
    if (completion)
      cancel_();

    using impl_t = completion_impl<
      typename asio::decay<Alloc>::type, Handler>;
    using alloc_t = typename std::allocator_traits<
      typename asio::decay<Alloc>::type>::template rebind_alloc<impl_t>;

    alloc_t alloc_{alloc};
    auto p = std::allocator_traits<alloc_t>::allocate(alloc_, 1u);
    completion = new (p) impl_t(std::forward<Alloc>(alloc),
        std::forward<Handler>(handler));
  }

  template<typename... T_>
  void complete(T_&&... ts)
  {
    assert(completion);
    std::exchange(completion, nullptr)->invoke(std::forward<T_>(ts)...);
  }

  template<std::size_t... Idx>
  void complete_with_result_impl(asio::detail::index_sequence<Idx...>)
  {
    auto& result_type = *reinterpret_cast<promise_impl::result_type*>(&result);
    this->complete(std::get<Idx>(std::move(result_type))...);
  }

  void complete_with_result()
  {
    complete_with_result_impl(
        asio::detail::make_index_sequence<sizeof...(Ts)>{});
  }

  template<typename... T_>
  void cancel_impl_(std::exception_ptr*, T_*...)
  {
    complete(
        std::make_exception_ptr(
          asio::system_error(
            asio::error::operation_aborted)),
        T_{}...);
  }

  template<typename... T_>
  void cancel_impl_(asio::error_code*, T_*...)
  {
    complete(asio::error::operation_aborted, T_{}...);
  }

  template<typename... T_>
  void cancel_impl_(T_*...)
  {
    complete(T_{}...);
  }

  void cancel_()
  {
    cancel_impl_(static_cast<Ts*>(nullptr)...);
  }
};

template<typename Signature = void(),
    typename Executor = asio::any_io_executor,
    typename Allocator = std::allocator<void>>
struct promise_handler;

template<typename... Ts,  typename Executor, typename Allocator>
struct promise_handler<void(Ts...), Executor, Allocator>
{
  using promise_type = promise<void(Ts...), Executor, Allocator>;

  promise_handler(
      Allocator allocator, Executor executor) // get_associated_allocator(exec)
    : impl_(
        std::allocate_shared<promise_impl<void(Ts...), Executor, Allocator>>(
          allocator, allocator, executor))
  {
  }

  std::shared_ptr<promise_impl<void(Ts...), Executor, Allocator>> impl_;

  using cancellation_slot_type = cancellation_slot;

  cancellation_slot_type get_cancellation_slot() const noexcept
  {
    return impl_->cancel.slot();
  }

  using allocator_type = Allocator;

  allocator_type get_allocator() const noexcept
  {
    return impl_->get_allocator();
  }

  using executor_type = Executor;

  Executor get_executor() const noexcept
  {
    return impl_->get_executor();
  }

  auto make_promise() -> promise<void(Ts...), executor_type, allocator_type>
  {
    return promise<void(Ts...), executor_type, allocator_type>{impl_};
  }

  void operator()(std::remove_reference_t<Ts>... ts)
  {
    assert(impl_);

    using result_type = typename promise_impl<
      void(Ts...), allocator_type, executor_type>::result_type ;

    new (&impl_->result) result_type(std::move(ts)...);
    impl_->done = true;

    if (impl_->completion)
      impl_->complete_with_result();
  }
};

} // namespace detail
} // namespace experimental
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_EXPERIMENTAL_IMPL_PROMISE_HPP
