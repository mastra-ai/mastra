//
// windows/basic_object_handle.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
// Copyright (c) 2011 Boris Schaeling (boris@highscore.de)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_WINDOWS_BASIC_OBJECT_HANDLE_HPP
#define ASIO_WINDOWS_BASIC_OBJECT_HANDLE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_WINDOWS_OBJECT_HANDLE) \
  || defined(GENERATING_DOCUMENTATION)

#include <utility>
#include "asio/any_io_executor.hpp"
#include "asio/async_result.hpp"
#include "asio/detail/io_object_impl.hpp"
#include "asio/detail/throw_error.hpp"
#include "asio/detail/win_object_handle_service.hpp"
#include "asio/error.hpp"
#include "asio/execution_context.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace windows {

/// Provides object-oriented handle functionality.
/**
 * The windows::basic_object_handle class provides asynchronous and blocking
 * object-oriented handle functionality.
 *
 * @par Thread Safety
 * @e Distinct @e objects: Safe.@n
 * @e Shared @e objects: Unsafe.
 */
template <typename Executor = any_io_executor>
class basic_object_handle
{
private:
  class initiate_async_wait;

public:
  /// The type of the executor associated with the object.
  typedef Executor executor_type;

  /// Rebinds the handle type to another executor.
  template <typename Executor1>
  struct rebind_executor
  {
    /// The handle type when rebound to the specified executor.
    typedef basic_object_handle<Executor1> other;
  };

  /// The native representation of a handle.
#if defined(GENERATING_DOCUMENTATION)
  typedef implementation_defined native_handle_type;
#else
  typedef asio::detail::win_object_handle_service::native_handle_type
    native_handle_type;
#endif

  /// An object handle is always the lowest layer.
  typedef basic_object_handle lowest_layer_type;

  /// Construct an object handle without opening it.
  /**
   * This constructor creates an object handle without opening it.
   *
   * @param ex The I/O executor that the object handle will use, by default, to
   * dispatch handlers for any asynchronous operations performed on the
   * object handle.
   */
  explicit basic_object_handle(const executor_type& ex)
    : impl_(0, ex)
  {
  }

  /// Construct an object handle without opening it.
  /**
   * This constructor creates an object handle without opening it.
   *
   * @param context An execution context which provides the I/O executor that
   * the object handle will use, by default, to dispatch handlers for any
   * asynchronous operations performed on the object handle.
   */
  template <typename ExecutionContext>
  explicit basic_object_handle(ExecutionContext& context,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value,
        defaulted_constraint
      > = defaulted_constraint())
    : impl_(0, 0, context)
  {
  }

  /// Construct an object handle on an existing native handle.
  /**
   * This constructor creates an object handle object to hold an existing native
   * handle.
   *
   * @param ex The I/O executor that the object handle will use, by default, to
   * dispatch handlers for any asynchronous operations performed on the
   * object handle.
   *
   * @param native_handle The new underlying handle implementation.
   *
   * @throws asio::system_error Thrown on failure.
   */
  basic_object_handle(const executor_type& ex,
      const native_handle_type& native_handle)
    : impl_(0, ex)
  {
    asio::error_code ec;
    impl_.get_service().assign(impl_.get_implementation(), native_handle, ec);
    asio::detail::throw_error(ec, "assign");
  }

  /// Construct an object handle on an existing native handle.
  /**
   * This constructor creates an object handle object to hold an existing native
   * handle.
   *
   * @param context An execution context which provides the I/O executor that
   * the object handle will use, by default, to dispatch handlers for any
   * asynchronous operations performed on the object handle.
   *
   * @param native_handle The new underlying handle implementation.
   *
   * @throws asio::system_error Thrown on failure.
   */
  template <typename ExecutionContext>
  basic_object_handle(ExecutionContext& context,
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

  /// Move-construct an object handle from another.
  /**
   * This constructor moves an object handle from one object to another.
   *
   * @param other The other object handle object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_object_handle(const executor_type&)
   * constructor.
   */
  basic_object_handle(basic_object_handle&& other)
    : impl_(std::move(other.impl_))
  {
  }

  /// Move-assign an object handle from another.
  /**
   * This assignment operator moves an object handle from one object to another.
   *
   * @param other The other object handle object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_object_handle(const executor_type&)
   * constructor.
   */
  basic_object_handle& operator=(basic_object_handle&& other)
  {
    impl_ = std::move(other.impl_);
    return *this;
  }

  // All handles have access to each other's implementations.
  template <typename Executor1>
  friend class basic_object_handle;

  /// Move-construct an object handle from a handle of another executor type.
  /**
   * This constructor moves an object handle from one object to another.
   *
   * @param other The other object handle object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_object_handle(const executor_type&)
   * constructor.
   */
  template<typename Executor1>
  basic_object_handle(basic_object_handle<Executor1>&& other,
      constraint_t<
        is_convertible<Executor1, Executor>::value,
        defaulted_constraint
      > = defaulted_constraint())
    : impl_(std::move(other.impl_))
  {
  }

  /// Move-assign an object handle from a handle of another executor type.
  /**
   * This assignment operator moves an object handle from one object to another.
   *
   * @param other The other object handle object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_object_handle(const executor_type&)
   * constructor.
   */
  template<typename Executor1>
  constraint_t<
    is_convertible<Executor1, Executor>::value,
    basic_object_handle&
  > operator=(basic_object_handle<Executor1>&& other)
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
   * layers. Since an object handle cannot contain any further layers, it simply
   * returns a reference to itself.
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
   * layers. Since an object handle cannot contain any further layers, it simply
   * returns a reference to itself.
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

  /// Perform a blocking wait on the object handle.
  /**
   * This function is used to wait for the object handle to be set to the
   * signalled state. This function blocks and does not return until the object
   * handle has been set to the signalled state.
   *
   * @throws asio::system_error Thrown on failure.
   */
  void wait()
  {
    asio::error_code ec;
    impl_.get_service().wait(impl_.get_implementation(), ec);
    asio::detail::throw_error(ec, "wait");
  }

  /// Perform a blocking wait on the object handle.
  /**
   * This function is used to wait for the object handle to be set to the
   * signalled state. This function blocks and does not return until the object
   * handle has been set to the signalled state.
   *
   * @param ec Set to indicate what error occurred, if any.
   */
  void wait(asio::error_code& ec)
  {
    impl_.get_service().wait(impl_.get_implementation(), ec);
  }

  /// Start an asynchronous wait on the object handle.
  /**
   * This function is be used to initiate an asynchronous wait against the
   * object handle. It is an initiating function for an @ref
   * asynchronous_operation, and always returns immediately.
   *
   * @param token The @ref completion_token that will be used to produce a
   * completion handler, which will be called when the wait completes.
   * Potential completion tokens include @ref use_future, @ref use_awaitable,
   * @ref yield_context, or a function object with the correct completion
   * signature. The function signature of the completion handler must be:
   * @code void handler(
   *   const asio::error_code& error // Result of operation.
   * ); @endcode
   * Regardless of whether the asynchronous operation completes immediately or
   * not, the completion handler will not be invoked from within this function.
   * On immediate completion, invocation of the handler will be performed in a
   * manner equivalent to using asio::async_immediate().
   *
   * @par Completion Signature
   * @code void(asio::error_code) @endcode
   */
  template <
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code))
        WaitToken = default_completion_token_t<executor_type>>
  auto async_wait(
      WaitToken&& token = default_completion_token_t<executor_type>())
    -> decltype(
      async_initiate<WaitToken, void (asio::error_code)>(
        declval<initiate_async_wait>(), token))
  {
    return async_initiate<WaitToken, void (asio::error_code)>(
        initiate_async_wait(this), token);
  }

private:
  // Disallow copying and assignment.
  basic_object_handle(const basic_object_handle&) = delete;
  basic_object_handle& operator=(const basic_object_handle&) = delete;

  class initiate_async_wait
  {
  public:
    typedef Executor executor_type;

    explicit initiate_async_wait(basic_object_handle* self)
      : self_(self)
    {
    }

    const executor_type& get_executor() const noexcept
    {
      return self_->get_executor();
    }

    template <typename WaitHandler>
    void operator()(WaitHandler&& handler) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a WaitHandler.
      ASIO_WAIT_HANDLER_CHECK(WaitHandler, handler) type_check;

      detail::non_const_lvalue<WaitHandler> handler2(handler);
      self_->impl_.get_service().async_wait(
          self_->impl_.get_implementation(),
          handler2.value, self_->impl_.get_executor());
    }

  private:
    basic_object_handle* self_;
  };

  asio::detail::io_object_impl<
    asio::detail::win_object_handle_service, Executor> impl_;
};

} // namespace windows
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // defined(ASIO_HAS_WINDOWS_OBJECT_HANDLE)
       //   || defined(GENERATING_DOCUMENTATION)

#endif // ASIO_WINDOWS_BASIC_OBJECT_HANDLE_HPP
