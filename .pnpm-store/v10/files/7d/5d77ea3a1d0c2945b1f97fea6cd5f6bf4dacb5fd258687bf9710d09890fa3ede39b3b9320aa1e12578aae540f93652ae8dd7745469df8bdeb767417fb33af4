//
// detail/scheduler_task.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_SCHEDULER_TASK_HPP
#define ASIO_DETAIL_SCHEDULER_TASK_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/op_queue.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

class scheduler_operation;

// Base class for all tasks that may be run by a scheduler.
class scheduler_task
{
public:
  // Run the task once until interrupted or events are ready to be dispatched.
  virtual void run(long usec, op_queue<scheduler_operation>& ops) = 0;

  // Interrupt the task.
  virtual void interrupt() = 0;

protected:
  // Prevent deletion through this type.
  ~scheduler_task()
  {
  }
};

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DETAIL_SCHEDULER_TASK_HPP
