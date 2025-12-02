//
// basic_stream_file.hpp
// ~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_BASIC_STREAM_FILE_HPP
#define ASIO_BASIC_STREAM_FILE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_FILE) \
  || defined(GENERATING_DOCUMENTATION)

#include <cstddef>
#include "asio/async_result.hpp"
#include "asio/basic_file.hpp"
#include "asio/detail/handler_type_requirements.hpp"
#include "asio/detail/non_const_lvalue.hpp"
#include "asio/detail/throw_error.hpp"
#include "asio/error.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

#if !defined(ASIO_BASIC_STREAM_FILE_FWD_DECL)
#define ASIO_BASIC_STREAM_FILE_FWD_DECL

// Forward declaration with defaulted arguments.
template <typename Executor = any_io_executor>
class basic_stream_file;

#endif // !defined(ASIO_BASIC_STREAM_FILE_FWD_DECL)

/// Provides stream-oriented file functionality.
/**
 * The basic_stream_file class template provides asynchronous and blocking
 * stream-oriented file functionality.
 *
 * @par Thread Safety
 * @e Distinct @e objects: Safe.@n
 * @e Shared @e objects: Unsafe.
 *
 * @par Concepts:
 * AsyncReadStream, AsyncWriteStream, Stream, SyncReadStream, SyncWriteStream.
 */
template <typename Executor>
class basic_stream_file
  : public basic_file<Executor>
{
private:
  class initiate_async_write_some;
  class initiate_async_read_some;

public:
  /// The type of the executor associated with the object.
  typedef Executor executor_type;

  /// Rebinds the file type to another executor.
  template <typename Executor1>
  struct rebind_executor
  {
    /// The file type when rebound to the specified executor.
    typedef basic_stream_file<Executor1> other;
  };

  /// The native representation of a file.
#if defined(GENERATING_DOCUMENTATION)
  typedef implementation_defined native_handle_type;
#else
  typedef typename basic_file<Executor>::native_handle_type native_handle_type;
#endif

  /// Construct a basic_stream_file without opening it.
  /**
   * This constructor initialises a file without opening it. The file needs to
   * be opened before data can be read from or or written to it.
   *
   * @param ex The I/O executor that the file will use, by default, to
   * dispatch handlers for any asynchronous operations performed on the file.
   */
  explicit basic_stream_file(const executor_type& ex)
    : basic_file<Executor>(ex)
  {
    this->impl_.get_service().set_is_stream(
        this->impl_.get_implementation(), true);
  }

  /// Construct a basic_stream_file without opening it.
  /**
   * This constructor initialises a file without opening it. The file needs to
   * be opened before data can be read from or or written to it.
   *
   * @param context An execution context which provides the I/O executor that
   * the file will use, by default, to dispatch handlers for any asynchronous
   * operations performed on the file.
   */
  template <typename ExecutionContext>
  explicit basic_stream_file(ExecutionContext& context,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value,
        defaulted_constraint
      > = defaulted_constraint())
    : basic_file<Executor>(context)
  {
    this->impl_.get_service().set_is_stream(
        this->impl_.get_implementation(), true);
  }

  /// Construct and open a basic_stream_file.
  /**
   * This constructor initialises and opens a file.
   *
   * @param ex The I/O executor that the file will use, by default, to
   * dispatch handlers for any asynchronous operations performed on the file.
   *
   * @param path The path name identifying the file to be opened.
   *
   * @param open_flags A set of flags that determine how the file should be
   * opened.
   *
   * @throws asio::system_error Thrown on failure.
   */
  basic_stream_file(const executor_type& ex,
      const char* path, file_base::flags open_flags)
    : basic_file<Executor>(ex)
  {
    asio::error_code ec;
    this->impl_.get_service().set_is_stream(
        this->impl_.get_implementation(), true);
    this->impl_.get_service().open(
        this->impl_.get_implementation(),
        path, open_flags, ec);
    asio::detail::throw_error(ec, "open");
  }

  /// Construct and open a basic_stream_file.
  /**
   * This constructor initialises and opens a file.
   *
   * @param context An execution context which provides the I/O executor that
   * the file will use, by default, to dispatch handlers for any asynchronous
   * operations performed on the file.
   *
   * @param path The path name identifying the file to be opened.
   *
   * @param open_flags A set of flags that determine how the file should be
   * opened.
   *
   * @throws asio::system_error Thrown on failure.
   */
  template <typename ExecutionContext>
  basic_stream_file(ExecutionContext& context,
      const char* path, file_base::flags open_flags,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value,
        defaulted_constraint
      > = defaulted_constraint())
    : basic_file<Executor>(context)
  {
    asio::error_code ec;
    this->impl_.get_service().set_is_stream(
        this->impl_.get_implementation(), true);
    this->impl_.get_service().open(
        this->impl_.get_implementation(),
        path, open_flags, ec);
    asio::detail::throw_error(ec, "open");
  }

  /// Construct and open a basic_stream_file.
  /**
   * This constructor initialises and opens a file.
   *
   * @param ex The I/O executor that the file will use, by default, to
   * dispatch handlers for any asynchronous operations performed on the file.
   *
   * @param path The path name identifying the file to be opened.
   *
   * @param open_flags A set of flags that determine how the file should be
   * opened.
   *
   * @throws asio::system_error Thrown on failure.
   */
  basic_stream_file(const executor_type& ex,
      const std::string& path, file_base::flags open_flags)
    : basic_file<Executor>(ex)
  {
    asio::error_code ec;
    this->impl_.get_service().set_is_stream(
        this->impl_.get_implementation(), true);
    this->impl_.get_service().open(
        this->impl_.get_implementation(),
        path.c_str(), open_flags, ec);
    asio::detail::throw_error(ec, "open");
  }

  /// Construct and open a basic_stream_file.
  /**
   * This constructor initialises and opens a file.
   *
   * @param context An execution context which provides the I/O executor that
   * the file will use, by default, to dispatch handlers for any asynchronous
   * operations performed on the file.
   *
   * @param path The path name identifying the file to be opened.
   *
   * @param open_flags A set of flags that determine how the file should be
   * opened.
   *
   * @throws asio::system_error Thrown on failure.
   */
  template <typename ExecutionContext>
  basic_stream_file(ExecutionContext& context,
      const std::string& path, file_base::flags open_flags,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value,
        defaulted_constraint
      > = defaulted_constraint())
    : basic_file<Executor>(context)
  {
    asio::error_code ec;
    this->impl_.get_service().set_is_stream(
        this->impl_.get_implementation(), true);
    this->impl_.get_service().open(
        this->impl_.get_implementation(),
        path.c_str(), open_flags, ec);
    asio::detail::throw_error(ec, "open");
  }

  /// Construct a basic_stream_file on an existing native file.
  /**
   * This constructor initialises a stream file object to hold an existing
   * native file.
   *
   * @param ex The I/O executor that the file will use, by default, to
   * dispatch handlers for any asynchronous operations performed on the file.
   *
   * @param native_file The new underlying file implementation.
   *
   * @throws asio::system_error Thrown on failure.
   */
  basic_stream_file(const executor_type& ex,
      const native_handle_type& native_file)
    : basic_file<Executor>(ex, native_file)
  {
    this->impl_.get_service().set_is_stream(
        this->impl_.get_implementation(), true);
  }

  /// Construct a basic_stream_file on an existing native file.
  /**
   * This constructor initialises a stream file object to hold an existing
   * native file.
   *
   * @param context An execution context which provides the I/O executor that
   * the file will use, by default, to dispatch handlers for any asynchronous
   * operations performed on the file.
   *
   * @param native_file The new underlying file implementation.
   *
   * @throws asio::system_error Thrown on failure.
   */
  template <typename ExecutionContext>
  basic_stream_file(ExecutionContext& context,
      const native_handle_type& native_file,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value,
        defaulted_constraint
      > = defaulted_constraint())
    : basic_file<Executor>(context, native_file)
  {
    this->impl_.get_service().set_is_stream(
        this->impl_.get_implementation(), true);
  }

  /// Move-construct a basic_stream_file from another.
  /**
   * This constructor moves a stream file from one object to another.
   *
   * @param other The other basic_stream_file object from which the move
   * will occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_stream_file(const executor_type&)
   * constructor.
   */
  basic_stream_file(basic_stream_file&& other) noexcept
    : basic_file<Executor>(std::move(other))
  {
  }

  /// Move-assign a basic_stream_file from another.
  /**
   * This assignment operator moves a stream file from one object to another.
   *
   * @param other The other basic_stream_file object from which the move
   * will occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_stream_file(const executor_type&)
   * constructor.
   */
  basic_stream_file& operator=(basic_stream_file&& other)
  {
    basic_file<Executor>::operator=(std::move(other));
    return *this;
  }

  /// Move-construct a basic_stream_file from a file of another executor
  /// type.
  /**
   * This constructor moves a stream file from one object to another.
   *
   * @param other The other basic_stream_file object from which the move
   * will occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_stream_file(const executor_type&)
   * constructor.
   */
  template <typename Executor1>
  basic_stream_file(basic_stream_file<Executor1>&& other,
      constraint_t<
        is_convertible<Executor1, Executor>::value,
        defaulted_constraint
      > = defaulted_constraint())
    : basic_file<Executor>(std::move(other))
  {
  }

  /// Move-assign a basic_stream_file from a file of another executor type.
  /**
   * This assignment operator moves a stream file from one object to another.
   *
   * @param other The other basic_stream_file object from which the move
   * will occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_stream_file(const executor_type&)
   * constructor.
   */
  template <typename Executor1>
  constraint_t<
    is_convertible<Executor1, Executor>::value,
    basic_stream_file&
  > operator=(basic_stream_file<Executor1>&& other)
  {
    basic_file<Executor>::operator=(std::move(other));
    return *this;
  }

  /// Destroys the file.
  /**
   * This function destroys the file, cancelling any outstanding asynchronous
   * operations associated with the file as if by calling @c cancel.
   */
  ~basic_stream_file()
  {
  }

  /// Seek to a position in the file.
  /**
   * This function updates the current position in the file.
   *
   * @param offset The requested position in the file, relative to @c whence.
   *
   * @param whence One of @c seek_set, @c seek_cur or @c seek_end.
   *
   * @returns The new position relative to the beginning of the file.
   *
   * @throws asio::system_error Thrown on failure.
   */
  uint64_t seek(int64_t offset, file_base::seek_basis whence)
  {
    asio::error_code ec;
    uint64_t n = this->impl_.get_service().seek(
        this->impl_.get_implementation(), offset, whence, ec);
    asio::detail::throw_error(ec, "seek");
    return n;
  }

  /// Seek to a position in the file.
  /**
   * This function updates the current position in the file.
   *
   * @param offset The requested position in the file, relative to @c whence.
   *
   * @param whence One of @c seek_set, @c seek_cur or @c seek_end.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @returns The new position relative to the beginning of the file.
   */
  uint64_t seek(int64_t offset, file_base::seek_basis whence,
      asio::error_code& ec)
  {
    return this->impl_.get_service().seek(
        this->impl_.get_implementation(), offset, whence, ec);
  }

  /// Write some data to the file.
  /**
   * This function is used to write data to the stream file. The function call
   * will block until one or more bytes of the data has been written
   * successfully, or until an error occurs.
   *
   * @param buffers One or more data buffers to be written to the file.
   *
   * @returns The number of bytes written.
   *
   * @throws asio::system_error Thrown on failure. An error code of
   * asio::error::eof indicates that the end of the file was reached.
   *
   * @note The write_some operation may not transmit all of the data to the
   * peer. Consider using the @ref write function if you need to ensure that
   * all data is written before the blocking operation completes.
   *
   * @par Example
   * To write a single data buffer use the @ref buffer function as follows:
   * @code
   * file.write_some(asio::buffer(data, size));
   * @endcode
   * See the @ref buffer documentation for information on writing multiple
   * buffers in one go, and how to use it with arrays, boost::array or
   * std::vector.
   */
  template <typename ConstBufferSequence>
  std::size_t write_some(const ConstBufferSequence& buffers)
  {
    asio::error_code ec;
    std::size_t s = this->impl_.get_service().write_some(
        this->impl_.get_implementation(), buffers, ec);
    asio::detail::throw_error(ec, "write_some");
    return s;
  }

  /// Write some data to the file.
  /**
   * This function is used to write data to the stream file. The function call
   * will block until one or more bytes of the data has been written
   * successfully, or until an error occurs.
   *
   * @param buffers One or more data buffers to be written to the file.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @returns The number of bytes written. Returns 0 if an error occurred.
   *
   * @note The write_some operation may not transmit all of the data to the
   * peer. Consider using the @ref write function if you need to ensure that
   * all data is written before the blocking operation completes.
   */
  template <typename ConstBufferSequence>
  std::size_t write_some(const ConstBufferSequence& buffers,
      asio::error_code& ec)
  {
    return this->impl_.get_service().write_some(
        this->impl_.get_implementation(), buffers, ec);
  }

  /// Start an asynchronous write.
  /**
   * This function is used to asynchronously write data to the stream file.
   * It is an initiating function for an @ref asynchronous_operation, and always
   * returns immediately.
   *
   * @param buffers One or more data buffers to be written to the file.
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
   * Consider using the @ref async_write function if you need to ensure that all
   * data is written before the asynchronous operation completes.
   *
   * @par Example
   * To write a single data buffer use the @ref buffer function as follows:
   * @code
   * file.async_write_some(asio::buffer(data, size), handler);
   * @endcode
   * See the @ref buffer documentation for information on writing multiple
   * buffers in one go, and how to use it with arrays, boost::array or
   * std::vector.
   *
   * @par Per-Operation Cancellation
   * On POSIX or Windows operating systems, this asynchronous operation supports
   * cancellation for the following asio::cancellation_type values:
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
  auto async_write_some(const ConstBufferSequence& buffers,
      WriteToken&& token = default_completion_token_t<executor_type>())
    -> decltype(
      async_initiate<WriteToken,
        void (asio::error_code, std::size_t)>(
          declval<initiate_async_write_some>(), token, buffers))
  {
    return async_initiate<WriteToken,
      void (asio::error_code, std::size_t)>(
        initiate_async_write_some(this), token, buffers);
  }

  /// Read some data from the file.
  /**
   * This function is used to read data from the stream file. The function
   * call will block until one or more bytes of data has been read successfully,
   * or until an error occurs.
   *
   * @param buffers One or more buffers into which the data will be read.
   *
   * @returns The number of bytes read.
   *
   * @throws asio::system_error Thrown on failure. An error code of
   * asio::error::eof indicates that the end of the file was reached.
   *
   * @note The read_some operation may not read all of the requested number of
   * bytes. Consider using the @ref read function if you need to ensure that
   * the requested amount of data is read before the blocking operation
   * completes.
   *
   * @par Example
   * To read into a single data buffer use the @ref buffer function as follows:
   * @code
   * file.read_some(asio::buffer(data, size));
   * @endcode
   * See the @ref buffer documentation for information on reading into multiple
   * buffers in one go, and how to use it with arrays, boost::array or
   * std::vector.
   */
  template <typename MutableBufferSequence>
  std::size_t read_some(const MutableBufferSequence& buffers)
  {
    asio::error_code ec;
    std::size_t s = this->impl_.get_service().read_some(
        this->impl_.get_implementation(), buffers, ec);
    asio::detail::throw_error(ec, "read_some");
    return s;
  }

  /// Read some data from the file.
  /**
   * This function is used to read data from the stream file. The function
   * call will block until one or more bytes of data has been read successfully,
   * or until an error occurs.
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
    return this->impl_.get_service().read_some(
        this->impl_.get_implementation(), buffers, ec);
  }

  /// Start an asynchronous read.
  /**
   * This function is used to asynchronously read data from the stream file.
   * It is an initiating function for an @ref asynchronous_operation, and always
   * returns immediately.
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
   * file.async_read_some(asio::buffer(data, size), handler);
   * @endcode
   * See the @ref buffer documentation for information on reading into multiple
   * buffers in one go, and how to use it with arrays, boost::array or
   * std::vector.
   *
   * @par Per-Operation Cancellation
   * On POSIX or Windows operating systems, this asynchronous operation supports
   * cancellation for the following asio::cancellation_type values:
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
  basic_stream_file(const basic_stream_file&) = delete;
  basic_stream_file& operator=(const basic_stream_file&) = delete;

  class initiate_async_write_some
  {
  public:
    typedef Executor executor_type;

    explicit initiate_async_write_some(basic_stream_file* self)
      : self_(self)
    {
    }

    const executor_type& get_executor() const noexcept
    {
      return self_->get_executor();
    }

    template <typename WriteHandler, typename ConstBufferSequence>
    void operator()(WriteHandler&& handler,
        const ConstBufferSequence& buffers) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a WriteHandler.
      ASIO_WRITE_HANDLER_CHECK(WriteHandler, handler) type_check;

      detail::non_const_lvalue<WriteHandler> handler2(handler);
      self_->impl_.get_service().async_write_some(
          self_->impl_.get_implementation(), buffers,
          handler2.value, self_->impl_.get_executor());
    }

  private:
    basic_stream_file* self_;
  };

  class initiate_async_read_some
  {
  public:
    typedef Executor executor_type;

    explicit initiate_async_read_some(basic_stream_file* self)
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
    basic_stream_file* self_;
  };
};

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // defined(ASIO_HAS_FILE)
       //   || defined(GENERATING_DOCUMENTATION)

#endif // ASIO_BASIC_STREAM_FILE_HPP
