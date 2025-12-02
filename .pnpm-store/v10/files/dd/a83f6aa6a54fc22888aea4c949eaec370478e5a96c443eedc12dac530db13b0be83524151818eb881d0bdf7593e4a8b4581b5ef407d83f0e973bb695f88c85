//
// posix/basic_descriptor.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_POSIX_BASIC_DESCRIPTOR_HPP
#define ASIO_POSIX_BASIC_DESCRIPTOR_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_POSIX_STREAM_DESCRIPTOR) \
  || defined(GENERATING_DOCUMENTATION)

#include <utility>
#include "asio/any_io_executor.hpp"
#include "asio/async_result.hpp"
#include "asio/detail/handler_type_requirements.hpp"
#include "asio/detail/io_object_impl.hpp"
#include "asio/detail/non_const_lvalue.hpp"
#include "asio/detail/throw_error.hpp"
#include "asio/error.hpp"
#include "asio/execution_context.hpp"
#include "asio/posix/descriptor_base.hpp"

#if defined(ASIO_HAS_IO_URING_AS_DEFAULT)
# include "asio/detail/io_uring_descriptor_service.hpp"
#else // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
# include "asio/detail/reactive_descriptor_service.hpp"
#endif // defined(ASIO_HAS_IO_URING_AS_DEFAULT)

#include "asio/detail/push_options.hpp"

namespace asio {
namespace posix {

/// Provides POSIX descriptor functionality.
/**
 * The posix::basic_descriptor class template provides the ability to wrap a
 * POSIX descriptor.
 *
 * @par Thread Safety
 * @e Distinct @e objects: Safe.@n
 * @e Shared @e objects: Unsafe.
 */
template <typename Executor = any_io_executor>
class basic_descriptor
  : public descriptor_base
{
private:
  class initiate_async_wait;

public:
  /// The type of the executor associated with the object.
  typedef Executor executor_type;

  /// Rebinds the descriptor type to another executor.
  template <typename Executor1>
  struct rebind_executor
  {
    /// The descriptor type when rebound to the specified executor.
    typedef basic_descriptor<Executor1> other;
  };

  /// The native representation of a descriptor.
#if defined(GENERATING_DOCUMENTATION)
  typedef implementation_defined native_handle_type;
#elif defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  typedef detail::io_uring_descriptor_service::native_handle_type
    native_handle_type;
#else // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  typedef detail::reactive_descriptor_service::native_handle_type
    native_handle_type;
#endif // defined(ASIO_HAS_IO_URING_AS_DEFAULT)

  /// A descriptor is always the lowest layer.
  typedef basic_descriptor lowest_layer_type;

  /// Construct a descriptor without opening it.
  /**
   * This constructor creates a descriptor without opening it.
   *
   * @param ex The I/O executor that the descriptor will use, by default, to
   * dispatch handlers for any asynchronous operations performed on the
   * descriptor.
   */
  explicit basic_descriptor(const executor_type& ex)
    : impl_(0, ex)
  {
  }

  /// Construct a descriptor without opening it.
  /**
   * This constructor creates a descriptor without opening it.
   *
   * @param context An execution context which provides the I/O executor that
   * the descriptor will use, by default, to dispatch handlers for any
   * asynchronous operations performed on the descriptor.
   */
  template <typename ExecutionContext>
  explicit basic_descriptor(ExecutionContext& context,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value,
        defaulted_constraint
      > = defaulted_constraint())
    : impl_(0, 0, context)
  {
  }

  /// Construct a descriptor on an existing native descriptor.
  /**
   * This constructor creates a descriptor object to hold an existing native
   * descriptor.
   *
   * @param ex The I/O executor that the descriptor will use, by default, to
   * dispatch handlers for any asynchronous operations performed on the
   * descriptor.
   *
   * @param native_descriptor A native descriptor.
   *
   * @throws asio::system_error Thrown on failure.
   */
  basic_descriptor(const executor_type& ex,
      const native_handle_type& native_descriptor)
    : impl_(0, ex)
  {
    asio::error_code ec;
    impl_.get_service().assign(impl_.get_implementation(),
        native_descriptor, ec);
    asio::detail::throw_error(ec, "assign");
  }

  /// Construct a descriptor on an existing native descriptor.
  /**
   * This constructor creates a descriptor object to hold an existing native
   * descriptor.
   *
   * @param context An execution context which provides the I/O executor that
   * the descriptor will use, by default, to dispatch handlers for any
   * asynchronous operations performed on the descriptor.
   *
   * @param native_descriptor A native descriptor.
   *
   * @throws asio::system_error Thrown on failure.
   */
  template <typename ExecutionContext>
  basic_descriptor(ExecutionContext& context,
      const native_handle_type& native_descriptor,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value
      > = 0)
    : impl_(0, 0, context)
  {
    asio::error_code ec;
    impl_.get_service().assign(impl_.get_implementation(),
        native_descriptor, ec);
    asio::detail::throw_error(ec, "assign");
  }

  /// Move-construct a descriptor from another.
  /**
   * This constructor moves a descriptor from one object to another.
   *
   * @param other The other descriptor object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_descriptor(const executor_type&)
   * constructor.
   */
  basic_descriptor(basic_descriptor&& other) noexcept
    : impl_(std::move(other.impl_))
  {
  }

  /// Move-assign a descriptor from another.
  /**
   * This assignment operator moves a descriptor from one object to another.
   *
   * @param other The other descriptor object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_descriptor(const executor_type&)
   * constructor.
   */
  basic_descriptor& operator=(basic_descriptor&& other)
  {
    impl_ = std::move(other.impl_);
    return *this;
  }

  // All descriptors have access to each other's implementations.
  template <typename Executor1>
  friend class basic_descriptor;

  /// Move-construct a basic_descriptor from a descriptor of another executor
  /// type.
  /**
   * This constructor moves a descriptor from one object to another.
   *
   * @param other The other basic_descriptor object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_descriptor(const executor_type&)
   * constructor.
   */
  template <typename Executor1>
  basic_descriptor(basic_descriptor<Executor1>&& other,
      constraint_t<
        is_convertible<Executor1, Executor>::value,
        defaulted_constraint
      > = defaulted_constraint())
    : impl_(std::move(other.impl_))
  {
  }

  /// Move-assign a basic_descriptor from a descriptor of another executor type.
  /**
   * This assignment operator moves a descriptor from one object to another.
   *
   * @param other The other basic_descriptor object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_descriptor(const executor_type&)
   * constructor.
   */
  template <typename Executor1>
  constraint_t<
    is_convertible<Executor1, Executor>::value,
    basic_descriptor&
  > operator=(basic_descriptor<Executor1> && other)
  {
    basic_descriptor tmp(std::move(other));
    impl_ = std::move(tmp.impl_);
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
   * layers. Since a descriptor cannot contain any further layers, it
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
   * layers. Since a descriptor cannot contain any further layers, it
   * simply returns a reference to itself.
   *
   * @return A const reference to the lowest layer in the stack of layers.
   * Ownership is not transferred to the caller.
   */
  const lowest_layer_type& lowest_layer() const
  {
    return *this;
  }

  /// Assign an existing native descriptor to the descriptor.
  /*
   * This function opens the descriptor to hold an existing native descriptor.
   *
   * @param native_descriptor A native descriptor.
   *
   * @throws asio::system_error Thrown on failure.
   */
  void assign(const native_handle_type& native_descriptor)
  {
    asio::error_code ec;
    impl_.get_service().assign(impl_.get_implementation(),
        native_descriptor, ec);
    asio::detail::throw_error(ec, "assign");
  }

  /// Assign an existing native descriptor to the descriptor.
  /*
   * This function opens the descriptor to hold an existing native descriptor.
   *
   * @param native_descriptor A native descriptor.
   *
   * @param ec Set to indicate what error occurred, if any.
   */
  ASIO_SYNC_OP_VOID assign(const native_handle_type& native_descriptor,
      asio::error_code& ec)
  {
    impl_.get_service().assign(
        impl_.get_implementation(), native_descriptor, ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Determine whether the descriptor is open.
  bool is_open() const
  {
    return impl_.get_service().is_open(impl_.get_implementation());
  }

  /// Close the descriptor.
  /**
   * This function is used to close the descriptor. Any asynchronous read or
   * write operations will be cancelled immediately, and will complete with the
   * asio::error::operation_aborted error.
   *
   * @throws asio::system_error Thrown on failure. Note that, even if
   * the function indicates an error, the underlying descriptor is closed.
   */
  void close()
  {
    asio::error_code ec;
    impl_.get_service().close(impl_.get_implementation(), ec);
    asio::detail::throw_error(ec, "close");
  }

  /// Close the descriptor.
  /**
   * This function is used to close the descriptor. Any asynchronous read or
   * write operations will be cancelled immediately, and will complete with the
   * asio::error::operation_aborted error.
   *
   * @param ec Set to indicate what error occurred, if any. Note that, even if
   * the function indicates an error, the underlying descriptor is closed.
   */
  ASIO_SYNC_OP_VOID close(asio::error_code& ec)
  {
    impl_.get_service().close(impl_.get_implementation(), ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Get the native descriptor representation.
  /**
   * This function may be used to obtain the underlying representation of the
   * descriptor. This is intended to allow access to native descriptor
   * functionality that is not otherwise provided.
   */
  native_handle_type native_handle()
  {
    return impl_.get_service().native_handle(impl_.get_implementation());
  }

  /// Release ownership of the native descriptor implementation.
  /**
   * This function may be used to obtain the underlying representation of the
   * descriptor. After calling this function, @c is_open() returns false. The
   * caller is responsible for closing the descriptor.
   *
   * All outstanding asynchronous read or write operations will finish
   * immediately, and the handlers for cancelled operations will be passed the
   * asio::error::operation_aborted error.
   */
  native_handle_type release()
  {
    return impl_.get_service().release(impl_.get_implementation());
  }

  /// Cancel all asynchronous operations associated with the descriptor.
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

  /// Cancel all asynchronous operations associated with the descriptor.
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

  /// Perform an IO control command on the descriptor.
  /**
   * This function is used to execute an IO control command on the descriptor.
   *
   * @param command The IO control command to be performed on the descriptor.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @sa IoControlCommand @n
   * asio::posix::descriptor_base::bytes_readable @n
   * asio::posix::descriptor_base::non_blocking_io
   *
   * @par Example
   * Getting the number of bytes ready to read:
   * @code
   * asio::posix::stream_descriptor descriptor(my_context);
   * ...
   * asio::posix::stream_descriptor::bytes_readable command;
   * descriptor.io_control(command);
   * std::size_t bytes_readable = command.get();
   * @endcode
   */
  template <typename IoControlCommand>
  void io_control(IoControlCommand& command)
  {
    asio::error_code ec;
    impl_.get_service().io_control(impl_.get_implementation(), command, ec);
    asio::detail::throw_error(ec, "io_control");
  }

  /// Perform an IO control command on the descriptor.
  /**
   * This function is used to execute an IO control command on the descriptor.
   *
   * @param command The IO control command to be performed on the descriptor.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @sa IoControlCommand @n
   * asio::posix::descriptor_base::bytes_readable @n
   * asio::posix::descriptor_base::non_blocking_io
   *
   * @par Example
   * Getting the number of bytes ready to read:
   * @code
   * asio::posix::stream_descriptor descriptor(my_context);
   * ...
   * asio::posix::stream_descriptor::bytes_readable command;
   * asio::error_code ec;
   * descriptor.io_control(command, ec);
   * if (ec)
   * {
   *   // An error occurred.
   * }
   * std::size_t bytes_readable = command.get();
   * @endcode
   */
  template <typename IoControlCommand>
  ASIO_SYNC_OP_VOID io_control(IoControlCommand& command,
      asio::error_code& ec)
  {
    impl_.get_service().io_control(impl_.get_implementation(), command, ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Gets the non-blocking mode of the descriptor.
  /**
   * @returns @c true if the descriptor's synchronous operations will fail with
   * asio::error::would_block if they are unable to perform the requested
   * operation immediately. If @c false, synchronous operations will block
   * until complete.
   *
   * @note The non-blocking mode has no effect on the behaviour of asynchronous
   * operations. Asynchronous operations will never fail with the error
   * asio::error::would_block.
   */
  bool non_blocking() const
  {
    return impl_.get_service().non_blocking(impl_.get_implementation());
  }

  /// Sets the non-blocking mode of the descriptor.
  /**
   * @param mode If @c true, the descriptor's synchronous operations will fail
   * with asio::error::would_block if they are unable to perform the
   * requested operation immediately. If @c false, synchronous operations will
   * block until complete.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @note The non-blocking mode has no effect on the behaviour of asynchronous
   * operations. Asynchronous operations will never fail with the error
   * asio::error::would_block.
   */
  void non_blocking(bool mode)
  {
    asio::error_code ec;
    impl_.get_service().non_blocking(impl_.get_implementation(), mode, ec);
    asio::detail::throw_error(ec, "non_blocking");
  }

  /// Sets the non-blocking mode of the descriptor.
  /**
   * @param mode If @c true, the descriptor's synchronous operations will fail
   * with asio::error::would_block if they are unable to perform the
   * requested operation immediately. If @c false, synchronous operations will
   * block until complete.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @note The non-blocking mode has no effect on the behaviour of asynchronous
   * operations. Asynchronous operations will never fail with the error
   * asio::error::would_block.
   */
  ASIO_SYNC_OP_VOID non_blocking(
      bool mode, asio::error_code& ec)
  {
    impl_.get_service().non_blocking(impl_.get_implementation(), mode, ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Gets the non-blocking mode of the native descriptor implementation.
  /**
   * This function is used to retrieve the non-blocking mode of the underlying
   * native descriptor. This mode has no effect on the behaviour of the
   * descriptor object's synchronous operations.
   *
   * @returns @c true if the underlying descriptor is in non-blocking mode and
   * direct system calls may fail with asio::error::would_block (or the
   * equivalent system error).
   *
   * @note The current non-blocking mode is cached by the descriptor object.
   * Consequently, the return value may be incorrect if the non-blocking mode
   * was set directly on the native descriptor.
   */
  bool native_non_blocking() const
  {
    return impl_.get_service().native_non_blocking(
        impl_.get_implementation());
  }

  /// Sets the non-blocking mode of the native descriptor implementation.
  /**
   * This function is used to modify the non-blocking mode of the underlying
   * native descriptor. It has no effect on the behaviour of the descriptor
   * object's synchronous operations.
   *
   * @param mode If @c true, the underlying descriptor is put into non-blocking
   * mode and direct system calls may fail with asio::error::would_block
   * (or the equivalent system error).
   *
   * @throws asio::system_error Thrown on failure. If the @c mode is
   * @c false, but the current value of @c non_blocking() is @c true, this
   * function fails with asio::error::invalid_argument, as the
   * combination does not make sense.
   */
  void native_non_blocking(bool mode)
  {
    asio::error_code ec;
    impl_.get_service().native_non_blocking(
        impl_.get_implementation(), mode, ec);
    asio::detail::throw_error(ec, "native_non_blocking");
  }

  /// Sets the non-blocking mode of the native descriptor implementation.
  /**
   * This function is used to modify the non-blocking mode of the underlying
   * native descriptor. It has no effect on the behaviour of the descriptor
   * object's synchronous operations.
   *
   * @param mode If @c true, the underlying descriptor is put into non-blocking
   * mode and direct system calls may fail with asio::error::would_block
   * (or the equivalent system error).
   *
   * @param ec Set to indicate what error occurred, if any. If the @c mode is
   * @c false, but the current value of @c non_blocking() is @c true, this
   * function fails with asio::error::invalid_argument, as the
   * combination does not make sense.
   */
  ASIO_SYNC_OP_VOID native_non_blocking(
      bool mode, asio::error_code& ec)
  {
    impl_.get_service().native_non_blocking(
        impl_.get_implementation(), mode, ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Wait for the descriptor to become ready to read, ready to write, or to
  /// have pending error conditions.
  /**
   * This function is used to perform a blocking wait for a descriptor to enter
   * a ready to read, write or error condition state.
   *
   * @param w Specifies the desired descriptor state.
   *
   * @par Example
   * Waiting for a descriptor to become readable.
   * @code
   * asio::posix::stream_descriptor descriptor(my_context);
   * ...
   * descriptor.wait(asio::posix::stream_descriptor::wait_read);
   * @endcode
   */
  void wait(wait_type w)
  {
    asio::error_code ec;
    impl_.get_service().wait(impl_.get_implementation(), w, ec);
    asio::detail::throw_error(ec, "wait");
  }

  /// Wait for the descriptor to become ready to read, ready to write, or to
  /// have pending error conditions.
  /**
   * This function is used to perform a blocking wait for a descriptor to enter
   * a ready to read, write or error condition state.
   *
   * @param w Specifies the desired descriptor state.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @par Example
   * Waiting for a descriptor to become readable.
   * @code
   * asio::posix::stream_descriptor descriptor(my_context);
   * ...
   * asio::error_code ec;
   * descriptor.wait(asio::posix::stream_descriptor::wait_read, ec);
   * @endcode
   */
  ASIO_SYNC_OP_VOID wait(wait_type w, asio::error_code& ec)
  {
    impl_.get_service().wait(impl_.get_implementation(), w, ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Asynchronously wait for the descriptor to become ready to read, ready to
  /// write, or to have pending error conditions.
  /**
   * This function is used to perform an asynchronous wait for a descriptor to
   * enter a ready to read, write or error condition state. It is an initiating
   * function for an @ref asynchronous_operation, and always returns
   * immediately.
   *
   * @param w Specifies the desired descriptor state.
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
   *
   * @par Example
   * @code
   * void wait_handler(const asio::error_code& error)
   * {
   *   if (!error)
   *   {
   *     // Wait succeeded.
   *   }
   * }
   *
   * ...
   *
   * asio::posix::stream_descriptor descriptor(my_context);
   * ...
   * descriptor.async_wait(
   *     asio::posix::stream_descriptor::wait_read,
   *     wait_handler);
   * @endcode
   *
   * @par Per-Operation Cancellation
   * This asynchronous operation supports cancellation for the following
   * asio::cancellation_type values:
   *
   * @li @c cancellation_type::terminal
   *
   * @li @c cancellation_type::partial
   *
   * @li @c cancellation_type::total
   */
  template <
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code))
        WaitToken = default_completion_token_t<executor_type>>
  auto async_wait(wait_type w,
      WaitToken&& token = default_completion_token_t<executor_type>())
    -> decltype(
      async_initiate<WaitToken, void (asio::error_code)>(
        declval<initiate_async_wait>(), token, w))
  {
    return async_initiate<WaitToken, void (asio::error_code)>(
        initiate_async_wait(this), token, w);
  }

protected:
  /// Protected destructor to prevent deletion through this type.
  /**
   * This function destroys the descriptor, cancelling any outstanding
   * asynchronous wait operations associated with the descriptor as if by
   * calling @c cancel.
   */
  ~basic_descriptor()
  {
  }

#if defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  detail::io_object_impl<detail::io_uring_descriptor_service, Executor> impl_;
#else // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  detail::io_object_impl<detail::reactive_descriptor_service, Executor> impl_;
#endif // defined(ASIO_HAS_IO_URING_AS_DEFAULT)

private:
  // Disallow copying and assignment.
  basic_descriptor(const basic_descriptor&) = delete;
  basic_descriptor& operator=(const basic_descriptor&) = delete;

  class initiate_async_wait
  {
  public:
    typedef Executor executor_type;

    explicit initiate_async_wait(basic_descriptor* self)
      : self_(self)
    {
    }

    const executor_type& get_executor() const noexcept
    {
      return self_->get_executor();
    }

    template <typename WaitHandler>
    void operator()(WaitHandler&& handler, wait_type w) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a WaitHandler.
      ASIO_WAIT_HANDLER_CHECK(WaitHandler, handler) type_check;

      detail::non_const_lvalue<WaitHandler> handler2(handler);
      self_->impl_.get_service().async_wait(
          self_->impl_.get_implementation(), w,
          handler2.value, self_->impl_.get_executor());
    }

  private:
    basic_descriptor* self_;
  };
};

} // namespace posix
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // defined(ASIO_HAS_POSIX_STREAM_DESCRIPTOR)
       //   || defined(GENERATING_DOCUMENTATION)

#endif // ASIO_POSIX_BASIC_DESCRIPTOR_HPP
