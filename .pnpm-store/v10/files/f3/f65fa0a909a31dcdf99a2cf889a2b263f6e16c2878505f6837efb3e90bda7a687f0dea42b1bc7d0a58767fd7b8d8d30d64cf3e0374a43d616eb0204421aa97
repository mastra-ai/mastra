//
// write.hpp
// ~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_WRITE_HPP
#define ASIO_WRITE_HPP

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

template <typename> class initiate_async_write;
#if !defined(ASIO_NO_DYNAMIC_BUFFER_V1)
template <typename> class initiate_async_write_dynbuf_v1;
#endif // !defined(ASIO_NO_DYNAMIC_BUFFER_V1)
template <typename> class initiate_async_write_dynbuf_v2;

} // namespace detail

/**
 * @defgroup write asio::write
 *
 * @brief The @c write function is a composed operation that writes a certain
 * amount of data to a stream before returning.
 */
/*@{*/

/// Write all of the supplied data to a stream before returning.
/**
 * This function is used to write a certain number of bytes of data to a stream.
 * The call will block until one of the following conditions is true:
 *
 * @li All of the data in the supplied buffers has been written. That is, the
 * bytes transferred is equal to the sum of the buffer sizes.
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * write_some function.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the SyncWriteStream concept.
 *
 * @param buffers One or more buffers containing the data to be written. The sum
 * of the buffer sizes indicates the maximum number of bytes to write to the
 * stream.
 *
 * @returns The number of bytes transferred.
 *
 * @throws asio::system_error Thrown on failure.
 *
 * @par Example
 * To write a single data buffer use the @ref buffer function as follows:
 * @code asio::write(s, asio::buffer(data, size)); @endcode
 * See the @ref buffer documentation for information on writing multiple
 * buffers in one go, and how to use it with arrays, boost::array or
 * std::vector.
 *
 * @note This overload is equivalent to calling:
 * @code asio::write(
 *     s, buffers,
 *     asio::transfer_all()); @endcode
 */
template <typename SyncWriteStream, typename ConstBufferSequence>
std::size_t write(SyncWriteStream& s, const ConstBufferSequence& buffers,
    constraint_t<
      is_const_buffer_sequence<ConstBufferSequence>::value
    > = 0);

/// Write all of the supplied data to a stream before returning.
/**
 * This function is used to write a certain number of bytes of data to a stream.
 * The call will block until one of the following conditions is true:
 *
 * @li All of the data in the supplied buffers has been written. That is, the
 * bytes transferred is equal to the sum of the buffer sizes.
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * write_some function.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the SyncWriteStream concept.
 *
 * @param buffers One or more buffers containing the data to be written. The sum
 * of the buffer sizes indicates the maximum number of bytes to write to the
 * stream.
 *
 * @param ec Set to indicate what error occurred, if any.
 *
 * @returns The number of bytes transferred.
 *
 * @par Example
 * To write a single data buffer use the @ref buffer function as follows:
 * @code asio::write(s, asio::buffer(data, size), ec); @endcode
 * See the @ref buffer documentation for information on writing multiple
 * buffers in one go, and how to use it with arrays, boost::array or
 * std::vector.
 *
 * @note This overload is equivalent to calling:
 * @code asio::write(
 *     s, buffers,
 *     asio::transfer_all(), ec); @endcode
 */
template <typename SyncWriteStream, typename ConstBufferSequence>
std::size_t write(SyncWriteStream& s, const ConstBufferSequence& buffers,
    asio::error_code& ec,
    constraint_t<
      is_const_buffer_sequence<ConstBufferSequence>::value
    > = 0);

/// Write a certain amount of data to a stream before returning.
/**
 * This function is used to write a certain number of bytes of data to a stream.
 * The call will block until one of the following conditions is true:
 *
 * @li All of the data in the supplied buffers has been written. That is, the
 * bytes transferred is equal to the sum of the buffer sizes.
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * write_some function.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the SyncWriteStream concept.
 *
 * @param buffers One or more buffers containing the data to be written. The sum
 * of the buffer sizes indicates the maximum number of bytes to write to the
 * stream.
 *
 * @param completion_condition The function object to be called to determine
 * whether the write operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest write_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the write operation is complete. A
 * non-zero return value indicates the maximum number of bytes to be written on
 * the next call to the stream's write_some function.
 *
 * @returns The number of bytes transferred.
 *
 * @throws asio::system_error Thrown on failure.
 *
 * @par Example
 * To write a single data buffer use the @ref buffer function as follows:
 * @code asio::write(s, asio::buffer(data, size),
 *     asio::transfer_at_least(32)); @endcode
 * See the @ref buffer documentation for information on writing multiple
 * buffers in one go, and how to use it with arrays, boost::array or
 * std::vector.
 */
template <typename SyncWriteStream, typename ConstBufferSequence,
    typename CompletionCondition>
std::size_t write(SyncWriteStream& s, const ConstBufferSequence& buffers,
    CompletionCondition completion_condition,
    constraint_t<
      is_const_buffer_sequence<ConstBufferSequence>::value
    > = 0,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0);

/// Write a certain amount of data to a stream before returning.
/**
 * This function is used to write a certain number of bytes of data to a stream.
 * The call will block until one of the following conditions is true:
 *
 * @li All of the data in the supplied buffers has been written. That is, the
 * bytes transferred is equal to the sum of the buffer sizes.
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * write_some function.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the SyncWriteStream concept.
 *
 * @param buffers One or more buffers containing the data to be written. The sum
 * of the buffer sizes indicates the maximum number of bytes to write to the
 * stream.
 *
 * @param completion_condition The function object to be called to determine
 * whether the write operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest write_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the write operation is complete. A
 * non-zero return value indicates the maximum number of bytes to be written on
 * the next call to the stream's write_some function.
 *
 * @param ec Set to indicate what error occurred, if any.
 *
 * @returns The number of bytes written. If an error occurs, returns the total
 * number of bytes successfully transferred prior to the error.
 */
template <typename SyncWriteStream, typename ConstBufferSequence,
    typename CompletionCondition>
std::size_t write(SyncWriteStream& s, const ConstBufferSequence& buffers,
    CompletionCondition completion_condition, asio::error_code& ec,
    constraint_t<
      is_const_buffer_sequence<ConstBufferSequence>::value
    > = 0,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0);

#if !defined(ASIO_NO_DYNAMIC_BUFFER_V1)

/// Write all of the supplied data to a stream before returning.
/**
 * This function is used to write a certain number of bytes of data to a stream.
 * The call will block until one of the following conditions is true:
 *
 * @li All of the data in the supplied dynamic buffer sequence has been written.
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * write_some function.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the SyncWriteStream concept.
 *
 * @param buffers The dynamic buffer sequence from which data will be written.
 * Successfully written data is automatically consumed from the buffers.
 *
 * @returns The number of bytes transferred.
 *
 * @throws asio::system_error Thrown on failure.
 *
 * @note This overload is equivalent to calling:
 * @code asio::write(
 *     s, buffers,
 *     asio::transfer_all()); @endcode
 */
template <typename SyncWriteStream, typename DynamicBuffer_v1>
std::size_t write(SyncWriteStream& s,
    DynamicBuffer_v1&& buffers,
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    > = 0,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    > = 0);

/// Write all of the supplied data to a stream before returning.
/**
 * This function is used to write a certain number of bytes of data to a stream.
 * The call will block until one of the following conditions is true:
 *
 * @li All of the data in the supplied dynamic buffer sequence has been written.
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * write_some function.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the SyncWriteStream concept.
 *
 * @param buffers The dynamic buffer sequence from which data will be written.
 * Successfully written data is automatically consumed from the buffers.
 *
 * @param ec Set to indicate what error occurred, if any.
 *
 * @returns The number of bytes transferred.
 *
 * @note This overload is equivalent to calling:
 * @code asio::write(
 *     s, buffers,
 *     asio::transfer_all(), ec); @endcode
 */
template <typename SyncWriteStream, typename DynamicBuffer_v1>
std::size_t write(SyncWriteStream& s,
    DynamicBuffer_v1&& buffers,
    asio::error_code& ec,
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    > = 0,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    > = 0);

/// Write a certain amount of data to a stream before returning.
/**
 * This function is used to write a certain number of bytes of data to a stream.
 * The call will block until one of the following conditions is true:
 *
 * @li All of the data in the supplied dynamic buffer sequence has been written.
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * write_some function.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the SyncWriteStream concept.
 *
 * @param buffers The dynamic buffer sequence from which data will be written.
 * Successfully written data is automatically consumed from the buffers.
 *
 * @param completion_condition The function object to be called to determine
 * whether the write operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest write_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the write operation is complete. A
 * non-zero return value indicates the maximum number of bytes to be written on
 * the next call to the stream's write_some function.
 *
 * @returns The number of bytes transferred.
 *
 * @throws asio::system_error Thrown on failure.
 */
template <typename SyncWriteStream, typename DynamicBuffer_v1,
    typename CompletionCondition>
std::size_t write(SyncWriteStream& s,
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

/// Write a certain amount of data to a stream before returning.
/**
 * This function is used to write a certain number of bytes of data to a stream.
 * The call will block until one of the following conditions is true:
 *
 * @li All of the data in the supplied dynamic buffer sequence has been written.
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * write_some function.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the SyncWriteStream concept.
 *
 * @param buffers The dynamic buffer sequence from which data will be written.
 * Successfully written data is automatically consumed from the buffers.
 *
 * @param completion_condition The function object to be called to determine
 * whether the write operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest write_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the write operation is complete. A
 * non-zero return value indicates the maximum number of bytes to be written on
 * the next call to the stream's write_some function.
 *
 * @param ec Set to indicate what error occurred, if any.
 *
 * @returns The number of bytes written. If an error occurs, returns the total
 * number of bytes successfully transferred prior to the error.
 */
template <typename SyncWriteStream, typename DynamicBuffer_v1,
    typename CompletionCondition>
std::size_t write(SyncWriteStream& s,
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

/// Write all of the supplied data to a stream before returning.
/**
 * This function is used to write a certain number of bytes of data to a stream.
 * The call will block until one of the following conditions is true:
 *
 * @li All of the data in the supplied basic_streambuf has been written.
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * write_some function.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the SyncWriteStream concept.
 *
 * @param b The basic_streambuf object from which data will be written.
 *
 * @returns The number of bytes transferred.
 *
 * @throws asio::system_error Thrown on failure.
 *
 * @note This overload is equivalent to calling:
 * @code asio::write(
 *     s, b,
 *     asio::transfer_all()); @endcode
 */
template <typename SyncWriteStream, typename Allocator>
std::size_t write(SyncWriteStream& s, basic_streambuf<Allocator>& b);

/// Write all of the supplied data to a stream before returning.
/**
 * This function is used to write a certain number of bytes of data to a stream.
 * The call will block until one of the following conditions is true:
 *
 * @li All of the data in the supplied basic_streambuf has been written.
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * write_some function.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the SyncWriteStream concept.
 *
 * @param b The basic_streambuf object from which data will be written.
 *
 * @param ec Set to indicate what error occurred, if any.
 *
 * @returns The number of bytes transferred.
 *
 * @note This overload is equivalent to calling:
 * @code asio::write(
 *     s, b,
 *     asio::transfer_all(), ec); @endcode
 */
template <typename SyncWriteStream, typename Allocator>
std::size_t write(SyncWriteStream& s, basic_streambuf<Allocator>& b,
    asio::error_code& ec);

/// Write a certain amount of data to a stream before returning.
/**
 * This function is used to write a certain number of bytes of data to a stream.
 * The call will block until one of the following conditions is true:
 *
 * @li All of the data in the supplied basic_streambuf has been written.
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * write_some function.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the SyncWriteStream concept.
 *
 * @param b The basic_streambuf object from which data will be written.
 *
 * @param completion_condition The function object to be called to determine
 * whether the write operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest write_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the write operation is complete. A
 * non-zero return value indicates the maximum number of bytes to be written on
 * the next call to the stream's write_some function.
 *
 * @returns The number of bytes transferred.
 *
 * @throws asio::system_error Thrown on failure.
 */
template <typename SyncWriteStream, typename Allocator,
    typename CompletionCondition>
std::size_t write(SyncWriteStream& s, basic_streambuf<Allocator>& b,
    CompletionCondition completion_condition,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0);

/// Write a certain amount of data to a stream before returning.
/**
 * This function is used to write a certain number of bytes of data to a stream.
 * The call will block until one of the following conditions is true:
 *
 * @li All of the data in the supplied basic_streambuf has been written.
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * write_some function.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the SyncWriteStream concept.
 *
 * @param b The basic_streambuf object from which data will be written.
 *
 * @param completion_condition The function object to be called to determine
 * whether the write operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest write_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the write operation is complete. A
 * non-zero return value indicates the maximum number of bytes to be written on
 * the next call to the stream's write_some function.
 *
 * @param ec Set to indicate what error occurred, if any.
 *
 * @returns The number of bytes written. If an error occurs, returns the total
 * number of bytes successfully transferred prior to the error.
 */
template <typename SyncWriteStream, typename Allocator,
    typename CompletionCondition>
std::size_t write(SyncWriteStream& s, basic_streambuf<Allocator>& b,
    CompletionCondition completion_condition, asio::error_code& ec,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0);

#endif // !defined(ASIO_NO_IOSTREAM)
#endif // !defined(ASIO_NO_EXTENSIONS)
#endif // !defined(ASIO_NO_DYNAMIC_BUFFER_V1)

/// Write all of the supplied data to a stream before returning.
/**
 * This function is used to write a certain number of bytes of data to a stream.
 * The call will block until one of the following conditions is true:
 *
 * @li All of the data in the supplied dynamic buffer sequence has been written.
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * write_some function.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the SyncWriteStream concept.
 *
 * @param buffers The dynamic buffer sequence from which data will be written.
 * Successfully written data is automatically consumed from the buffers.
 *
 * @returns The number of bytes transferred.
 *
 * @throws asio::system_error Thrown on failure.
 *
 * @note This overload is equivalent to calling:
 * @code asio::write(
 *     s, buffers,
 *     asio::transfer_all()); @endcode
 */
template <typename SyncWriteStream, typename DynamicBuffer_v2>
std::size_t write(SyncWriteStream& s, DynamicBuffer_v2 buffers,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    > = 0);

/// Write all of the supplied data to a stream before returning.
/**
 * This function is used to write a certain number of bytes of data to a stream.
 * The call will block until one of the following conditions is true:
 *
 * @li All of the data in the supplied dynamic buffer sequence has been written.
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * write_some function.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the SyncWriteStream concept.
 *
 * @param buffers The dynamic buffer sequence from which data will be written.
 * Successfully written data is automatically consumed from the buffers.
 *
 * @param ec Set to indicate what error occurred, if any.
 *
 * @returns The number of bytes transferred.
 *
 * @note This overload is equivalent to calling:
 * @code asio::write(
 *     s, buffers,
 *     asio::transfer_all(), ec); @endcode
 */
template <typename SyncWriteStream, typename DynamicBuffer_v2>
std::size_t write(SyncWriteStream& s, DynamicBuffer_v2 buffers,
    asio::error_code& ec,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    > = 0);

/// Write a certain amount of data to a stream before returning.
/**
 * This function is used to write a certain number of bytes of data to a stream.
 * The call will block until one of the following conditions is true:
 *
 * @li All of the data in the supplied dynamic buffer sequence has been written.
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * write_some function.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the SyncWriteStream concept.
 *
 * @param buffers The dynamic buffer sequence from which data will be written.
 * Successfully written data is automatically consumed from the buffers.
 *
 * @param completion_condition The function object to be called to determine
 * whether the write operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest write_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the write operation is complete. A
 * non-zero return value indicates the maximum number of bytes to be written on
 * the next call to the stream's write_some function.
 *
 * @returns The number of bytes transferred.
 *
 * @throws asio::system_error Thrown on failure.
 */
template <typename SyncWriteStream, typename DynamicBuffer_v2,
    typename CompletionCondition>
std::size_t write(SyncWriteStream& s, DynamicBuffer_v2 buffers,
    CompletionCondition completion_condition,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    > = 0,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0);

/// Write a certain amount of data to a stream before returning.
/**
 * This function is used to write a certain number of bytes of data to a stream.
 * The call will block until one of the following conditions is true:
 *
 * @li All of the data in the supplied dynamic buffer sequence has been written.
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * write_some function.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the SyncWriteStream concept.
 *
 * @param buffers The dynamic buffer sequence from which data will be written.
 * Successfully written data is automatically consumed from the buffers.
 *
 * @param completion_condition The function object to be called to determine
 * whether the write operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest write_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the write operation is complete. A
 * non-zero return value indicates the maximum number of bytes to be written on
 * the next call to the stream's write_some function.
 *
 * @param ec Set to indicate what error occurred, if any.
 *
 * @returns The number of bytes written. If an error occurs, returns the total
 * number of bytes successfully transferred prior to the error.
 */
template <typename SyncWriteStream, typename DynamicBuffer_v2,
    typename CompletionCondition>
std::size_t write(SyncWriteStream& s, DynamicBuffer_v2 buffers,
    CompletionCondition completion_condition, asio::error_code& ec,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    > = 0,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0);

/*@}*/
/**
 * @defgroup async_write asio::async_write
 *
 * @brief The @c async_write function is a composed asynchronous operation that
 * writes a certain amount of data to a stream before completion.
 */
/*@{*/

/// Start an asynchronous operation to write all of the supplied data to a
/// stream.
/**
 * This function is used to asynchronously write a certain number of bytes of
 * data to a stream. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately. The asynchronous
 * operation will continue until one of the following conditions is true:
 *
 * @li All of the data in the supplied buffers has been written. That is, the
 * bytes transferred is equal to the sum of the buffer sizes.
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * async_write_some function, and is known as a <em>composed operation</em>. The
 * program must ensure that the stream performs no other write operations (such
 * as async_write, the stream's async_write_some function, or any other composed
 * operations that perform writes) until this operation completes.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the AsyncWriteStream concept.
 *
 * @param buffers One or more buffers containing the data to be written.
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
 *   // Result of operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes written from the buffers. If an error
 *   // occurred, this will be less than the sum of the buffer sizes.
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
 * To write a single data buffer use the @ref buffer function as follows:
 * @code
 * asio::async_write(s, asio::buffer(data, size), handler);
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
 * if they are also supported by the @c AsyncWriteStream type's
 * @c async_write_some operation.
 */
template <typename AsyncWriteStream, typename ConstBufferSequence,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      std::size_t)) WriteToken
        = default_completion_token_t<typename AsyncWriteStream::executor_type>>
inline auto async_write(AsyncWriteStream& s, const ConstBufferSequence& buffers,
    WriteToken&& token
      = default_completion_token_t<typename AsyncWriteStream::executor_type>(),
    constraint_t<
      is_const_buffer_sequence<ConstBufferSequence>::value
    > = 0,
    constraint_t<
      !is_completion_condition<decay_t<WriteToken>>::value
    > = 0)
  -> decltype(
    async_initiate<WriteToken,
      void (asio::error_code, std::size_t)>(
        declval<detail::initiate_async_write<AsyncWriteStream>>(),
        token, buffers, transfer_all()))
{
  return async_initiate<WriteToken,
    void (asio::error_code, std::size_t)>(
      detail::initiate_async_write<AsyncWriteStream>(s),
      token, buffers, transfer_all());
}

/// Start an asynchronous operation to write a certain amount of data to a
/// stream.
/**
 * This function is used to asynchronously write a certain number of bytes of
 * data to a stream. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately. The asynchronous
 * operation will continue until one of the following conditions is true:
 *
 * @li All of the data in the supplied buffers has been written. That is, the
 * bytes transferred is equal to the sum of the buffer sizes.
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * async_write_some function, and is known as a <em>composed operation</em>. The
 * program must ensure that the stream performs no other write operations (such
 * as async_write, the stream's async_write_some function, or any other composed
 * operations that perform writes) until this operation completes.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the AsyncWriteStream concept.
 *
 * @param buffers One or more buffers containing the data to be written.
 * Although the buffers object may be copied as necessary, ownership of the
 * underlying memory blocks is retained by the caller, which must guarantee
 * that they remain valid until the completion handler is called.
 *
 * @param completion_condition The function object to be called to determine
 * whether the write operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest async_write_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the write operation is complete. A
 * non-zero return value indicates the maximum number of bytes to be written on
 * the next call to the stream's async_write_some function.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler, which will be called when the write completes.
 * Potential completion tokens include @ref use_future, @ref use_awaitable,
 * @ref yield_context, or a function object with the correct completion
 * signature. The function signature of the completion handler must be:
 * @code void handler(
 *   // Result of operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes written from the buffers. If an error
 *   // occurred, this will be less than the sum of the buffer sizes.
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
 * To write a single data buffer use the @ref buffer function as follows:
 * @code asio::async_write(s,
 *     asio::buffer(data, size),
 *     asio::transfer_at_least(32),
 *     handler); @endcode
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
 * if they are also supported by the @c AsyncWriteStream type's
 * @c async_write_some operation.
 */
template <typename AsyncWriteStream,
    typename ConstBufferSequence, typename CompletionCondition,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      std::size_t)) WriteToken
        = default_completion_token_t<typename AsyncWriteStream::executor_type>>
inline auto async_write(AsyncWriteStream& s, const ConstBufferSequence& buffers,
    CompletionCondition completion_condition,
    WriteToken&& token
      = default_completion_token_t<typename AsyncWriteStream::executor_type>(),
    constraint_t<
      is_const_buffer_sequence<ConstBufferSequence>::value
    > = 0,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0)
  -> decltype(
    async_initiate<WriteToken,
      void (asio::error_code, std::size_t)>(
        declval<detail::initiate_async_write<AsyncWriteStream>>(),
        token, buffers,
        static_cast<CompletionCondition&&>(completion_condition)))
{
  return async_initiate<WriteToken,
    void (asio::error_code, std::size_t)>(
      detail::initiate_async_write<AsyncWriteStream>(s),
      token, buffers,
      static_cast<CompletionCondition&&>(completion_condition));
}

#if !defined(ASIO_NO_DYNAMIC_BUFFER_V1)

/// Start an asynchronous operation to write all of the supplied data to a
/// stream.
/**
 * This function is used to asynchronously write a certain number of bytes of
 * data to a stream. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately. The asynchronous
 * operation will continue until one of the following conditions is true:
 *
 * @li All of the data in the supplied dynamic buffer sequence has been written.
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * async_write_some function, and is known as a <em>composed operation</em>. The
 * program must ensure that the stream performs no other write operations (such
 * as async_write, the stream's async_write_some function, or any other composed
 * operations that perform writes) until this operation completes.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the AsyncWriteStream concept.
 *
 * @param buffers The dynamic buffer sequence from which data will be written.
 * Although the buffers object may be copied as necessary, ownership of the
 * underlying memory blocks is retained by the caller, which must guarantee
 * that they remain valid until the completion handler is called. Successfully
 * written data is automatically consumed from the buffers.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler, which will be called when the write completes.
 * Potential completion tokens include @ref use_future, @ref use_awaitable,
 * @ref yield_context, or a function object with the correct completion
 * signature. The function signature of the completion handler must be:
 * @code void handler(
 *   // Result of operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes written from the buffers. If an error
 *   // occurred, this will be less than the sum of the buffer sizes.
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
 * if they are also supported by the @c AsyncWriteStream type's
 * @c async_write_some operation.
 */
template <typename AsyncWriteStream, typename DynamicBuffer_v1,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      std::size_t)) WriteToken
        = default_completion_token_t<typename AsyncWriteStream::executor_type>>
inline auto async_write(AsyncWriteStream& s, DynamicBuffer_v1&& buffers,
    WriteToken&& token
      = default_completion_token_t<typename AsyncWriteStream::executor_type>(),
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    > = 0,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    > = 0,
    constraint_t<
      !is_completion_condition<decay_t<WriteToken>>::value
    > = 0)
  -> decltype(
    async_initiate<WriteToken,
      void (asio::error_code, std::size_t)>(
        declval<detail::initiate_async_write_dynbuf_v1<AsyncWriteStream>>(),
        token, static_cast<DynamicBuffer_v1&&>(buffers),
        transfer_all()))
{
  return async_initiate<WriteToken,
    void (asio::error_code, std::size_t)>(
      detail::initiate_async_write_dynbuf_v1<AsyncWriteStream>(s),
      token, static_cast<DynamicBuffer_v1&&>(buffers),
      transfer_all());
}

/// Start an asynchronous operation to write a certain amount of data to a
/// stream.
/**
 * This function is used to asynchronously write a certain number of bytes of
 * data to a stream. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately. The asynchronous
 * operation will continue until one of the following conditions is true:
 *
 * @li All of the data in the supplied dynamic buffer sequence has been written.
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * async_write_some function, and is known as a <em>composed operation</em>. The
 * program must ensure that the stream performs no other write operations (such
 * as async_write, the stream's async_write_some function, or any other composed
 * operations that perform writes) until this operation completes.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the AsyncWriteStream concept.
 *
 * @param buffers The dynamic buffer sequence from which data will be written.
 * Although the buffers object may be copied as necessary, ownership of the
 * underlying memory blocks is retained by the caller, which must guarantee
 * that they remain valid until the completion handler is called. Successfully
 * written data is automatically consumed from the buffers.
 *
 * @param completion_condition The function object to be called to determine
 * whether the write operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest async_write_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the write operation is complete. A
 * non-zero return value indicates the maximum number of bytes to be written on
 * the next call to the stream's async_write_some function.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler, which will be called when the write completes.
 * Potential completion tokens include @ref use_future, @ref use_awaitable,
 * @ref yield_context, or a function object with the correct completion
 * signature. The function signature of the completion handler must be:
 * @code void handler(
 *   // Result of operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes written from the buffers. If an error
 *   // occurred, this will be less than the sum of the buffer sizes.
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
 * if they are also supported by the @c AsyncWriteStream type's
 * @c async_write_some operation.
 */
template <typename AsyncWriteStream,
    typename DynamicBuffer_v1, typename CompletionCondition,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      std::size_t)) WriteToken
        = default_completion_token_t<typename AsyncWriteStream::executor_type>>
inline auto async_write(AsyncWriteStream& s, DynamicBuffer_v1&& buffers,
    CompletionCondition completion_condition,
    WriteToken&& token
      = default_completion_token_t<typename AsyncWriteStream::executor_type>(),
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
    async_initiate<WriteToken,
      void (asio::error_code, std::size_t)>(
        declval<detail::initiate_async_write_dynbuf_v1<AsyncWriteStream>>(),
        token, static_cast<DynamicBuffer_v1&&>(buffers),
        static_cast<CompletionCondition&&>(completion_condition)))
{
  return async_initiate<WriteToken,
    void (asio::error_code, std::size_t)>(
      detail::initiate_async_write_dynbuf_v1<AsyncWriteStream>(s),
      token, static_cast<DynamicBuffer_v1&&>(buffers),
      static_cast<CompletionCondition&&>(completion_condition));
}

#if !defined(ASIO_NO_EXTENSIONS)
#if !defined(ASIO_NO_IOSTREAM)

/// Start an asynchronous operation to write all of the supplied data to a
/// stream.
/**
 * This function is used to asynchronously write a certain number of bytes of
 * data to a stream. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately. The asynchronous
 * operation will continue until one of the following conditions is true:
 *
 * @li All of the data in the supplied basic_streambuf has been written.
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * async_write_some function, and is known as a <em>composed operation</em>. The
 * program must ensure that the stream performs no other write operations (such
 * as async_write, the stream's async_write_some function, or any other composed
 * operations that perform writes) until this operation completes.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the AsyncWriteStream concept.
 *
 * @param b A basic_streambuf object from which data will be written. Ownership
 * of the streambuf is retained by the caller, which must guarantee that it
 * remains valid until the completion handler is called.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler, which will be called when the write completes.
 * Potential completion tokens include @ref use_future, @ref use_awaitable,
 * @ref yield_context, or a function object with the correct completion
 * signature. The function signature of the completion handler must be:
 * @code void handler(
 *   // Result of operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes written from the buffers. If an error
 *   // occurred, this will be less than the sum of the buffer sizes.
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
 * if they are also supported by the @c AsyncWriteStream type's
 * @c async_write_some operation.
 */
template <typename AsyncWriteStream, typename Allocator,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      std::size_t)) WriteToken
        = default_completion_token_t<typename AsyncWriteStream::executor_type>>
inline auto async_write(AsyncWriteStream& s, basic_streambuf<Allocator>& b,
    WriteToken&& token
      = default_completion_token_t<typename AsyncWriteStream::executor_type>(),
    constraint_t<
      !is_completion_condition<decay_t<WriteToken>>::value
    > = 0)
  -> decltype(
    async_initiate<WriteToken,
      void (asio::error_code, std::size_t)>(
        declval<detail::initiate_async_write_dynbuf_v1<AsyncWriteStream>>(),
        token, basic_streambuf_ref<Allocator>(b), transfer_all()))
{
  return async_initiate<WriteToken,
    void (asio::error_code, std::size_t)>(
      detail::initiate_async_write_dynbuf_v1<AsyncWriteStream>(s),
      token, basic_streambuf_ref<Allocator>(b), transfer_all());
}

/// Start an asynchronous operation to write a certain amount of data to a
/// stream.
/**
 * This function is used to asynchronously write a certain number of bytes of
 * data to a stream. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately. The asynchronous
 * operation will continue until one of the following conditions is true:
 *
 * @li All of the data in the supplied basic_streambuf has been written.
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * async_write_some function, and is known as a <em>composed operation</em>. The
 * program must ensure that the stream performs no other write operations (such
 * as async_write, the stream's async_write_some function, or any other composed
 * operations that perform writes) until this operation completes.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the AsyncWriteStream concept.
 *
 * @param b A basic_streambuf object from which data will be written. Ownership
 * of the streambuf is retained by the caller, which must guarantee that it
 * remains valid until the completion handler is called.
 *
 * @param completion_condition The function object to be called to determine
 * whether the write operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest async_write_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the write operation is complete. A
 * non-zero return value indicates the maximum number of bytes to be written on
 * the next call to the stream's async_write_some function.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler, which will be called when the write completes.
 * Potential completion tokens include @ref use_future, @ref use_awaitable,
 * @ref yield_context, or a function object with the correct completion
 * signature. The function signature of the completion handler must be:
 * @code void handler(
 *   // Result of operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes written from the buffers. If an error
 *   // occurred, this will be less than the sum of the buffer sizes.
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
 * if they are also supported by the @c AsyncWriteStream type's
 * @c async_write_some operation.
 */
template <typename AsyncWriteStream,
    typename Allocator, typename CompletionCondition,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      std::size_t)) WriteToken
        = default_completion_token_t<typename AsyncWriteStream::executor_type>>
inline auto async_write(AsyncWriteStream& s, basic_streambuf<Allocator>& b,
    CompletionCondition completion_condition,
    WriteToken&& token
      = default_completion_token_t<typename AsyncWriteStream::executor_type>(),
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0)
  -> decltype(
    async_initiate<WriteToken,
      void (asio::error_code, std::size_t)>(
        declval<detail::initiate_async_write_dynbuf_v1<AsyncWriteStream>>(),
        token, basic_streambuf_ref<Allocator>(b),
        static_cast<CompletionCondition&&>(completion_condition)))
{
  return async_initiate<WriteToken,
    void (asio::error_code, std::size_t)>(
      detail::initiate_async_write_dynbuf_v1<AsyncWriteStream>(s),
      token, basic_streambuf_ref<Allocator>(b),
      static_cast<CompletionCondition&&>(completion_condition));
}

#endif // !defined(ASIO_NO_IOSTREAM)
#endif // !defined(ASIO_NO_EXTENSIONS)
#endif // !defined(ASIO_NO_DYNAMIC_BUFFER_V1)

/// Start an asynchronous operation to write all of the supplied data to a
/// stream.
/**
 * This function is used to asynchronously write a certain number of bytes of
 * data to a stream. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately. The asynchronous
 * operation will continue until one of the following conditions is true:
 *
 * @li All of the data in the supplied dynamic buffer sequence has been written.
 *
 * @li An error occurred.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * async_write_some function, and is known as a <em>composed operation</em>. The
 * program must ensure that the stream performs no other write operations (such
 * as async_write, the stream's async_write_some function, or any other composed
 * operations that perform writes) until this operation completes.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the AsyncWriteStream concept.
 *
 * @param buffers The dynamic buffer sequence from which data will be written.
 * Although the buffers object may be copied as necessary, ownership of the
 * underlying memory blocks is retained by the caller, which must guarantee
 * that they remain valid until the completion handler is called. Successfully
 * written data is automatically consumed from the buffers.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler, which will be called when the write completes.
 * Potential completion tokens include @ref use_future, @ref use_awaitable,
 * @ref yield_context, or a function object with the correct completion
 * signature. The function signature of the completion handler must be:
 * @code void handler(
 *   // Result of operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes written from the buffers. If an error
 *   // occurred, this will be less than the sum of the buffer sizes.
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
 * if they are also supported by the @c AsyncWriteStream type's
 * @c async_write_some operation.
 */
template <typename AsyncWriteStream, typename DynamicBuffer_v2,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      std::size_t)) WriteToken
        = default_completion_token_t<typename AsyncWriteStream::executor_type>>
inline auto async_write(AsyncWriteStream& s, DynamicBuffer_v2 buffers,
    WriteToken&& token
      = default_completion_token_t<typename AsyncWriteStream::executor_type>(),
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    > = 0,
    constraint_t<
      !is_completion_condition<decay_t<WriteToken>>::value
    > = 0)
  -> decltype(
    async_initiate<WriteToken,
      void (asio::error_code, std::size_t)>(
        declval<detail::initiate_async_write_dynbuf_v2<AsyncWriteStream>>(),
        token, static_cast<DynamicBuffer_v2&&>(buffers),
        transfer_all()))
{
  return async_initiate<WriteToken,
    void (asio::error_code, std::size_t)>(
      detail::initiate_async_write_dynbuf_v2<AsyncWriteStream>(s),
      token, static_cast<DynamicBuffer_v2&&>(buffers),
      transfer_all());
}

/// Start an asynchronous operation to write a certain amount of data to a
/// stream.
/**
 * This function is used to asynchronously write a certain number of bytes of
 * data to a stream. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately. The asynchronous
 * operation will continue until one of the following conditions is true:
 *
 * @li All of the data in the supplied dynamic buffer sequence has been written.
 *
 * @li The completion_condition function object returns 0.
 *
 * This operation is implemented in terms of zero or more calls to the stream's
 * async_write_some function, and is known as a <em>composed operation</em>. The
 * program must ensure that the stream performs no other write operations (such
 * as async_write, the stream's async_write_some function, or any other composed
 * operations that perform writes) until this operation completes.
 *
 * @param s The stream to which the data is to be written. The type must support
 * the AsyncWriteStream concept.
 *
 * @param buffers The dynamic buffer sequence from which data will be written.
 * Although the buffers object may be copied as necessary, ownership of the
 * underlying memory blocks is retained by the caller, which must guarantee
 * that they remain valid until the completion handler is called. Successfully
 * written data is automatically consumed from the buffers.
 *
 * @param completion_condition The function object to be called to determine
 * whether the write operation is complete. The signature of the function object
 * must be:
 * @code std::size_t completion_condition(
 *   // Result of latest async_write_some operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes transferred so far.
 *   std::size_t bytes_transferred
 * ); @endcode
 * A return value of 0 indicates that the write operation is complete. A
 * non-zero return value indicates the maximum number of bytes to be written on
 * the next call to the stream's async_write_some function.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler, which will be called when the write completes.
 * Potential completion tokens include @ref use_future, @ref use_awaitable,
 * @ref yield_context, or a function object with the correct completion
 * signature. The function signature of the completion handler must be:
 * @code void handler(
 *   // Result of operation.
 *   const asio::error_code& error,
 *
 *   // Number of bytes written from the buffers. If an error
 *   // occurred, this will be less than the sum of the buffer sizes.
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
 * if they are also supported by the @c AsyncWriteStream type's
 * @c async_write_some operation.
 */
template <typename AsyncWriteStream,
    typename DynamicBuffer_v2, typename CompletionCondition,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      std::size_t)) WriteToken
        = default_completion_token_t<typename AsyncWriteStream::executor_type>>
inline auto async_write(AsyncWriteStream& s, DynamicBuffer_v2 buffers,
    CompletionCondition completion_condition,
    WriteToken&& token
      = default_completion_token_t<typename AsyncWriteStream::executor_type>(),
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    > = 0,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    > = 0)
  -> decltype(
    async_initiate<WriteToken,
      void (asio::error_code, std::size_t)>(
        declval<detail::initiate_async_write_dynbuf_v2<AsyncWriteStream>>(),
        token, static_cast<DynamicBuffer_v2&&>(buffers),
        static_cast<CompletionCondition&&>(completion_condition)))
{
  return async_initiate<WriteToken,
    void (asio::error_code, std::size_t)>(
      detail::initiate_async_write_dynbuf_v2<AsyncWriteStream>(s),
      token, static_cast<DynamicBuffer_v2&&>(buffers),
      static_cast<CompletionCondition&&>(completion_condition));
}

/*@}*/

} // namespace asio

#include "asio/detail/pop_options.hpp"

#include "asio/impl/write.hpp"

#endif // ASIO_WRITE_HPP
