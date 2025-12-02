//
// detail/resolve_endpoint_op.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_RESOLVER_ENDPOINT_OP_HPP
#define ASIO_DETAIL_RESOLVER_ENDPOINT_OP_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/bind_handler.hpp"
#include "asio/detail/fenced_block.hpp"
#include "asio/detail/handler_alloc_helpers.hpp"
#include "asio/detail/handler_work.hpp"
#include "asio/detail/memory.hpp"
#include "asio/detail/resolve_op.hpp"
#include "asio/detail/socket_ops.hpp"
#include "asio/error.hpp"
#include "asio/ip/basic_resolver_results.hpp"

#if defined(ASIO_HAS_IOCP)
# include "asio/detail/win_iocp_io_context.hpp"
#else // defined(ASIO_HAS_IOCP)
# include "asio/detail/scheduler.hpp"
#endif // defined(ASIO_HAS_IOCP)

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

template <typename Protocol, typename Handler, typename IoExecutor>
class resolve_endpoint_op : public resolve_op
{
public:
  ASIO_DEFINE_HANDLER_PTR(resolve_endpoint_op);

  typedef typename Protocol::endpoint endpoint_type;
  typedef asio::ip::basic_resolver_results<Protocol> results_type;

#if defined(ASIO_HAS_IOCP)
  typedef class win_iocp_io_context scheduler_impl;
#else
  typedef class scheduler scheduler_impl;
#endif

  resolve_endpoint_op(socket_ops::weak_cancel_token_type cancel_token,
      const endpoint_type& endpoint, scheduler_impl& sched,
      Handler& handler, const IoExecutor& io_ex)
    : resolve_op(&resolve_endpoint_op::do_complete),
      cancel_token_(cancel_token),
      endpoint_(endpoint),
      scheduler_(sched),
      handler_(static_cast<Handler&&>(handler)),
      work_(handler_, io_ex)
  {
  }

  static void do_complete(void* owner, operation* base,
      const asio::error_code& /*ec*/,
      std::size_t /*bytes_transferred*/)
  {
    // Take ownership of the operation object.
    ASIO_ASSUME(base != 0);
    resolve_endpoint_op* o(static_cast<resolve_endpoint_op*>(base));
    ptr p = { asio::detail::addressof(o->handler_), o, o };

    if (owner && owner != &o->scheduler_)
    {
      // The operation is being run on the worker io_context. Time to perform
      // the resolver operation.

      // Perform the blocking endpoint resolution operation.
      char host_name[NI_MAXHOST] = "";
      char service_name[NI_MAXSERV] = "";
      socket_ops::background_getnameinfo(o->cancel_token_, o->endpoint_.data(),
          o->endpoint_.size(), host_name, NI_MAXHOST, service_name, NI_MAXSERV,
          o->endpoint_.protocol().type(), o->ec_);
      o->results_ = results_type::create(o->endpoint_, host_name, service_name);

      // Pass operation back to main io_context for completion.
      o->scheduler_.post_deferred_completion(o);
      p.v = p.p = 0;
    }
    else
    {
      // The operation has been returned to the main io_context. The completion
      // handler is ready to be delivered.

      ASIO_HANDLER_COMPLETION((*o));

      // Take ownership of the operation's outstanding work.
      handler_work<Handler, IoExecutor> w(
          static_cast<handler_work<Handler, IoExecutor>&&>(
            o->work_));

      // Make a copy of the handler so that the memory can be deallocated
      // before the upcall is made. Even if we're not about to make an upcall,
      // a sub-object of the handler may be the true owner of the memory
      // associated with the handler. Consequently, a local copy of the handler
      // is required to ensure that any owning sub-object remains valid until
      // after we have deallocated the memory here.
      detail::binder2<Handler, asio::error_code, results_type>
        handler(o->handler_, o->ec_, o->results_);
      p.h = asio::detail::addressof(handler.handler_);
      p.reset();

      if (owner)
      {
        fenced_block b(fenced_block::half);
        ASIO_HANDLER_INVOCATION_BEGIN((handler.arg1_, "..."));
        w.complete(handler, handler.handler_);
        ASIO_HANDLER_INVOCATION_END;
      }
    }
  }

private:
  socket_ops::weak_cancel_token_type cancel_token_;
  endpoint_type endpoint_;
  scheduler_impl& scheduler_;
  Handler handler_;
  handler_work<Handler, IoExecutor> work_;
  results_type results_;
};

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DETAIL_RESOLVER_ENDPOINT_OP_HPP
