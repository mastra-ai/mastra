//
// windows/overlapped_ptr.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_WINDOWS_OVERLAPPED_PTR_HPP
#define ASIO_WINDOWS_OVERLAPPED_PTR_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_WINDOWS_OVERLAPPED_PTR) \
  || defined(GENERATING_DOCUMENTATION)

#include "asio/detail/noncopyable.hpp"
#include "asio/detail/win_iocp_overlapped_ptr.hpp"
#include "asio/io_context.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace windows {

/// Wraps a handler to create an OVERLAPPED object for use with overlapped I/O.
/**
 * A special-purpose smart pointer used to wrap an application handler so that
 * it can be passed as the LPOVERLAPPED argument to overlapped I/O functions.
 *
 * @par Thread Safety
 * @e Distinct @e objects: Safe.@n
 * @e Shared @e objects: Unsafe.
 */
class overlapped_ptr
  : private noncopyable
{
public:
  /// Construct an empty overlapped_ptr.
  overlapped_ptr()
    : impl_()
  {
  }

  /// Construct an overlapped_ptr to contain the specified handler.
  template <typename ExecutionContext, typename Handler>
  explicit overlapped_ptr(ExecutionContext& context,
      Handler&& handler,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value
      > = 0)
    : impl_(context.get_executor(), static_cast<Handler&&>(handler))
  {
  }

  /// Construct an overlapped_ptr to contain the specified handler.
  template <typename Executor, typename Handler>
  explicit overlapped_ptr(const Executor& ex,
      Handler&& handler,
      constraint_t<
        execution::is_executor<Executor>::value
          || is_executor<Executor>::value
      > = 0)
    : impl_(ex, static_cast<Handler&&>(handler))
  {
  }

  /// Destructor automatically frees the OVERLAPPED object unless released.
  ~overlapped_ptr()
  {
  }

  /// Reset to empty.
  void reset()
  {
    impl_.reset();
  }

  /// Reset to contain the specified handler, freeing any current OVERLAPPED
  /// object.
  template <typename ExecutionContext, typename Handler>
  void reset(ExecutionContext& context, Handler&& handler,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value
      > = 0)
  {
    impl_.reset(context.get_executor(), static_cast<Handler&&>(handler));
  }

  /// Reset to contain the specified handler, freeing any current OVERLAPPED
  /// object.
  template <typename Executor, typename Handler>
  void reset(const Executor& ex, Handler&& handler,
      constraint_t<
        execution::is_executor<Executor>::value
          || is_executor<Executor>::value
      > = 0)
  {
    impl_.reset(ex, static_cast<Handler&&>(handler));
  }

  /// Get the contained OVERLAPPED object.
  OVERLAPPED* get()
  {
    return impl_.get();
  }

  /// Get the contained OVERLAPPED object.
  const OVERLAPPED* get() const
  {
    return impl_.get();
  }

  /// Release ownership of the OVERLAPPED object.
  OVERLAPPED* release()
  {
    return impl_.release();
  }

  /// Post completion notification for overlapped operation. Releases ownership.
  void complete(const asio::error_code& ec,
      std::size_t bytes_transferred)
  {
    impl_.complete(ec, bytes_transferred);
  }

private:
  detail::win_iocp_overlapped_ptr impl_;
};

} // namespace windows
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // defined(ASIO_HAS_WINDOWS_OVERLAPPED_PTR)
       //   || defined(GENERATING_DOCUMENTATION)

#endif // ASIO_WINDOWS_OVERLAPPED_PTR_HPP
