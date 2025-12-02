//
// detail/impl/io_uring_descriptor_service.ipp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_IMPL_IO_URING_DESCRIPTOR_SERVICE_IPP
#define ASIO_DETAIL_IMPL_IO_URING_DESCRIPTOR_SERVICE_IPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_IO_URING)

#include "asio/error.hpp"
#include "asio/detail/io_uring_descriptor_service.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

io_uring_descriptor_service::io_uring_descriptor_service(
    execution_context& context)
  : execution_context_service_base<io_uring_descriptor_service>(context),
    io_uring_service_(asio::use_service<io_uring_service>(context))
{
  io_uring_service_.init_task();
}

void io_uring_descriptor_service::shutdown()
{
}

void io_uring_descriptor_service::construct(
    io_uring_descriptor_service::implementation_type& impl)
{
  impl.descriptor_ = -1;
  impl.state_ = 0;
  impl.io_object_data_ = 0;
}

void io_uring_descriptor_service::move_construct(
    io_uring_descriptor_service::implementation_type& impl,
    io_uring_descriptor_service::implementation_type& other_impl)
  noexcept
{
  impl.descriptor_ = other_impl.descriptor_;
  other_impl.descriptor_ = -1;

  impl.state_ = other_impl.state_;
  other_impl.state_ = 0;

  impl.io_object_data_ = other_impl.io_object_data_;
  other_impl.io_object_data_ = 0;
}

void io_uring_descriptor_service::move_assign(
    io_uring_descriptor_service::implementation_type& impl,
    io_uring_descriptor_service& /*other_service*/,
    io_uring_descriptor_service::implementation_type& other_impl)
{
  destroy(impl);

  impl.descriptor_ = other_impl.descriptor_;
  other_impl.descriptor_ = -1;

  impl.state_ = other_impl.state_;
  other_impl.state_ = 0;

  impl.io_object_data_ = other_impl.io_object_data_;
  other_impl.io_object_data_ = 0;
}

void io_uring_descriptor_service::destroy(
    io_uring_descriptor_service::implementation_type& impl)
{
  if (is_open(impl))
  {
    ASIO_HANDLER_OPERATION((io_uring_service_.context(),
          "descriptor", &impl, impl.descriptor_, "close"));

    io_uring_service_.deregister_io_object(impl.io_object_data_);
    asio::error_code ignored_ec;
    descriptor_ops::close(impl.descriptor_, impl.state_, ignored_ec);
    io_uring_service_.cleanup_io_object(impl.io_object_data_);
  }
}

asio::error_code io_uring_descriptor_service::assign(
    io_uring_descriptor_service::implementation_type& impl,
    const native_handle_type& native_descriptor, asio::error_code& ec)
{
  if (is_open(impl))
  {
    ec = asio::error::already_open;
    ASIO_ERROR_LOCATION(ec);
    return ec;
  }

  io_uring_service_.register_io_object(impl.io_object_data_);

  impl.descriptor_ = native_descriptor;
  impl.state_ = descriptor_ops::possible_dup;
  ec = success_ec_;
  return ec;
}

asio::error_code io_uring_descriptor_service::close(
    io_uring_descriptor_service::implementation_type& impl,
    asio::error_code& ec)
{
  if (is_open(impl))
  {
    ASIO_HANDLER_OPERATION((io_uring_service_.context(),
          "descriptor", &impl, impl.descriptor_, "close"));

    io_uring_service_.deregister_io_object(impl.io_object_data_);
    descriptor_ops::close(impl.descriptor_, impl.state_, ec);
    io_uring_service_.cleanup_io_object(impl.io_object_data_);
  }
  else
  {
    ec = success_ec_;
  }

  // The descriptor is closed by the OS even if close() returns an error.
  //
  // (Actually, POSIX says the state of the descriptor is unspecified. On
  // Linux the descriptor is apparently closed anyway; e.g. see
  //   http://lkml.org/lkml/2005/9/10/129
  construct(impl);

  ASIO_ERROR_LOCATION(ec);
  return ec;
}

io_uring_descriptor_service::native_handle_type
io_uring_descriptor_service::release(
    io_uring_descriptor_service::implementation_type& impl)
{
  native_handle_type descriptor = impl.descriptor_;

  if (is_open(impl))
  {
    ASIO_HANDLER_OPERATION((io_uring_service_.context(),
          "descriptor", &impl, impl.descriptor_, "release"));

    io_uring_service_.deregister_io_object(impl.io_object_data_);
    io_uring_service_.cleanup_io_object(impl.io_object_data_);
    construct(impl);
  }

  return descriptor;
}

asio::error_code io_uring_descriptor_service::cancel(
    io_uring_descriptor_service::implementation_type& impl,
    asio::error_code& ec)
{
  if (!is_open(impl))
  {
    ec = asio::error::bad_descriptor;
    ASIO_ERROR_LOCATION(ec);
    return ec;
  }

  ASIO_HANDLER_OPERATION((io_uring_service_.context(),
        "descriptor", &impl, impl.descriptor_, "cancel"));

  io_uring_service_.cancel_ops(impl.io_object_data_);
  ec = success_ec_;
  return ec;
}

void io_uring_descriptor_service::start_op(
    io_uring_descriptor_service::implementation_type& impl,
    int op_type, io_uring_operation* op, bool is_continuation, bool noop)
{
  if (!noop)
  {
    io_uring_service_.start_op(op_type,
        impl.io_object_data_, op, is_continuation);
  }
  else
  {
    io_uring_service_.post_immediate_completion(op, is_continuation);
  }
}

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // defined(ASIO_HAS_IO_URING)

#endif // ASIO_DETAIL_IMPL_IO_URING_DESCRIPTOR_SERVICE_IPP
