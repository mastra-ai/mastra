//
// detail/impl/signal_set_service.ipp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_IMPL_SIGNAL_SET_SERVICE_IPP
#define ASIO_DETAIL_IMPL_SIGNAL_SET_SERVICE_IPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#include <cstring>
#include <stdexcept>
#include "asio/detail/signal_blocker.hpp"
#include "asio/detail/signal_set_service.hpp"
#include "asio/detail/static_mutex.hpp"
#include "asio/detail/throw_exception.hpp"

#if defined(ASIO_HAS_IO_URING_AS_DEFAULT)
# include "asio/detail/io_uring_service.hpp"
#else // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
# include "asio/detail/reactor.hpp"
#endif // defined(ASIO_HAS_IO_URING_AS_DEFAULT)

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

struct signal_state
{
  // Mutex used for protecting global state.
  static_mutex mutex_;

  // The read end of the pipe used for signal notifications.
  int read_descriptor_;

  // The write end of the pipe used for signal notifications.
  int write_descriptor_;

  // Whether the signal state has been prepared for a fork.
  bool fork_prepared_;

  // The head of a linked list of all signal_set_service instances.
  class signal_set_service* service_list_;

  // A count of the number of objects that are registered for each signal.
  std::size_t registration_count_[max_signal_number];

  // The flags used for each registered signal.
  signal_set_base::flags_t flags_[max_signal_number];
};

signal_state* get_signal_state()
{
  static signal_state state = {
    ASIO_STATIC_MUTEX_INIT, -1, -1, false, 0,
    { 0 }, { signal_set_base::flags_t() } };
  return &state;
}

void asio_signal_handler(int signal_number)
{
#if defined(ASIO_WINDOWS) \
  || defined(ASIO_WINDOWS_RUNTIME) \
  || defined(__CYGWIN__)
  signal_set_service::deliver_signal(signal_number);
#else // defined(ASIO_WINDOWS)
      //   || defined(ASIO_WINDOWS_RUNTIME)
      //   || defined(__CYGWIN__)
  int saved_errno = errno;
  signal_state* state = get_signal_state();
  signed_size_type result = ::write(state->write_descriptor_,
      &signal_number, sizeof(signal_number));
  (void)result;
  errno = saved_errno;
#endif // defined(ASIO_WINDOWS)
       //   || defined(ASIO_WINDOWS_RUNTIME)
       //   || defined(__CYGWIN__)

#if defined(ASIO_HAS_SIGNAL) && !defined(ASIO_HAS_SIGACTION)
  ::signal(signal_number, asio_signal_handler);
#endif // defined(ASIO_HAS_SIGNAL) && !defined(ASIO_HAS_SIGACTION)
}

#if !defined(ASIO_WINDOWS) \
  && !defined(ASIO_WINDOWS_RUNTIME) \
  && !defined(__CYGWIN__)
class signal_set_service::pipe_read_op :
# if defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  public io_uring_operation
# else // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  public reactor_op
# endif // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
{
public:
# if defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  pipe_read_op()
    : io_uring_operation(asio::error_code(), &pipe_read_op::do_prepare,
        &pipe_read_op::do_perform, pipe_read_op::do_complete)
  {
  }

  static void do_prepare(io_uring_operation*, ::io_uring_sqe* sqe)
  {
    signal_state* state = get_signal_state();

    int fd = state->read_descriptor_;
    ::io_uring_prep_poll_add(sqe, fd, POLLIN);
  }

  static bool do_perform(io_uring_operation*, bool)
  {
    signal_state* state = get_signal_state();

    int fd = state->read_descriptor_;
    int signal_number = 0;
    while (::read(fd, &signal_number, sizeof(int)) == sizeof(int))
      if (signal_number >= 0 && signal_number < max_signal_number)
        signal_set_service::deliver_signal(signal_number);

    return false;
  }
# else // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  pipe_read_op()
    : reactor_op(asio::error_code(),
        &pipe_read_op::do_perform, pipe_read_op::do_complete)
  {
  }

  static status do_perform(reactor_op*)
  {
    signal_state* state = get_signal_state();

    int fd = state->read_descriptor_;
    int signal_number = 0;
    while (::read(fd, &signal_number, sizeof(int)) == sizeof(int))
      if (signal_number >= 0 && signal_number < max_signal_number)
        signal_set_service::deliver_signal(signal_number);

    return not_done;
  }
# endif // defined(ASIO_HAS_IO_URING_AS_DEFAULT)

  static void do_complete(void* /*owner*/, operation* base,
      const asio::error_code& /*ec*/,
      std::size_t /*bytes_transferred*/)
  {
    pipe_read_op* o(static_cast<pipe_read_op*>(base));
    delete o;
  }
};
#endif // !defined(ASIO_WINDOWS)
       //   && !defined(ASIO_WINDOWS_RUNTIME)
       //   && !defined(__CYGWIN__)

signal_set_service::signal_set_service(execution_context& context)
  : execution_context_service_base<signal_set_service>(context),
    scheduler_(asio::use_service<scheduler_impl>(context)),
#if !defined(ASIO_WINDOWS) \
  && !defined(ASIO_WINDOWS_RUNTIME) \
  && !defined(__CYGWIN__)
# if defined(ASIO_HAS_IO_URING_AS_DEFAULT)
    io_uring_service_(asio::use_service<io_uring_service>(context)),
# else // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
    reactor_(asio::use_service<reactor>(context)),
# endif // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
#endif // !defined(ASIO_WINDOWS)
       //   && !defined(ASIO_WINDOWS_RUNTIME)
       //   && !defined(__CYGWIN__)
    next_(0),
    prev_(0)
{
  get_signal_state()->mutex_.init();

#if !defined(ASIO_WINDOWS) \
  && !defined(ASIO_WINDOWS_RUNTIME) \
  && !defined(__CYGWIN__)
# if defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  io_uring_service_.init_task();
# else // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  reactor_.init_task();
# endif // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
#endif // !defined(ASIO_WINDOWS)
       //   && !defined(ASIO_WINDOWS_RUNTIME)
       //   && !defined(__CYGWIN__)

  for (int i = 0; i < max_signal_number; ++i)
    registrations_[i] = 0;

  add_service(this);
}

signal_set_service::~signal_set_service()
{
  remove_service(this);
}

void signal_set_service::shutdown()
{
  remove_service(this);

  op_queue<operation> ops;

  for (int i = 0; i < max_signal_number; ++i)
  {
    registration* reg = registrations_[i];
    while (reg)
    {
      ops.push(*reg->queue_);
      reg = reg->next_in_table_;
    }
  }

  scheduler_.abandon_operations(ops);
}

void signal_set_service::notify_fork(execution_context::fork_event fork_ev)
{
#if !defined(ASIO_WINDOWS) \
  && !defined(ASIO_WINDOWS_RUNTIME) \
  && !defined(__CYGWIN__)
  signal_state* state = get_signal_state();
  static_mutex::scoped_lock lock(state->mutex_);

  switch (fork_ev)
  {
  case execution_context::fork_prepare:
    {
      int read_descriptor = state->read_descriptor_;
      state->fork_prepared_ = true;
      lock.unlock();
# if defined(ASIO_HAS_IO_URING_AS_DEFAULT)
      (void)read_descriptor;
      io_uring_service_.deregister_io_object(io_object_data_);
      io_uring_service_.cleanup_io_object(io_object_data_);
# else // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
      reactor_.deregister_internal_descriptor(read_descriptor, reactor_data_);
      reactor_.cleanup_descriptor_data(reactor_data_);
# endif // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
    }
    break;
  case execution_context::fork_parent:
    if (state->fork_prepared_)
    {
      int read_descriptor = state->read_descriptor_;
      state->fork_prepared_ = false;
      lock.unlock();
# if defined(ASIO_HAS_IO_URING_AS_DEFAULT)
      (void)read_descriptor;
      io_uring_service_.register_internal_io_object(io_object_data_,
          io_uring_service::read_op, new pipe_read_op);
# else // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
      reactor_.register_internal_descriptor(reactor::read_op,
          read_descriptor, reactor_data_, new pipe_read_op);
# endif // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
    }
    break;
  case execution_context::fork_child:
    if (state->fork_prepared_)
    {
      asio::detail::signal_blocker blocker;
      close_descriptors();
      open_descriptors();
      int read_descriptor = state->read_descriptor_;
      state->fork_prepared_ = false;
      lock.unlock();
# if defined(ASIO_HAS_IO_URING_AS_DEFAULT)
      (void)read_descriptor;
      io_uring_service_.register_internal_io_object(io_object_data_,
          io_uring_service::read_op, new pipe_read_op);
# else // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
      reactor_.register_internal_descriptor(reactor::read_op,
          read_descriptor, reactor_data_, new pipe_read_op);
# endif // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
    }
    break;
  default:
    break;
  }
#else // !defined(ASIO_WINDOWS)
      //   && !defined(ASIO_WINDOWS_RUNTIME)
      //   && !defined(__CYGWIN__)
  (void)fork_ev;
#endif // !defined(ASIO_WINDOWS)
       //   && !defined(ASIO_WINDOWS_RUNTIME)
       //   && !defined(__CYGWIN__)
}

void signal_set_service::construct(
    signal_set_service::implementation_type& impl)
{
  impl.signals_ = 0;
}

void signal_set_service::destroy(
    signal_set_service::implementation_type& impl)
{
  asio::error_code ignored_ec;
  clear(impl, ignored_ec);
  cancel(impl, ignored_ec);
}

asio::error_code signal_set_service::add(
    signal_set_service::implementation_type& impl, int signal_number,
    signal_set_base::flags_t f, asio::error_code& ec)
{
  // Check that the signal number is valid.
  if (signal_number < 0 || signal_number >= max_signal_number)
  {
    ec = asio::error::invalid_argument;
    return ec;
  }

  // Check that the specified flags are supported.
#if !defined(ASIO_HAS_SIGACTION)
  if (f != signal_set_base::flags::dont_care)
  {
    ec = asio::error::operation_not_supported;
    return ec;
  }
#endif // !defined(ASIO_HAS_SIGACTION)

  signal_state* state = get_signal_state();
  static_mutex::scoped_lock lock(state->mutex_);

  // Find the appropriate place to insert the registration.
  registration** insertion_point = &impl.signals_;
  registration* next = impl.signals_;
  while (next && next->signal_number_ < signal_number)
  {
    insertion_point = &next->next_in_set_;
    next = next->next_in_set_;
  }

  // Only do something if the signal is not already registered.
  if (next == 0 || next->signal_number_ != signal_number)
  {
    registration* new_registration = new registration;

#if defined(ASIO_HAS_SIGNAL) || defined(ASIO_HAS_SIGACTION)
    // Register for the signal if we're the first.
    if (state->registration_count_[signal_number] == 0)
    {
# if defined(ASIO_HAS_SIGACTION)
      using namespace std; // For memset.
      struct sigaction sa;
      memset(&sa, 0, sizeof(sa));
      sa.sa_handler = asio_signal_handler;
      sigfillset(&sa.sa_mask);
      if (f != signal_set_base::flags::dont_care)
        sa.sa_flags = static_cast<int>(f);
      if (::sigaction(signal_number, &sa, 0) == -1)
# else // defined(ASIO_HAS_SIGACTION)
      if (::signal(signal_number, asio_signal_handler) == SIG_ERR)
# endif // defined(ASIO_HAS_SIGACTION)
      {
# if defined(ASIO_WINDOWS) || defined(__CYGWIN__)
        ec = asio::error::invalid_argument;
# else // defined(ASIO_WINDOWS) || defined(__CYGWIN__)
        ec = asio::error_code(errno,
            asio::error::get_system_category());
# endif // defined(ASIO_WINDOWS) || defined(__CYGWIN__)
        delete new_registration;
        return ec;
      }
# if defined(ASIO_HAS_SIGACTION)
      state->flags_[signal_number] = f;
# endif // defined(ASIO_HAS_SIGACTION)
    }
# if defined(ASIO_HAS_SIGACTION)
    // Otherwise check to see if the flags have changed.
    else if (f != signal_set_base::flags::dont_care)
    {
      if (f != state->flags_[signal_number])
      {
        using namespace std; // For memset.
        if (state->flags_[signal_number] != signal_set_base::flags::dont_care)
        {
          ec = asio::error::invalid_argument;
          delete new_registration;
          return ec;
        }
        struct sigaction sa;
        memset(&sa, 0, sizeof(sa));
        sa.sa_handler = asio_signal_handler;
        sigfillset(&sa.sa_mask);
        sa.sa_flags = static_cast<int>(f);
        if (::sigaction(signal_number, &sa, 0) == -1)
        {
          ec = asio::error_code(errno,
              asio::error::get_system_category());
          delete new_registration;
          return ec;
        }
        state->flags_[signal_number] = f;
      }
    }
# endif // defined(ASIO_HAS_SIGACTION)
#endif // defined(ASIO_HAS_SIGNAL) || defined(ASIO_HAS_SIGACTION)

    // Record the new registration in the set.
    new_registration->signal_number_ = signal_number;
    new_registration->queue_ = &impl.queue_;
    new_registration->next_in_set_ = next;
    *insertion_point = new_registration;

    // Insert registration into the registration table.
    new_registration->next_in_table_ = registrations_[signal_number];
    if (registrations_[signal_number])
      registrations_[signal_number]->prev_in_table_ = new_registration;
    registrations_[signal_number] = new_registration;

    ++state->registration_count_[signal_number];
  }

  ec = asio::error_code();
  return ec;
}

asio::error_code signal_set_service::remove(
    signal_set_service::implementation_type& impl,
    int signal_number, asio::error_code& ec)
{
  // Check that the signal number is valid.
  if (signal_number < 0 || signal_number >= max_signal_number)
  {
    ec = asio::error::invalid_argument;
    return ec;
  }

  signal_state* state = get_signal_state();
  static_mutex::scoped_lock lock(state->mutex_);

  // Find the signal number in the list of registrations.
  registration** deletion_point = &impl.signals_;
  registration* reg = impl.signals_;
  while (reg && reg->signal_number_ < signal_number)
  {
    deletion_point = &reg->next_in_set_;
    reg = reg->next_in_set_;
  }

  if (reg != 0 && reg->signal_number_ == signal_number)
  {
#if defined(ASIO_HAS_SIGNAL) || defined(ASIO_HAS_SIGACTION)
    // Set signal handler back to the default if we're the last.
    if (state->registration_count_[signal_number] == 1)
    {
# if defined(ASIO_HAS_SIGACTION)
      using namespace std; // For memset.
      struct sigaction sa;
      memset(&sa, 0, sizeof(sa));
      sa.sa_handler = SIG_DFL;
      if (::sigaction(signal_number, &sa, 0) == -1)
# else // defined(ASIO_HAS_SIGACTION)
      if (::signal(signal_number, SIG_DFL) == SIG_ERR)
# endif // defined(ASIO_HAS_SIGACTION)
      {
# if defined(ASIO_WINDOWS) || defined(__CYGWIN__)
        ec = asio::error::invalid_argument;
# else // defined(ASIO_WINDOWS) || defined(__CYGWIN__)
        ec = asio::error_code(errno,
            asio::error::get_system_category());
# endif // defined(ASIO_WINDOWS) || defined(__CYGWIN__)
        return ec;
      }
# if defined(ASIO_HAS_SIGACTION)
      state->flags_[signal_number] = signal_set_base::flags_t();
# endif // defined(ASIO_HAS_SIGACTION)
    }
#endif // defined(ASIO_HAS_SIGNAL) || defined(ASIO_HAS_SIGACTION)

    // Remove the registration from the set.
    *deletion_point = reg->next_in_set_;

    // Remove the registration from the registration table.
    if (registrations_[signal_number] == reg)
      registrations_[signal_number] = reg->next_in_table_;
    if (reg->prev_in_table_)
      reg->prev_in_table_->next_in_table_ = reg->next_in_table_;
    if (reg->next_in_table_)
      reg->next_in_table_->prev_in_table_ = reg->prev_in_table_;

    --state->registration_count_[signal_number];

    delete reg;
  }

  ec = asio::error_code();
  return ec;
}

asio::error_code signal_set_service::clear(
    signal_set_service::implementation_type& impl,
    asio::error_code& ec)
{
  signal_state* state = get_signal_state();
  static_mutex::scoped_lock lock(state->mutex_);

  while (registration* reg = impl.signals_)
  {
#if defined(ASIO_HAS_SIGNAL) || defined(ASIO_HAS_SIGACTION)
    // Set signal handler back to the default if we're the last.
    if (state->registration_count_[reg->signal_number_] == 1)
    {
# if defined(ASIO_HAS_SIGACTION)
      using namespace std; // For memset.
      struct sigaction sa;
      memset(&sa, 0, sizeof(sa));
      sa.sa_handler = SIG_DFL;
      if (::sigaction(reg->signal_number_, &sa, 0) == -1)
# else // defined(ASIO_HAS_SIGACTION)
      if (::signal(reg->signal_number_, SIG_DFL) == SIG_ERR)
# endif // defined(ASIO_HAS_SIGACTION)
      {
# if defined(ASIO_WINDOWS) || defined(__CYGWIN__)
        ec = asio::error::invalid_argument;
# else // defined(ASIO_WINDOWS) || defined(__CYGWIN__)
        ec = asio::error_code(errno,
            asio::error::get_system_category());
# endif // defined(ASIO_WINDOWS) || defined(__CYGWIN__)
        return ec;
      }
# if defined(ASIO_HAS_SIGACTION)
      state->flags_[reg->signal_number_] = signal_set_base::flags_t();
# endif // defined(ASIO_HAS_SIGACTION)
    }
#endif // defined(ASIO_HAS_SIGNAL) || defined(ASIO_HAS_SIGACTION)

    // Remove the registration from the registration table.
    if (registrations_[reg->signal_number_] == reg)
      registrations_[reg->signal_number_] = reg->next_in_table_;
    if (reg->prev_in_table_)
      reg->prev_in_table_->next_in_table_ = reg->next_in_table_;
    if (reg->next_in_table_)
      reg->next_in_table_->prev_in_table_ = reg->prev_in_table_;

    --state->registration_count_[reg->signal_number_];

    impl.signals_ = reg->next_in_set_;
    delete reg;
  }

  ec = asio::error_code();
  return ec;
}

asio::error_code signal_set_service::cancel(
    signal_set_service::implementation_type& impl,
    asio::error_code& ec)
{
  ASIO_HANDLER_OPERATION((scheduler_.context(),
        "signal_set", &impl, 0, "cancel"));

  op_queue<operation> ops;
  {
    signal_state* state = get_signal_state();
    static_mutex::scoped_lock lock(state->mutex_);

    while (signal_op* op = impl.queue_.front())
    {
      op->ec_ = asio::error::operation_aborted;
      impl.queue_.pop();
      ops.push(op);
    }
  }

  scheduler_.post_deferred_completions(ops);

  ec = asio::error_code();
  return ec;
}

void signal_set_service::cancel_ops_by_key(
    signal_set_service::implementation_type& impl, void* cancellation_key)
{
  op_queue<operation> ops;
  {
    op_queue<signal_op> other_ops;
    signal_state* state = get_signal_state();
    static_mutex::scoped_lock lock(state->mutex_);

    while (signal_op* op = impl.queue_.front())
    {
      impl.queue_.pop();
      if (op->cancellation_key_ == cancellation_key)
      {
        op->ec_ = asio::error::operation_aborted;
        ops.push(op);
      }
      else
        other_ops.push(op);
    }

    impl.queue_.push(other_ops);
  }

  scheduler_.post_deferred_completions(ops);
}

void signal_set_service::deliver_signal(int signal_number)
{
  signal_state* state = get_signal_state();
  static_mutex::scoped_lock lock(state->mutex_);

  signal_set_service* service = state->service_list_;
  while (service)
  {
    op_queue<operation> ops;

    registration* reg = service->registrations_[signal_number];
    while (reg)
    {
      if (reg->queue_->empty())
      {
        ++reg->undelivered_;
      }
      else
      {
        while (signal_op* op = reg->queue_->front())
        {
          op->signal_number_ = signal_number;
          reg->queue_->pop();
          ops.push(op);
        }
      }

      reg = reg->next_in_table_;
    }

    service->scheduler_.post_deferred_completions(ops);

    service = service->next_;
  }
}

void signal_set_service::add_service(signal_set_service* service)
{
  signal_state* state = get_signal_state();
  static_mutex::scoped_lock lock(state->mutex_);

#if !defined(ASIO_WINDOWS) && !defined(__CYGWIN__)
  // If this is the first service to be created, open a new pipe.
  if (state->service_list_ == 0)
    open_descriptors();
#endif // !defined(ASIO_WINDOWS) && !defined(__CYGWIN__)

  // If a scheduler_ object is thread-unsafe then it must be the only
  // scheduler used to create signal_set objects.
  if (state->service_list_ != 0)
  {
    if (!config(service->context()).get("scheduler", "locking", true)
        || !config(state->service_list_->context()).get(
            "scheduler", "locking", true))
    {
      std::logic_error ex(
          "Thread-unsafe execution context objects require "
          "exclusive access to signal handling.");
      asio::detail::throw_exception(ex);
    }
  }

  // Insert service into linked list of all services.
  service->next_ = state->service_list_;
  service->prev_ = 0;
  if (state->service_list_)
    state->service_list_->prev_ = service;
  state->service_list_ = service;

#if !defined(ASIO_WINDOWS) \
  && !defined(ASIO_WINDOWS_RUNTIME) \
  && !defined(__CYGWIN__)
  // Register for pipe readiness notifications.
  int read_descriptor = state->read_descriptor_;
  lock.unlock();
# if defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  (void)read_descriptor;
  service->io_uring_service_.register_internal_io_object(
      service->io_object_data_, io_uring_service::read_op, new pipe_read_op);
# else // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  service->reactor_.register_internal_descriptor(reactor::read_op,
      read_descriptor, service->reactor_data_, new pipe_read_op);
# endif // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
#endif // !defined(ASIO_WINDOWS)
       //   && !defined(ASIO_WINDOWS_RUNTIME)
       //   && !defined(__CYGWIN__)
}

void signal_set_service::remove_service(signal_set_service* service)
{
  signal_state* state = get_signal_state();
  static_mutex::scoped_lock lock(state->mutex_);

  if (service->next_ || service->prev_ || state->service_list_ == service)
  {
#if !defined(ASIO_WINDOWS) \
  && !defined(ASIO_WINDOWS_RUNTIME) \
  && !defined(__CYGWIN__)
    // Disable the pipe readiness notifications.
    int read_descriptor = state->read_descriptor_;
    lock.unlock();
# if defined(ASIO_HAS_IO_URING_AS_DEFAULT)
    (void)read_descriptor;
    service->io_uring_service_.deregister_io_object(service->io_object_data_);
    service->io_uring_service_.cleanup_io_object(service->io_object_data_);
    lock.lock();
# else // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
    service->reactor_.deregister_internal_descriptor(
        read_descriptor, service->reactor_data_);
    service->reactor_.cleanup_descriptor_data(service->reactor_data_);
    lock.lock();
# endif // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
#endif // !defined(ASIO_WINDOWS)
       //   && !defined(ASIO_WINDOWS_RUNTIME)
       //   && !defined(__CYGWIN__)

    // Remove service from linked list of all services.
    if (state->service_list_ == service)
      state->service_list_ = service->next_;
    if (service->prev_)
      service->prev_->next_ = service->next_;
    if (service->next_)
      service->next_->prev_= service->prev_;
    service->next_ = 0;
    service->prev_ = 0;

#if !defined(ASIO_WINDOWS) && !defined(__CYGWIN__)
    // If this is the last service to be removed, close the pipe.
    if (state->service_list_ == 0)
      close_descriptors();
#endif // !defined(ASIO_WINDOWS) && !defined(__CYGWIN__)
  }
}

void signal_set_service::open_descriptors()
{
#if !defined(ASIO_WINDOWS) \
  && !defined(ASIO_WINDOWS_RUNTIME) \
  && !defined(__CYGWIN__)
  signal_state* state = get_signal_state();

  int pipe_fds[2];
  if (::pipe(pipe_fds) == 0)
  {
    state->read_descriptor_ = pipe_fds[0];
    ::fcntl(state->read_descriptor_, F_SETFL, O_NONBLOCK);

    state->write_descriptor_ = pipe_fds[1];
    ::fcntl(state->write_descriptor_, F_SETFL, O_NONBLOCK);

#if defined(FD_CLOEXEC)
    ::fcntl(state->read_descriptor_, F_SETFD, FD_CLOEXEC);
    ::fcntl(state->write_descriptor_, F_SETFD, FD_CLOEXEC);
#endif // defined(FD_CLOEXEC)
  }
  else
  {
    asio::error_code ec(errno,
        asio::error::get_system_category());
    asio::detail::throw_error(ec, "signal_set_service pipe");
  }
#endif // !defined(ASIO_WINDOWS)
       //   && !defined(ASIO_WINDOWS_RUNTIME)
       //   && !defined(__CYGWIN__)
}

void signal_set_service::close_descriptors()
{
#if !defined(ASIO_WINDOWS) \
  && !defined(ASIO_WINDOWS_RUNTIME) \
  && !defined(__CYGWIN__)
  signal_state* state = get_signal_state();

  if (state->read_descriptor_ != -1)
    ::close(state->read_descriptor_);
  state->read_descriptor_ = -1;

  if (state->write_descriptor_ != -1)
    ::close(state->write_descriptor_);
  state->write_descriptor_ = -1;
#endif // !defined(ASIO_WINDOWS)
       //   && !defined(ASIO_WINDOWS_RUNTIME)
       //   && !defined(__CYGWIN__)
}

void signal_set_service::start_wait_op(
    signal_set_service::implementation_type& impl, signal_op* op)
{
  scheduler_.work_started();

  signal_state* state = get_signal_state();
  static_mutex::scoped_lock lock(state->mutex_);

  registration* reg = impl.signals_;
  while (reg)
  {
    if (reg->undelivered_ > 0)
    {
      --reg->undelivered_;
      op->signal_number_ = reg->signal_number_;
      scheduler_.post_deferred_completion(op);
      return;
    }

    reg = reg->next_in_set_;
  }

  impl.queue_.push(op);
}

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DETAIL_IMPL_SIGNAL_SET_SERVICE_IPP
