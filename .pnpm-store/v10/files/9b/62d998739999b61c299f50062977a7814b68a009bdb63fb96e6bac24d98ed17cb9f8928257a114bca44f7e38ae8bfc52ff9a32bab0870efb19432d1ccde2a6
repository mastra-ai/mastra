//
// detail/impl/resolver_service_base.ipp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_IMPL_RESOLVER_SERVICE_BASE_IPP
#define ASIO_DETAIL_IMPL_RESOLVER_SERVICE_BASE_IPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/config.hpp"
#include "asio/detail/resolver_service_base.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

class resolver_service_base::work_scheduler_runner
{
public:
  work_scheduler_runner(scheduler_impl& work_scheduler)
    : work_scheduler_(work_scheduler)
  {
  }

  void operator()()
  {
    asio::error_code ec;
    work_scheduler_.run(ec);
  }

private:
  scheduler_impl& work_scheduler_;
};

resolver_service_base::resolver_service_base(execution_context& context)
  : scheduler_(asio::use_service<scheduler_impl>(context)),
    work_scheduler_(new scheduler_impl(context, false)),
    work_thread_(0),
    scheduler_locking_(config(context).get("scheduler", "locking", true))
{
  work_scheduler_->work_started();
}

resolver_service_base::~resolver_service_base()
{
  base_shutdown();
}

void resolver_service_base::base_shutdown()
{
  if (work_scheduler_.get())
  {
    work_scheduler_->work_finished();
    work_scheduler_->stop();
    if (work_thread_.get())
    {
      work_thread_->join();
      work_thread_.reset();
    }
    work_scheduler_.reset();
  }
}

void resolver_service_base::base_notify_fork(
    execution_context::fork_event fork_ev)
{
  if (work_thread_.get())
  {
    if (fork_ev == execution_context::fork_prepare)
    {
      work_scheduler_->stop();
      work_thread_->join();
      work_thread_.reset();
    }
  }
  else if (fork_ev != execution_context::fork_prepare)
  {
    work_scheduler_->restart();
  }
}

void resolver_service_base::construct(
    resolver_service_base::implementation_type& impl)
{
  impl.reset(static_cast<void*>(0), socket_ops::noop_deleter());
}

void resolver_service_base::destroy(
    resolver_service_base::implementation_type& impl)
{
  ASIO_HANDLER_OPERATION((scheduler_.context(),
        "resolver", &impl, 0, "cancel"));

  impl.reset();
}

void resolver_service_base::move_construct(implementation_type& impl,
    implementation_type& other_impl)
{
  impl = static_cast<implementation_type&&>(other_impl);
}

void resolver_service_base::move_assign(implementation_type& impl,
    resolver_service_base&, implementation_type& other_impl)
{
  destroy(impl);
  impl = static_cast<implementation_type&&>(other_impl);
}

void resolver_service_base::cancel(
    resolver_service_base::implementation_type& impl)
{
  ASIO_HANDLER_OPERATION((scheduler_.context(),
        "resolver", &impl, 0, "cancel"));

  impl.reset(static_cast<void*>(0), socket_ops::noop_deleter());
}

void resolver_service_base::start_resolve_op(resolve_op* op)
{
  if (scheduler_locking_)
  {
    start_work_thread();
    scheduler_.work_started();
    work_scheduler_->post_immediate_completion(op, false);
  }
  else
  {
    op->ec_ = asio::error::operation_not_supported;
    scheduler_.post_immediate_completion(op, false);
  }
}

void resolver_service_base::start_work_thread()
{
  asio::detail::mutex::scoped_lock lock(mutex_);
  if (!work_thread_.get())
  {
    work_thread_.reset(new asio::detail::thread(
          work_scheduler_runner(*work_scheduler_)));
  }
}

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DETAIL_IMPL_RESOLVER_SERVICE_BASE_IPP
