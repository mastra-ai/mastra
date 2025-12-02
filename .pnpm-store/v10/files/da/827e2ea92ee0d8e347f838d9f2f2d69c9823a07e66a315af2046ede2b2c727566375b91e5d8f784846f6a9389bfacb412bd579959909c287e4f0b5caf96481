//
// detail/io_uring_socket_accept_op.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_IO_URING_SOCKET_ACCEPT_OP_HPP
#define ASIO_DETAIL_IO_URING_SOCKET_ACCEPT_OP_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_IO_URING)

#include "asio/detail/bind_handler.hpp"
#include "asio/detail/fenced_block.hpp"
#include "asio/detail/handler_alloc_helpers.hpp"
#include "asio/detail/handler_work.hpp"
#include "asio/detail/io_uring_operation.hpp"
#include "asio/detail/memory.hpp"
#include "asio/detail/socket_holder.hpp"
#include "asio/detail/socket_ops.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

template <typename Socket, typename Protocol>
class io_uring_socket_accept_op_base : public io_uring_operation
{
public:
  io_uring_socket_accept_op_base(const asio::error_code& success_ec,
      socket_type socket, socket_ops::state_type state, Socket& peer,
      const Protocol& protocol, typename Protocol::endpoint* peer_endpoint,
      func_type complete_func)
    : io_uring_operation(success_ec,
        &io_uring_socket_accept_op_base::do_prepare,
        &io_uring_socket_accept_op_base::do_perform, complete_func),
      socket_(socket),
      state_(state),
      peer_(peer),
      protocol_(protocol),
      peer_endpoint_(peer_endpoint),
      addrlen_(peer_endpoint ? peer_endpoint->capacity() : 0)
  {
  }

  static void do_prepare(io_uring_operation* base, ::io_uring_sqe* sqe)
  {
    ASIO_ASSUME(base != 0);
    io_uring_socket_accept_op_base* o(
        static_cast<io_uring_socket_accept_op_base*>(base));

    if ((o->state_ & socket_ops::internal_non_blocking) != 0)
    {
      ::io_uring_prep_poll_add(sqe, o->socket_, POLLIN);
    }
    else
    {
      ::io_uring_prep_accept(sqe, o->socket_,
          o->peer_endpoint_ ? o->peer_endpoint_->data() : 0,
          o->peer_endpoint_ ? &o->addrlen_ : 0, 0);
    }
  }

  static bool do_perform(io_uring_operation* base, bool after_completion)
  {
    ASIO_ASSUME(base != 0);
    io_uring_socket_accept_op_base* o(
        static_cast<io_uring_socket_accept_op_base*>(base));

    if ((o->state_ & socket_ops::internal_non_blocking) != 0)
    {
      socket_type new_socket = invalid_socket;
      std::size_t addrlen = static_cast<std::size_t>(o->addrlen_);
      bool result = socket_ops::non_blocking_accept(o->socket_,
          o->state_, o->peer_endpoint_ ? o->peer_endpoint_->data() : 0,
          o->peer_endpoint_ ? &addrlen : 0, o->ec_, new_socket);
      o->new_socket_.reset(new_socket);
      o->addrlen_ = static_cast<socklen_t>(addrlen);
      return result;
    }

    if (o->ec_ && o->ec_ == asio::error::would_block)
    {
      o->state_ |= socket_ops::internal_non_blocking;
      return false;
    }

    if (after_completion && !o->ec_)
      o->new_socket_.reset(static_cast<int>(o->bytes_transferred_));

    return after_completion;
  }

  void do_assign()
  {
    if (new_socket_.get() != invalid_socket)
    {
      if (peer_endpoint_)
        peer_endpoint_->resize(addrlen_);
      peer_.assign(protocol_, new_socket_.get(), ec_);
      if (!ec_)
        new_socket_.release();
    }
  }

private:
  socket_type socket_;
  socket_ops::state_type state_;
  socket_holder new_socket_;
  Socket& peer_;
  Protocol protocol_;
  typename Protocol::endpoint* peer_endpoint_;
  socklen_t addrlen_;
};

template <typename Socket, typename Protocol,
    typename Handler, typename IoExecutor>
class io_uring_socket_accept_op :
  public io_uring_socket_accept_op_base<Socket, Protocol>
{
public:
  ASIO_DEFINE_HANDLER_PTR(io_uring_socket_accept_op);

  io_uring_socket_accept_op(const asio::error_code& success_ec,
      socket_type socket, socket_ops::state_type state, Socket& peer,
      const Protocol& protocol, typename Protocol::endpoint* peer_endpoint,
      Handler& handler, const IoExecutor& io_ex)
    : io_uring_socket_accept_op_base<Socket, Protocol>(
        success_ec, socket, state, peer, protocol, peer_endpoint,
        &io_uring_socket_accept_op::do_complete),
      handler_(static_cast<Handler&&>(handler)),
      work_(handler_, io_ex)
  {
  }

  static void do_complete(void* owner, operation* base,
      const asio::error_code& /*ec*/,
      std::size_t /*bytes_transferred*/)
  {
    // Take ownership of the handler object.
    ASIO_ASSUME(base != 0);
    io_uring_socket_accept_op* o(static_cast<io_uring_socket_accept_op*>(base));
    ptr p = { asio::detail::addressof(o->handler_), o, o };

    // On success, assign new connection to peer socket object.
    if (owner)
      o->do_assign();

    ASIO_HANDLER_COMPLETION((*o));

    // Take ownership of the operation's outstanding work.
    handler_work<Handler, IoExecutor> w(
        static_cast<handler_work<Handler, IoExecutor>&&>(
          o->work_));

    ASIO_ERROR_LOCATION(o->ec_);

    // Make a copy of the handler so that the memory can be deallocated before
    // the upcall is made. Even if we're not about to make an upcall, a
    // sub-object of the handler may be the true owner of the memory associated
    // with the handler. Consequently, a local copy of the handler is required
    // to ensure that any owning sub-object remains valid until after we have
    // deallocated the memory here.
    detail::binder1<Handler, asio::error_code>
      handler(o->handler_, o->ec_);
    p.h = asio::detail::addressof(handler.handler_);
    p.reset();

    // Make the upcall if required.
    if (owner)
    {
      fenced_block b(fenced_block::half);
      ASIO_HANDLER_INVOCATION_BEGIN((handler.arg1_));
      w.complete(handler, handler.handler_);
      ASIO_HANDLER_INVOCATION_END;
    }
  }

private:
  Handler handler_;
  handler_work<Handler, IoExecutor> work_;
};

template <typename Protocol, typename PeerIoExecutor,
    typename Handler, typename IoExecutor>
class io_uring_socket_move_accept_op :
  private Protocol::socket::template rebind_executor<PeerIoExecutor>::other,
  public io_uring_socket_accept_op_base<
    typename Protocol::socket::template rebind_executor<PeerIoExecutor>::other,
    Protocol>
{
public:
  ASIO_DEFINE_HANDLER_PTR(io_uring_socket_move_accept_op);

  io_uring_socket_move_accept_op(const asio::error_code& success_ec,
      const PeerIoExecutor& peer_io_ex, socket_type socket,
      socket_ops::state_type state, const Protocol& protocol,
      typename Protocol::endpoint* peer_endpoint, Handler& handler,
      const IoExecutor& io_ex)
    : peer_socket_type(peer_io_ex),
      io_uring_socket_accept_op_base<peer_socket_type, Protocol>(
        success_ec, socket, state, *this, protocol, peer_endpoint,
        &io_uring_socket_move_accept_op::do_complete),
      handler_(static_cast<Handler&&>(handler)),
      work_(handler_, io_ex)
  {
  }

  static void do_complete(void* owner, operation* base,
      const asio::error_code& /*ec*/,
      std::size_t /*bytes_transferred*/)
  {
    // Take ownership of the handler object.
    ASIO_ASSUME(base != 0);
    io_uring_socket_move_accept_op* o(
        static_cast<io_uring_socket_move_accept_op*>(base));
    ptr p = { asio::detail::addressof(o->handler_), o, o };

    // On success, assign new connection to peer socket object.
    if (owner)
      o->do_assign();

    ASIO_HANDLER_COMPLETION((*o));

    // Take ownership of the operation's outstanding work.
    handler_work<Handler, IoExecutor> w(
        static_cast<handler_work<Handler, IoExecutor>&&>(
          o->work_));

    ASIO_ERROR_LOCATION(o->ec_);

    // Make a copy of the handler so that the memory can be deallocated before
    // the upcall is made. Even if we're not about to make an upcall, a
    // sub-object of the handler may be the true owner of the memory associated
    // with the handler. Consequently, a local copy of the handler is required
    // to ensure that any owning sub-object remains valid until after we have
    // deallocated the memory here.
    detail::move_binder2<Handler,
      asio::error_code, peer_socket_type>
        handler(0, static_cast<Handler&&>(o->handler_), o->ec_,
          static_cast<peer_socket_type&&>(*o));
    p.h = asio::detail::addressof(handler.handler_);
    p.reset();

    // Make the upcall if required.
    if (owner)
    {
      fenced_block b(fenced_block::half);
      ASIO_HANDLER_INVOCATION_BEGIN((handler.arg1_, "..."));
      w.complete(handler, handler.handler_);
      ASIO_HANDLER_INVOCATION_END;
    }
  }

private:
  typedef typename Protocol::socket::template
    rebind_executor<PeerIoExecutor>::other peer_socket_type;

  Handler handler_;
  handler_work<Handler, IoExecutor> work_;
};

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // defined(ASIO_HAS_IO_URING)

#endif // ASIO_DETAIL_IO_URING_SOCKET_ACCEPT_OP_HPP
