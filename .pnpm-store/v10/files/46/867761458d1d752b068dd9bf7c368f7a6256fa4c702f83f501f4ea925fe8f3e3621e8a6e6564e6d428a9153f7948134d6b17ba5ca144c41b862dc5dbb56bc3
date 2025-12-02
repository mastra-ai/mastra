//
// detail/handler_work.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_HANDLER_WORK_HPP
#define ASIO_DETAIL_HANDLER_WORK_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/associated_allocator.hpp"
#include "asio/associated_executor.hpp"
#include "asio/associated_immediate_executor.hpp"
#include "asio/detail/initiate_dispatch.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/detail/work_dispatcher.hpp"
#include "asio/execution/allocator.hpp"
#include "asio/execution/blocking.hpp"
#include "asio/execution/executor.hpp"
#include "asio/execution/outstanding_work.hpp"
#include "asio/executor_work_guard.hpp"
#include "asio/prefer.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

class executor;
class io_context;

#if !defined(ASIO_USE_TS_EXECUTOR_AS_DEFAULT)

class any_completion_executor;
class any_io_executor;

#endif // !defined(ASIO_USE_TS_EXECUTOR_AS_DEFAULT)

namespace execution {

template <typename...> class any_executor;

} // namespace execution
namespace detail {

template <typename Executor, typename CandidateExecutor = void,
    typename IoContext = io_context,
    typename PolymorphicExecutor = executor, typename = void>
class handler_work_base
{
public:
  explicit handler_work_base(int, int, const Executor& ex) noexcept
    : executor_(asio::prefer(ex, execution::outstanding_work.tracked))
  {
  }

  template <typename OtherExecutor>
  handler_work_base(bool /*base1_owns_work*/, const Executor& ex,
      const OtherExecutor& /*candidate*/) noexcept
    : executor_(asio::prefer(ex, execution::outstanding_work.tracked))
  {
  }

  handler_work_base(const handler_work_base& other) noexcept
    : executor_(other.executor_)
  {
  }

  handler_work_base(handler_work_base&& other) noexcept
    : executor_(static_cast<executor_type&&>(other.executor_))
  {
  }

  bool owns_work() const noexcept
  {
    return true;
  }

  template <typename Function, typename Handler>
  void dispatch(Function& function, Handler& handler)
  {
    asio::prefer(executor_,
        execution::allocator((get_associated_allocator)(handler))
      ).execute(static_cast<Function&&>(function));
  }

private:
  typedef decay_t<
      prefer_result_t<Executor, execution::outstanding_work_t::tracked_t>
    > executor_type;

  executor_type executor_;
};

template <typename Executor, typename CandidateExecutor,
    typename IoContext, typename PolymorphicExecutor>
class handler_work_base<Executor, CandidateExecutor,
    IoContext, PolymorphicExecutor,
    enable_if_t<
      !execution::is_executor<Executor>::value
        && (!is_same<Executor, PolymorphicExecutor>::value
          || !is_same<CandidateExecutor, void>::value)
    >
  >
{
public:
  explicit handler_work_base(int, int, const Executor& ex) noexcept
    : executor_(ex),
      owns_work_(true)
  {
    executor_.on_work_started();
  }

  handler_work_base(bool /*base1_owns_work*/, const Executor& ex,
      const Executor& candidate) noexcept
    : executor_(ex),
      owns_work_(ex != candidate)
  {
    if (owns_work_)
      executor_.on_work_started();
  }

  template <typename OtherExecutor>
  handler_work_base(bool /*base1_owns_work*/, const Executor& ex,
      const OtherExecutor& /*candidate*/) noexcept
    : executor_(ex),
      owns_work_(true)
  {
    executor_.on_work_started();
  }

  handler_work_base(const handler_work_base& other) noexcept
    : executor_(other.executor_),
      owns_work_(other.owns_work_)
  {
    if (owns_work_)
      executor_.on_work_started();
  }

  handler_work_base(handler_work_base&& other) noexcept
    : executor_(static_cast<Executor&&>(other.executor_)),
      owns_work_(other.owns_work_)
  {
    other.owns_work_ = false;
  }

  ~handler_work_base()
  {
    if (owns_work_)
      executor_.on_work_finished();
  }

  bool owns_work() const noexcept
  {
    return owns_work_;
  }

  template <typename Function, typename Handler>
  void dispatch(Function& function, Handler& handler)
  {
    executor_.dispatch(static_cast<Function&&>(function),
        asio::get_associated_allocator(handler));
  }

private:
  Executor executor_;
  bool owns_work_;
};

template <typename Executor, typename IoContext, typename PolymorphicExecutor>
class handler_work_base<Executor, void, IoContext, PolymorphicExecutor,
    enable_if_t<
      is_same<
        Executor,
        typename IoContext::executor_type
      >::value
    >
  >
{
public:
  explicit handler_work_base(int, int, const Executor&)
  {
  }

  bool owns_work() const noexcept
  {
    return false;
  }

  template <typename Function, typename Handler>
  void dispatch(Function& function, Handler&)
  {
    // When using a native implementation, I/O completion handlers are
    // already dispatched according to the execution context's executor's
    // rules. We can call the function directly.
    static_cast<Function&&>(function)();
  }
};

template <typename Executor, typename IoContext>
class handler_work_base<Executor, void, IoContext, Executor>
{
public:
  explicit handler_work_base(int, int, const Executor& ex) noexcept
#if !defined(ASIO_NO_TYPEID)
    : executor_(
        ex.target_type() == typeid(typename IoContext::executor_type)
          ? Executor() : ex)
#else // !defined(ASIO_NO_TYPEID)
    : executor_(ex)
#endif // !defined(ASIO_NO_TYPEID)
  {
    if (executor_)
      executor_.on_work_started();
  }

  handler_work_base(bool /*base1_owns_work*/, const Executor& ex,
      const Executor& candidate) noexcept
    : executor_(ex != candidate ? ex : Executor())
  {
    if (executor_)
      executor_.on_work_started();
  }

  template <typename OtherExecutor>
  handler_work_base(const Executor& ex,
      const OtherExecutor&) noexcept
    : executor_(ex)
  {
    executor_.on_work_started();
  }

  handler_work_base(const handler_work_base& other) noexcept
    : executor_(other.executor_)
  {
    if (executor_)
      executor_.on_work_started();
  }

  handler_work_base(handler_work_base&& other) noexcept
    : executor_(static_cast<Executor&&>(other.executor_))
  {
  }

  ~handler_work_base()
  {
    if (executor_)
      executor_.on_work_finished();
  }

  bool owns_work() const noexcept
  {
    return !!executor_;
  }

  template <typename Function, typename Handler>
  void dispatch(Function& function, Handler& handler)
  {
    executor_.dispatch(static_cast<Function&&>(function),
        asio::get_associated_allocator(handler));
  }

private:
  Executor executor_;
};

template <typename... SupportableProperties, typename CandidateExecutor,
    typename IoContext, typename PolymorphicExecutor>
class handler_work_base<execution::any_executor<SupportableProperties...>,
    CandidateExecutor, IoContext, PolymorphicExecutor>
{
public:
  typedef execution::any_executor<SupportableProperties...> executor_type;

  explicit handler_work_base(int, int, const executor_type& ex) noexcept
#if !defined(ASIO_NO_TYPEID)
    : executor_(
        ex.target_type() == typeid(typename IoContext::executor_type)
          ? executor_type()
          : asio::prefer(ex, execution::outstanding_work.tracked))
#else // !defined(ASIO_NO_TYPEID)
    : executor_(asio::prefer(ex, execution::outstanding_work.tracked))
#endif // !defined(ASIO_NO_TYPEID)
  {
  }

  handler_work_base(bool base1_owns_work, const executor_type& ex,
      const executor_type& candidate) noexcept
    : executor_(
        !base1_owns_work && ex == candidate
          ? executor_type()
          : asio::prefer(ex, execution::outstanding_work.tracked))
  {
  }

  template <typename OtherExecutor>
  handler_work_base(bool /*base1_owns_work*/, const executor_type& ex,
      const OtherExecutor& /*candidate*/) noexcept
    : executor_(asio::prefer(ex, execution::outstanding_work.tracked))
  {
  }

  handler_work_base(const handler_work_base& other) noexcept
    : executor_(other.executor_)
  {
  }

  handler_work_base(handler_work_base&& other) noexcept
    : executor_(static_cast<executor_type&&>(other.executor_))
  {
  }

  bool owns_work() const noexcept
  {
    return !!executor_;
  }

  template <typename Function, typename Handler>
  void dispatch(Function& function, Handler&)
  {
    executor_.execute(static_cast<Function&&>(function));
  }

private:
  executor_type executor_;
};

#if !defined(ASIO_USE_TS_EXECUTOR_AS_DEFAULT)

template <typename Executor, typename CandidateExecutor,
    typename IoContext, typename PolymorphicExecutor>
class handler_work_base<
    Executor, CandidateExecutor,
    IoContext, PolymorphicExecutor,
    enable_if_t<
      is_same<Executor, any_completion_executor>::value
        || is_same<Executor, any_io_executor>::value
    >
  >
{
public:
  typedef Executor executor_type;

  explicit handler_work_base(int, int,
      const executor_type& ex) noexcept
#if !defined(ASIO_NO_TYPEID)
    : executor_(
        ex.target_type() == typeid(typename IoContext::executor_type)
          ? executor_type()
          : asio::prefer(ex, execution::outstanding_work.tracked))
#else // !defined(ASIO_NO_TYPEID)
    : executor_(asio::prefer(ex, execution::outstanding_work.tracked))
#endif // !defined(ASIO_NO_TYPEID)
  {
  }

  handler_work_base(bool base1_owns_work, const executor_type& ex,
      const executor_type& candidate) noexcept
    : executor_(
        !base1_owns_work && ex == candidate
          ? executor_type()
          : asio::prefer(ex, execution::outstanding_work.tracked))
  {
  }

  template <typename OtherExecutor>
  handler_work_base(bool /*base1_owns_work*/, const executor_type& ex,
      const OtherExecutor& /*candidate*/) noexcept
    : executor_(asio::prefer(ex, execution::outstanding_work.tracked))
  {
  }

  handler_work_base(const handler_work_base& other) noexcept
    : executor_(other.executor_)
  {
  }

  handler_work_base(handler_work_base&& other) noexcept
    : executor_(static_cast<executor_type&&>(other.executor_))
  {
  }

  bool owns_work() const noexcept
  {
    return !!executor_;
  }

  template <typename Function, typename Handler>
  void dispatch(Function& function, Handler&)
  {
    executor_.execute(static_cast<Function&&>(function));
  }

private:
  executor_type executor_;
};

#endif // !defined(ASIO_USE_TS_EXECUTOR_AS_DEFAULT)

template <typename Handler, typename IoExecutor, typename = void>
class handler_work :
  handler_work_base<IoExecutor>,
  handler_work_base<associated_executor_t<Handler, IoExecutor>, IoExecutor>
{
public:
  typedef handler_work_base<IoExecutor> base1_type;
  typedef handler_work_base<associated_executor_t<Handler, IoExecutor>,
      IoExecutor> base2_type;

  handler_work(Handler& handler, const IoExecutor& io_ex) noexcept
    : base1_type(0, 0, io_ex),
      base2_type(base1_type::owns_work(),
          asio::get_associated_executor(handler, io_ex), io_ex)
  {
  }

  template <typename Function>
  void complete(Function& function, Handler& handler)
  {
    if (!base1_type::owns_work() && !base2_type::owns_work())
    {
      // When using a native implementation, I/O completion handlers are
      // already dispatched according to the execution context's executor's
      // rules. We can call the function directly.
      static_cast<Function&&>(function)();
    }
    else
    {
      base2_type::dispatch(function, handler);
    }
  }
};

template <typename Handler, typename IoExecutor>
class handler_work<
    Handler, IoExecutor,
    enable_if_t<
      is_same<
        typename associated_executor<Handler,
          IoExecutor>::asio_associated_executor_is_unspecialised,
        void
      >::value
    >
  > : handler_work_base<IoExecutor>
{
public:
  typedef handler_work_base<IoExecutor> base1_type;

  handler_work(Handler&, const IoExecutor& io_ex) noexcept
    : base1_type(0, 0, io_ex)
  {
  }

  template <typename Function>
  void complete(Function& function, Handler& handler)
  {
    if (!base1_type::owns_work())
    {
      // When using a native implementation, I/O completion handlers are
      // already dispatched according to the execution context's executor's
      // rules. We can call the function directly.
      static_cast<Function&&>(function)();
    }
    else
    {
      base1_type::dispatch(function, handler);
    }
  }
};

template <typename Handler, typename IoExecutor>
class immediate_handler_work
{
public:
  typedef handler_work<Handler, IoExecutor> handler_work_type;

  explicit immediate_handler_work(handler_work_type&& w)
    : handler_work_(static_cast<handler_work_type&&>(w))
  {
  }

  template <typename Function>
  void complete(Function& function, Handler& handler, const void* io_ex)
  {
    typedef associated_immediate_executor_t<Handler, IoExecutor>
      immediate_ex_type;

    immediate_ex_type immediate_ex = (get_associated_immediate_executor)(
        handler, *static_cast<const IoExecutor*>(io_ex));

    (initiate_dispatch_with_executor<immediate_ex_type>(immediate_ex))(
        static_cast<Function&&>(function));
  }

private:
  handler_work_type handler_work_;
};

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DETAIL_HANDLER_WORK_HPP
