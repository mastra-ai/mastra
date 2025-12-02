//
// detail/io_uring_socket_service_base.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_IO_URING_SOCKET_SERVICE_BASE_HPP
#define ASIO_DETAIL_IO_URING_SOCKET_SERVICE_BASE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_IO_URING)

#include "asio/associated_cancellation_slot.hpp"
#include "asio/buffer.hpp"
#include "asio/cancellation_type.hpp"
#include "asio/error.hpp"
#include "asio/execution_context.hpp"
#include "asio/socket_base.hpp"
#include "asio/detail/buffer_sequence_adapter.hpp"
#include "asio/detail/memory.hpp"
#include "asio/detail/io_uring_null_buffers_op.hpp"
#include "asio/detail/io_uring_service.hpp"
#include "asio/detail/io_uring_socket_recv_op.hpp"
#include "asio/detail/io_uring_socket_recvmsg_op.hpp"
#include "asio/detail/io_uring_socket_send_op.hpp"
#include "asio/detail/io_uring_wait_op.hpp"
#include "asio/detail/socket_holder.hpp"
#include "asio/detail/socket_ops.hpp"
#include "asio/detail/socket_types.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

class io_uring_socket_service_base
{
public:
  // The native type of a socket.
  typedef socket_type native_handle_type;

  // The implementation type of the socket.
  struct base_implementation_type
  {
    // The native socket representation.
    socket_type socket_;

    // The current state of the socket.
    socket_ops::state_type state_;

    // Per I/O object data used by the io_uring_service.
    io_uring_service::per_io_object_data io_object_data_;
  };

  // Constructor.
  ASIO_DECL io_uring_socket_service_base(execution_context& context);

  // Destroy all user-defined handler objects owned by the service.
  ASIO_DECL void base_shutdown();

  // Construct a new socket implementation.
  ASIO_DECL void construct(base_implementation_type& impl);

  // Move-construct a new socket implementation.
  ASIO_DECL void base_move_construct(base_implementation_type& impl,
      base_implementation_type& other_impl) noexcept;

  // Move-assign from another socket implementation.
  ASIO_DECL void base_move_assign(base_implementation_type& impl,
      io_uring_socket_service_base& other_service,
      base_implementation_type& other_impl);

  // Destroy a socket implementation.
  ASIO_DECL void destroy(base_implementation_type& impl);

  // Determine whether the socket is open.
  bool is_open(const base_implementation_type& impl) const
  {
    return impl.socket_ != invalid_socket;
  }

  // Destroy a socket implementation.
  ASIO_DECL asio::error_code close(
      base_implementation_type& impl, asio::error_code& ec);

  // Release ownership of the socket.
  ASIO_DECL socket_type release(
      base_implementation_type& impl, asio::error_code& ec);

  // Get the native socket representation.
  native_handle_type native_handle(base_implementation_type& impl)
  {
    return impl.socket_;
  }

  // Cancel all operations associated with the socket.
  ASIO_DECL asio::error_code cancel(
      base_implementation_type& impl, asio::error_code& ec);

  // Determine whether the socket is at the out-of-band data mark.
  bool at_mark(const base_implementation_type& impl,
      asio::error_code& ec) const
  {
    return socket_ops::sockatmark(impl.socket_, ec);
  }

  // Determine the number of bytes available for reading.
  std::size_t available(const base_implementation_type& impl,
      asio::error_code& ec) const
  {
    return socket_ops::available(impl.socket_, ec);
  }

  // Place the socket into the state where it will listen for new connections.
  asio::error_code listen(base_implementation_type& impl,
      int backlog, asio::error_code& ec)
  {
    socket_ops::listen(impl.socket_, backlog, ec);
    return ec;
  }

  // Perform an IO control command on the socket.
  template <typename IO_Control_Command>
  asio::error_code io_control(base_implementation_type& impl,
      IO_Control_Command& command, asio::error_code& ec)
  {
    socket_ops::ioctl(impl.socket_, impl.state_, command.name(),
        static_cast<ioctl_arg_type*>(command.data()), ec);
    return ec;
  }

  // Gets the non-blocking mode of the socket.
  bool non_blocking(const base_implementation_type& impl) const
  {
    return (impl.state_ & socket_ops::user_set_non_blocking) != 0;
  }

  // Sets the non-blocking mode of the socket.
  asio::error_code non_blocking(base_implementation_type& impl,
      bool mode, asio::error_code& ec)
  {
    socket_ops::set_user_non_blocking(impl.socket_, impl.state_, mode, ec);
    return ec;
  }

  // Gets the non-blocking mode of the native socket implementation.
  bool native_non_blocking(const base_implementation_type& impl) const
  {
    return (impl.state_ & socket_ops::internal_non_blocking) != 0;
  }

  // Sets the non-blocking mode of the native socket implementation.
  asio::error_code native_non_blocking(base_implementation_type& impl,
      bool mode, asio::error_code& ec)
  {
    socket_ops::set_internal_non_blocking(impl.socket_, impl.state_, mode, ec);
    return ec;
  }

  // Wait for the socket to become ready to read, ready to write, or to have
  // pending error conditions.
  asio::error_code wait(base_implementation_type& impl,
      socket_base::wait_type w, asio::error_code& ec)
  {
    switch (w)
    {
    case socket_base::wait_read:
      socket_ops::poll_read(impl.socket_, impl.state_, -1, ec);
      break;
    case socket_base::wait_write:
      socket_ops::poll_write(impl.socket_, impl.state_, -1, ec);
      break;
    case socket_base::wait_error:
      socket_ops::poll_error(impl.socket_, impl.state_, -1, ec);
      break;
    default:
      ec = asio::error::invalid_argument;
      break;
    }

    return ec;
  }

  // Asynchronously wait for the socket to become ready to read, ready to
  // write, or to have pending error conditions.
  template <typename Handler, typename IoExecutor>
  void async_wait(base_implementation_type& impl,
      socket_base::wait_type w, Handler& handler, const IoExecutor& io_ex)
  {
    bool is_continuation =
      asio_handler_cont_helpers::is_continuation(handler);

    associated_cancellation_slot_t<Handler> slot
      = asio::get_associated_cancellation_slot(handler);

    int op_type;
    int poll_flags;
    switch (w)
    {
    case socket_base::wait_read:
      op_type = io_uring_service::read_op;
      poll_flags = POLLIN;
      break;
    case socket_base::wait_write:
      op_type = io_uring_service::write_op;
      poll_flags = POLLOUT;
      break;
    case socket_base::wait_error:
      op_type = io_uring_service::except_op;
      poll_flags = POLLPRI | POLLERR | POLLHUP;
      break;
    default:
      op_type = -1;
      poll_flags = -1;
      return;
    }

    // Allocate and construct an operation to wrap the handler.
    typedef io_uring_wait_op<Handler, IoExecutor> op;
    typename op::ptr p = { asio::detail::addressof(handler),
      op::ptr::allocate(handler), 0 };
    p.p = new (p.v) op(success_ec_, impl.socket_,
        poll_flags, handler, io_ex);

    ASIO_HANDLER_CREATION((io_uring_service_.context(), *p.p,
          "socket", &impl, impl.socket_, "async_wait"));

    // Optionally register for per-operation cancellation.
    if (slot.is_connected())
    {
      p.p->cancellation_key_ =
        &slot.template emplace<io_uring_op_cancellation>(
            &io_uring_service_, &impl.io_object_data_, op_type);
    }

    start_op(impl, op_type, p.p, is_continuation, op_type == -1);
    p.v = p.p = 0;
  }

  // Send the given data to the peer.
  template <typename ConstBufferSequence>
  size_t send(base_implementation_type& impl,
      const ConstBufferSequence& buffers,
      socket_base::message_flags flags, asio::error_code& ec)
  {
    typedef buffer_sequence_adapter<asio::const_buffer,
        ConstBufferSequence> bufs_type;

    if (bufs_type::is_single_buffer)
    {
      return socket_ops::sync_send1(impl.socket_,
          impl.state_, bufs_type::first(buffers).data(),
          bufs_type::first(buffers).size(), flags, ec);
    }
    else
    {
      bufs_type bufs(buffers);
      return socket_ops::sync_send(impl.socket_, impl.state_,
          bufs.buffers(), bufs.count(), flags, bufs.all_empty(), ec);
    }
  }

  // Wait until data can be sent without blocking.
  size_t send(base_implementation_type& impl, const null_buffers&,
      socket_base::message_flags, asio::error_code& ec)
  {
    // Wait for socket to become ready.
    socket_ops::poll_write(impl.socket_, impl.state_, -1, ec);

    return 0;
  }

  // Start an asynchronous send. The data being sent must be valid for the
  // lifetime of the asynchronous operation.
  template <typename ConstBufferSequence, typename Handler, typename IoExecutor>
  void async_send(base_implementation_type& impl,
      const ConstBufferSequence& buffers, socket_base::message_flags flags,
      Handler& handler, const IoExecutor& io_ex)
  {
    bool is_continuation =
      asio_handler_cont_helpers::is_continuation(handler);

    associated_cancellation_slot_t<Handler> slot
      = asio::get_associated_cancellation_slot(handler);

    // Allocate and construct an operation to wrap the handler.
    typedef io_uring_socket_send_op<
        ConstBufferSequence, Handler, IoExecutor> op;
    typename op::ptr p = { asio::detail::addressof(handler),
      op::ptr::allocate(handler), 0 };
    p.p = new (p.v) op(success_ec_, impl.socket_,
        impl.state_, buffers, flags, handler, io_ex);

    // Optionally register for per-operation cancellation.
    if (slot.is_connected())
    {
      p.p->cancellation_key_ =
        &slot.template emplace<io_uring_op_cancellation>(&io_uring_service_,
            &impl.io_object_data_, io_uring_service::write_op);
    }

    ASIO_HANDLER_CREATION((io_uring_service_.context(), *p.p,
          "socket", &impl, impl.socket_, "async_send"));

    start_op(impl, io_uring_service::write_op, p.p, is_continuation,
        ((impl.state_ & socket_ops::stream_oriented)
          && buffer_sequence_adapter<asio::const_buffer,
            ConstBufferSequence>::all_empty(buffers)));
    p.v = p.p = 0;
  }

  // Start an asynchronous wait until data can be sent without blocking.
  template <typename Handler, typename IoExecutor>
  void async_send(base_implementation_type& impl, const null_buffers&,
      socket_base::message_flags, Handler& handler, const IoExecutor& io_ex)
  {
    bool is_continuation =
      asio_handler_cont_helpers::is_continuation(handler);

    associated_cancellation_slot_t<Handler> slot
      = asio::get_associated_cancellation_slot(handler);

    // Allocate and construct an operation to wrap the handler.
    typedef io_uring_null_buffers_op<Handler, IoExecutor> op;
    typename op::ptr p = { asio::detail::addressof(handler),
      op::ptr::allocate(handler), 0 };
    p.p = new (p.v) op(success_ec_, impl.socket_, POLLOUT, handler, io_ex);

    // Optionally register for per-operation cancellation.
    if (slot.is_connected())
    {
      p.p->cancellation_key_ =
        &slot.template emplace<io_uring_op_cancellation>(&io_uring_service_,
            &impl.io_object_data_, io_uring_service::write_op);
    }

    ASIO_HANDLER_CREATION((io_uring_service_.context(), *p.p,
          "socket", &impl, impl.socket_, "async_send(null_buffers)"));

    start_op(impl, io_uring_service::write_op, p.p, is_continuation, false);
    p.v = p.p = 0;
  }

  // Receive some data from the peer. Returns the number of bytes received.
  template <typename MutableBufferSequence>
  size_t receive(base_implementation_type& impl,
      const MutableBufferSequence& buffers,
      socket_base::message_flags flags, asio::error_code& ec)
  {
    typedef buffer_sequence_adapter<asio::mutable_buffer,
        MutableBufferSequence> bufs_type;

    if (bufs_type::is_single_buffer)
    {
      return socket_ops::sync_recv1(impl.socket_,
          impl.state_, bufs_type::first(buffers).data(),
          bufs_type::first(buffers).size(), flags, ec);
    }
    else
    {
      bufs_type bufs(buffers);
      return socket_ops::sync_recv(impl.socket_, impl.state_,
          bufs.buffers(), bufs.count(), flags, bufs.all_empty(), ec);
    }
  }

  // Wait until data can be received without blocking.
  size_t receive(base_implementation_type& impl, const null_buffers&,
      socket_base::message_flags, asio::error_code& ec)
  {
    // Wait for socket to become ready.
    socket_ops::poll_read(impl.socket_, impl.state_, -1, ec);

    return 0;
  }

  // Start an asynchronous receive. The buffer for the data being received
  // must be valid for the lifetime of the asynchronous operation.
  template <typename MutableBufferSequence,
      typename Handler, typename IoExecutor>
  void async_receive(base_implementation_type& impl,
      const MutableBufferSequence& buffers, socket_base::message_flags flags,
      Handler& handler, const IoExecutor& io_ex)
  {
    bool is_continuation =
      asio_handler_cont_helpers::is_continuation(handler);

    int op_type = (flags & socket_base::message_out_of_band)
      ? io_uring_service::except_op : io_uring_service::read_op;

    associated_cancellation_slot_t<Handler> slot
      = asio::get_associated_cancellation_slot(handler);

    // Allocate and construct an operation to wrap the handler.
    typedef io_uring_socket_recv_op<
        MutableBufferSequence, Handler, IoExecutor> op;
    typename op::ptr p = { asio::detail::addressof(handler),
      op::ptr::allocate(handler), 0 };
    p.p = new (p.v) op(success_ec_, impl.socket_,
        impl.state_, buffers, flags, handler, io_ex);

    // Optionally register for per-operation cancellation.
    if (slot.is_connected())
    {
      p.p->cancellation_key_ =
        &slot.template emplace<io_uring_op_cancellation>(
            &io_uring_service_, &impl.io_object_data_, op_type);
    }

    ASIO_HANDLER_CREATION((io_uring_service_.context(), *p.p,
          "socket", &impl, impl.socket_, "async_receive"));

    start_op(impl, op_type, p.p, is_continuation,
        ((impl.state_ & socket_ops::stream_oriented)
          && buffer_sequence_adapter<asio::mutable_buffer,
            MutableBufferSequence>::all_empty(buffers)));
    p.v = p.p = 0;
  }

  // Wait until data can be received without blocking.
  template <typename Handler, typename IoExecutor>
  void async_receive(base_implementation_type& impl,
      const null_buffers&, socket_base::message_flags flags,
      Handler& handler, const IoExecutor& io_ex)
  {
    bool is_continuation =
      asio_handler_cont_helpers::is_continuation(handler);

    int op_type;
    int poll_flags;
    if ((flags & socket_base::message_out_of_band) != 0)
    {
      op_type = io_uring_service::except_op;
      poll_flags = POLLPRI;
    }
    else
    {
      op_type = io_uring_service::read_op;
      poll_flags = POLLIN;
    }

    associated_cancellation_slot_t<Handler> slot
      = asio::get_associated_cancellation_slot(handler);

    // Allocate and construct an operation to wrap the handler.
    typedef io_uring_null_buffers_op<Handler, IoExecutor> op;
    typename op::ptr p = { asio::detail::addressof(handler),
      op::ptr::allocate(handler), 0 };
    p.p = new (p.v) op(success_ec_, impl.socket_, poll_flags, handler, io_ex);

    // Optionally register for per-operation cancellation.
    if (slot.is_connected())
    {
      p.p->cancellation_key_ =
        &slot.template emplace<io_uring_op_cancellation>(
            &io_uring_service_, &impl.io_object_data_, op_type);
    }

    ASIO_HANDLER_CREATION((io_uring_service_.context(), *p.p,
          "socket", &impl, impl.socket_, "async_receive(null_buffers)"));

    start_op(impl, op_type, p.p, is_continuation, false);
    p.v = p.p = 0;
  }

  // Receive some data with associated flags. Returns the number of bytes
  // received.
  template <typename MutableBufferSequence>
  size_t receive_with_flags(base_implementation_type& impl,
      const MutableBufferSequence& buffers,
      socket_base::message_flags in_flags,
      socket_base::message_flags& out_flags, asio::error_code& ec)
  {
    buffer_sequence_adapter<asio::mutable_buffer,
        MutableBufferSequence> bufs(buffers);

    return socket_ops::sync_recvmsg(impl.socket_, impl.state_,
        bufs.buffers(), bufs.count(), in_flags, out_flags, ec);
  }

  // Wait until data can be received without blocking.
  size_t receive_with_flags(base_implementation_type& impl,
      const null_buffers&, socket_base::message_flags,
      socket_base::message_flags& out_flags, asio::error_code& ec)
  {
    // Wait for socket to become ready.
    socket_ops::poll_read(impl.socket_, impl.state_, -1, ec);

    // Clear out_flags, since we cannot give it any other sensible value when
    // performing a null_buffers operation.
    out_flags = 0;

    return 0;
  }

  // Start an asynchronous receive. The buffer for the data being received
  // must be valid for the lifetime of the asynchronous operation.
  template <typename MutableBufferSequence,
      typename Handler, typename IoExecutor>
  void async_receive_with_flags(base_implementation_type& impl,
      const MutableBufferSequence& buffers, socket_base::message_flags in_flags,
      socket_base::message_flags& out_flags, Handler& handler,
      const IoExecutor& io_ex)
  {
    bool is_continuation =
      asio_handler_cont_helpers::is_continuation(handler);

    int op_type = (in_flags & socket_base::message_out_of_band)
      ? io_uring_service::except_op : io_uring_service::read_op;

    associated_cancellation_slot_t<Handler> slot
      = asio::get_associated_cancellation_slot(handler);

    // Allocate and construct an operation to wrap the handler.
    typedef io_uring_socket_recvmsg_op<
        MutableBufferSequence, Handler, IoExecutor> op;
    typename op::ptr p = { asio::detail::addressof(handler),
      op::ptr::allocate(handler), 0 };
    p.p = new (p.v) op(success_ec_, impl.socket_, impl.state_,
        buffers, in_flags, out_flags, handler, io_ex);

    // Optionally register for per-operation cancellation.
    if (slot.is_connected())
    {
      p.p->cancellation_key_ =
        &slot.template emplace<io_uring_op_cancellation>(
            &io_uring_service_, &impl.io_object_data_, op_type);
    }

    ASIO_HANDLER_CREATION((io_uring_service_.context(), *p.p,
          "socket", &impl, impl.socket_, "async_receive_with_flags"));

    start_op(impl, op_type, p.p, is_continuation, false);
    p.v = p.p = 0;
  }

  // Wait until data can be received without blocking.
  template <typename Handler, typename IoExecutor>
  void async_receive_with_flags(base_implementation_type& impl,
      const null_buffers&, socket_base::message_flags in_flags,
      socket_base::message_flags& out_flags, Handler& handler,
      const IoExecutor& io_ex)
  {
    bool is_continuation =
      asio_handler_cont_helpers::is_continuation(handler);

    int op_type;
    int poll_flags;
    if ((in_flags & socket_base::message_out_of_band) != 0)
    {
      op_type = io_uring_service::except_op;
      poll_flags = POLLPRI;
    }
    else
    {
      op_type = io_uring_service::read_op;
      poll_flags = POLLIN;
    }

    associated_cancellation_slot_t<Handler> slot
      = asio::get_associated_cancellation_slot(handler);

    // Allocate and construct an operation to wrap the handler.
    typedef io_uring_null_buffers_op<Handler, IoExecutor> op;
    typename op::ptr p = { asio::detail::addressof(handler),
      op::ptr::allocate(handler), 0 };
    p.p = new (p.v) op(success_ec_, impl.socket_, poll_flags, handler, io_ex);

    // Optionally register for per-operation cancellation.
    if (slot.is_connected())
    {
      p.p->cancellation_key_ =
        &slot.template emplace<io_uring_op_cancellation>(
            &io_uring_service_, &impl.io_object_data_, op_type);
    }

    ASIO_HANDLER_CREATION((io_uring_service_.context(), *p.p, "socket",
          &impl, impl.socket_, "async_receive_with_flags(null_buffers)"));

    // Clear out_flags, since we cannot give it any other sensible value when
    // performing a null_buffers operation.
    out_flags = 0;

    start_op(impl, op_type, p.p, is_continuation, false);
    p.v = p.p = 0;
  }

protected:
  // Open a new socket implementation.
  ASIO_DECL asio::error_code do_open(
      base_implementation_type& impl, int af,
      int type, int protocol, asio::error_code& ec);

  // Assign a native socket to a socket implementation.
  ASIO_DECL asio::error_code do_assign(
      base_implementation_type& impl, int type,
      const native_handle_type& native_socket, asio::error_code& ec);

  // Start the asynchronous read or write operation.
  ASIO_DECL void start_op(base_implementation_type& impl, int op_type,
      io_uring_operation* op, bool is_continuation, bool noop);

  // Start the asynchronous accept operation.
  ASIO_DECL void start_accept_op(base_implementation_type& impl,
      io_uring_operation* op, bool is_continuation, bool peer_is_open);

  // Helper class used to implement per-operation cancellation
  class io_uring_op_cancellation
  {
  public:
    io_uring_op_cancellation(io_uring_service* s,
        io_uring_service::per_io_object_data* p, int o)
      : io_uring_service_(s),
        io_object_data_(p),
        op_type_(o)
    {
    }

    void operator()(cancellation_type_t type)
    {
      if (!!(type &
            (cancellation_type::terminal
              | cancellation_type::partial
              | cancellation_type::total)))
      {
        io_uring_service_->cancel_ops_by_key(*io_object_data_, op_type_, this);
      }
    }

  private:
    io_uring_service* io_uring_service_;
    io_uring_service::per_io_object_data* io_object_data_;
    int op_type_;
  };

  // The io_uring_service that performs event demultiplexing for the service.
  io_uring_service& io_uring_service_;

  // Cached success value to avoid accessing category singleton.
  const asio::error_code success_ec_;
};

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#if defined(ASIO_HEADER_ONLY)
# include "asio/detail/impl/io_uring_socket_service_base.ipp"
#endif // defined(ASIO_HEADER_ONLY)

#endif // defined(ASIO_HAS_IO_URING)

#endif // ASIO_DETAIL_IO_URING_SOCKET_SERVICE_BASE_HPP
