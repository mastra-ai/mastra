//
// detail/impl/strand_service.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_IMPL_STRAND_SERVICE_HPP
#define ASIO_DETAIL_IMPL_STRAND_SERVICE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/completion_handler.hpp"
#include "asio/detail/fenced_block.hpp"
#include "asio/detail/handler_alloc_helpers.hpp"
#include "asio/detail/memory.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

inline strand_service::strand_impl::strand_impl()
  : operation(&strand_service::do_complete),
    locked_(false)
{
}

template <typename Handler>
void strand_service::dispatch(strand_service::implementation_type& impl,
    Handler& handler)
{
  // If we are already in the strand then the handler can run immediately.
  if (running_in_this_thread(impl))
  {
    fenced_block b(fenced_block::full);
    static_cast<Handler&&>(handler)();
    return;
  }

  // Allocate and construct an operation to wrap the handler.
  typedef completion_handler<Handler, io_context::executor_type> op;
  typename op::ptr p = { asio::detail::addressof(handler),
    op::ptr::allocate(handler), 0 };
  p.p = new (p.v) op(handler, io_context_.get_executor());

  ASIO_HANDLER_CREATION((this->context(),
        *p.p, "strand", impl, 0, "dispatch"));

  operation* o = p.p;
  p.v = p.p = 0;
  do_dispatch(impl, o);
}

// Request the io_context to invoke the given handler and return immediately.
template <typename Handler>
void strand_service::post(strand_service::implementation_type& impl,
    Handler& handler)
{
  bool is_continuation =
    asio_handler_cont_helpers::is_continuation(handler);

  // Allocate and construct an operation to wrap the handler.
  typedef completion_handler<Handler, io_context::executor_type> op;
  typename op::ptr p = { asio::detail::addressof(handler),
    op::ptr::allocate(handler), 0 };
  p.p = new (p.v) op(handler, io_context_.get_executor());

  ASIO_HANDLER_CREATION((this->context(),
        *p.p, "strand", impl, 0, "post"));

  do_post(impl, p.p, is_continuation);
  p.v = p.p = 0;
}

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DETAIL_IMPL_STRAND_SERVICE_HPP
