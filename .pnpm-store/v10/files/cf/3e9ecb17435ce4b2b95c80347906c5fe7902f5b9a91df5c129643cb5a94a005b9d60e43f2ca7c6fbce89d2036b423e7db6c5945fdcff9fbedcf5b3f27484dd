//
// detail/blocking_executor_op.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_BLOCKING_EXECUTOR_OP_HPP
#define ASIO_DETAIL_BLOCKING_EXECUTOR_OP_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/event.hpp"
#include "asio/detail/fenced_block.hpp"
#include "asio/detail/mutex.hpp"
#include "asio/detail/scheduler_operation.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

template <typename Operation = scheduler_operation>
class blocking_executor_op_base : public Operation
{
public:
  blocking_executor_op_base(typename Operation::func_type complete_func)
    : Operation(complete_func),
      is_complete_(false)
  {
  }

  void wait()
  {
    asio::detail::mutex::scoped_lock lock(mutex_);
    while (!is_complete_)
      event_.wait(lock);
  }

protected:
  struct do_complete_cleanup
  {
    ~do_complete_cleanup()
    {
      asio::detail::mutex::scoped_lock lock(op_->mutex_);
      op_->is_complete_ = true;
      op_->event_.unlock_and_signal_one_for_destruction(lock);
    }

    blocking_executor_op_base* op_;
  };

private:
  asio::detail::mutex mutex_;
  asio::detail::event event_;
  bool is_complete_;
};

template <typename Handler, typename Operation = scheduler_operation>
class blocking_executor_op : public blocking_executor_op_base<Operation>
{
public:
  blocking_executor_op(Handler& h)
    : blocking_executor_op_base<Operation>(&blocking_executor_op::do_complete),
      handler_(h)
  {
  }

  static void do_complete(void* owner, Operation* base,
      const asio::error_code& /*ec*/,
      std::size_t /*bytes_transferred*/)
  {
    ASIO_ASSUME(base != 0);
    blocking_executor_op* o(static_cast<blocking_executor_op*>(base));

    typename blocking_executor_op_base<Operation>::do_complete_cleanup
      on_exit = { o };
    (void)on_exit;

    ASIO_HANDLER_COMPLETION((*o));

    // Make the upcall if required.
    if (owner)
    {
      fenced_block b(fenced_block::half);
      ASIO_HANDLER_INVOCATION_BEGIN(());
      static_cast<Handler&&>(o->handler_)();
      ASIO_HANDLER_INVOCATION_END;
    }
  }

private:
  Handler& handler_;
};

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DETAIL_BLOCKING_EXECUTOR_OP_HPP
