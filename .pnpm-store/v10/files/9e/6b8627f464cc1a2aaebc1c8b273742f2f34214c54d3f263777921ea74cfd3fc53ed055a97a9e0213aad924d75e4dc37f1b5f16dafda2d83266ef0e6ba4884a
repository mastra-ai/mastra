//
// experimental/detail/channel_receive_op.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXPERIMENTAL_DETAIL_CHANNEL_RECEIVE_OP_HPP
#define ASIO_EXPERIMENTAL_DETAIL_CHANNEL_RECEIVE_OP_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/bind_handler.hpp"
#include "asio/detail/completion_handler.hpp"
#include "asio/detail/handler_alloc_helpers.hpp"
#include "asio/error.hpp"
#include "asio/experimental/detail/channel_operation.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace experimental {
namespace detail {

template <typename Payload>
class channel_receive : public channel_operation
{
public:
  void immediate(Payload payload)
  {
    func_(this, immediate_op, &payload);
  }

  void post(Payload payload)
  {
    func_(this, post_op, &payload);
  }

  void dispatch(Payload payload)
  {
    func_(this, dispatch_op, &payload);
  }

protected:
  channel_receive(func_type func)
    : channel_operation(func)
  {
  }
};

template <typename Payload, typename Handler, typename IoExecutor>
class channel_receive_op : public channel_receive<Payload>
{
public:
  ASIO_DEFINE_HANDLER_PTR(channel_receive_op);

  template <typename... Args>
  channel_receive_op(Handler& handler, const IoExecutor& io_ex)
    : channel_receive<Payload>(&channel_receive_op::do_action),
      handler_(static_cast<Handler&&>(handler)),
      work_(handler_, io_ex)
  {
  }

  static void do_action(channel_operation* base,
      channel_operation::action a, void* v)
  {
    // Take ownership of the operation object.
    channel_receive_op* o(static_cast<channel_receive_op*>(base));
    ptr p = { asio::detail::addressof(o->handler_), o, o };

    ASIO_HANDLER_COMPLETION((*o));

    // Take ownership of the operation's outstanding work.
    channel_operation::handler_work<Handler, IoExecutor> w(
        static_cast<channel_operation::handler_work<Handler, IoExecutor>&&>(
          o->work_));

    // Make a copy of the handler so that the memory can be deallocated before
    // the handler is posted. Even if we're not about to post the handler, a
    // sub-object of the handler may be the true owner of the memory associated
    // with the handler. Consequently, a local copy of the handler is required
    // to ensure that any owning sub-object remains valid until after we have
    // deallocated the memory here.
    if (a != channel_operation::destroy_op)
    {
      Payload* payload = static_cast<Payload*>(v);
      asio::detail::completion_payload_handler<Payload, Handler> handler(
          static_cast<Payload&&>(*payload), o->handler_);
      p.h = asio::detail::addressof(handler.handler_);
      p.reset();
      ASIO_HANDLER_INVOCATION_BEGIN(());
      if (a == channel_operation::immediate_op)
        w.immediate(handler, handler.handler_, 0);
      else if (a == channel_operation::dispatch_op)
        w.dispatch(handler, handler.handler_);
      else
        w.post(handler, handler.handler_);
      ASIO_HANDLER_INVOCATION_END;
    }
    else
    {
      asio::detail::binder0<Handler> handler(o->handler_);
      p.h = asio::detail::addressof(handler.handler_);
      p.reset();
    }
  }

private:
  Handler handler_;
  channel_operation::handler_work<Handler, IoExecutor> work_;
};

} // namespace detail
} // namespace experimental
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_EXPERIMENTAL_DETAIL_CHANNEL_RECEIVE_OP_HPP
