//
// detail/win_iocp_overlapped_ptr.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_WIN_IOCP_OVERLAPPED_PTR_HPP
#define ASIO_DETAIL_WIN_IOCP_OVERLAPPED_PTR_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_IOCP)

#include "asio/io_context.hpp"
#include "asio/query.hpp"
#include "asio/detail/handler_alloc_helpers.hpp"
#include "asio/detail/memory.hpp"
#include "asio/detail/noncopyable.hpp"
#include "asio/detail/win_iocp_overlapped_op.hpp"
#include "asio/detail/win_iocp_io_context.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

// Wraps a handler to create an OVERLAPPED object for use with overlapped I/O.
class win_iocp_overlapped_ptr
  : private noncopyable
{
public:
  // Construct an empty win_iocp_overlapped_ptr.
  win_iocp_overlapped_ptr()
    : ptr_(0),
      iocp_service_(0)
  {
  }

  // Construct an win_iocp_overlapped_ptr to contain the specified handler.
  template <typename Executor, typename Handler>
  explicit win_iocp_overlapped_ptr(const Executor& ex,
      Handler&& handler)
    : ptr_(0),
      iocp_service_(0)
  {
    this->reset(ex, static_cast<Handler&&>(handler));
  }

  // Destructor automatically frees the OVERLAPPED object unless released.
  ~win_iocp_overlapped_ptr()
  {
    reset();
  }

  // Reset to empty.
  void reset()
  {
    if (ptr_)
    {
      ptr_->destroy();
      ptr_ = 0;
      iocp_service_->work_finished();
      iocp_service_ = 0;
    }
  }

  // Reset to contain the specified handler, freeing any current OVERLAPPED
  // object.
  template <typename Executor, typename Handler>
  void reset(const Executor& ex, Handler handler)
  {
    win_iocp_io_context* iocp_service = this->get_iocp_service(ex);

    typedef win_iocp_overlapped_op<Handler, Executor> op;
    typename op::ptr p = { asio::detail::addressof(handler),
      op::ptr::allocate(handler), 0 };
    p.p = new (p.v) op(handler, ex);

    ASIO_HANDLER_CREATION((ex.context(), *p.p,
          "iocp_service", iocp_service, 0, "overlapped"));

    iocp_service->work_started();
    reset();
    ptr_ = p.p;
    p.v = p.p = 0;
    iocp_service_ = iocp_service;
  }

  // Get the contained OVERLAPPED object.
  OVERLAPPED* get()
  {
    return ptr_;
  }

  // Get the contained OVERLAPPED object.
  const OVERLAPPED* get() const
  {
    return ptr_;
  }

  // Release ownership of the OVERLAPPED object.
  OVERLAPPED* release()
  {
    if (ptr_)
      iocp_service_->on_pending(ptr_);

    OVERLAPPED* tmp = ptr_;
    ptr_ = 0;
    iocp_service_ = 0;
    return tmp;
  }

  // Post completion notification for overlapped operation. Releases ownership.
  void complete(const asio::error_code& ec,
      std::size_t bytes_transferred)
  {
    if (ptr_)
    {
      iocp_service_->on_completion(ptr_, ec,
          static_cast<DWORD>(bytes_transferred));
      ptr_ = 0;
      iocp_service_ = 0;
    }
  }

private:
  template <typename Executor>
  static win_iocp_io_context* get_iocp_service(const Executor& ex,
      enable_if_t<
        can_query<const Executor&, execution::context_t>::value
      >* = 0)
  {
    return &use_service<win_iocp_io_context>(
        asio::query(ex, execution::context));
  }

  template <typename Executor>
  static win_iocp_io_context* get_iocp_service(const Executor& ex,
      enable_if_t<
        !can_query<const Executor&, execution::context_t>::value
      >* = 0)
  {
    return &use_service<win_iocp_io_context>(ex.context());
  }

  static win_iocp_io_context* get_iocp_service(
      const io_context::executor_type& ex)
  {
    return &asio::query(ex, execution::context).impl_;
  }

  win_iocp_operation* ptr_;
  win_iocp_io_context* iocp_service_;
};

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // defined(ASIO_HAS_IOCP)

#endif // ASIO_DETAIL_WIN_IOCP_OVERLAPPED_PTR_HPP
