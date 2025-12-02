//
// windows/basic_overlapped_handle.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_WINDOWS_BASIC_OVERLAPPED_HANDLE_HPP
#define ASIO_WINDOWS_BASIC_OVERLAPPED_HANDLE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_WINDOWS_RANDOM_ACCESS_HANDLE) \
  || defined(ASIO_HAS_WINDOWS_STREAM_HANDLE) \
  || defined(GENERATING_DOCUMENTATION)

#include <cstddef>
#include <utility>
#include "asio/any_io_executor.hpp"
#include "asio/async_result.hpp"
#include "asio/detail/io_object_impl.hpp"
#include "asio/detail/throw_error.hpp"
#include "asio/detail/win_iocp_handle_service.hpp"
#include "asio/error.hpp"
#include "asio/execution_context.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace windows {

/// Provides Windows handle functionality for objects that support
/// overlapped I/O.
/**
 * The windows::overlapped_handle class provides the ability to wrap a Windows
 * handle. The underlying object referred to by the handle must support
 * overlapped I/O.
 *
 * @par Thread Safety
 * @e Distinct @e objects: Safe.@n
 * @e Shared @e objects: Unsafe.
 */
template <typename Executor = any_io_executor>
class basic_overlapped_handle
{
public:
  /// The type of the executor associated with the object.
  typedef Executor executor_type;

  /// Rebinds the handle type to another executor.
  template <typename Executor1>
  struct rebind_executor
  {
    /// The handle type when rebound to the specified executor.
    typedef basic_overlapped_handle<Executor1> other;
  };

  /// The native representation of a handle.
#if defined(GENERATING_DOCUMENTATION)
  typedef implementation_defined native_handle_type;
#else
  typedef asio::detail::win_iocp_handle_service::native_handle_type
    native_handle_type;
#endif

  /// An overlapped_handle is always the lowest layer.
  typedef basic_overlapped_handle lowest_layer_type;

  /// Construct an overlapped handle without opening it.
  /**
   * This constructor creates an overlapped handle without opening it.
   *
   * @param ex The I/O executor that the overlapped handle will use, by default,
   * to dispatch handlers for any asynchronous operations performed on the
   * overlapped handle.
   */
  explicit basic_overlapped_handle(const executor_type& ex)
    : impl_(0, ex)
  {
  }

  /// Construct an overlapped handle without opening it.
  /**
   * This constructor creates an overlapped handle without opening it.
   *
   * @param context An execution context which provides the I/O executor that
   * the overlapped handle will use, by default, to dispatch handlers for any
   * asynchronous operations performed on the overlapped handle.
   */
  template <typename ExecutionContext>
  explicit basic_overlapped_handle(ExecutionContext& context,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value,
        defaulted_constraint
      > = defaulted_constraint())
    : impl_(0, 0, context)
  {
  }

  /// Construct an overlapped handle on an existing native handle.
  /**
   * This constructor creates an overlapped handle object to hold an existing
   * native handle.
   *
   * @param ex The I/O executor that the overlapped handle will use, by default,
   * to dispatch handlers for any asynchronous operations performed on the
   * overlapped handle.
   *
   * @param native_handle The new underlying handle implementation.
   *
   * @throws asio::system_error Thrown on failure.
   */
  basic_overlapped_handle(const executor_type& ex,
      const native_handle_type& native_handle)
    : impl_(0, ex)
  {
    asio::error_code ec;
    impl_.get_service().assign(impl_.get_implementation(), native_handle, ec);
    asio::detail::throw_error(ec, "assign");
  }

  /// Construct an overlapped handle on an existing native handle.
  /**
   * This constructor creates an overlapped handle object to hold an existing
   * native handle.
   *
   * @param context An execution context which provides the I/O executor that
   * the overlapped handle will use, by default, to dispatch handlers for any
   * asynchronous operations performed on the overlapped handle.
   *
   * @param native_handle The new underlying handle implementation.
   *
   * @throws asio::system_error Thrown on failure.
   */
  template <typename ExecutionContext>
  basic_overlapped_handle(ExecutionContext& context,
      const native_handle_type& native_handle,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value
      > = 0)
    : impl_(0, 0, context)
  {
    asio::error_code ec;
    impl_.get_service().assign(impl_.get_implementation(), native_handle, ec);
    asio::detail::throw_error(ec, "assign");
  }

  /// Move-construct an overlapped handle from another.
  /**
   * This constructor moves a handle from one object to another.
   *
   * @param other The other overlapped handle object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c overlapped_handle(const executor_type&)
   * constructor.
   */
  basic_overlapped_handle(basic_overlapped_handle&& other)
    : impl_(std::move(other.impl_))
  {
  }

  /// Move-assign an overlapped handle from another.
  /**
   * This assignment operator moves a handle from one object to another.
   *
   * @param other The other overlapped handle object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c overlapped_handle(const executor_type&)
   * constructor.
   */
  basic_overlapped_handle& operator=(basic_overlapped_handle&& other)
  {
    impl_ = std::move(other.impl_);
    return *this;
  }

  // All overlapped handles have access to each other's implementations.
  template <typename Executor1>
  friend class basic_overlapped_handle;

  /// Move-construct an overlapped handle from a handle of another executor
  /// type.
  /**
   * This constructor moves a handle from one object to another.
   *
   * @param other The other overlapped handle object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c overlapped_handle(const executor_type&)
   * constructor.
   */
  template<typename Executor1>
  basic_overlapped_handle(basic_overlapped_handle<Executor1>&& other,
      constraint_t<
        is_convertible<Executor1, Executor>::value,
        defaulted_constraint
      > = defaulted_constraint())
    : impl_(std::move(other.impl_))
  {
  }

  /// Move-assign an overlapped handle from a handle of another executor type.
  /**
   * This assignment operator moves a handle from one object to another.
   *
   * @param other The other overlapped handle object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c overlapped_handle(const executor_type&)
   * constructor.
   */
  template<typename Executor1>
  constraint_t<
    is_convertible<Executor1, Executor>::value,
    basic_overlapped_handle&
  > operator=(basic_overlapped_handle<Executor1>&& other)
  {
    impl_ = std::move(other.impl_);
    return *this;
  }

  /// Get the executor associated with the object.
  const executor_type& get_executor() noexcept
  {
    return impl_.get_executor();
  }

  /// Get a reference to the lowest layer.
  /**
   * This function returns a reference to the lowest layer in a stack of
   * layers. Since an overlapped_handle cannot contain any further layers, it
   * simply returns a reference to itself.
   *
   * @return A reference to the lowest layer in the stack of layers. Ownership
   * is not transferred to the caller.
   */
  lowest_layer_type& lowest_layer()
  {
    return *this;
  }

  /// Get a const reference to the lowest layer.
  /**
   * This function returns a const reference to the lowest layer in a stack of
   * layers. Since an overlapped_handle cannot contain any further layers, it
   * simply returns a reference to itself.
   *
   * @return A const reference to the lowest layer in the stack of layers.
   * Ownership is not transferred to the caller.
   */
  const lowest_layer_type& lowest_layer() const
  {
    return *this;
  }

  /// Assign an existing native handle to the handle.
  /*
   * This function opens the handle to hold an existing native handle.
   *
   * @param handle A native handle.
   *
   * @throws asio::system_error Thrown on failure.
   */
  void assign(const native_handle_type& handle)
  {
    asio::error_code ec;
    impl_.get_service().assign(impl_.get_implementation(), handle, ec);
    asio::detail::throw_error(ec, "assign");
  }

  /// Assign an existing native handle to the handle.
  /*
   * This function opens the handle to hold an existing native handle.
   *
   * @param handle A native handle.
   *
   * @param ec Set to indicate what error occurred, if any.
   */
  ASIO_SYNC_OP_VOID assign(const native_handle_type& handle,
      asio::error_code& ec)
  {
    impl_.get_service().assign(impl_.get_implementation(), handle, ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Determine whether the handle is open.
  bool is_open() const
  {
    return impl_.get_service().is_open(impl_.get_implementation());
  }

  /// Close the handle.
  /**
   * This function is used to close the handle. Any asynchronous read or write
   * operations will be cancelled immediately, and will complete with the
   * asio::error::operation_aborted error.
   *
   * @throws asio::system_error Thrown on failure.
   */
  void close()
  {
    asio::error_code ec;
    impl_.get_service().close(impl_.get_implementation(), ec);
    asio::detail::throw_error(ec, "close");
  }

  /// Close the handle.
  /**
   * This function is used to close the handle. Any asynchronous read or write
   * operations will be cancelled immediately, and will complete with the
   * asio::error::operation_aborted error.
   *
   * @param ec Set to indicate what error occurred, if any.
   */
  ASIO_SYNC_OP_VOID close(asio::error_code& ec)
  {
    impl_.get_service().close(impl_.get_implementation(), ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Release ownership of the underlying native handle.
  /**
   * This function causes all outstanding asynchronous operations to finish
   * immediately, and the handlers for cancelled operations will be passed the
   * asio::error::operation_aborted error. Ownership of the native handle
   * is then transferred to the caller.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @note This function is unsupported on Windows versions prior to Windows
   * 8.1, and will fail with asio::error::operation_not_supported on
   * these platforms.
   */
#if defined(ASIO_MSVC) && (ASIO_MSVC >= 1400) \
  && (!defined(_WIN32_WINNT) || _WIN32_WINNT < 0x0603)
  __declspec(deprecated("This function always fails with "
        "operation_not_supported when used on Windows versions "
        "prior to Windows 8.1."))
#endif
  native_handle_type release()
  {
    asio::error_code ec;
    native_handle_type s = impl_.get_service().release(
        impl_.get_implementation(), ec);
    asio::detail::throw_error(ec, "release");
    return s;
  }

  /// Release ownership of the underlying native handle.
  /**
   * This function causes all outstanding asynchronous operations to finish
   * immediately, and the handlers for cancelled operations will be passed the
   * asio::error::operation_aborted error. Ownership of the native handle
   * is then transferred to the caller.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @note This function is unsupported on Windows versions prior to Windows
   * 8.1, and will fail with asio::error::operation_not_supported on
   * these platforms.
   */
#if defined(ASIO_MSVC) && (ASIO_MSVC >= 1400) \
  && (!defined(_WIN32_WINNT) || _WIN32_WINNT < 0x0603)
  __declspec(deprecated("This function always fails with "
        "operation_not_supported when used on Windows versions "
        "prior to Windows 8.1."))
#endif
  native_handle_type release(asio::error_code& ec)
  {
    return impl_.get_service().release(impl_.get_implementation(), ec);
  }

  /// Get the native handle representation.
  /**
   * This function may be used to obtain the underlying representation of the
   * handle. This is intended to allow access to native handle functionality
   * that is not otherwise provided.
   */
  native_handle_type native_handle()
  {
    return impl_.get_service().native_handle(impl_.get_implementation());
  }

  /// Cancel all asynchronous operations associated with the handle.
  /**
   * This function causes all outstanding asynchronous read or write operations
   * to finish immediately, and the handlers for cancelled operations will be
   * passed the asio::error::operation_aborted error.
   *
   * @throws asio::system_error Thrown on failure.
   */
  void cancel()
  {
    asio::error_code ec;
    impl_.get_service().cancel(impl_.get_implementation(), ec);
    asio::detail::throw_error(ec, "cancel");
  }

  /// Cancel all asynchronous operations associated with the handle.
  /**
   * This function causes all outstanding asynchronous read or write operations
   * to finish immediately, and the handlers for cancelled operations will be
   * passed the asio::error::operation_aborted error.
   *
   * @param ec Set to indicate what error occurred, if any.
   */
  ASIO_SYNC_OP_VOID cancel(asio::error_code& ec)
  {
    impl_.get_service().cancel(impl_.get_implementation(), ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

protected:
  /// Protected destructor to prevent deletion through this type.
  /**
   * This function destroys the handle, cancelling any outstanding asynchronous
   * wait operations associated with the handle as if by calling @c cancel.
   */
  ~basic_overlapped_handle()
  {
  }

  asio::detail::io_object_impl<
    asio::detail::win_iocp_handle_service, Executor> impl_;

private:
  // Disallow copying and assignment.
  basic_overlapped_handle(const basic_overlapped_handle&) = delete;
  basic_overlapped_handle& operator=(
      const basic_overlapped_handle&) = delete;
};

} // namespace windows
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // defined(ASIO_HAS_WINDOWS_RANDOM_ACCESS_HANDLE)
       //   || defined(ASIO_HAS_WINDOWS_STREAM_HANDLE)
       //   || defined(GENERATING_DOCUMENTATION)

#endif // ASIO_WINDOWS_BASIC_OVERLAPPED_HANDLE_HPP
