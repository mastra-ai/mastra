//
// experimental/detail/channel_operation.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXPERIMENTAL_DETAIL_CHANNEL_OPERATION_HPP
#define ASIO_EXPERIMENTAL_DETAIL_CHANNEL_OPERATION_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/associated_allocator.hpp"
#include "asio/associated_executor.hpp"
#include "asio/associated_immediate_executor.hpp"
#include "asio/detail/initiate_post.hpp"
#include "asio/detail/initiate_dispatch.hpp"
#include "asio/detail/op_queue.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/execution/executor.hpp"
#include "asio/execution/outstanding_work.hpp"
#include "asio/executor_work_guard.hpp"
#include "asio/prefer.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace experimental {
namespace detail {

// Base class for all channel operations. A function pointer is used instead of
// virtual functions to avoid the associated overhead.
class channel_operation ASIO_INHERIT_TRACKED_HANDLER
{
public:
  template <typename Executor, typename = void, typename = void>
  class handler_work_base;

  template <typename Handler, typename IoExecutor, typename = void>
  class handler_work;

  void destroy()
  {
    func_(this, destroy_op, 0);
  }

protected:
  enum action
  {
    destroy_op = 0,
    immediate_op = 1,
    post_op = 2,
    dispatch_op = 3,
    cancel_op = 4,
    close_op = 5
  };

  typedef void (*func_type)(channel_operation*, action, void*);

  channel_operation(func_type func)
    : next_(0),
      func_(func),
      cancellation_key_(0)
  {
  }

  // Prevents deletion through this type.
  ~channel_operation()
  {
  }

  friend class asio::detail::op_queue_access;
  channel_operation* next_;
  func_type func_;

public:
  // The operation key used for targeted cancellation.
  void* cancellation_key_;
};

template <typename Executor, typename, typename>
class channel_operation::handler_work_base
{
public:
  typedef decay_t<
      prefer_result_t<Executor,
        execution::outstanding_work_t::tracked_t
      >
    > executor_type;

  handler_work_base(int, const Executor& ex)
    : executor_(asio::prefer(ex, execution::outstanding_work.tracked))
  {
  }

  const executor_type& get_executor() const noexcept
  {
    return executor_;
  }

  template <typename IoExecutor, typename Function, typename Handler>
  void post(const IoExecutor& io_exec, Function& function, Handler&)
  {
    (asio::detail::initiate_post_with_executor<IoExecutor>(io_exec))(
        static_cast<Function&&>(function));
  }

  template <typename Function, typename Handler>
  void dispatch(Function& function, Handler& handler)
  {
    associated_allocator_t<Handler> allocator =
      (get_associated_allocator)(handler);

    asio::prefer(executor_,
        execution::allocator(allocator)
      ).execute(static_cast<Function&&>(function));
  }

private:
  executor_type executor_;
};

template <typename Executor>
class channel_operation::handler_work_base<Executor,
    enable_if_t<
      execution::is_executor<Executor>::value
    >,
    enable_if_t<
      can_require<Executor, execution::blocking_t::never_t>::value
    >
  >
{
public:
  typedef decay_t<
      prefer_result_t<Executor,
        execution::outstanding_work_t::tracked_t
      >
    > executor_type;

  handler_work_base(int, const Executor& ex)
    : executor_(asio::prefer(ex, execution::outstanding_work.tracked))
  {
  }

  const executor_type& get_executor() const noexcept
  {
    return executor_;
  }

  template <typename IoExecutor, typename Function, typename Handler>
  void post(const IoExecutor&, Function& function, Handler& handler)
  {
    associated_allocator_t<Handler> allocator =
      (get_associated_allocator)(handler);

    asio::prefer(
        asio::require(executor_, execution::blocking.never),
        execution::allocator(allocator)
      ).execute(static_cast<Function&&>(function));
  }

  template <typename Function, typename Handler>
  void dispatch(Function& function, Handler& handler)
  {
    associated_allocator_t<Handler> allocator =
      (get_associated_allocator)(handler);

    asio::prefer(executor_,
        execution::allocator(allocator)
      ).execute(static_cast<Function&&>(function));
  }

private:
  executor_type executor_;
};

#if !defined(ASIO_NO_TS_EXECUTORS)

template <typename Executor>
class channel_operation::handler_work_base<Executor,
    enable_if_t<
      !execution::is_executor<Executor>::value
    >
  >
{
public:
  typedef Executor executor_type;

  handler_work_base(int, const Executor& ex)
    : work_(ex)
  {
  }

  executor_type get_executor() const noexcept
  {
    return work_.get_executor();
  }

  template <typename IoExecutor, typename Function, typename Handler>
  void post(const IoExecutor&, Function& function, Handler& handler)
  {
    associated_allocator_t<Handler> allocator =
      (get_associated_allocator)(handler);

    work_.get_executor().post(
        static_cast<Function&&>(function), allocator);
  }

  template <typename Function, typename Handler>
  void dispatch(Function& function, Handler& handler)
  {
    associated_allocator_t<Handler> allocator =
      (get_associated_allocator)(handler);

    work_.get_executor().dispatch(
        static_cast<Function&&>(function), allocator);
  }

private:
  executor_work_guard<Executor> work_;
};

#endif // !defined(ASIO_NO_TS_EXECUTORS)

template <typename Handler, typename IoExecutor, typename>
class channel_operation::handler_work :
  channel_operation::handler_work_base<IoExecutor>,
  channel_operation::handler_work_base<
      associated_executor_t<Handler, IoExecutor>, IoExecutor>
{
public:
  typedef channel_operation::handler_work_base<IoExecutor> base1_type;

  typedef channel_operation::handler_work_base<
      associated_executor_t<Handler, IoExecutor>, IoExecutor>
    base2_type;

  handler_work(Handler& handler, const IoExecutor& io_ex) noexcept
    : base1_type(0, io_ex),
      base2_type(0, (get_associated_executor)(handler, io_ex))
  {
  }

  template <typename Function>
  void post(Function& function, Handler& handler)
  {
    base2_type::post(base1_type::get_executor(), function, handler);
  }

  template <typename Function>
  void dispatch(Function& function, Handler& handler)
  {
    base2_type::dispatch(function, handler);
  }

  template <typename Function>
  void immediate(Function& function, Handler& handler, ...)
  {
    typedef associated_immediate_executor_t<Handler,
      typename base1_type::executor_type> immediate_ex_type;

    immediate_ex_type immediate_ex = (get_associated_immediate_executor)(
        handler, base1_type::get_executor());

    (asio::detail::initiate_dispatch_with_executor<immediate_ex_type>(
          immediate_ex))(static_cast<Function&&>(function));
  }

  template <typename Function>
  void immediate(Function& function, Handler&,
      enable_if_t<
        is_same<
          typename associated_immediate_executor<
            conditional_t<false, Function, Handler>,
            typename base1_type::executor_type>::
              asio_associated_immediate_executor_is_unspecialised,
          void
        >::value
      >*)
  {
    (asio::detail::initiate_post_with_executor<
        typename base1_type::executor_type>(
          base1_type::get_executor()))(
        static_cast<Function&&>(function));
  }
};

template <typename Handler, typename IoExecutor>
class channel_operation::handler_work<
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
  typedef channel_operation::handler_work_base<IoExecutor> base1_type;

  handler_work(Handler&, const IoExecutor& io_ex) noexcept
    : base1_type(0, io_ex)
  {
  }

  template <typename Function>
  void post(Function& function, Handler& handler)
  {
    base1_type::post(base1_type::get_executor(), function, handler);
  }

  template <typename Function>
  void dispatch(Function& function, Handler& handler)
  {
    base1_type::dispatch(function, handler);
  }

  template <typename Function>
  void immediate(Function& function, Handler& handler, ...)
  {
    typedef associated_immediate_executor_t<Handler,
      typename base1_type::executor_type> immediate_ex_type;

    immediate_ex_type immediate_ex = (get_associated_immediate_executor)(
        handler, base1_type::get_executor());

    (asio::detail::initiate_dispatch_with_executor<immediate_ex_type>(
          immediate_ex))(static_cast<Function&&>(function));
  }

  template <typename Function>
  void immediate(Function& function, Handler& handler,
      enable_if_t<
        is_same<
          typename associated_immediate_executor<
            conditional_t<false, Function, Handler>,
            typename base1_type::executor_type>::
              asio_associated_immediate_executor_is_unspecialised,
          void
        >::value
      >*)
  {
    base1_type::post(base1_type::get_executor(), function, handler);
  }
};

} // namespace detail
} // namespace experimental
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_EXPERIMENTAL_DETAIL_CHANNEL_OPERATION_HPP
