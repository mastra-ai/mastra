//
// detail/io_uring_socket_service_base.ipp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_IMPL_IO_URING_SOCKET_SERVICE_BASE_IPP
#define ASIO_DETAIL_IMPL_IO_URING_SOCKET_SERVICE_BASE_IPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_IO_URING)

#include "asio/detail/io_uring_socket_service_base.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

io_uring_socket_service_base::io_uring_socket_service_base(
    execution_context& context)
  : io_uring_service_(asio::use_service<io_uring_service>(context))
{
  io_uring_service_.init_task();
}

void io_uring_socket_service_base::base_shutdown()
{
}

void io_uring_socket_service_base::construct(
    io_uring_socket_service_base::base_implementation_type& impl)
{
  impl.socket_ = invalid_socket;
  impl.state_ = 0;
  impl.io_object_data_ = 0;
}

void io_uring_socket_service_base::base_move_construct(
    io_uring_socket_service_base::base_implementation_type& impl,
    io_uring_socket_service_base::base_implementation_type& other_impl)
  noexcept
{
  impl.socket_ = other_impl.socket_;
  other_impl.socket_ = invalid_socket;

  impl.state_ = other_impl.state_;
  other_impl.state_ = 0;

  impl.io_object_data_ = other_impl.io_object_data_;
  other_impl.io_object_data_ = 0;
}

void io_uring_socket_service_base::base_move_assign(
    io_uring_socket_service_base::base_implementation_type& impl,
    io_uring_socket_service_base& /*other_service*/,
    io_uring_socket_service_base::base_implementation_type& other_impl)
{
  destroy(impl);

  impl.socket_ = other_impl.socket_;
  other_impl.socket_ = invalid_socket;

  impl.state_ = other_impl.state_;
  other_impl.state_ = 0;

  impl.io_object_data_ = other_impl.io_object_data_;
  other_impl.io_object_data_ = 0;
}

void io_uring_socket_service_base::destroy(
    io_uring_socket_service_base::base_implementation_type& impl)
{
  if (impl.socket_ != invalid_socket)
  {
    ASIO_HANDLER_OPERATION((io_uring_service_.context(),
          "socket", &impl, impl.socket_, "close"));

    io_uring_service_.deregister_io_object(impl.io_object_data_);
    asio::error_code ignored_ec;
    socket_ops::close(impl.socket_, impl.state_, true, ignored_ec);
    io_uring_service_.cleanup_io_object(impl.io_object_data_);
  }
}

asio::error_code io_uring_socket_service_base::close(
    io_uring_socket_service_base::base_implementation_type& impl,
    asio::error_code& ec)
{
  if (is_open(impl))
  {
    ASIO_HANDLER_OPERATION((io_uring_service_.context(),
          "socket", &impl, impl.socket_, "close"));

    io_uring_service_.deregister_io_object(impl.io_object_data_);
    socket_ops::close(impl.socket_, impl.state_, false, ec);
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

  return ec;
}

socket_type io_uring_socket_service_base::release(
    io_uring_socket_service_base::base_implementation_type& impl,
    asio::error_code& ec)
{
  if (!is_open(impl))
  {
    ec = asio::error::bad_descriptor;
    return invalid_socket;
  }

  ASIO_HANDLER_OPERATION((io_uring_service_.context(),
        "socket", &impl, impl.socket_, "release"));

  io_uring_service_.deregister_io_object(impl.io_object_data_);
  io_uring_service_.cleanup_io_object(impl.io_object_data_);
  socket_type sock = impl.socket_;
  construct(impl);
  ec = success_ec_;
  return sock;
}

asio::error_code io_uring_socket_service_base::cancel(
    io_uring_socket_service_base::base_implementation_type& impl,
    asio::error_code& ec)
{
  if (!is_open(impl))
  {
    ec = asio::error::bad_descriptor;
    return ec;
  }

  ASIO_HANDLER_OPERATION((io_uring_service_.context(),
        "socket", &impl, impl.socket_, "cancel"));

  io_uring_service_.cancel_ops(impl.io_object_data_);
  ec = success_ec_;
  return ec;
}

asio::error_code io_uring_socket_service_base::do_open(
    io_uring_socket_service_base::base_implementation_type& impl,
    int af, int type, int protocol, asio::error_code& ec)
{
  if (is_open(impl))
  {
    ec = asio::error::already_open;
    return ec;
  }

  socket_holder sock(socket_ops::socket(af, type, protocol, ec));
  if (sock.get() == invalid_socket)
    return ec;

  io_uring_service_.register_io_object(impl.io_object_data_);

  impl.socket_ = sock.release();
  switch (type)
  {
  case SOCK_STREAM: impl.state_ = socket_ops::stream_oriented; break;
  case SOCK_DGRAM: impl.state_ = socket_ops::datagram_oriented; break;
  default: impl.state_ = 0; break;
  }
  ec = success_ec_;
  return ec;
}

asio::error_code io_uring_socket_service_base::do_assign(
    io_uring_socket_service_base::base_implementation_type& impl, int type,
    const io_uring_socket_service_base::native_handle_type& native_socket,
    asio::error_code& ec)
{
  if (is_open(impl))
  {
    ec = asio::error::already_open;
    return ec;
  }

  io_uring_service_.register_io_object(impl.io_object_data_);

  impl.socket_ = native_socket;
  switch (type)
  {
  case SOCK_STREAM: impl.state_ = socket_ops::stream_oriented; break;
  case SOCK_DGRAM: impl.state_ = socket_ops::datagram_oriented; break;
  default: impl.state_ = 0; break;
  }
  impl.state_ |= socket_ops::possible_dup;
  ec = success_ec_;
  return ec;
}

void io_uring_socket_service_base::start_op(
    io_uring_socket_service_base::base_implementation_type& impl,
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

void io_uring_socket_service_base::start_accept_op(
    io_uring_socket_service_base::base_implementation_type& impl,
    io_uring_operation* op, bool is_continuation, bool peer_is_open)
{
  if (!peer_is_open)
    start_op(impl, io_uring_service::read_op, op, is_continuation, false);
  else
  {
    op->ec_ = asio::error::already_open;
    io_uring_service_.post_immediate_completion(op, is_continuation);
  }
}

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // defined(ASIO_HAS_IO_URING)

#endif // ASIO_DETAIL_IMPL_IO_URING_SOCKET_SERVICE_BASE_IPP
