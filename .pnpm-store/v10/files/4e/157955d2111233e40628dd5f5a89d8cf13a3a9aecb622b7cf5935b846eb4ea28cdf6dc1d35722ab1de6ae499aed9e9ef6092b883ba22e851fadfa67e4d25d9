//
// basic_readable_pipe.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_BASIC_READABLE_PIPE_HPP
#define ASIO_BASIC_READABLE_PIPE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_PIPE) \
  || defined(GENERATING_DOCUMENTATION)

#include <string>
#include <utility>
#include "asio/any_io_executor.hpp"
#include "asio/async_result.hpp"
#include "asio/detail/handler_type_requirements.hpp"
#include "asio/detail/io_object_impl.hpp"
#include "asio/detail/non_const_lvalue.hpp"
#include "asio/detail/throw_error.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/error.hpp"
#include "asio/execution_context.hpp"
#if defined(ASIO_HAS_IOCP)
# include "asio/detail/win_iocp_handle_service.hpp"
#elif defined(ASIO_HAS_IO_URING_AS_DEFAULT)
# include "asio/detail/io_uring_descriptor_service.hpp"
#else
# include "asio/detail/reactive_descriptor_service.hpp"
#endif

#include "asio/detail/push_options.hpp"

namespace asio {

/// Provides pipe functionality.
/**
 * The basic_readable_pipe class provides a wrapper over pipe
 * functionality.
 *
 * @par Thread Safety
 * @e Distinct @e objects: Safe.@n
 * @e Shared @e objects: Unsafe.
 */
template <typename Executor = any_io_executor>
class basic_readable_pipe
{
private:
  class initiate_async_read_some;

public:
  /// The type of the executor associated with the object.
  typedef Executor executor_type;

  /// Rebinds the pipe type to another executor.
  template <typename Executor1>
  struct rebind_executor
  {
    /// The pipe type when rebound to the specified executor.
    typedef basic_readable_pipe<Executor1> other;
  };

  /// The native representation of a pipe.
#if defined(GENERATING_DOCUMENTATION)
  typedef implementation_defined native_handle_type;
#elif defined(ASIO_HAS_IOCP)
  typedef detail::win_iocp_handle_service::native_handle_type
    native_handle_type;
#elif defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  typedef detail::io_uring_descriptor_service::native_handle_type
    native_handle_type;
#else
  typedef detail::reactive_descriptor_service::native_handle_type
    native_handle_type;
#endif

  /// A basic_readable_pipe is always the lowest layer.
  typedef basic_readable_pipe lowest_layer_type;

  /// Construct a basic_readable_pipe without opening it.
  /**
   * This constructor creates a pipe without opening it.
   *
   * @param ex The I/O executor that the pipe will use, by default, to dispatch
   * handlers for any asynchronous operations performed on the pipe.
   */
  explicit basic_readable_pipe(const executor_type& ex)
    : impl_(0, ex)
  {
  }

  /// Construct a basic_readable_pipe without opening it.
  /**
   * This constructor creates a pipe without opening it.
   *
   * @param context An execution context which provides the I/O executor that
   * the pipe will use, by default, to dispatch handlers for any asynchronous
   * operations performed on the pipe.
   */
  template <typename ExecutionContext>
  explicit basic_readable_pipe(ExecutionContext& context,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value,
        defaulted_constraint
      > = defaulted_constraint())
    : impl_(0, 0, context)
  {
  }

  /// Construct a basic_readable_pipe on an existing native pipe.
  /**
   * This constructor creates a pipe object to hold an existing native
   * pipe.
   *
   * @param ex The I/O executor that the pipe will use, by default, to
   * dispatch handlers for any asynchronous operations performed on the
   * pipe.
   *
   * @param native_pipe A native pipe.
   *
   * @throws asio::system_error Thrown on failure.
   */
  basic_readable_pipe(const executor_type& ex,
      const native_handle_type& native_pipe)
    : impl_(0, ex)
  {
    asio::error_code ec;
    impl_.get_service().assign(impl_.get_implementation(),
        native_pipe, ec);
    asio::detail::throw_error(ec, "assign");
  }

  /// Construct a basic_readable_pipe on an existing native pipe.
  /**
   * This constructor creates a pipe object to hold an existing native
   * pipe.
   *
   * @param context An execution context which provides the I/O executor that
   * the pipe will use, by default, to dispatch handlers for any
   * asynchronous operations performed on the pipe.
   *
   * @param native_pipe A native pipe.
   *
   * @throws asio::system_error Thrown on failure.
   */
  template <typename ExecutionContext>
  basic_readable_pipe(ExecutionContext& context,
      const native_handle_type& native_pipe,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value
      > = 0)
    : impl_(0, 0, context)
  {
    asio::error_code ec;
    impl_.get_service().assign(impl_.get_implementation(),
        native_pipe, ec);
    asio::detail::throw_error(ec, "assign");
  }

  /// Move-construct a basic_readable_pipe from another.
  /**
   * This constructor moves a pipe from one object to another.
   *
   * @param other The other basic_readable_pipe object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_readable_pipe(const executor_type&)
   * constructor.
   */
  basic_readable_pipe(basic_readable_pipe&& other)
    : impl_(std::move(other.impl_))
  {
  }

  /// Move-assign a basic_readable_pipe from another.
  /**
   * This assignment operator moves a pipe from one object to another.
   *
   * @param other The other basic_readable_pipe object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_readable_pipe(const executor_type&)
   * constructor.
   */
  basic_readable_pipe& operator=(basic_readable_pipe&& other)
  {
    impl_ = std::move(other.impl_);
    return *this;
  }

  // All pipes have access to each other's implementations.
  template <typename Executor1>
  friend class basic_readable_pipe;

  /// Move-construct a basic_readable_pipe from a pipe of another executor type.
  /**
   * This constructor moves a pipe from one object to another.
   *
   * @param other The other basic_readable_pipe object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_readable_pipe(const executor_type&)
   * constructor.
   */
  template <typename Executor1>
  basic_readable_pipe(basic_readable_pipe<Executor1>&& other,
      constraint_t<
        is_convertible<Executor1, Executor>::value,
        defaulted_constraint
      > = defaulted_constraint())
    : impl_(std::move(other.impl_))
  {
  }

  /// Move-assign a basic_readable_pipe from a pipe of another executor type.
  /**
   * This assignment operator moves a pipe from one object to another.
   *
   * @param other The other basic_readable_pipe object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_readable_pipe(const executor_type&)
   * constructor.
   */
  template <typename Executor1>
  constraint_t<
    is_convertible<Executor1, Executor>::value,
    basic_readable_pipe&
  > operator=(basic_readable_pipe<Executor1>&& other)
  {
    basic_readable_pipe tmp(std::move(other));
    impl_ = std::move(tmp.impl_);
    return *this;
  }

  /// Destroys the pipe.
  /**
   * This function destroys the pipe, cancelling any outstanding
   * asynchronous wait operations associated with the pipe as if by
   * calling @c cancel.
   */
  ~basic_readable_pipe()
  {
  }

  /// Get the executor associated with the object.
  const executor_type& get_executor() noexcept
  {
    return impl_.get_executor();
  }

  /// Get a reference to the lowest layer.
  /**
   * This function returns a reference to the lowest layer in a stack of
   * layers. Since a basic_readable_pipe cannot contain any further layers, it
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
   * layers. Since a basic_readable_pipe cannot contain any further layers, it
   * simply returns a reference to itself.
   *
   * @return A const reference to the lowest layer in the stack of layers.
   * Ownership is not transferred to the caller.
   */
  const lowest_layer_type& lowest_layer() const
  {
    return *this;
  }

  /// Assign an existing native pipe to the pipe.
  /*
   * This function opens the pipe to hold an existing native pipe.
   *
   * @param native_pipe A native pipe.
   *
   * @throws asio::system_error Thrown on failure.
   */
  void assign(const native_handle_type& native_pipe)
  {
    asio::error_code ec;
    impl_.get_service().assign(impl_.get_implementation(), native_pipe, ec);
    asio::detail::throw_error(ec, "assign");
  }

  /// Assign an existing native pipe to the pipe.
  /*
   * This function opens the pipe to hold an existing native pipe.
   *
   * @param native_pipe A native pipe.
   *
   * @param ec Set to indicate what error occurred, if any.
   */
  ASIO_SYNC_OP_VOID assign(const native_handle_type& native_pipe,
      asio::error_code& ec)
  {
    impl_.get_service().assign(impl_.get_implementation(), native_pipe, ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Determine whether the pipe is open.
  bool is_open() const
  {
    return impl_.get_service().is_open(impl_.get_implementation());
  }

  /// Close the pipe.
  /**
   * This function is used to close the pipe. Any asynchronous read operations
   * will be cancelled immediately, and will complete with the
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

  /// Close the pipe.
  /**
   * This function is used to close the pipe. Any asynchronous read operations
   * will be cancelled immediately, and will complete with the
   * asio::error::operation_aborted error.
   *
   * @param ec Set to indicate what error occurred, if any.
   */
  ASIO_SYNC_OP_VOID close(asio::error_code& ec)
  {
    impl_.get_service().close(impl_.get_implementation(), ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Release ownership of the underlying native pipe.
  /**
   * This function causes all outstanding asynchronous read operations to
   * finish immediately, and the handlers for cancelled operations will be
   * passed the asio::error::operation_aborted error. Ownership of the
   * native pipe is then transferred to the caller.
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

  /// Release ownership of the underlying native pipe.
  /**
   * This function causes all outstanding asynchronous read operations to
   * finish immediately, and the handlers for cancelled operations will be
   * passed the asio::error::operation_aborted error. Ownership of the
   * native pipe is then transferred to the caller.
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

  /// Get the native pipe representation.
  /**
   * This function may be used to obtain the underlying representation of the
   * pipe. This is intended to allow access to native pipe
   * functionality that is not otherwise provided.
   */
  native_handle_type native_handle()
  {
    return impl_.get_service().native_handle(impl_.get_implementation());
  }

  /// Cancel all asynchronous operations associated with the pipe.
  /**
   * This function causes all outstanding asynchronous read operations to finish
   * immediately, and the handlers for cancelled operations will be passed the
   * asio::error::operation_aborted error.
   *
   * @throws asio::system_error Thrown on failure.
   */
  void cancel()
  {
    asio::error_code ec;
    impl_.get_service().cancel(impl_.get_implementation(), ec);
    asio::detail::throw_error(ec, "cancel");
  }

  /// Cancel all asynchronous operations associated with the pipe.
  /**
   * This function causes all outstanding asynchronous read operations to finish
   * immediately, and the handlers for cancelled operations will be passed the
   * asio::error::operation_aborted error.
   *
   * @param ec Set to indicate what error occurred, if any.
   */
  ASIO_SYNC_OP_VOID cancel(asio::error_code& ec)
  {
    impl_.get_service().cancel(impl_.get_implementation(), ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Read some data from the pipe.
  /**
   * This function is used to read data from the pipe. The function call will
   * block until one or more bytes of data has been read successfully, or until
   * an error occurs.
   *
   * @param buffers One or more buffers into which the data will be read.
   *
   * @returns The number of bytes read.
   *
   * @throws asio::system_error Thrown on failure. An error code of
   * asio::error::eof indicates that the connection was closed by the
   * peer.
   *
   * @note The read_some operation may not read all of the requested number of
   * bytes. Consider using the @ref read function if you need to ensure that
   * the requested amount of data is read before the blocking operation
   * completes.
   *
   * @par Example
   * To read into a single data buffer use the @ref buffer function as follows:
   * @code
   * basic_readable_pipe.read_some(asio::buffer(data, size));
   * @endcode
   * See the @ref buffer documentation for information on reading into multiple
   * buffers in one go, and how to use it with arrays, boost::array or
   * std::vector.
   */
  template <typename MutableBufferSequence>
  std::size_t read_some(const MutableBufferSequence& buffers)
  {
    asio::error_code ec;
    std::size_t s = impl_.get_service().read_some(
        impl_.get_implementation(), buffers, ec);
    asio::detail::throw_error(ec, "read_some");
    return s;
  }

  /// Read some data from the pipe.
  /**
   * This function is used to read data from the pipe. The function call will
   * block until one or more bytes of data has been read successfully, or until
   * an error occurs.
   *
   * @param buffers One or more buffers into which the data will be read.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @returns The number of bytes read. Returns 0 if an error occurred.
   *
   * @note The read_some operation may not read all of the requested number of
   * bytes. Consider using the @ref read function if you need to ensure that
   * the requested amount of data is read before the blocking operation
   * completes.
   */
  template <typename MutableBufferSequence>
  std::size_t read_some(const MutableBufferSequence& buffers,
      asio::error_code& ec)
  {
    return impl_.get_service().read_some(
        impl_.get_implementation(), buffers, ec);
  }

  /// Start an asynchronous read.
  /**
   * This function is used to asynchronously read data from the pipe. It is an
   * initiating function for an @ref asynchronous_operation, and always returns
   * immediately.
   *
   * @param buffers One or more buffers into which the data will be read.
   * Although the buffers object may be copied as necessary, ownership of the
   * underlying memory blocks is retained by the caller, which must guarantee
   * that they remain valid until the completion handler is called.
   *
   * @param token The @ref completion_token that will be used to produce a
   * completion handler, which will be called when the read completes.
   * Potential completion tokens include @ref use_future, @ref use_awaitable,
   * @ref yield_context, or a function object with the correct completion
   * signature. The function signature of the completion handler must be:
   * @code void handler(
   *   const asio::error_code& error, // Result of operation.
   *   std::size_t bytes_transferred // Number of bytes read.
   * ); @endcode
   * Regardless of whether the asynchronous operation completes immediately or
   * not, the completion handler will not be invoked from within this function.
   * On immediate completion, invocation of the handler will be performed in a
   * manner equivalent to using asio::async_immediate().
   *
   * @par Completion Signature
   * @code void(asio::error_code, std::size_t) @endcode
   *
   * @note The read operation may not read all of the requested number of bytes.
   * Consider using the @ref async_read function if you need to ensure that the
   * requested amount of data is read before the asynchronous operation
   * completes.
   *
   * @par Example
   * To read into a single data buffer use the @ref buffer function as follows:
   * @code
   * basic_readable_pipe.async_read_some(
   *     asio::buffer(data, size), handler);
   * @endcode
   * See the @ref buffer documentation for information on reading into multiple
   * buffers in one go, and how to use it with arrays, boost::array or
   * std::vector.
   */
  template <typename MutableBufferSequence,
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
        std::size_t)) ReadToken = default_completion_token_t<executor_type>>
  auto async_read_some(const MutableBufferSequence& buffers,
      ReadToken&& token = default_completion_token_t<executor_type>())
    -> decltype(
      async_initiate<ReadToken,
        void (asio::error_code, std::size_t)>(
          declval<initiate_async_read_some>(), token, buffers))
  {
    return async_initiate<ReadToken,
      void (asio::error_code, std::size_t)>(
        initiate_async_read_some(this), token, buffers);
  }

private:
  // Disallow copying and assignment.
  basic_readable_pipe(const basic_readable_pipe&) = delete;
  basic_readable_pipe& operator=(const basic_readable_pipe&) = delete;

  class initiate_async_read_some
  {
  public:
    typedef Executor executor_type;

    explicit initiate_async_read_some(basic_readable_pipe* self)
      : self_(self)
    {
    }

    const executor_type& get_executor() const noexcept
    {
      return self_->get_executor();
    }

    template <typename ReadHandler, typename MutableBufferSequence>
    void operator()(ReadHandler&& handler,
        const MutableBufferSequence& buffers) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a ReadHandler.
      ASIO_READ_HANDLER_CHECK(ReadHandler, handler) type_check;

      detail::non_const_lvalue<ReadHandler> handler2(handler);
      self_->impl_.get_service().async_read_some(
          self_->impl_.get_implementation(), buffers,
          handler2.value, self_->impl_.get_executor());
    }

  private:
    basic_readable_pipe* self_;
  };

#if defined(ASIO_HAS_IOCP)
  detail::io_object_impl<detail::win_iocp_handle_service, Executor> impl_;
#elif defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  detail::io_object_impl<detail::io_uring_descriptor_service, Executor> impl_;
#else
  detail::io_object_impl<detail::reactive_descriptor_service, Executor> impl_;
#endif
};

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // defined(ASIO_HAS_PIPE)
       //   || defined(GENERATING_DOCUMENTATION)

#endif // ASIO_BASIC_READABLE_PIPE_HPP
