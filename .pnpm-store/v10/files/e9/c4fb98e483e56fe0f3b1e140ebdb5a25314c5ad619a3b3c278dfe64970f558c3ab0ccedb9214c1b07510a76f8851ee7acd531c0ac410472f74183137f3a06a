//
// windows/basic_random_access_handle.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_WINDOWS_BASIC_RANDOM_ACCESS_HANDLE_HPP
#define ASIO_WINDOWS_BASIC_RANDOM_ACCESS_HANDLE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/windows/basic_overlapped_handle.hpp"

#if defined(ASIO_HAS_WINDOWS_RANDOM_ACCESS_HANDLE) \
  || defined(GENERATING_DOCUMENTATION)

#include "asio/detail/push_options.hpp"

namespace asio {
namespace windows {

/// Provides random-access handle functionality.
/**
 * The windows::basic_random_access_handle class provides asynchronous and
 * blocking random-access handle functionality.
 *
 * @par Thread Safety
 * @e Distinct @e objects: Safe.@n
 * @e Shared @e objects: Unsafe.
 */
template <typename Executor = any_io_executor>
class basic_random_access_handle
  : public basic_overlapped_handle<Executor>
{
private:
  class initiate_async_write_some_at;
  class initiate_async_read_some_at;

public:
  /// The type of the executor associated with the object.
  typedef Executor executor_type;

  /// Rebinds the handle type to another executor.
  template <typename Executor1>
  struct rebind_executor
  {
    /// The handle type when rebound to the specified executor.
    typedef basic_random_access_handle<Executor1> other;
  };

  /// The native representation of a handle.
#if defined(GENERATING_DOCUMENTATION)
  typedef implementation_defined native_handle_type;
#else
  typedef asio::detail::win_iocp_handle_service::native_handle_type
    native_handle_type;
#endif

  /// Construct a random-access handle without opening it.
  /**
   * This constructor creates a random-access handle without opening it.
   *
   * @param ex The I/O executor that the random-access handle will use, by
   * default, to dispatch handlers for any asynchronous operations performed on
   * the random-access handle.
   */
  explicit basic_random_access_handle(const executor_type& ex)
    : basic_overlapped_handle<Executor>(ex)
  {
  }

  /// Construct a random-access handle without opening it.
  /**
   * This constructor creates a random-access handle without opening it. The
   * handle needs to be opened or assigned before data can be written to or read
   * from it.
   *
   * @param context An execution context which provides the I/O executor that
   * the random-access handle will use, by default, to dispatch handlers for any
   * asynchronous operations performed on the random-access handle.
   */
  template <typename ExecutionContext>
  explicit basic_random_access_handle(ExecutionContext& context,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value,
        defaulted_constraint
      > = defaulted_constraint())
    : basic_overlapped_handle<Executor>(context)
  {
  }

  /// Construct a random-access handle on an existing native handle.
  /**
   * This constructor creates a random-access handle object to hold an existing
   * native handle.
   *
   * @param ex The I/O executor that the random-access handle will use, by
   * default, to dispatch handlers for any asynchronous operations performed on
   * the random-access handle.
   *
   * @param handle The new underlying handle implementation.
   *
   * @throws asio::system_error Thrown on failure.
   */
  basic_random_access_handle(const executor_type& ex,
      const native_handle_type& handle)
    : basic_overlapped_handle<Executor>(ex, handle)
  {
  }

  /// Construct a random-access handle on an existing native handle.
  /**
   * This constructor creates a random-access handle object to hold an existing
   * native handle.
   *
   * @param context An execution context which provides the I/O executor that
   * the random-access handle will use, by default, to dispatch handlers for any
   * asynchronous operations performed on the random-access handle.
   *
   * @param handle The new underlying handle implementation.
   *
   * @throws asio::system_error Thrown on failure.
   */
  template <typename ExecutionContext>
  basic_random_access_handle(ExecutionContext& context,
      const native_handle_type& handle,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value
      > = 0)
    : basic_overlapped_handle<Executor>(context, handle)
  {
  }

  /// Move-construct a random-access handle from another.
  /**
   * This constructor moves a random-access handle from one object to another.
   *
   * @param other The other random-access handle object from which the
   * move will occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_random_access_handle(const executor_type&)
   * constructor.
   */
  basic_random_access_handle(basic_random_access_handle&& other)
    : basic_overlapped_handle<Executor>(std::move(other))
  {
  }

  /// Move-assign a random-access handle from another.
  /**
   * This assignment operator moves a random-access handle from one object to
   * another.
   *
   * @param other The other random-access handle object from which the
   * move will occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_random_access_handle(const executor_type&)
   * constructor.
   */
  basic_random_access_handle& operator=(basic_random_access_handle&& other)
  {
    basic_overlapped_handle<Executor>::operator=(std::move(other));
    return *this;
  }

  /// Move-construct a random-access handle from a handle of another executor
  /// type.
  /**
   * This constructor moves a random-access handle from one object to another.
   *
   * @param other The other random-access handle object from which the
   * move will occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_random_access_handle(const executor_type&)
   * constructor.
   */
  template<typename Executor1>
  basic_random_access_handle(basic_random_access_handle<Executor1>&& other,
      constraint_t<
        is_convertible<Executor1, Executor>::value,
        defaulted_constraint
      > = defaulted_constraint())
    : basic_overlapped_handle<Executor>(std::move(other))
  {
  }

  /// Move-assign a random-access handle from a handle of another executor
  /// type.
  /**
   * This assignment operator moves a random-access handle from one object to
   * another.
   *
   * @param other The other random-access handle object from which the
   * move will occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_random_access_handle(const executor_type&)
   * constructor.
   */
  template<typename Executor1>
  constraint_t<
    is_convertible<Executor1, Executor>::value,
    basic_random_access_handle&
  > operator=(basic_random_access_handle<Executor1>&& other)
  {
    basic_overlapped_handle<Executor>::operator=(std::move(other));
    return *this;
  }

  /// Write some data to the handle at the specified offset.
  /**
   * This function is used to write data to the random-access handle. The
   * function call will block until one or more bytes of the data has been
   * written successfully, or until an error occurs.
   *
   * @param offset The offset at which the data will be written.
   *
   * @param buffers One or more data buffers to be written to the handle.
   *
   * @returns The number of bytes written.
   *
   * @throws asio::system_error Thrown on failure. An error code of
   * asio::error::eof indicates that the connection was closed by the
   * peer.
   *
   * @note The write_some_at operation may not write all of the data. Consider
   * using the @ref write_at function if you need to ensure that all data is
   * written before the blocking operation completes.
   *
   * @par Example
   * To write a single data buffer use the @ref buffer function as follows:
   * @code
   * handle.write_some_at(42, asio::buffer(data, size));
   * @endcode
   * See the @ref buffer documentation for information on writing multiple
   * buffers in one go, and how to use it with arrays, boost::array or
   * std::vector.
   */
  template <typename ConstBufferSequence>
  std::size_t write_some_at(uint64_t offset,
      const ConstBufferSequence& buffers)
  {
    asio::error_code ec;
    std::size_t s = this->impl_.get_service().write_some_at(
        this->impl_.get_implementation(), offset, buffers, ec);
    asio::detail::throw_error(ec, "write_some_at");
    return s;
  }

  /// Write some data to the handle at the specified offset.
  /**
   * This function is used to write data to the random-access handle. The
   * function call will block until one or more bytes of the data has been
   * written successfully, or until an error occurs.
   *
   * @param offset The offset at which the data will be written.
   *
   * @param buffers One or more data buffers to be written to the handle.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @returns The number of bytes written. Returns 0 if an error occurred.
   *
   * @note The write_some operation may not transmit all of the data to the
   * peer. Consider using the @ref write_at function if you need to ensure that
   * all data is written before the blocking operation completes.
   */
  template <typename ConstBufferSequence>
  std::size_t write_some_at(uint64_t offset,
      const ConstBufferSequence& buffers, asio::error_code& ec)
  {
    return this->impl_.get_service().write_some_at(
        this->impl_.get_implementation(), offset, buffers, ec);
  }

  /// Start an asynchronous write at the specified offset.
  /**
   * This function is used to asynchronously write data to the random-access
   * handle. It is an initiating function for an @ref asynchronous_operation,
   * and always returns immediately.
   *
   * @param offset The offset at which the data will be written.
   *
   * @param buffers One or more data buffers to be written to the handle.
   * Although the buffers object may be copied as necessary, ownership of the
   * underlying memory blocks is retained by the caller, which must guarantee
   * that they remain valid until the completion handler is called.
   *
   * @param token The @ref completion_token that will be used to produce a
   * completion handler, which will be called when the write completes.
   * Potential completion tokens include @ref use_future, @ref use_awaitable,
   * @ref yield_context, or a function object with the correct completion
   * signature. The function signature of the completion handler must be:
   * @code void handler(
   *   const asio::error_code& error, // Result of operation.
   *   std::size_t bytes_transferred // Number of bytes written.
   * ); @endcode
   * Regardless of whether the asynchronous operation completes immediately or
   * not, the completion handler will not be invoked from within this function.
   * On immediate completion, invocation of the handler will be performed in a
   * manner equivalent to using asio::async_immediate().
   *
   * @par Completion Signature
   * @code void(asio::error_code, std::size_t) @endcode
   *
   * @note The write operation may not transmit all of the data to the peer.
   * Consider using the @ref async_write_at function if you need to ensure that
   * all data is written before the asynchronous operation completes.
   *
   * @par Example
   * To write a single data buffer use the @ref buffer function as follows:
   * @code
   * handle.async_write_some_at(42, asio::buffer(data, size), handler);
   * @endcode
   * See the @ref buffer documentation for information on writing multiple
   * buffers in one go, and how to use it with arrays, boost::array or
   * std::vector.
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
  template <typename ConstBufferSequence,
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
        std::size_t)) WriteToken = default_completion_token_t<executor_type>>
  auto async_write_some_at(uint64_t offset, const ConstBufferSequence& buffers,
      WriteToken&& token = default_completion_token_t<executor_type>())
    -> decltype(
      async_initiate<WriteToken,
        void (asio::error_code, std::size_t)>(
          declval<initiate_async_write_some_at>(), token, offset, buffers))
  {
    return async_initiate<WriteToken,
      void (asio::error_code, std::size_t)>(
        initiate_async_write_some_at(this), token, offset, buffers);
  }

  /// Read some data from the handle at the specified offset.
  /**
   * This function is used to read data from the random-access handle. The
   * function call will block until one or more bytes of data has been read
   * successfully, or until an error occurs.
   *
   * @param offset The offset at which the data will be read.
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
   * bytes. Consider using the @ref read_at function if you need to ensure that
   * the requested amount of data is read before the blocking operation
   * completes.
   *
   * @par Example
   * To read into a single data buffer use the @ref buffer function as follows:
   * @code
   * handle.read_some_at(42, asio::buffer(data, size));
   * @endcode
   * See the @ref buffer documentation for information on reading into multiple
   * buffers in one go, and how to use it with arrays, boost::array or
   * std::vector.
   */
  template <typename MutableBufferSequence>
  std::size_t read_some_at(uint64_t offset,
      const MutableBufferSequence& buffers)
  {
    asio::error_code ec;
    std::size_t s = this->impl_.get_service().read_some_at(
        this->impl_.get_implementation(), offset, buffers, ec);
    asio::detail::throw_error(ec, "read_some_at");
    return s;
  }

  /// Read some data from the handle at the specified offset.
  /**
   * This function is used to read data from the random-access handle. The
   * function call will block until one or more bytes of data has been read
   * successfully, or until an error occurs.
   *
   * @param offset The offset at which the data will be read.
   *
   * @param buffers One or more buffers into which the data will be read.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @returns The number of bytes read. Returns 0 if an error occurred.
   *
   * @note The read_some operation may not read all of the requested number of
   * bytes. Consider using the @ref read_at function if you need to ensure that
   * the requested amount of data is read before the blocking operation
   * completes.
   */
  template <typename MutableBufferSequence>
  std::size_t read_some_at(uint64_t offset,
      const MutableBufferSequence& buffers, asio::error_code& ec)
  {
    return this->impl_.get_service().read_some_at(
        this->impl_.get_implementation(), offset, buffers, ec);
  }

  /// Start an asynchronous read at the specified offset.
  /**
   * This function is used to asynchronously read data from the random-access
   * handle. It is an initiating function for an @ref asynchronous_operation,
   * and always returns immediately.
   *
   * @param offset The offset at which the data will be read.
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
   * Consider using the @ref async_read_at function if you need to ensure that
   * the requested amount of data is read before the asynchronous operation
   * completes.
   *
   * @par Example
   * To read into a single data buffer use the @ref buffer function as follows:
   * @code
   * handle.async_read_some_at(42, asio::buffer(data, size), handler);
   * @endcode
   * See the @ref buffer documentation for information on reading into multiple
   * buffers in one go, and how to use it with arrays, boost::array or
   * std::vector.
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
  template <typename MutableBufferSequence,
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
        std::size_t)) ReadToken = default_completion_token_t<executor_type>>
  auto async_read_some_at(uint64_t offset, const MutableBufferSequence& buffers,
      ReadToken&& token = default_completion_token_t<executor_type>())
    -> decltype(
      async_initiate<ReadToken,
        void (asio::error_code, std::size_t)>(
          declval<initiate_async_read_some_at>(), token, offset, buffers))
  {
    return async_initiate<ReadToken,
      void (asio::error_code, std::size_t)>(
        initiate_async_read_some_at(this), token, offset, buffers);
  }

private:
  class initiate_async_write_some_at
  {
  public:
    typedef Executor executor_type;

    explicit initiate_async_write_some_at(basic_random_access_handle* self)
      : self_(self)
    {
    }

    const executor_type& get_executor() const noexcept
    {
      return self_->get_executor();
    }

    template <typename WriteHandler, typename ConstBufferSequence>
    void operator()(WriteHandler&& handler,
        uint64_t offset, const ConstBufferSequence& buffers) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a WriteHandler.
      ASIO_WRITE_HANDLER_CHECK(WriteHandler, handler) type_check;

      detail::non_const_lvalue<WriteHandler> handler2(handler);
      self_->impl_.get_service().async_write_some_at(
          self_->impl_.get_implementation(), offset, buffers,
          handler2.value, self_->impl_.get_executor());
    }

  private:
    basic_random_access_handle* self_;
  };

  class initiate_async_read_some_at
  {
  public:
    typedef Executor executor_type;

    explicit initiate_async_read_some_at(basic_random_access_handle* self)
      : self_(self)
    {
    }

    const executor_type& get_executor() const noexcept
    {
      return self_->get_executor();
    }

    template <typename ReadHandler, typename MutableBufferSequence>
    void operator()(ReadHandler&& handler,
        uint64_t offset, const MutableBufferSequence& buffers) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a ReadHandler.
      ASIO_READ_HANDLER_CHECK(ReadHandler, handler) type_check;

      detail::non_const_lvalue<ReadHandler> handler2(handler);
      self_->impl_.get_service().async_read_some_at(
          self_->impl_.get_implementation(), offset, buffers,
          handler2.value, self_->impl_.get_executor());
    }

  private:
    basic_random_access_handle* self_;
  };
};

} // namespace windows
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // defined(ASIO_HAS_WINDOWS_RANDOM_ACCESS_HANDLE)
       //   || defined(GENERATING_DOCUMENTATION)

#endif // ASIO_WINDOWS_BASIC_RANDOM_ACCESS_HANDLE_HPP
