//
// detail/io_uring_descriptor_service.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_IO_URING_DESCRIPTOR_SERVICE_HPP
#define ASIO_DETAIL_IO_URING_DESCRIPTOR_SERVICE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_IO_URING)

#include "asio/associated_cancellation_slot.hpp"
#include "asio/buffer.hpp"
#include "asio/cancellation_type.hpp"
#include "asio/execution_context.hpp"
#include "asio/detail/buffer_sequence_adapter.hpp"
#include "asio/detail/descriptor_ops.hpp"
#include "asio/detail/io_uring_descriptor_read_at_op.hpp"
#include "asio/detail/io_uring_descriptor_read_op.hpp"
#include "asio/detail/io_uring_descriptor_write_at_op.hpp"
#include "asio/detail/io_uring_descriptor_write_op.hpp"
#include "asio/detail/io_uring_null_buffers_op.hpp"
#include "asio/detail/io_uring_service.hpp"
#include "asio/detail/io_uring_wait_op.hpp"
#include "asio/detail/memory.hpp"
#include "asio/detail/noncopyable.hpp"
#include "asio/posix/descriptor_base.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

class io_uring_descriptor_service :
  public execution_context_service_base<io_uring_descriptor_service>
{
public:
  // The native type of a descriptor.
  typedef int native_handle_type;

  // The implementation type of the descriptor.
  class implementation_type
    : private asio::detail::noncopyable
  {
  public:
    // Default constructor.
    implementation_type()
      : descriptor_(-1),
        state_(0)
    {
    }

  private:
    // Only this service will have access to the internal values.
    friend class io_uring_descriptor_service;

    // The native descriptor representation.
    int descriptor_;

    // The current state of the descriptor.
    descriptor_ops::state_type state_;

    // Per I/O object data used by the io_uring_service.
    io_uring_service::per_io_object_data io_object_data_;
  };

  // Constructor.
  ASIO_DECL io_uring_descriptor_service(execution_context& context);

  // Destroy all user-defined handler objects owned by the service.
  ASIO_DECL void shutdown();

  // Construct a new descriptor implementation.
  ASIO_DECL void construct(implementation_type& impl);

  // Move-construct a new descriptor implementation.
  ASIO_DECL void move_construct(implementation_type& impl,
      implementation_type& other_impl) noexcept;

  // Move-assign from another descriptor implementation.
  ASIO_DECL void move_assign(implementation_type& impl,
      io_uring_descriptor_service& other_service,
      implementation_type& other_impl);

  // Destroy a descriptor implementation.
  ASIO_DECL void destroy(implementation_type& impl);

  // Assign a native descriptor to a descriptor implementation.
  ASIO_DECL asio::error_code assign(implementation_type& impl,
      const native_handle_type& native_descriptor,
      asio::error_code& ec);

  // Determine whether the descriptor is open.
  bool is_open(const implementation_type& impl) const
  {
    return impl.descriptor_ != -1;
  }

  // Destroy a descriptor implementation.
  ASIO_DECL asio::error_code close(implementation_type& impl,
      asio::error_code& ec);

  // Get the native descriptor representation.
  native_handle_type native_handle(const implementation_type& impl) const
  {
    return impl.descriptor_;
  }

  // Release ownership of the native descriptor representation.
  ASIO_DECL native_handle_type release(implementation_type& impl);

  // Release ownership of the native descriptor representation.
  native_handle_type release(implementation_type& impl,
      asio::error_code& ec)
  {
    ec = success_ec_;
    return release(impl);
  }

  // Cancel all operations associated with the descriptor.
  ASIO_DECL asio::error_code cancel(implementation_type& impl,
      asio::error_code& ec);

  // Perform an IO control command on the descriptor.
  template <typename IO_Control_Command>
  asio::error_code io_control(implementation_type& impl,
      IO_Control_Command& command, asio::error_code& ec)
  {
    descriptor_ops::ioctl(impl.descriptor_, impl.state_,
        command.name(), static_cast<ioctl_arg_type*>(command.data()), ec);
    ASIO_ERROR_LOCATION(ec);
    return ec;
  }

  // Gets the non-blocking mode of the descriptor.
  bool non_blocking(const implementation_type& impl) const
  {
    return (impl.state_ & descriptor_ops::user_set_non_blocking) != 0;
  }

  // Sets the non-blocking mode of the descriptor.
  asio::error_code non_blocking(implementation_type& impl,
      bool mode, asio::error_code& ec)
  {
    descriptor_ops::set_user_non_blocking(
        impl.descriptor_, impl.state_, mode, ec);
    ASIO_ERROR_LOCATION(ec);
    return ec;
  }

  // Gets the non-blocking mode of the native descriptor implementation.
  bool native_non_blocking(const implementation_type& impl) const
  {
    return (impl.state_ & descriptor_ops::internal_non_blocking) != 0;
  }

  // Sets the non-blocking mode of the native descriptor implementation.
  asio::error_code native_non_blocking(implementation_type& impl,
      bool mode, asio::error_code& ec)
  {
    descriptor_ops::set_internal_non_blocking(
        impl.descriptor_, impl.state_, mode, ec);
    ASIO_ERROR_LOCATION(ec);
    return ec;
  }

  // Wait for the descriptor to become ready to read, ready to write, or to have
  // pending error conditions.
  asio::error_code wait(implementation_type& impl,
      posix::descriptor_base::wait_type w, asio::error_code& ec)
  {
    switch (w)
    {
    case posix::descriptor_base::wait_read:
      descriptor_ops::poll_read(impl.descriptor_, impl.state_, ec);
      break;
    case posix::descriptor_base::wait_write:
      descriptor_ops::poll_write(impl.descriptor_, impl.state_, ec);
      break;
    case posix::descriptor_base::wait_error:
      descriptor_ops::poll_error(impl.descriptor_, impl.state_, ec);
      break;
    default:
      ec = asio::error::invalid_argument;
      break;
    }

    ASIO_ERROR_LOCATION(ec);
    return ec;
  }

  // Asynchronously wait for the descriptor to become ready to read, ready to
  // write, or to have pending error conditions.
  template <typename Handler, typename IoExecutor>
  void async_wait(implementation_type& impl,
      posix::descriptor_base::wait_type w,
      Handler& handler, const IoExecutor& io_ex)
  {
    bool is_continuation =
      asio_handler_cont_helpers::is_continuation(handler);

    associated_cancellation_slot_t<Handler> slot
      = asio::get_associated_cancellation_slot(handler);

    int op_type;
    int poll_flags;
    switch (w)
    {
    case posix::descriptor_base::wait_read:
      op_type = io_uring_service::read_op;
      poll_flags = POLLIN;
      break;
    case posix::descriptor_base::wait_write:
      op_type = io_uring_service::write_op;
      poll_flags = POLLOUT;
      break;
    case posix::descriptor_base::wait_error:
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
    p.p = new (p.v) op(success_ec_, impl.descriptor_,
        poll_flags, handler, io_ex);

    // Optionally register for per-operation cancellation.
    if (slot.is_connected() && op_type != -1)
    {
      p.p->cancellation_key_ =
        &slot.template emplace<io_uring_op_cancellation>(
            &io_uring_service_, &impl.io_object_data_, op_type);
    }

    ASIO_HANDLER_CREATION((io_uring_service_.context(), *p.p,
          "descriptor", &impl, impl.descriptor_, "async_wait"));

    start_op(impl, op_type, p.p, is_continuation, op_type == -1);
    p.v = p.p = 0;
  }

  // Write some data to the descriptor.
  template <typename ConstBufferSequence>
  size_t write_some(implementation_type& impl,
      const ConstBufferSequence& buffers, asio::error_code& ec)
  {
    typedef buffer_sequence_adapter<asio::const_buffer,
        ConstBufferSequence> bufs_type;

    size_t n;
    if (bufs_type::is_single_buffer)
    {
      n = descriptor_ops::sync_write1(impl.descriptor_,
          impl.state_, bufs_type::first(buffers).data(),
          bufs_type::first(buffers).size(), ec);
    }
    else
    {
      bufs_type bufs(buffers);

      n = descriptor_ops::sync_write(impl.descriptor_, impl.state_,
          bufs.buffers(), bufs.count(), bufs.all_empty(), ec);
    }

    ASIO_ERROR_LOCATION(ec);
    return n;
  }

  // Wait until data can be written without blocking.
  size_t write_some(implementation_type& impl,
      const null_buffers&, asio::error_code& ec)
  {
    // Wait for descriptor to become ready.
    descriptor_ops::poll_write(impl.descriptor_, impl.state_, ec);

    ASIO_ERROR_LOCATION(ec);
    return 0;
  }

  // Start an asynchronous write. The data being sent must be valid for the
  // lifetime of the asynchronous operation.
  template <typename ConstBufferSequence, typename Handler, typename IoExecutor>
  void async_write_some(implementation_type& impl,
      const ConstBufferSequence& buffers, Handler& handler,
      const IoExecutor& io_ex)
  {
    bool is_continuation =
      asio_handler_cont_helpers::is_continuation(handler);

    associated_cancellation_slot_t<Handler> slot
      = asio::get_associated_cancellation_slot(handler);

    // Allocate and construct an operation to wrap the handler.
    typedef io_uring_descriptor_write_op<
      ConstBufferSequence, Handler, IoExecutor> op;
    typename op::ptr p = { asio::detail::addressof(handler),
      op::ptr::allocate(handler), 0 };
    p.p = new (p.v) op(success_ec_, impl.descriptor_,
        impl.state_, buffers, handler, io_ex);

    // Optionally register for per-operation cancellation.
    if (slot.is_connected())
    {
      p.p->cancellation_key_ =
        &slot.template emplace<io_uring_op_cancellation>(&io_uring_service_,
            &impl.io_object_data_, io_uring_service::write_op);
    }

    ASIO_HANDLER_CREATION((io_uring_service_.context(), *p.p,
          "descriptor", &impl, impl.descriptor_, "async_write_some"));

    start_op(impl, io_uring_service::write_op, p.p, is_continuation,
        buffer_sequence_adapter<asio::const_buffer,
          ConstBufferSequence>::all_empty(buffers));
    p.v = p.p = 0;
  }

  // Start an asynchronous wait until data can be written without blocking.
  template <typename Handler, typename IoExecutor>
  void async_write_some(implementation_type& impl,
      const null_buffers&, Handler& handler, const IoExecutor& io_ex)
  {
    bool is_continuation =
      asio_handler_cont_helpers::is_continuation(handler);

    associated_cancellation_slot_t<Handler> slot
      = asio::get_associated_cancellation_slot(handler);

    // Allocate and construct an operation to wrap the handler.
    typedef io_uring_null_buffers_op<Handler, IoExecutor> op;
    typename op::ptr p = { asio::detail::addressof(handler),
      op::ptr::allocate(handler), 0 };
    p.p = new (p.v) op(success_ec_, impl.descriptor_, POLLOUT, handler, io_ex);

    // Optionally register for per-operation cancellation.
    if (slot.is_connected())
    {
      p.p->cancellation_key_ =
        &slot.template emplace<io_uring_op_cancellation>(&io_uring_service_,
            &impl.io_object_data_, io_uring_service::write_op);
    }

    ASIO_HANDLER_CREATION((io_uring_service_.context(),
          *p.p, "descriptor", &impl, impl.descriptor_,
          "async_write_some(null_buffers)"));

    start_op(impl, io_uring_service::write_op, p.p, is_continuation, false);
    p.v = p.p = 0;
  }

  // Write some data to the descriptor at the specified offset.
  template <typename ConstBufferSequence>
  size_t write_some_at(implementation_type& impl, uint64_t offset,
      const ConstBufferSequence& buffers, asio::error_code& ec)
  {
    typedef buffer_sequence_adapter<asio::const_buffer,
        ConstBufferSequence> bufs_type;

    size_t n;
    if (bufs_type::is_single_buffer)
    {
      n = descriptor_ops::sync_write_at1(impl.descriptor_,
          impl.state_, offset, bufs_type::first(buffers).data(),
          bufs_type::first(buffers).size(), ec);
    }
    else
    {
      bufs_type bufs(buffers);

      n = descriptor_ops::sync_write_at(impl.descriptor_, impl.state_,
          offset, bufs.buffers(), bufs.count(), bufs.all_empty(), ec);
    }

    ASIO_ERROR_LOCATION(ec);
    return n;
  }

  // Wait until data can be written without blocking.
  size_t write_some_at(implementation_type& impl, uint64_t,
      const null_buffers& buffers, asio::error_code& ec)
  {
    return write_some(impl, buffers, ec);
  }

  // Start an asynchronous write at the specified offset. The data being sent
  // must be valid for the lifetime of the asynchronous operation.
  template <typename ConstBufferSequence, typename Handler, typename IoExecutor>
  void async_write_some_at(implementation_type& impl, uint64_t offset,
      const ConstBufferSequence& buffers, Handler& handler,
      const IoExecutor& io_ex)
  {
    bool is_continuation =
      asio_handler_cont_helpers::is_continuation(handler);

    associated_cancellation_slot_t<Handler> slot
      = asio::get_associated_cancellation_slot(handler);

    // Allocate and construct an operation to wrap the handler.
    typedef io_uring_descriptor_write_at_op<
      ConstBufferSequence, Handler, IoExecutor> op;
    typename op::ptr p = { asio::detail::addressof(handler),
      op::ptr::allocate(handler), 0 };
    p.p = new (p.v) op(success_ec_, impl.descriptor_,
        impl.state_, offset, buffers, handler, io_ex);

    // Optionally register for per-operation cancellation.
    if (slot.is_connected())
    {
      p.p->cancellation_key_ =
        &slot.template emplace<io_uring_op_cancellation>(&io_uring_service_,
            &impl.io_object_data_, io_uring_service::write_op);
    }

    ASIO_HANDLER_CREATION((io_uring_service_.context(), *p.p,
          "descriptor", &impl, impl.descriptor_, "async_write_some"));

    start_op(impl, io_uring_service::write_op, p.p, is_continuation,
        buffer_sequence_adapter<asio::const_buffer,
          ConstBufferSequence>::all_empty(buffers));
    p.v = p.p = 0;
  }

  // Start an asynchronous wait until data can be written without blocking.
  template <typename Handler, typename IoExecutor>
  void async_write_some_at(implementation_type& impl,
      const null_buffers& buffers, Handler& handler, const IoExecutor& io_ex)
  {
    return async_write_some(impl, buffers, handler, io_ex);
  }

  // Read some data from the stream. Returns the number of bytes read.
  template <typename MutableBufferSequence>
  size_t read_some(implementation_type& impl,
      const MutableBufferSequence& buffers, asio::error_code& ec)
  {
    typedef buffer_sequence_adapter<asio::mutable_buffer,
        MutableBufferSequence> bufs_type;

    size_t n;
    if (bufs_type::is_single_buffer)
    {
      n = descriptor_ops::sync_read1(impl.descriptor_,
          impl.state_, bufs_type::first(buffers).data(),
          bufs_type::first(buffers).size(), ec);
    }
    else
    {
      bufs_type bufs(buffers);

      n = descriptor_ops::sync_read(impl.descriptor_, impl.state_,
          bufs.buffers(), bufs.count(), bufs.all_empty(), ec);
    }

    ASIO_ERROR_LOCATION(ec);
    return n;
  }

  // Wait until data can be read without blocking.
  size_t read_some(implementation_type& impl,
      const null_buffers&, asio::error_code& ec)
  {
    // Wait for descriptor to become ready.
    descriptor_ops::poll_read(impl.descriptor_, impl.state_, ec);

    ASIO_ERROR_LOCATION(ec);
    return 0;
  }

  // Start an asynchronous read. The buffer for the data being read must be
  // valid for the lifetime of the asynchronous operation.
  template <typename MutableBufferSequence,
      typename Handler, typename IoExecutor>
  void async_read_some(implementation_type& impl,
      const MutableBufferSequence& buffers,
      Handler& handler, const IoExecutor& io_ex)
  {
    bool is_continuation =
      asio_handler_cont_helpers::is_continuation(handler);

    associated_cancellation_slot_t<Handler> slot
      = asio::get_associated_cancellation_slot(handler);

    // Allocate and construct an operation to wrap the handler.
    typedef io_uring_descriptor_read_op<
      MutableBufferSequence, Handler, IoExecutor> op;
    typename op::ptr p = { asio::detail::addressof(handler),
      op::ptr::allocate(handler), 0 };
    p.p = new (p.v) op(success_ec_, impl.descriptor_,
        impl.state_, buffers, handler, io_ex);

    // Optionally register for per-operation cancellation.
    if (slot.is_connected())
    {
      p.p->cancellation_key_ =
        &slot.template emplace<io_uring_op_cancellation>(&io_uring_service_,
            &impl.io_object_data_, io_uring_service::read_op);
    }

    ASIO_HANDLER_CREATION((io_uring_service_.context(), *p.p,
          "descriptor", &impl, impl.descriptor_, "async_read_some"));

    start_op(impl, io_uring_service::read_op, p.p, is_continuation,
        buffer_sequence_adapter<asio::mutable_buffer,
          MutableBufferSequence>::all_empty(buffers));
    p.v = p.p = 0;
  }

  // Wait until data can be read without blocking.
  template <typename Handler, typename IoExecutor>
  void async_read_some(implementation_type& impl,
      const null_buffers&, Handler& handler, const IoExecutor& io_ex)
  {
    bool is_continuation =
      asio_handler_cont_helpers::is_continuation(handler);

    associated_cancellation_slot_t<Handler> slot
      = asio::get_associated_cancellation_slot(handler);

    // Allocate and construct an operation to wrap the handler.
    typedef io_uring_null_buffers_op<Handler, IoExecutor> op;
    typename op::ptr p = { asio::detail::addressof(handler),
      op::ptr::allocate(handler), 0 };
    p.p = new (p.v) op(success_ec_, impl.descriptor_, POLLIN, handler, io_ex);

    // Optionally register for per-operation cancellation.
    if (slot.is_connected())
    {
      p.p->cancellation_key_ =
        &slot.template emplace<io_uring_op_cancellation>(&io_uring_service_,
            &impl.io_object_data_, io_uring_service::read_op);
    }

    ASIO_HANDLER_CREATION((io_uring_service_.context(),
          *p.p, "descriptor", &impl, impl.descriptor_,
          "async_read_some(null_buffers)"));

    start_op(impl, io_uring_service::read_op, p.p, is_continuation, false);
    p.v = p.p = 0;
  }

  // Read some data at the specified offset. Returns the number of bytes read.
  template <typename MutableBufferSequence>
  size_t read_some_at(implementation_type& impl, uint64_t offset,
      const MutableBufferSequence& buffers, asio::error_code& ec)
  {
    typedef buffer_sequence_adapter<asio::mutable_buffer,
        MutableBufferSequence> bufs_type;

    if (bufs_type::is_single_buffer)
    {
      return descriptor_ops::sync_read_at1(impl.descriptor_,
          impl.state_, offset, bufs_type::first(buffers).data(),
          bufs_type::first(buffers).size(), ec);
    }
    else
    {
      bufs_type bufs(buffers);

      return descriptor_ops::sync_read_at(impl.descriptor_, impl.state_,
          offset, bufs.buffers(), bufs.count(), bufs.all_empty(), ec);
    }
  }

  // Wait until data can be read without blocking.
  size_t read_some_at(implementation_type& impl, uint64_t,
      const null_buffers& buffers, asio::error_code& ec)
  {
    return read_some(impl, buffers, ec);
  }

  // Start an asynchronous read. The buffer for the data being read must be
  // valid for the lifetime of the asynchronous operation.
  template <typename MutableBufferSequence,
      typename Handler, typename IoExecutor>
  void async_read_some_at(implementation_type& impl,
      uint64_t offset, const MutableBufferSequence& buffers,
      Handler& handler, const IoExecutor& io_ex)
  {
    bool is_continuation =
      asio_handler_cont_helpers::is_continuation(handler);

    associated_cancellation_slot_t<Handler> slot
      = asio::get_associated_cancellation_slot(handler);

    // Allocate and construct an operation to wrap the handler.
    typedef io_uring_descriptor_read_at_op<
      MutableBufferSequence, Handler, IoExecutor> op;
    typename op::ptr p = { asio::detail::addressof(handler),
      op::ptr::allocate(handler), 0 };
    p.p = new (p.v) op(success_ec_, impl.descriptor_,
        impl.state_, offset, buffers, handler, io_ex);

    // Optionally register for per-operation cancellation.
    if (slot.is_connected())
    {
      p.p->cancellation_key_ =
        &slot.template emplace<io_uring_op_cancellation>(&io_uring_service_,
            &impl.io_object_data_, io_uring_service::read_op);
    }

    ASIO_HANDLER_CREATION((io_uring_service_.context(), *p.p,
          "descriptor", &impl, impl.descriptor_, "async_read_some"));

    start_op(impl, io_uring_service::read_op, p.p, is_continuation,
        buffer_sequence_adapter<asio::mutable_buffer,
          MutableBufferSequence>::all_empty(buffers));
    p.v = p.p = 0;
  }

  // Wait until data can be read without blocking.
  template <typename Handler, typename IoExecutor>
  void async_read_some_at(implementation_type& impl, uint64_t,
      const null_buffers& buffers, Handler& handler, const IoExecutor& io_ex)
  {
    return async_read_some(impl, buffers, handler, io_ex);
  }

private:
  // Start the asynchronous operation.
  ASIO_DECL void start_op(implementation_type& impl, int op_type,
      io_uring_operation* op, bool is_continuation, bool noop);

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
# include "asio/detail/impl/io_uring_descriptor_service.ipp"
#endif // defined(ASIO_HEADER_ONLY)

#endif // defined(ASIO_HAS_IO_URING)

#endif // ASIO_DETAIL_IO_URING_DESCRIPTOR_SERVICE_HPP
