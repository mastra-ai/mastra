//
// detail/reactive_socket_service_base.ipp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_IMPL_REACTIVE_SOCKET_SERVICE_BASE_IPP
#define ASIO_DETAIL_IMPL_REACTIVE_SOCKET_SERVICE_BASE_IPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if !defined(ASIO_HAS_IOCP) \
  && !defined(ASIO_WINDOWS_RUNTIME) \
  && !defined(ASIO_HAS_IO_URING_AS_DEFAULT)

#include "asio/detail/reactive_socket_service_base.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

reactive_socket_service_base::reactive_socket_service_base(
    execution_context& context)
  : reactor_(use_service<reactor>(context))
{
  reactor_.init_task();
}

void reactive_socket_service_base::base_shutdown()
{
}

void reactive_socket_service_base::construct(
    reactive_socket_service_base::base_implementation_type& impl)
{
  impl.socket_ = invalid_socket;
  impl.state_ = 0;
  impl.reactor_data_ = reactor::per_descriptor_data();
}

void reactive_socket_service_base::base_move_construct(
    reactive_socket_service_base::base_implementation_type& impl,
    reactive_socket_service_base::base_implementation_type& other_impl)
  noexcept
{
  impl.socket_ = other_impl.socket_;
  other_impl.socket_ = invalid_socket;

  impl.state_ = other_impl.state_;
  other_impl.state_ = 0;

  reactor_.move_descriptor(impl.socket_,
      impl.reactor_data_, other_impl.reactor_data_);
}

void reactive_socket_service_base::base_move_assign(
    reactive_socket_service_base::base_implementation_type& impl,
    reactive_socket_service_base& other_service,
    reactive_socket_service_base::base_implementation_type& other_impl)
{
  destroy(impl);

  impl.socket_ = other_impl.socket_;
  other_impl.socket_ = invalid_socket;

  impl.state_ = other_impl.state_;
  other_impl.state_ = 0;

  other_service.reactor_.move_descriptor(impl.socket_,
      impl.reactor_data_, other_impl.reactor_data_);
}

void reactive_socket_service_base::destroy(
    reactive_socket_service_base::base_implementation_type& impl)
{
  if (impl.socket_ != invalid_socket)
  {
    ASIO_HANDLER_OPERATION((reactor_.context(),
          "socket", &impl, impl.socket_, "close"));

    reactor_.deregister_descriptor(impl.socket_, impl.reactor_data_,
        (impl.state_ & socket_ops::possible_dup) == 0);

    asio::error_code ignored_ec;
    socket_ops::close(impl.socket_, impl.state_, true, ignored_ec);

    reactor_.cleanup_descriptor_data(impl.reactor_data_);
  }
}

asio::error_code reactive_socket_service_base::close(
    reactive_socket_service_base::base_implementation_type& impl,
    asio::error_code& ec)
{
  if (is_open(impl))
  {
    ASIO_HANDLER_OPERATION((reactor_.context(),
          "socket", &impl, impl.socket_, "close"));

    reactor_.deregister_descriptor(impl.socket_, impl.reactor_data_,
        (impl.state_ & socket_ops::possible_dup) == 0);

    socket_ops::close(impl.socket_, impl.state_, false, ec);

    reactor_.cleanup_descriptor_data(impl.reactor_data_);
  }
  else
  {
    ec = asio::error_code();
  }

  // The descriptor is closed by the OS even if close() returns an error.
  //
  // (Actually, POSIX says the state of the descriptor is unspecified. On
  // Linux the descriptor is apparently closed anyway; e.g. see
  //   http://lkml.org/lkml/2005/9/10/129
  // We'll just have to assume that other OSes follow the same behaviour. The
  // known exception is when Windows's closesocket() function fails with
  // WSAEWOULDBLOCK, but this case is handled inside socket_ops::close().
  construct(impl);

  return ec;
}

socket_type reactive_socket_service_base::release(
    reactive_socket_service_base::base_implementation_type& impl,
    asio::error_code& ec)
{
  if (!is_open(impl))
  {
    ec = asio::error::bad_descriptor;
    return invalid_socket;
  }

  ASIO_HANDLER_OPERATION((reactor_.context(),
        "socket", &impl, impl.socket_, "release"));

  reactor_.deregister_descriptor(impl.socket_, impl.reactor_data_, false);
  reactor_.cleanup_descriptor_data(impl.reactor_data_);
  socket_type sock = impl.socket_;
  construct(impl);
  ec = asio::error_code();
  return sock;
}

asio::error_code reactive_socket_service_base::cancel(
    reactive_socket_service_base::base_implementation_type& impl,
    asio::error_code& ec)
{
  if (!is_open(impl))
  {
    ec = asio::error::bad_descriptor;
    return ec;
  }

  ASIO_HANDLER_OPERATION((reactor_.context(),
        "socket", &impl, impl.socket_, "cancel"));

  reactor_.cancel_ops(impl.socket_, impl.reactor_data_);
  ec = asio::error_code();
  return ec;
}

asio::error_code reactive_socket_service_base::do_open(
    reactive_socket_service_base::base_implementation_type& impl,
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

  if (int err = reactor_.register_descriptor(sock.get(), impl.reactor_data_))
  {
    ec = asio::error_code(err,
        asio::error::get_system_category());
    return ec;
  }

  impl.socket_ = sock.release();
  switch (type)
  {
  case SOCK_STREAM: impl.state_ = socket_ops::stream_oriented; break;
  case SOCK_DGRAM: impl.state_ = socket_ops::datagram_oriented; break;
  default: impl.state_ = 0; break;
  }
  ec = asio::error_code();
  return ec;
}

asio::error_code reactive_socket_service_base::do_assign(
    reactive_socket_service_base::base_implementation_type& impl, int type,
    const reactive_socket_service_base::native_handle_type& native_socket,
    asio::error_code& ec)
{
  if (is_open(impl))
  {
    ec = asio::error::already_open;
    return ec;
  }

  if (int err = reactor_.register_descriptor(
        native_socket, impl.reactor_data_))
  {
    ec = asio::error_code(err,
        asio::error::get_system_category());
    return ec;
  }

  impl.socket_ = native_socket;
  switch (type)
  {
  case SOCK_STREAM: impl.state_ = socket_ops::stream_oriented; break;
  case SOCK_DGRAM: impl.state_ = socket_ops::datagram_oriented; break;
  default: impl.state_ = 0; break;
  }
  impl.state_ |= socket_ops::possible_dup;
  ec = asio::error_code();
  return ec;
}

void reactive_socket_service_base::do_start_op(
    reactive_socket_service_base::base_implementation_type& impl,
    int op_type, reactor_op* op, bool is_continuation,
    bool allow_speculative, bool noop, bool needs_non_blocking,
    void (*on_immediate)(operation* op, bool, const void*),
    const void* immediate_arg)
{
  if (!noop)
  {
    if ((impl.state_ & socket_ops::non_blocking)
        || !needs_non_blocking
        || socket_ops::set_internal_non_blocking(
          impl.socket_, impl.state_, true, op->ec_))
    {
      reactor_.start_op(op_type, impl.socket_, impl.reactor_data_, op,
          is_continuation, allow_speculative, on_immediate, immediate_arg);
      return;
    }
  }

  on_immediate(op, is_continuation, immediate_arg);
}

void reactive_socket_service_base::do_start_accept_op(
    reactive_socket_service_base::base_implementation_type& impl,
    reactor_op* op, bool is_continuation, bool peer_is_open,
    void (*on_immediate)(operation* op, bool, const void*),
    const void* immediate_arg)
{
  if (!peer_is_open)
  {
    do_start_op(impl, reactor::read_op, op, is_continuation,
        true, false, true, on_immediate, immediate_arg);
  }
  else
  {
    op->ec_ = asio::error::already_open;
    on_immediate(op, is_continuation, immediate_arg);
  }
}

void reactive_socket_service_base::do_start_connect_op(
    reactive_socket_service_base::base_implementation_type& impl,
    reactor_op* op, bool is_continuation, const void* addr, size_t addrlen,
    void (*on_immediate)(operation* op, bool, const void*),
    const void* immediate_arg)
{
  if ((impl.state_ & socket_ops::non_blocking)
      || socket_ops::set_internal_non_blocking(
        impl.socket_, impl.state_, true, op->ec_))
  {
    if (socket_ops::connect(impl.socket_, addr, addrlen, op->ec_) != 0)
    {
      if (op->ec_ == asio::error::in_progress
          || op->ec_ == asio::error::would_block)
      {
        op->ec_ = asio::error_code();
        reactor_.start_op(reactor::connect_op, impl.socket_, impl.reactor_data_,
            op, is_continuation, false, on_immediate, immediate_arg);
        return;
      }
    }
  }

  on_immediate(op, is_continuation, immediate_arg);
}

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // !defined(ASIO_HAS_IOCP)
       //   && !defined(ASIO_WINDOWS_RUNTIME)
       //   && !defined(ASIO_HAS_IO_URING_AS_DEFAULT)

#endif // ASIO_DETAIL_IMPL_REACTIVE_SOCKET_SERVICE_BASE_IPP
