//
// detail/io_uring_null_buffers_op.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_IO_URING_NULL_BUFFERS_OP_HPP
#define ASIO_DETAIL_IO_URING_NULL_BUFFERS_OP_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/bind_handler.hpp"
#include "asio/detail/fenced_block.hpp"
#include "asio/detail/handler_alloc_helpers.hpp"
#include "asio/detail/handler_work.hpp"
#include "asio/detail/io_uring_operation.hpp"
#include "asio/detail/memory.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

template <typename Handler, typename IoExecutor>
class io_uring_null_buffers_op : public io_uring_operation
{
public:
  ASIO_DEFINE_HANDLER_PTR(io_uring_null_buffers_op);

  io_uring_null_buffers_op(const asio::error_code& success_ec,
      int descriptor, int poll_flags, Handler& handler, const IoExecutor& io_ex)
    : io_uring_operation(success_ec,
        &io_uring_null_buffers_op::do_prepare,
        &io_uring_null_buffers_op::do_perform,
        &io_uring_null_buffers_op::do_complete),
      handler_(static_cast<Handler&&>(handler)),
      work_(handler_, io_ex),
      descriptor_(descriptor),
      poll_flags_(poll_flags)
  {
  }

  static void do_prepare(io_uring_operation* base, ::io_uring_sqe* sqe)
  {
    ASIO_ASSUME(base != 0);
    io_uring_null_buffers_op* o(static_cast<io_uring_null_buffers_op*>(base));

    ::io_uring_prep_poll_add(sqe, o->descriptor_, o->poll_flags_);
  }

  static bool do_perform(io_uring_operation*, bool after_completion)
  {
    return after_completion;
  }

  static void do_complete(void* owner, operation* base,
      const asio::error_code& /*ec*/,
      std::size_t /*bytes_transferred*/)
  {
    // Take ownership of the handler object.
    ASIO_ASSUME(base != 0);
    io_uring_null_buffers_op* o(static_cast<io_uring_null_buffers_op*>(base));
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
    detail::binder2<Handler, asio::error_code, std::size_t>
      handler(o->handler_, o->ec_, o->bytes_transferred_);
    p.h = asio::detail::addressof(handler.handler_);
    p.reset();

    // Make the upcall if required.
    if (owner)
    {
      fenced_block b(fenced_block::half);
      ASIO_HANDLER_INVOCATION_BEGIN((handler.arg1_, handler.arg2_));
      w.complete(handler, handler.handler_);
      ASIO_HANDLER_INVOCATION_END;
    }
  }

private:
  Handler handler_;
  handler_work<Handler, IoExecutor> work_;
  int descriptor_;
  int poll_flags_;
};

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DETAIL_IO_URING_NULL_BUFFERS_OP_HPP
