//
// detail/impl/scheduler.ipp
// ~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_IMPL_SCHEDULER_IPP
#define ASIO_DETAIL_IMPL_SCHEDULER_IPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#include "asio/config.hpp"
#include "asio/detail/event.hpp"
#include "asio/detail/limits.hpp"
#include "asio/detail/scheduler.hpp"
#include "asio/detail/scheduler_thread_info.hpp"
#include "asio/detail/signal_blocker.hpp"

#if defined(ASIO_HAS_IO_URING_AS_DEFAULT)
# include "asio/detail/io_uring_service.hpp"
#else // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
# include "asio/detail/reactor.hpp"
#endif // defined(ASIO_HAS_IO_URING_AS_DEFAULT)

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

class scheduler::thread_function
{
public:
  explicit thread_function(scheduler* s)
    : this_(s)
  {
  }

  void operator()()
  {
    asio::error_code ec;
    this_->run(ec);
  }

private:
  scheduler* this_;
};

struct scheduler::task_cleanup
{
  ~task_cleanup()
  {
    if (this_thread_->private_outstanding_work > 0)
    {
      asio::detail::increment(
          scheduler_->outstanding_work_,
          this_thread_->private_outstanding_work);
    }
    this_thread_->private_outstanding_work = 0;

    // Enqueue the completed operations and reinsert the task at the end of
    // the operation queue.
    lock_->lock();
    scheduler_->task_interrupted_ = true;
    scheduler_->op_queue_.push(this_thread_->private_op_queue);
    scheduler_->op_queue_.push(&scheduler_->task_operation_);
  }

  scheduler* scheduler_;
  mutex::scoped_lock* lock_;
  thread_info* this_thread_;
};

struct scheduler::work_cleanup
{
  ~work_cleanup()
  {
    if (this_thread_->private_outstanding_work > 1)
    {
      asio::detail::increment(
          scheduler_->outstanding_work_,
          this_thread_->private_outstanding_work - 1);
    }
    else if (this_thread_->private_outstanding_work < 1)
    {
      scheduler_->work_finished();
    }
    this_thread_->private_outstanding_work = 0;

#if defined(ASIO_HAS_THREADS)
    if (!this_thread_->private_op_queue.empty())
    {
      lock_->lock();
      scheduler_->op_queue_.push(this_thread_->private_op_queue);
    }
#endif // defined(ASIO_HAS_THREADS)
  }

  scheduler* scheduler_;
  mutex::scoped_lock* lock_;
  thread_info* this_thread_;
};

scheduler::scheduler(asio::execution_context& ctx,
    bool own_thread, get_task_func_type get_task)
  : asio::detail::execution_context_service_base<scheduler>(ctx),
    one_thread_(config(ctx).get("scheduler", "concurrency_hint", 0) == 1),
    mutex_(config(ctx).get("scheduler", "locking", true),
        config(ctx).get("scheduler", "locking_spin_count", 0)),
    task_(0),
    get_task_(get_task),
    task_interrupted_(true),
    outstanding_work_(0),
    stopped_(false),
    shutdown_(false),
    concurrency_hint_(config(ctx).get("scheduler", "concurrency_hint", 0)),
    task_usec_(config(ctx).get("scheduler", "task_usec", -1L)),
    wait_usec_(config(ctx).get("scheduler", "wait_usec", -1L)),
    thread_(0)
{
  ASIO_HANDLER_TRACKING_INIT;

  if (own_thread)
  {
    ++outstanding_work_;
    asio::detail::signal_blocker sb;
    thread_ = new asio::detail::thread(thread_function(this));
  }
}

scheduler::~scheduler()
{
  if (thread_)
  {
    mutex::scoped_lock lock(mutex_);
    shutdown_ = true;
    stop_all_threads(lock);
    lock.unlock();
    thread_->join();
    delete thread_;
  }
}

void scheduler::shutdown()
{
  mutex::scoped_lock lock(mutex_);
  shutdown_ = true;
  if (thread_)
    stop_all_threads(lock);
  lock.unlock();

  // Join thread to ensure task operation is returned to queue.
  if (thread_)
  {
    thread_->join();
    delete thread_;
    thread_ = 0;
  }

  // Destroy handler objects.
  while (!op_queue_.empty())
  {
    operation* o = op_queue_.front();
    op_queue_.pop();
    if (o != &task_operation_)
      o->destroy();
  }

  // Reset to initial state.
  task_ = 0;
}

void scheduler::init_task()
{
  mutex::scoped_lock lock(mutex_);
  if (!shutdown_ && !task_)
  {
    task_ = get_task_(this->context());
    op_queue_.push(&task_operation_);
    wake_one_thread_and_unlock(lock);
  }
}

std::size_t scheduler::run(asio::error_code& ec)
{
  ec = asio::error_code();
  if (outstanding_work_ == 0)
  {
    stop();
    return 0;
  }

  thread_info this_thread;
  this_thread.private_outstanding_work = 0;
  thread_call_stack::context ctx(this, this_thread);

  mutex::scoped_lock lock(mutex_);

  std::size_t n = 0;
  for (; do_run_one(lock, this_thread, ec); lock.lock())
    if (n != (std::numeric_limits<std::size_t>::max)())
      ++n;
  return n;
}

std::size_t scheduler::run_one(asio::error_code& ec)
{
  ec = asio::error_code();
  if (outstanding_work_ == 0)
  {
    stop();
    return 0;
  }

  thread_info this_thread;
  this_thread.private_outstanding_work = 0;
  thread_call_stack::context ctx(this, this_thread);

  mutex::scoped_lock lock(mutex_);

  return do_run_one(lock, this_thread, ec);
}

std::size_t scheduler::wait_one(long usec, asio::error_code& ec)
{
  ec = asio::error_code();
  if (outstanding_work_ == 0)
  {
    stop();
    return 0;
  }

  thread_info this_thread;
  this_thread.private_outstanding_work = 0;
  thread_call_stack::context ctx(this, this_thread);

  mutex::scoped_lock lock(mutex_);

  return do_wait_one(lock, this_thread, usec, ec);
}

std::size_t scheduler::poll(asio::error_code& ec)
{
  ec = asio::error_code();
  if (outstanding_work_ == 0)
  {
    stop();
    return 0;
  }

  thread_info this_thread;
  this_thread.private_outstanding_work = 0;
  thread_call_stack::context ctx(this, this_thread);

  mutex::scoped_lock lock(mutex_);

#if defined(ASIO_HAS_THREADS)
  // We want to support nested calls to poll() and poll_one(), so any handlers
  // that are already on a thread-private queue need to be put on to the main
  // queue now.
  if (one_thread_)
    if (thread_info* outer_info = static_cast<thread_info*>(ctx.next_by_key()))
      op_queue_.push(outer_info->private_op_queue);
#endif // defined(ASIO_HAS_THREADS)

  std::size_t n = 0;
  for (; do_poll_one(lock, this_thread, ec); lock.lock())
    if (n != (std::numeric_limits<std::size_t>::max)())
      ++n;
  return n;
}

std::size_t scheduler::poll_one(asio::error_code& ec)
{
  ec = asio::error_code();
  if (outstanding_work_ == 0)
  {
    stop();
    return 0;
  }

  thread_info this_thread;
  this_thread.private_outstanding_work = 0;
  thread_call_stack::context ctx(this, this_thread);

  mutex::scoped_lock lock(mutex_);

#if defined(ASIO_HAS_THREADS)
  // We want to support nested calls to poll() and poll_one(), so any handlers
  // that are already on a thread-private queue need to be put on to the main
  // queue now.
  if (one_thread_)
    if (thread_info* outer_info = static_cast<thread_info*>(ctx.next_by_key()))
      op_queue_.push(outer_info->private_op_queue);
#endif // defined(ASIO_HAS_THREADS)

  return do_poll_one(lock, this_thread, ec);
}

void scheduler::stop()
{
  mutex::scoped_lock lock(mutex_);
  stop_all_threads(lock);
}

bool scheduler::stopped() const
{
  mutex::scoped_lock lock(mutex_);
  return stopped_;
}

void scheduler::restart()
{
  mutex::scoped_lock lock(mutex_);
  stopped_ = false;
}

void scheduler::compensating_work_started()
{
  thread_info_base* this_thread = thread_call_stack::contains(this);
  ASIO_ASSUME(this_thread != 0); // Only called from inside scheduler.
  ++static_cast<thread_info*>(this_thread)->private_outstanding_work;
}

bool scheduler::can_dispatch()
{
  return thread_call_stack::contains(this) != 0;
}

void scheduler::capture_current_exception()
{
  if (thread_info_base* this_thread = thread_call_stack::contains(this))
    this_thread->capture_current_exception();
}

void scheduler::post_immediate_completion(
    scheduler::operation* op, bool is_continuation)
{
#if defined(ASIO_HAS_THREADS)
  if (one_thread_ || is_continuation)
  {
    if (thread_info_base* this_thread = thread_call_stack::contains(this))
    {
      ++static_cast<thread_info*>(this_thread)->private_outstanding_work;
      static_cast<thread_info*>(this_thread)->private_op_queue.push(op);
      return;
    }
  }
#else // defined(ASIO_HAS_THREADS)
  (void)is_continuation;
#endif // defined(ASIO_HAS_THREADS)

  work_started();
  mutex::scoped_lock lock(mutex_);
  op_queue_.push(op);
  wake_one_thread_and_unlock(lock);
}

void scheduler::post_immediate_completions(std::size_t n,
    op_queue<scheduler::operation>& ops, bool is_continuation)
{
#if defined(ASIO_HAS_THREADS)
  if (one_thread_ || is_continuation)
  {
    if (thread_info_base* this_thread = thread_call_stack::contains(this))
    {
      static_cast<thread_info*>(this_thread)->private_outstanding_work
        += static_cast<long>(n);
      static_cast<thread_info*>(this_thread)->private_op_queue.push(ops);
      return;
    }
  }
#else // defined(ASIO_HAS_THREADS)
  (void)is_continuation;
#endif // defined(ASIO_HAS_THREADS)

  increment(outstanding_work_, static_cast<long>(n));
  mutex::scoped_lock lock(mutex_);
  op_queue_.push(ops);
  wake_one_thread_and_unlock(lock);
}

void scheduler::post_deferred_completion(scheduler::operation* op)
{
#if defined(ASIO_HAS_THREADS)
  if (one_thread_)
  {
    if (thread_info_base* this_thread = thread_call_stack::contains(this))
    {
      static_cast<thread_info*>(this_thread)->private_op_queue.push(op);
      return;
    }
  }
#endif // defined(ASIO_HAS_THREADS)

  mutex::scoped_lock lock(mutex_);
  op_queue_.push(op);
  wake_one_thread_and_unlock(lock);
}

void scheduler::post_deferred_completions(
    op_queue<scheduler::operation>& ops)
{
  if (!ops.empty())
  {
#if defined(ASIO_HAS_THREADS)
    if (one_thread_)
    {
      if (thread_info_base* this_thread = thread_call_stack::contains(this))
      {
        static_cast<thread_info*>(this_thread)->private_op_queue.push(ops);
        return;
      }
    }
#endif // defined(ASIO_HAS_THREADS)

    mutex::scoped_lock lock(mutex_);
    op_queue_.push(ops);
    wake_one_thread_and_unlock(lock);
  }
}

void scheduler::do_dispatch(
    scheduler::operation* op)
{
  work_started();
  mutex::scoped_lock lock(mutex_);
  op_queue_.push(op);
  wake_one_thread_and_unlock(lock);
}

void scheduler::abandon_operations(
    op_queue<scheduler::operation>& ops)
{
  op_queue<scheduler::operation> ops2;
  ops2.push(ops);
}

std::size_t scheduler::do_run_one(mutex::scoped_lock& lock,
    scheduler::thread_info& this_thread,
    const asio::error_code& ec)
{
  while (!stopped_)
  {
    if (!op_queue_.empty())
    {
      // Prepare to execute first handler from queue.
      operation* o = op_queue_.front();
      op_queue_.pop();
      bool more_handlers = (!op_queue_.empty());

      if (o == &task_operation_)
      {
        task_interrupted_ = more_handlers || task_usec_ == 0;

        if (more_handlers && !one_thread_ && wait_usec_ != 0)
          wakeup_event_.unlock_and_signal_one(lock);
        else
          lock.unlock();

        task_cleanup on_exit = { this, &lock, &this_thread };
        (void)on_exit;

        // Run the task. May throw an exception. Only block if the operation
        // queue is empty and we're not polling, otherwise we want to return
        // as soon as possible.
        task_->run(more_handlers ? 0 : task_usec_,
            this_thread.private_op_queue);
      }
      else
      {
        std::size_t task_result = o->task_result_;

        if (more_handlers && !one_thread_)
          wake_one_thread_and_unlock(lock);
        else
          lock.unlock();

        // Ensure the count of outstanding work is decremented on block exit.
        work_cleanup on_exit = { this, &lock, &this_thread };
        (void)on_exit;

        // Complete the operation. May throw an exception. Deletes the object.
        o->complete(this, ec, task_result);
        this_thread.rethrow_pending_exception();

        return 1;
      }
    }
    else
    {
      if (wait_usec_ == 0)
      {
        lock.unlock();
        lock.lock();
      }
      else
      {
        wakeup_event_.clear(lock);
        if (wait_usec_ > 0)
          wakeup_event_.wait_for_usec(lock, wait_usec_);
        else
          wakeup_event_.wait(lock);
      }
    }
  }

  return 0;
}

std::size_t scheduler::do_wait_one(mutex::scoped_lock& lock,
    scheduler::thread_info& this_thread, long usec,
    const asio::error_code& ec)
{
  if (stopped_)
    return 0;

  operation* o = op_queue_.front();
  if (o == 0)
  {
    wakeup_event_.clear(lock);
    usec = (wait_usec_ >= 0 && wait_usec_ < usec) ? wait_usec_ : usec;
    wakeup_event_.wait_for_usec(lock, usec);
    usec = 0; // Wait at most once.
    o = op_queue_.front();
  }

  if (o == &task_operation_)
  {
    op_queue_.pop();
    bool more_handlers = (!op_queue_.empty());

    usec = (task_usec_ >= 0 && task_usec_ < usec) ? task_usec_ : usec;
    task_interrupted_ = more_handlers || usec == 0;

    if (more_handlers && !one_thread_ && wait_usec_ != 0)
      wakeup_event_.unlock_and_signal_one(lock);
    else
      lock.unlock();

    {
      task_cleanup on_exit = { this, &lock, &this_thread };
      (void)on_exit;

      // Run the task. May throw an exception. Only block if the operation
      // queue is empty and we're not polling, otherwise we want to return
      // as soon as possible.
      task_->run(more_handlers ? 0 : usec, this_thread.private_op_queue);
    }

    o = op_queue_.front();
    if (o == &task_operation_)
    {
      if (!one_thread_)
        wakeup_event_.maybe_unlock_and_signal_one(lock);
      return 0;
    }
  }

  if (o == 0)
    return 0;

  op_queue_.pop();
  bool more_handlers = (!op_queue_.empty());

  std::size_t task_result = o->task_result_;

  if (more_handlers && !one_thread_)
    wake_one_thread_and_unlock(lock);
  else
    lock.unlock();

  // Ensure the count of outstanding work is decremented on block exit.
  work_cleanup on_exit = { this, &lock, &this_thread };
  (void)on_exit;

  // Complete the operation. May throw an exception. Deletes the object.
  o->complete(this, ec, task_result);
  this_thread.rethrow_pending_exception();

  return 1;
}

std::size_t scheduler::do_poll_one(mutex::scoped_lock& lock,
    scheduler::thread_info& this_thread,
    const asio::error_code& ec)
{
  if (stopped_)
    return 0;

  operation* o = op_queue_.front();
  if (o == &task_operation_)
  {
    op_queue_.pop();
    lock.unlock();

    {
      task_cleanup c = { this, &lock, &this_thread };
      (void)c;

      // Run the task. May throw an exception. Only block if the operation
      // queue is empty and we're not polling, otherwise we want to return
      // as soon as possible.
      task_->run(0, this_thread.private_op_queue);
    }

    o = op_queue_.front();
    if (o == &task_operation_)
    {
      wakeup_event_.maybe_unlock_and_signal_one(lock);
      return 0;
    }
  }

  if (o == 0)
    return 0;

  op_queue_.pop();
  bool more_handlers = (!op_queue_.empty());

  std::size_t task_result = o->task_result_;

  if (more_handlers && !one_thread_)
    wake_one_thread_and_unlock(lock);
  else
    lock.unlock();

  // Ensure the count of outstanding work is decremented on block exit.
  work_cleanup on_exit = { this, &lock, &this_thread };
  (void)on_exit;

  // Complete the operation. May throw an exception. Deletes the object.
  o->complete(this, ec, task_result);
  this_thread.rethrow_pending_exception();

  return 1;
}

void scheduler::stop_all_threads(
    mutex::scoped_lock& lock)
{
  stopped_ = true;
  wakeup_event_.signal_all(lock);

  if (!task_interrupted_ && task_)
  {
    task_interrupted_ = true;
    task_->interrupt();
  }
}

void scheduler::wake_one_thread_and_unlock(
    mutex::scoped_lock& lock)
{
  if (wait_usec_ == 0 || !wakeup_event_.maybe_unlock_and_signal_one(lock))
  {
    if (!task_interrupted_ && task_)
    {
      task_interrupted_ = true;
      task_->interrupt();
    }
    lock.unlock();
  }
}

scheduler_task* scheduler::get_default_task(asio::execution_context& ctx)
{
#if defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  return &use_service<io_uring_service>(ctx);
#else // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  return &use_service<reactor>(ctx);
#endif // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
}

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DETAIL_IMPL_SCHEDULER_IPP
