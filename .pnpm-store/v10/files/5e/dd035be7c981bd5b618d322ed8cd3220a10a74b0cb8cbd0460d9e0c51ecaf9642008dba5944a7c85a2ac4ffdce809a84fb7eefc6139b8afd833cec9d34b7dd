//
// buffered_write_stream.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_BUFFERED_WRITE_STREAM_HPP
#define ASIO_BUFFERED_WRITE_STREAM_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <cstddef>
#include "asio/buffered_write_stream_fwd.hpp"
#include "asio/buffer.hpp"
#include "asio/completion_condition.hpp"
#include "asio/detail/bind_handler.hpp"
#include "asio/detail/buffered_stream_storage.hpp"
#include "asio/detail/noncopyable.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/error.hpp"
#include "asio/write.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

template <typename> class initiate_async_buffered_flush;
template <typename> class initiate_async_buffered_write_some;

} // namespace detail

/// Adds buffering to the write-related operations of a stream.
/**
 * The buffered_write_stream class template can be used to add buffering to the
 * synchronous and asynchronous write operations of a stream.
 *
 * @par Thread Safety
 * @e Distinct @e objects: Safe.@n
 * @e Shared @e objects: Unsafe.
 *
 * @par Concepts:
 * AsyncReadStream, AsyncWriteStream, Stream, SyncReadStream, SyncWriteStream.
 */
template <typename Stream>
class buffered_write_stream
  : private noncopyable
{
public:
  /// The type of the next layer.
  typedef remove_reference_t<Stream> next_layer_type;

  /// The type of the lowest layer.
  typedef typename next_layer_type::lowest_layer_type lowest_layer_type;

  /// The type of the executor associated with the object.
  typedef typename lowest_layer_type::executor_type executor_type;

#if defined(GENERATING_DOCUMENTATION)
  /// The default buffer size.
  static const std::size_t default_buffer_size = implementation_defined;
#else
  ASIO_STATIC_CONSTANT(std::size_t, default_buffer_size = 1024);
#endif

  /// Construct, passing the specified argument to initialise the next layer.
  template <typename Arg>
  explicit buffered_write_stream(Arg&& a)
    : next_layer_(static_cast<Arg&&>(a)),
      storage_(default_buffer_size)
  {
  }

  /// Construct, passing the specified argument to initialise the next layer.
  template <typename Arg>
  buffered_write_stream(Arg&& a,
      std::size_t buffer_size)
    : next_layer_(static_cast<Arg&&>(a)),
      storage_(buffer_size)
  {
  }

  /// Get a reference to the next layer.
  next_layer_type& next_layer()
  {
    return next_layer_;
  }

  /// Get a reference to the lowest layer.
  lowest_layer_type& lowest_layer()
  {
    return next_layer_.lowest_layer();
  }

  /// Get a const reference to the lowest layer.
  const lowest_layer_type& lowest_layer() const
  {
    return next_layer_.lowest_layer();
  }

  /// Get the executor associated with the object.
  executor_type get_executor() noexcept
  {
    return next_layer_.lowest_layer().get_executor();
  }

  /// Close the stream.
  void close()
  {
    next_layer_.close();
  }

  /// Close the stream.
  ASIO_SYNC_OP_VOID close(asio::error_code& ec)
  {
    next_layer_.close(ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Flush all data from the buffer to the next layer. Returns the number of
  /// bytes written to the next layer on the last write operation. Throws an
  /// exception on failure.
  std::size_t flush();

  /// Flush all data from the buffer to the next layer. Returns the number of
  /// bytes written to the next layer on the last write operation, or 0 if an
  /// error occurred.
  std::size_t flush(asio::error_code& ec);

  /// Start an asynchronous flush.
  /**
   * @par Completion Signature
   * @code void(asio::error_code, std::size_t) @endcode
   */
  template <
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
        std::size_t)) WriteHandler = default_completion_token_t<executor_type>>
  auto async_flush(
      WriteHandler&& handler = default_completion_token_t<executor_type>())
    -> decltype(
      async_initiate<WriteHandler,
        void (asio::error_code, std::size_t)>(
          declval<detail::initiate_async_buffered_flush<Stream>>(),
          handler, declval<detail::buffered_stream_storage*>()));

  /// Write the given data to the stream. Returns the number of bytes written.
  /// Throws an exception on failure.
  template <typename ConstBufferSequence>
  std::size_t write_some(const ConstBufferSequence& buffers);

  /// Write the given data to the stream. Returns the number of bytes written,
  /// or 0 if an error occurred and the error handler did not throw.
  template <typename ConstBufferSequence>
  std::size_t write_some(const ConstBufferSequence& buffers,
      asio::error_code& ec);

  /// Start an asynchronous write. The data being written must be valid for the
  /// lifetime of the asynchronous operation.
  /**
   * @par Completion Signature
   * @code void(asio::error_code, std::size_t) @endcode
   */
  template <typename ConstBufferSequence,
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
        std::size_t)) WriteHandler = default_completion_token_t<executor_type>>
  auto async_write_some(const ConstBufferSequence& buffers,
      WriteHandler&& handler = default_completion_token_t<executor_type>())
    -> decltype(
      async_initiate<WriteHandler,
        void (asio::error_code, std::size_t)>(
          declval<detail::initiate_async_buffered_write_some<Stream>>(),
          handler, declval<detail::buffered_stream_storage*>(), buffers));

  /// Read some data from the stream. Returns the number of bytes read. Throws
  /// an exception on failure.
  template <typename MutableBufferSequence>
  std::size_t read_some(const MutableBufferSequence& buffers)
  {
    return next_layer_.read_some(buffers);
  }

  /// Read some data from the stream. Returns the number of bytes read or 0 if
  /// an error occurred.
  template <typename MutableBufferSequence>
  std::size_t read_some(const MutableBufferSequence& buffers,
      asio::error_code& ec)
  {
    return next_layer_.read_some(buffers, ec);
  }

  /// Start an asynchronous read. The buffer into which the data will be read
  /// must be valid for the lifetime of the asynchronous operation.
  /**
   * @par Completion Signature
   * @code void(asio::error_code, std::size_t) @endcode
   */
  template <typename MutableBufferSequence,
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
        std::size_t)) ReadHandler = default_completion_token_t<executor_type>>
  auto async_read_some(const MutableBufferSequence& buffers,
      ReadHandler&& handler = default_completion_token_t<executor_type>())
    -> decltype(
      declval<conditional_t<true, Stream&, ReadHandler>>().async_read_some(
        buffers, static_cast<ReadHandler&&>(handler)))
  {
    return next_layer_.async_read_some(buffers,
        static_cast<ReadHandler&&>(handler));
  }

  /// Peek at the incoming data on the stream. Returns the number of bytes read.
  /// Throws an exception on failure.
  template <typename MutableBufferSequence>
  std::size_t peek(const MutableBufferSequence& buffers)
  {
    return next_layer_.peek(buffers);
  }

  /// Peek at the incoming data on the stream. Returns the number of bytes read,
  /// or 0 if an error occurred.
  template <typename MutableBufferSequence>
  std::size_t peek(const MutableBufferSequence& buffers,
      asio::error_code& ec)
  {
    return next_layer_.peek(buffers, ec);
  }

  /// Determine the amount of data that may be read without blocking.
  std::size_t in_avail()
  {
    return next_layer_.in_avail();
  }

  /// Determine the amount of data that may be read without blocking.
  std::size_t in_avail(asio::error_code& ec)
  {
    return next_layer_.in_avail(ec);
  }

private:
  /// Copy data into the internal buffer from the specified source buffer.
  /// Returns the number of bytes copied.
  template <typename ConstBufferSequence>
  std::size_t copy(const ConstBufferSequence& buffers);

  /// The next layer.
  Stream next_layer_;

  // The data in the buffer.
  detail::buffered_stream_storage storage_;
};

} // namespace asio

#include "asio/detail/pop_options.hpp"

#include "asio/impl/buffered_write_stream.hpp"

#endif // ASIO_BUFFERED_WRITE_STREAM_HPP
