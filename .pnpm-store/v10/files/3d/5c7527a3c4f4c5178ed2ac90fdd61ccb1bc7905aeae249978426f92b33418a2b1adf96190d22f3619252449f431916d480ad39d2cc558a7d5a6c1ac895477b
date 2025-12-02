//
// detail/io_uring_socket_connect_op.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_IO_URING_SOCKET_CONNECT_OP_HPP
#define ASIO_DETAIL_IO_URING_SOCKET_CONNECT_OP_HPP

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
#include "asio/detail/socket_ops.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

template <typename Protocol>
class io_uring_socket_connect_op_base : public io_uring_operation
{
public:
  io_uring_socket_connect_op_base(const asio::error_code& success_ec,
      socket_type socket, const typename Protocol::endpoint& endpoint,
      func_type complete_func)
    : io_uring_operation(success_ec,
        &io_uring_socket_connect_op_base::do_prepare,
        &io_uring_socket_connect_op_base::do_perform, complete_func),
      socket_(socket),
      endpoint_(endpoint)
  {
  }

  static void do_prepare(io_uring_operation* base, ::io_uring_sqe* sqe)
  {
    ASIO_ASSUME(base != 0);
    io_uring_socket_connect_op_base* o(
        static_cast<io_uring_socket_connect_op_base*>(base));

    ::io_uring_prep_connect(sqe, o->socket_,
        static_cast<sockaddr*>(o->endpoint_.data()),
        static_cast<socklen_t>(o->endpoint_.size()));
  }

  static bool do_perform(io_uring_operation*, bool after_completion)
  {
    return after_completion;
  }

private:
  socket_type socket_;
  typename Protocol::endpoint endpoint_;
};

template <typename Protocol, typename Handler, typename IoExecutor>
class io_uring_socket_connect_op :
  public io_uring_socket_connect_op_base<Protocol>
{
public:
  ASIO_DEFINE_HANDLER_PTR(io_uring_socket_connect_op);

  io_uring_socket_connect_op(const asio::error_code& success_ec,
      socket_type socket, const typename Protocol::endpoint& endpoint,
      Handler& handler, const IoExecutor& io_ex)
    : io_uring_socket_connect_op_base<Protocol>(success_ec, socket,
        endpoint, &io_uring_socket_connect_op::do_complete),
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
    io_uring_socket_connect_op* o
      (static_cast<io_uring_socket_connect_op*>(base));
    ptr p = { asio::detail::addressof(o->handler_), o, o };

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

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // defined(ASIO_HAS_IO_URING)

#endif // ASIO_DETAIL_IO_URING_SOCKET_CONNECT_OP_HPP
