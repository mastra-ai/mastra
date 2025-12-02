//
// read.hpp
// ~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_READ_HPP
#define ASIO_READ_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <cstddef>
#include "asio/async_result.hpp"
#include "asio/buffer.hpp"
#include "asio/completion_condition.hpp"
#include "asio/error.hpp"

#if !defined(ASIO_NO_EXTENSIONS)
# include "asio/basic_streambuf_fwd.hpp"
#endif // !defined(ASIO_NO_EXTENSIONS)

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

template <typename> class initiate_async_read;
#if !defined(ASIO_NO_DYNAMIC_BUFFER_V1)
template <typename> class initiate_async_read_dynbuf_v1;
#endif // !defined(ASIO_NO_DYNAMIC_BUFFER_V1)
template <typename> class initiate_async_read_dynbuf_v2;

} // namespace detail

/**
 * @defgroup read asio::read
 *
 * @brief The @c read function is a composed operation that reads a certain
 * amount of data from a stream before returning.
 */
/*@{*/

/// Attempt to read a certain amount of data from a stream before returning.
/**
 * This function is used to read a certain number of bytes of data from a
 * stream. The call will block until one of the following conditions is true:
 *
 * @li The supplied buffers are full. That is, the bytes transferred is equal to
 * the sum of the buffer sizes.
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * read_some function.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the SyncReadStream concept.
 *
 * @param buffers One or more buffers into which the data will be read. The sum
 * of the buffer sizes indicates the maximum number of bytes to read from the
 * stream.
 *
 * @returns The number of bytes transferred.
 *
 * @throws asio::system_error Thrown on failure.
 *
 * @par Example
 * To read into a single data buffer use the @ref buffer function as follows:
 * @code asio::read(s, asio::buffer(data, size)); @endcode
 * See the @ref buffer documentation for information on reading into multiple
 * buffers in one go, and how to use it with arrays, boost::array or
 * std::vector.
 *
 * @note This overload is equivalent to calling:
 * @code asio::read(
 *     s, buffers,
 *     asio::transfer_all()); @endcode
 */
template <typename SyncReadStream, typename MutableBufferSequence>
std::size_t read(SyncReadStream& s, const MutableBufferSequence& buffers,
    constraint_t<
      is_mutable_buffer_sequence<MutableBufferSequence>::value
    > = 0);

/// Attempt to read a certain amount of data from a stream before returning.
/**
 * This function is used to read a certain number of bytes of data from a
 * stream. The call will block until one of the following conditions is true:
 *
 * @li The supplied buffers are full. That is, the bytes transferred is equal to
 * the sum of the buffer sizes.
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * read_some function.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the SyncReadStream concept.
 *
 * @param buffers One or more buffers into which the data will be read. The sum
 * of the buffer sizes indicates the maximum number of bytes to read from the
 * stream.
 *
 * @param ec Set to indicate what error occurred, if any.
 *
 * @returns The number of bytes transferred.
 *
 * @par Example
 * To read into a single data buffer use the @ref buffer function as follows:
 * @code asio::read(s, asio::buffer(data, size), ec); @endcode
 * See the @ref buffer documentation for information on reading into multiple
 * buffers in one go, and how to use it with arrays, boost::array or
 * std::vector.
 *
 * @note This overload is equivalent to calling:
 * @code asio::read(
 *     s, buffers,
 *     asio::transfer_all(), ec); @endcode
 */
template <typename SyncReadStream, typename MutableBufferSequence>
std::size_t read(SyncReadStream& s, const MutableBufferSequence& buffers,
    asio::error_code& ec,
    constraint_t<
      is_mutable_buffer_sequence<MutableBufferSequence>::value
    > = 0);

/// Attempt to read a certain amount of data from a stream before returning.
/**
 * This function is used to read a certain number of bytes of data from a
 * stream. The call will block until one of the following conditions is true:
 *
 * @li The supplied buffers are full. That is, the bytes transferred is equal to
 * the sum of the buffer sizes.
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * read_some function.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the SyncReadStream concept.
 *
 * @param buffers One or more buffers into which the data will be read. The sum
 * of the buffer sizes indicates the maximum number of bytes to read from the
 * stream.
 *
 * @param completion_condition The function object to be called to determine
 * whether the read operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest read_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the read operation is complete. A non-zero
 * return value indicates the maximum number of bytes to be read on the next
 * call to the stream's read_some function.
 *
 * @returns The number of bytes transferred.
 *
 * @throws asio::system_error Thrown on failure.
 *
 * @par Example
 * To read into a single data buffer use the @ref buffer function as follows:
 * @code asio::read(s, asio::buffer(data, size),
 *     asio::transfer_at_least(32)); @endcode
 * See the @ref buffer documentation for information on reading into multiple
 * buffers in one go, and how to use it with arrays, boost::array or
 * std::vector.
 */
template <typename SyncReadStream, typename MutableBufferSequence,
  typename CompletionCondition>
std::size_t read(SyncReadStream& s, const MutableBufferSequence& buffers,
    CompletionCondition completion_condition,
    constraint_t<
      is_mutable_buffer_sequence<MutableBufferSequence>::value
    > = 0,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0);

/// Attempt to read a certain amount of data from a stream before returning.
/**
 * This function is used to read a certain number of bytes of data from a
 * stream. The call will block until one of the following conditions is true:
 *
 * @li The supplied buffers are full. That is, the bytes transferred is equal to
 * the sum of the buffer sizes.
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * read_some function.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the SyncReadStream concept.
 *
 * @param buffers One or more buffers into which the data will be read. The sum
 * of the buffer sizes indicates the maximum number of bytes to read from the
 * stream.
 *
 * @param completion_condition The function object to be called to determine
 * whether the read operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest read_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the read operation is complete. A non-zero
 * return value indicates the maximum number of bytes to be read on the next
 * call to the stream's read_some function.
 *
 * @param ec Set to indicate what error occurred, if any.
 *
 * @returns The number of bytes read. If an error occurs, returns the total
 * number of bytes successfully transferred prior to the error.
 */
template <typename SyncReadStream, typename MutableBufferSequence,
    typename CompletionCondition>
std::size_t read(SyncReadStream& s, const MutableBufferSequence& buffers,
    CompletionCondition completion_condition, asio::error_code& ec,
    constraint_t<
      is_mutable_buffer_sequence<MutableBufferSequence>::value
    > = 0,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0);

#if !defined(ASIO_NO_DYNAMIC_BUFFER_V1)

/// Attempt to read a certain amount of data from a stream before returning.
/**
 * This function is used to read a certain number of bytes of data from a
 * stream. The call will block until one of the following conditions is true:
 *
 * @li The specified dynamic buffer sequence is full (that is, it has reached
 * maximum size).
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * read_some function.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the SyncReadStream concept.
 *
 * @param buffers The dynamic buffer sequence into which the data will be read.
 *
 * @returns The number of bytes transferred.
 *
 * @throws asio::system_error Thrown on failure.
 *
 * @note This overload is equivalent to calling:
 * @code asio::read(
 *     s, buffers,
 *     asio::transfer_all()); @endcode
 */
template <typename SyncReadStream, typename DynamicBuffer_v1>
std::size_t read(SyncReadStream& s,
    DynamicBuffer_v1&& buffers,
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    > = 0,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    > = 0);

/// Attempt to read a certain amount of data from a stream before returning.
/**
 * This function is used to read a certain number of bytes of data from a
 * stream. The call will block until one of the following conditions is true:
 *
 * @li The supplied buffer is full (that is, it has reached maximum size).
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * read_some function.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the SyncReadStream concept.
 *
 * @param buffers The dynamic buffer sequence into which the data will be read.
 *
 * @param ec Set to indicate what error occurred, if any.
 *
 * @returns The number of bytes transferred.
 *
 * @note This overload is equivalent to calling:
 * @code asio::read(
 *     s, buffers,
 *     asio::transfer_all(), ec); @endcode
 */
template <typename SyncReadStream, typename DynamicBuffer_v1>
std::size_t read(SyncReadStream& s,
    DynamicBuffer_v1&& buffers,
    asio::error_code& ec,
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    > = 0,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    > = 0);

/// Attempt to read a certain amount of data from a stream before returning.
/**
 * This function is used to read a certain number of bytes of data from a
 * stream. The call will block until one of the following conditions is true:
 *
 * @li The specified dynamic buffer sequence is full (that is, it has reached
 * maximum size).
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * read_some function.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the SyncReadStream concept.
 *
 * @param buffers The dynamic buffer sequence into which the data will be read.
 *
 * @param completion_condition The function object to be called to determine
 * whether the read operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest read_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the read operation is complete. A non-zero
 * return value indicates the maximum number of bytes to be read on the next
 * call to the stream's read_some function.
 *
 * @returns The number of bytes transferred.
 *
 * @throws asio::system_error Thrown on failure.
 */
template <typename SyncReadStream, typename DynamicBuffer_v1,
    typename CompletionCondition>
std::size_t read(SyncReadStream& s,
    DynamicBuffer_v1&& buffers,
    CompletionCondition completion_condition,
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    > = 0,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    > = 0,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0);

/// Attempt to read a certain amount of data from a stream before returning.
/**
 * This function is used to read a certain number of bytes of data from a
 * stream. The call will block until one of the following conditions is true:
 *
 * @li The specified dynamic buffer sequence is full (that is, it has reached
 * maximum size).
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * read_some function.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the SyncReadStream concept.
 *
 * @param buffers The dynamic buffer sequence into which the data will be read.
 *
 * @param completion_condition The function object to be called to determine
 * whether the read operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest read_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the read operation is complete. A non-zero
 * return value indicates the maximum number of bytes to be read on the next
 * call to the stream's read_some function.
 *
 * @param ec Set to indicate what error occurred, if any.
 *
 * @returns The number of bytes read. If an error occurs, returns the total
 * number of bytes successfully transferred prior to the error.
 */
template <typename SyncReadStream, typename DynamicBuffer_v1,
    typename CompletionCondition>
std::size_t read(SyncReadStream& s,
    DynamicBuffer_v1&& buffers,
    CompletionCondition completion_condition, asio::error_code& ec,
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    > = 0,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    > = 0,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0);

#if !defined(ASIO_NO_EXTENSIONS)
#if !defined(ASIO_NO_IOSTREAM)

/// Attempt to read a certain amount of data from a stream before returning.
/**
 * This function is used to read a certain number of bytes of data from a
 * stream. The call will block until one of the following conditions is true:
 *
 * @li The supplied buffer is full (that is, it has reached maximum size).
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * read_some function.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the SyncReadStream concept.
 *
 * @param b The basic_streambuf object into which the data will be read.
 *
 * @returns The number of bytes transferred.
 *
 * @throws asio::system_error Thrown on failure.
 *
 * @note This overload is equivalent to calling:
 * @code asio::read(
 *     s, b,
 *     asio::transfer_all()); @endcode
 */
template <typename SyncReadStream, typename Allocator>
std::size_t read(SyncReadStream& s, basic_streambuf<Allocator>& b);

/// Attempt to read a certain amount of data from a stream before returning.
/**
 * This function is used to read a certain number of bytes of data from a
 * stream. The call will block until one of the following conditions is true:
 *
 * @li The supplied buffer is full (that is, it has reached maximum size).
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * read_some function.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the SyncReadStream concept.
 *
 * @param b The basic_streambuf object into which the data will be read.
 *
 * @param ec Set to indicate what error occurred, if any.
 *
 * @returns The number of bytes transferred.
 *
 * @note This overload is equivalent to calling:
 * @code asio::read(
 *     s, b,
 *     asio::transfer_all(), ec); @endcode
 */
template <typename SyncReadStream, typename Allocator>
std::size_t read(SyncReadStream& s, basic_streambuf<Allocator>& b,
    asio::error_code& ec);

/// Attempt to read a certain amount of data from a stream before returning.
/**
 * This function is used to read a certain number of bytes of data from a
 * stream. The call will block until one of the following conditions is true:
 *
 * @li The supplied buffer is full (that is, it has reached maximum size).
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * read_some function.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the SyncReadStream concept.
 *
 * @param b The basic_streambuf object into which the data will be read.
 *
 * @param completion_condition The function object to be called to determine
 * whether the read operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest read_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the read operation is complete. A non-zero
 * return value indicates the maximum number of bytes to be read on the next
 * call to the stream's read_some function.
 *
 * @returns The number of bytes transferred.
 *
 * @throws asio::system_error Thrown on failure.
 */
template <typename SyncReadStream, typename Allocator,
    typename CompletionCondition>
std::size_t read(SyncReadStream& s, basic_streambuf<Allocator>& b,
    CompletionCondition completion_condition,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0);

/// Attempt to read a certain amount of data from a stream before returning.
/**
 * This function is used to read a certain number of bytes of data from a
 * stream. The call will block until one of the following conditions is true:
 *
 * @li The supplied buffer is full (that is, it has reached maximum size).
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * read_some function.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the SyncReadStream concept.
 *
 * @param b The basic_streambuf object into which the data will be read.
 *
 * @param completion_condition The function object to be called to determine
 * whether the read operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest read_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the read operation is complete. A non-zero
 * return value indicates the maximum number of bytes to be read on the next
 * call to the stream's read_some function.
 *
 * @param ec Set to indicate what error occurred, if any.
 *
 * @returns The number of bytes read. If an error occurs, returns the total
 * number of bytes successfully transferred prior to the error.
 */
template <typename SyncReadStream, typename Allocator,
    typename CompletionCondition>
std::size_t read(SyncReadStream& s, basic_streambuf<Allocator>& b,
    CompletionCondition completion_condition, asio::error_code& ec,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0);

#endif // !defined(ASIO_NO_IOSTREAM)
#endif // !defined(ASIO_NO_EXTENSIONS)
#endif // !defined(ASIO_NO_DYNAMIC_BUFFER_V1)

/// Attempt to read a certain amount of data from a stream before returning.
/**
 * This function is used to read a certain number of bytes of data from a
 * stream. The call will block until one of the following conditions is true:
 *
 * @li The specified dynamic buffer sequence is full (that is, it has reached
 * maximum size).
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * read_some function.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the SyncReadStream concept.
 *
 * @param buffers The dynamic buffer sequence into which the data will be read.
 *
 * @returns The number of bytes transferred.
 *
 * @throws asio::system_error Thrown on failure.
 *
 * @note This overload is equivalent to calling:
 * @code asio::read(
 *     s, buffers,
 *     asio::transfer_all()); @endcode
 */
template <typename SyncReadStream, typename DynamicBuffer_v2>
std::size_t read(SyncReadStream& s, DynamicBuffer_v2 buffers,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    > = 0);

/// Attempt to read a certain amount of data from a stream before returning.
/**
 * This function is used to read a certain number of bytes of data from a
 * stream. The call will block until one of the following conditions is true:
 *
 * @li The supplied buffer is full (that is, it has reached maximum size).
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * read_some function.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the SyncReadStream concept.
 *
 * @param buffers The dynamic buffer sequence into which the data will be read.
 *
 * @param ec Set to indicate what error occurred, if any.
 *
 * @returns The number of bytes transferred.
 *
 * @note This overload is equivalent to calling:
 * @code asio::read(
 *     s, buffers,
 *     asio::transfer_all(), ec); @endcode
 */
template <typename SyncReadStream, typename DynamicBuffer_v2>
std::size_t read(SyncReadStream& s, DynamicBuffer_v2 buffers,
    asio::error_code& ec,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    > = 0);

/// Attempt to read a certain amount of data from a stream before returning.
/**
 * This function is used to read a certain number of bytes of data from a
 * stream. The call will block until one of the following conditions is true:
 *
 * @li The specified dynamic buffer sequence is full (that is, it has reached
 * maximum size).
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * read_some function.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the SyncReadStream concept.
 *
 * @param buffers The dynamic buffer sequence into which the data will be read.
 *
 * @param completion_condition The function object to be called to determine
 * whether the read operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest read_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the read operation is complete. A non-zero
 * return value indicates the maximum number of bytes to be read on the next
 * call to the stream's read_some function.
 *
 * @returns The number of bytes transferred.
 *
 * @throws asio::system_error Thrown on failure.
 */
template <typename SyncReadStream, typename DynamicBuffer_v2,
    typename CompletionCondition>
std::size_t read(SyncReadStream& s, DynamicBuffer_v2 buffers,
    CompletionCondition completion_condition,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    > = 0,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0);

/// Attempt to read a certain amount of data from a stream before returning.
/**
 * This function is used to read a certain number of bytes of data from a
 * stream. The call will block until one of the following conditions is true:
 *
 * @li The specified dynamic buffer sequence is full (that is, it has reached
 * maximum size).
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * read_some function.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the SyncReadStream concept.
 *
 * @param buffers The dynamic buffer sequence into which the data will be read.
 *
 * @param completion_condition The function object to be called to determine
 * whether the read operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest read_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the read operation is complete. A non-zero
 * return value indicates the maximum number of bytes to be read on the next
 * call to the stream's read_some function.
 *
 * @param ec Set to indicate what error occurred, if any.
 *
 * @returns The number of bytes read. If an error occurs, returns the total
 * number of bytes successfully transferred prior to the error.
 */
template <typename SyncReadStream, typename DynamicBuffer_v2,
    typename CompletionCondition>
std::size_t read(SyncReadStream& s, DynamicBuffer_v2 buffers,
    CompletionCondition completion_condition, asio::error_code& ec,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    > = 0,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0);

/*@}*/
/**
 * @defgroup async_read asio::async_read
 *
 * @brief The @c async_read function is a composed asynchronous operation that
 * reads a certain amount of data from a stream before completion.
 */
/*@{*/

/// Start an asynchronous operation to read a certain amount of data from a
/// stream.
/**
 * This function is used to asynchronously read a certain number of bytes of
 * data from a stream. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately. The asynchronous
 * operation will continue until one of the following conditions is true:
 *
 * @li The supplied buffers are full. That is, the bytes transferred is equal to
 * the sum of the buffer sizes.
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * async_read_some function, and is known as a <em>composed operation</em>. The
 * program must ensure that the stream performs no other read operations (such
 * as async_read, the stream's async_read_some function, or any other composed
 * operations that perform reads) until this operation completes.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the AsyncReadStream concept.
 *
 * @param buffers One or more buffers into which the data will be read. The sum
 * of the buffer sizes indicates the maximum number of bytes to read from the
 * stream. Although the buffers object may be copied as necessary, ownership of
 * the underlying memory blocks is retained by the caller, which must guarantee
 * that they remain valid until the completion handler is called.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler, which will be called when the read completes.
 * Potential completion tokens include @ref use_future, @ref use_awaitable,
 * @ref yield_context, or a function object with the correct completion
 * signature. The function signature of the completion handler must be:
 * @code void handler(
 *   // Result of operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes copied into the buffers. If an error
 *   // occurred, this will be the number of bytes successfully
 *   // transferred prior to the error.
 *   std::size_t bytes_transferred
 * ); @endcode
 * Regardless of whether the asynchronous operation completes immediately or
 * not, the completion handler will not be invoked from within this function.
 * On immediate completion, invocation of the handler will be performed in a
 * manner equivalent to using asio::async_immediate().
 *
 * @par Completion Signature
 * @code void(asio::error_code, std::size_t) @endcode
 *
 * @par Example
 * To read into a single data buffer use the @ref buffer function as follows:
 * @code
 * asio::async_read(s, asio::buffer(data, size), handler);
 * @endcode
 * See the @ref buffer documentation for information on reading into multiple
 * buffers in one go, and how to use it with arrays, boost::array or
 * std::vector.
 *
 * @note This overload is equivalent to calling:
 * @code asio::async_read(
 *     s, buffers,
 *     asio::transfer_all(),
 *     handler); @endcode
 *
 * @par Per-Operation Cancellation
 * This asynchronous operation supports cancellation for the following
 * asio::cancellation_type values:
 *
 * @li @c cancellation_type::terminal
 *
 * @li @c cancellation_type::partial
 *
 * if they are also supported by the @c AsyncReadStream type's
 * @c async_read_some operation.
 */
template <typename AsyncReadStream, typename MutableBufferSequence,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      std::size_t)) ReadToken = default_completion_token_t<
        typename AsyncReadStream::executor_type>>
inline auto async_read(AsyncReadStream& s, const MutableBufferSequence& buffers,
    ReadToken&& token = default_completion_token_t<
      typename AsyncReadStream::executor_type>(),
    constraint_t<
      is_mutable_buffer_sequence<MutableBufferSequence>::value
    > = 0,
    constraint_t<
      !is_completion_condition<ReadToken>::value
    > = 0)
  -> decltype(
    async_initiate<ReadToken,
      void (asio::error_code, std::size_t)>(
        declval<detail::initiate_async_read<AsyncReadStream>>(),
        token, buffers, transfer_all()))
{
  return async_initiate<ReadToken,
    void (asio::error_code, std::size_t)>(
      detail::initiate_async_read<AsyncReadStream>(s),
      token, buffers, transfer_all());
}

/// Start an asynchronous operation to read a certain amount of data from a
/// stream.
/**
 * This function is used to asynchronously read a certain number of bytes of
 * data from a stream. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately. The asynchronous
 * operation will continue until one of the following conditions is true:
 *
 * @li The supplied buffers are full. That is, the bytes transferred is equal to
 * the sum of the buffer sizes.
 *
 * @li The completion_condition function object returns 0.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the AsyncReadStream concept.
 *
 * @param buffers One or more buffers into which the data will be read. The sum
 * of the buffer sizes indicates the maximum number of bytes to read from the
 * stream. Although the buffers object may be copied as necessary, ownership of
 * the underlying memory blocks is retained by the caller, which must guarantee
 * that they remain valid until the completion handler is called.
 *
 * @param completion_condition The function object to be called to determine
 * whether the read operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest async_read_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the read operation is complete. A non-zero
 * return value indicates the maximum number of bytes to be read on the next
 * call to the stream's async_read_some function.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler, which will be called when the read completes.
 * Potential completion tokens include @ref use_future, @ref use_awaitable,
 * @ref yield_context, or a function object with the correct completion
 * signature. The function signature of the completion handler must be:
 * @code void handler(
 *   // Result of operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes copied into the buffers. If an error
 *   // occurred, this will be the number of bytes successfully
 *   // transferred prior to the error.
 *   std::size_t bytes_transferred
 * ); @endcode
 * Regardless of whether the asynchronous operation completes immediately or
 * not, the completion handler will not be invoked from within this function.
 * On immediate completion, invocation of the handler will be performed in a
 * manner equivalent to using asio::async_immediate().
 *
 * @par Completion Signature
 * @code void(asio::error_code, std::size_t) @endcode
 *
 * @par Example
 * To read into a single data buffer use the @ref buffer function as follows:
 * @code asio::async_read(s,
 *     asio::buffer(data, size),
 *     asio::transfer_at_least(32),
 *     handler); @endcode
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
 * if they are also supported by the @c AsyncReadStream type's
 * @c async_read_some operation.
 */
template <typename AsyncReadStream,
    typename MutableBufferSequence, typename CompletionCondition,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      std::size_t)) ReadToken = default_completion_token_t<
        typename AsyncReadStream::executor_type>>
inline auto async_read(AsyncReadStream& s, const MutableBufferSequence& buffers,
    CompletionCondition completion_condition,
    ReadToken&& token = default_completion_token_t<
      typename AsyncReadStream::executor_type>(),
    constraint_t<
      is_mutable_buffer_sequence<MutableBufferSequence>::value
    > = 0,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0)
  -> decltype(
    async_initiate<ReadToken,
      void (asio::error_code, std::size_t)>(
        declval<detail::initiate_async_read<AsyncReadStream>>(),
        token, buffers,
        static_cast<CompletionCondition&&>(completion_condition)))
{
  return async_initiate<ReadToken,
    void (asio::error_code, std::size_t)>(
      detail::initiate_async_read<AsyncReadStream>(s), token, buffers,
      static_cast<CompletionCondition&&>(completion_condition));
}

#if !defined(ASIO_NO_DYNAMIC_BUFFER_V1)

/// Start an asynchronous operation to read a certain amount of data from a
/// stream.
/**
 * This function is used to asynchronously read a certain number of bytes of
 * data from a stream. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately. The asynchronous
 * operation will continue until one of the following conditions is true:
 *
 * @li The specified dynamic buffer sequence is full (that is, it has reached
 * maximum size).
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * async_read_some function, and is known as a <em>composed operation</em>. The
 * program must ensure that the stream performs no other read operations (such
 * as async_read, the stream's async_read_some function, or any other composed
 * operations that perform reads) until this operation completes.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the AsyncReadStream concept.
 *
 * @param buffers The dynamic buffer sequence into which the data will be read.
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
 *   // Result of operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes copied into the buffers. If an error
 *   // occurred, this will be the number of bytes successfully
 *   // transferred prior to the error.
 *   std::size_t bytes_transferred
 * ); @endcode
 * Regardless of whether the asynchronous operation completes immediately or
 * not, the completion handler will not be invoked from within this function.
 * On immediate completion, invocation of the handler will be performed in a
 * manner equivalent to using asio::async_immediate().
 *
 * @par Completion Signature
 * @code void(asio::error_code, std::size_t) @endcode
 *
 * @note This overload is equivalent to calling:
 * @code asio::async_read(
 *     s, buffers,
 *     asio::transfer_all(),
 *     handler); @endcode
 *
 * @par Per-Operation Cancellation
 * This asynchronous operation supports cancellation for the following
 * asio::cancellation_type values:
 *
 * @li @c cancellation_type::terminal
 *
 * @li @c cancellation_type::partial
 *
 * if they are also supported by the @c AsyncReadStream type's
 * @c async_read_some operation.
 */
template <typename AsyncReadStream, typename DynamicBuffer_v1,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      std::size_t)) ReadToken = default_completion_token_t<
        typename AsyncReadStream::executor_type>>
inline auto async_read(AsyncReadStream& s, DynamicBuffer_v1&& buffers,
    ReadToken&& token = default_completion_token_t<
      typename AsyncReadStream::executor_type>(),
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    > = 0,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    > = 0,
    constraint_t<
      !is_completion_condition<ReadToken>::value
    > = 0)
  -> decltype(
    async_initiate<ReadToken,
      void (asio::error_code, std::size_t)>(
        declval<detail::initiate_async_read_dynbuf_v1<AsyncReadStream>>(),
        token, static_cast<DynamicBuffer_v1&&>(buffers), transfer_all()))
{
  return async_initiate<ReadToken,
    void (asio::error_code, std::size_t)>(
      detail::initiate_async_read_dynbuf_v1<AsyncReadStream>(s),
      token, static_cast<DynamicBuffer_v1&&>(buffers), transfer_all());
}

/// Start an asynchronous operation to read a certain amount of data from a
/// stream.
/**
 * This function is used to asynchronously read a certain number of bytes of
 * data from a stream. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately. The asynchronous
 * operation will continue until one of the following conditions is true:
 *
 * @li The specified dynamic buffer sequence is full (that is, it has reached
 * maximum size).
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * async_read_some function, and is known as a <em>composed operation</em>. The
 * program must ensure that the stream performs no other read operations (such
 * as async_read, the stream's async_read_some function, or any other composed
 * operations that perform reads) until this operation completes.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the AsyncReadStream concept.
 *
 * @param buffers The dynamic buffer sequence into which the data will be read.
 * Although the buffers object may be copied as necessary, ownership of the
 * underlying memory blocks is retained by the caller, which must guarantee
 * that they remain valid until the completion handler is called.
 *
 * @param completion_condition The function object to be called to determine
 * whether the read operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest async_read_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the read operation is complete. A non-zero
 * return value indicates the maximum number of bytes to be read on the next
 * call to the stream's async_read_some function.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler, which will be called when the read completes.
 * Potential completion tokens include @ref use_future, @ref use_awaitable,
 * @ref yield_context, or a function object with the correct completion
 * signature. The function signature of the completion handler must be:
 * @code void handler(
 *   // Result of operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes copied into the buffers. If an error
 *   // occurred, this will be the number of bytes successfully
 *   // transferred prior to the error.
 *   std::size_t bytes_transferred
 * ); @endcode
 * Regardless of whether the asynchronous operation completes immediately or
 * not, the completion handler will not be invoked from within this function.
 * On immediate completion, invocation of the handler will be performed in a
 * manner equivalent to using asio::async_immediate().
 *
 * @par Completion Signature
 * @code void(asio::error_code, std::size_t) @endcode
 *
 * @par Per-Operation Cancellation
 * This asynchronous operation supports cancellation for the following
 * asio::cancellation_type values:
 *
 * @li @c cancellation_type::terminal
 *
 * @li @c cancellation_type::partial
 *
 * if they are also supported by the @c AsyncReadStream type's
 * @c async_read_some operation.
 */
template <typename AsyncReadStream,
    typename DynamicBuffer_v1, typename CompletionCondition,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      std::size_t)) ReadToken = default_completion_token_t<
        typename AsyncReadStream::executor_type>>
inline auto async_read(AsyncReadStream& s, DynamicBuffer_v1&& buffers,
    CompletionCondition completion_condition,
    ReadToken&& token = default_completion_token_t<
      typename AsyncReadStream::executor_type>(),
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    > = 0,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    > = 0,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0)
  -> decltype(
    async_initiate<ReadToken,
      void (asio::error_code, std::size_t)>(
        declval<detail::initiate_async_read_dynbuf_v1<AsyncReadStream>>(),
        token, static_cast<DynamicBuffer_v1&&>(buffers),
        static_cast<CompletionCondition&&>(completion_condition)))
{
  return async_initiate<ReadToken,
    void (asio::error_code, std::size_t)>(
      detail::initiate_async_read_dynbuf_v1<AsyncReadStream>(s),
      token, static_cast<DynamicBuffer_v1&&>(buffers),
      static_cast<CompletionCondition&&>(completion_condition));
}

#if !defined(ASIO_NO_EXTENSIONS)
#if !defined(ASIO_NO_IOSTREAM)

/// Start an asynchronous operation to read a certain amount of data from a
/// stream.
/**
 * This function is used to asynchronously read a certain number of bytes of
 * data from a stream. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately. The asynchronous
 * operation will continue until one of the following conditions is true:
 *
 * @li The supplied buffer is full (that is, it has reached maximum size).
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * async_read_some function, and is known as a <em>composed operation</em>. The
 * program must ensure that the stream performs no other read operations (such
 * as async_read, the stream's async_read_some function, or any other composed
 * operations that perform reads) until this operation completes.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the AsyncReadStream concept.
 *
 * @param b A basic_streambuf object into which the data will be read. Ownership
 * of the streambuf is retained by the caller, which must guarantee that it
 * remains valid until the completion handler is called.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler, which will be called when the read completes.
 * Potential completion tokens include @ref use_future, @ref use_awaitable,
 * @ref yield_context, or a function object with the correct completion
 * signature. The function signature of the completion handler must be:
 * @code void handler(
 *   // Result of operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes copied into the buffers. If an error
 *   // occurred, this will be the number of bytes successfully
 *   // transferred prior to the error.
 *   std::size_t bytes_transferred
 * ); @endcode
 * Regardless of whether the asynchronous operation completes immediately or
 * not, the completion handler will not be invoked from within this function.
 * On immediate completion, invocation of the handler will be performed in a
 * manner equivalent to using asio::async_immediate().
 *
 * @par Completion Signature
 * @code void(asio::error_code, std::size_t) @endcode
 *
 * @note This overload is equivalent to calling:
 * @code asio::async_read(
 *     s, b,
 *     asio::transfer_all(),
 *     handler); @endcode
 *
 * @par Per-Operation Cancellation
 * This asynchronous operation supports cancellation for the following
 * asio::cancellation_type values:
 *
 * @li @c cancellation_type::terminal
 *
 * @li @c cancellation_type::partial
 *
 * if they are also supported by the @c AsyncReadStream type's
 * @c async_read_some operation.
 */
template <typename AsyncReadStream, typename Allocator,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      std::size_t)) ReadToken = default_completion_token_t<
        typename AsyncReadStream::executor_type>>
inline auto async_read(AsyncReadStream& s, basic_streambuf<Allocator>& b,
    ReadToken&& token = default_completion_token_t<
      typename AsyncReadStream::executor_type>(),
    constraint_t<
      !is_completion_condition<ReadToken>::value
    > = 0)
  -> decltype(
    async_initiate<ReadToken,
      void (asio::error_code, std::size_t)>(
        declval<detail::initiate_async_read_dynbuf_v1<AsyncReadStream>>(),
        token, basic_streambuf_ref<Allocator>(b), transfer_all()))
{
  return async_initiate<ReadToken,
    void (asio::error_code, std::size_t)>(
      detail::initiate_async_read_dynbuf_v1<AsyncReadStream>(s),
      token, basic_streambuf_ref<Allocator>(b), transfer_all());
}

/// Start an asynchronous operation to read a certain amount of data from a
/// stream.
/**
 * This function is used to asynchronously read a certain number of bytes of
 * data from a stream. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately. The asynchronous
 * operation will continue until one of the following conditions is true:
 *
 * @li The supplied buffer is full (that is, it has reached maximum size).
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * async_read_some function, and is known as a <em>composed operation</em>. The
 * program must ensure that the stream performs no other read operations (such
 * as async_read, the stream's async_read_some function, or any other composed
 * operations that perform reads) until this operation completes.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the AsyncReadStream concept.
 *
 * @param b A basic_streambuf object into which the data will be read. Ownership
 * of the streambuf is retained by the caller, which must guarantee that it
 * remains valid until the completion handler is called.
 *
 * @param completion_condition The function object to be called to determine
 * whether the read operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest async_read_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the read operation is complete. A non-zero
 * return value indicates the maximum number of bytes to be read on the next
 * call to the stream's async_read_some function.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler, which will be called when the read completes.
 * Potential completion tokens include @ref use_future, @ref use_awaitable,
 * @ref yield_context, or a function object with the correct completion
 * signature. The function signature of the completion handler must be:
 * @code void handler(
 *   // Result of operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes copied into the buffers. If an error
 *   // occurred, this will be the number of bytes successfully
 *   // transferred prior to the error.
 *   std::size_t bytes_transferred
 * ); @endcode
 * Regardless of whether the asynchronous operation completes immediately or
 * not, the completion handler will not be invoked from within this function.
 * On immediate completion, invocation of the handler will be performed in a
 * manner equivalent to using asio::async_immediate().
 *
 * @par Completion Signature
 * @code void(asio::error_code, std::size_t) @endcode
 *
 * @par Per-Operation Cancellation
 * This asynchronous operation supports cancellation for the following
 * asio::cancellation_type values:
 *
 * @li @c cancellation_type::terminal
 *
 * @li @c cancellation_type::partial
 *
 * if they are also supported by the @c AsyncReadStream type's
 * @c async_read_some operation.
 */
template <typename AsyncReadStream,
    typename Allocator, typename CompletionCondition,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      std::size_t)) ReadToken = default_completion_token_t<
        typename AsyncReadStream::executor_type>>
inline auto async_read(AsyncReadStream& s, basic_streambuf<Allocator>& b,
    CompletionCondition completion_condition,
    ReadToken&& token = default_completion_token_t<
      typename AsyncReadStream::executor_type>(),
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0)
  -> decltype(
    async_initiate<ReadToken,
      void (asio::error_code, std::size_t)>(
        declval<detail::initiate_async_read_dynbuf_v1<AsyncReadStream>>(),
        token, basic_streambuf_ref<Allocator>(b),
        static_cast<CompletionCondition&&>(completion_condition)))
{
  return async_initiate<ReadToken,
    void (asio::error_code, std::size_t)>(
      detail::initiate_async_read_dynbuf_v1<AsyncReadStream>(s),
      token, basic_streambuf_ref<Allocator>(b),
      static_cast<CompletionCondition&&>(completion_condition));
}

#endif // !defined(ASIO_NO_IOSTREAM)
#endif // !defined(ASIO_NO_EXTENSIONS)
#endif // !defined(ASIO_NO_DYNAMIC_BUFFER_V1)

/// Start an asynchronous operation to read a certain amount of data from a
/// stream.
/**
 * This function is used to asynchronously read a certain number of bytes of
 * data from a stream. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately. The asynchronous
 * operation will continue until one of the following conditions is true:
 *
 * @li The specified dynamic buffer sequence is full (that is, it has reached
 * maximum size).
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * async_read_some function, and is known as a <em>composed operation</em>. The
 * program must ensure that the stream performs no other read operations (such
 * as async_read, the stream's async_read_some function, or any other composed
 * operations that perform reads) until this operation completes.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the AsyncReadStream concept.
 *
 * @param buffers The dynamic buffer sequence into which the data will be read.
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
 *   // Result of operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes copied into the buffers. If an error
 *   // occurred, this will be the number of bytes successfully
 *   // transferred prior to the error.
 *   std::size_t bytes_transferred
 * ); @endcode
 * Regardless of whether the asynchronous operation completes immediately or
 * not, the completion handler will not be invoked from within this function.
 * On immediate completion, invocation of the handler will be performed in a
 * manner equivalent to using asio::async_immediate().
 *
 * @par Completion Signature
 * @code void(asio::error_code, std::size_t) @endcode
 *
 * @note This overload is equivalent to calling:
 * @code asio::async_read(
 *     s, buffers,
 *     asio::transfer_all(),
 *     handler); @endcode
 *
 * @par Per-Operation Cancellation
 * This asynchronous operation supports cancellation for the following
 * asio::cancellation_type values:
 *
 * @li @c cancellation_type::terminal
 *
 * @li @c cancellation_type::partial
 *
 * if they are also supported by the @c AsyncReadStream type's
 * @c async_read_some operation.
 */
template <typename AsyncReadStream, typename DynamicBuffer_v2,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      std::size_t)) ReadToken = default_completion_token_t<
        typename AsyncReadStream::executor_type>>
inline auto async_read(AsyncReadStream& s, DynamicBuffer_v2 buffers,
    ReadToken&& token = default_completion_token_t<
      typename AsyncReadStream::executor_type>(),
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    > = 0,
    constraint_t<
      !is_completion_condition<ReadToken>::value
    > = 0)
  -> decltype(
    async_initiate<ReadToken,
      void (asio::error_code, std::size_t)>(
        declval<detail::initiate_async_read_dynbuf_v2<AsyncReadStream>>(),
        token, static_cast<DynamicBuffer_v2&&>(buffers), transfer_all()))
{
  return async_initiate<ReadToken,
    void (asio::error_code, std::size_t)>(
      detail::initiate_async_read_dynbuf_v2<AsyncReadStream>(s),
      token, static_cast<DynamicBuffer_v2&&>(buffers), transfer_all());
}

/// Start an asynchronous operation to read a certain amount of data from a
/// stream.
/**
 * This function is used to asynchronously read a certain number of bytes of
 * data from a stream. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately. The asynchronous
 * operation will continue until one of the following conditions is true:
 *
 * @li The specified dynamic buffer sequence is full (that is, it has reached
 * maximum size).
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * async_read_some function, and is known as a <em>composed operation</em>. The
 * program must ensure that the stream performs no other read operations (such
 * as async_read, the stream's async_read_some function, or any other composed
 * operations that perform reads) until this operation completes.
 *
 * @param s The stream from which the data is to be read. The type must support
 * the AsyncReadStream concept.
 *
 * @param buffers The dynamic buffer sequence into which the data will be read.
 * Although the buffers object may be copied as necessary, ownership of the
 * underlying memory blocks is retained by the caller, which must guarantee
 * that they remain valid until the completion handler is called.
 *
 * @param completion_condition The function object to be called to determine
 * whether the read operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest async_read_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the read operation is complete. A non-zero
 * return value indicates the maximum number of bytes to be read on the next
 * call to the stream's async_read_some function.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler, which will be called when the read completes.
 * Potential completion tokens include @ref use_future, @ref use_awaitable,
 * @ref yield_context, or a function object with the correct completion
 * signature. The function signature of the completion handler must be:
 * @code void handler(
 *   // Result of operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes copied into the buffers. If an error
 *   // occurred, this will be the number of bytes successfully
 *   // transferred prior to the error.
 *   std::size_t bytes_transferred
 * ); @endcode
 * Regardless of whether the asynchronous operation completes immediately or
 * not, the completion handler will not be invoked from within this function.
 * On immediate completion, invocation of the handler will be performed in a
 * manner equivalent to using asio::async_immediate().
 *
 * @par Completion Signature
 * @code void(asio::error_code, std::size_t) @endcode
 *
 * @par Per-Operation Cancellation
 * This asynchronous operation supports cancellation for the following
 * asio::cancellation_type values:
 *
 * @li @c cancellation_type::terminal
 *
 * @li @c cancellation_type::partial
 *
 * if they are also supported by the @c AsyncReadStream type's
 * @c async_read_some operation.
 */
template <typename AsyncReadStream,
    typename DynamicBuffer_v2, typename CompletionCondition,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      std::size_t)) ReadToken = default_completion_token_t<
        typename AsyncReadStream::executor_type>>
inline auto async_read(AsyncReadStream& s, DynamicBuffer_v2 buffers,
    CompletionCondition completion_condition,
    ReadToken&& token = default_completion_token_t<
      typename AsyncReadStream::executor_type>(),
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    > = 0,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0)
  -> decltype(
    async_initiate<ReadToken,
      void (asio::error_code, std::size_t)>(
        declval<detail::initiate_async_read_dynbuf_v2<AsyncReadStream>>(),
        token, static_cast<DynamicBuffer_v2&&>(buffers),
        static_cast<CompletionCondition&&>(completion_condition)))
{
  return async_initiate<ReadToken,
    void (asio::error_code, std::size_t)>(
      detail::initiate_async_read_dynbuf_v2<AsyncReadStream>(s),
      token, static_cast<DynamicBuffer_v2&&>(buffers),
      static_cast<CompletionCondition&&>(completion_condition));
}

/*@}*/

} // namespace asio

#include "asio/detail/pop_options.hpp"

#include "asio/impl/read.hpp"

#endif // ASIO_READ_HPP
