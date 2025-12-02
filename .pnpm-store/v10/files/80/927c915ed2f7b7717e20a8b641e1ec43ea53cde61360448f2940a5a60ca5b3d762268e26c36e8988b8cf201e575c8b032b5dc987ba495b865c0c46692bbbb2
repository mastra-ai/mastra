//
// basic_socket_streambuf.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_BASIC_SOCKET_STREAMBUF_HPP
#define ASIO_BASIC_SOCKET_STREAMBUF_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if !defined(ASIO_NO_IOSTREAM)

#include <streambuf>
#include <vector>
#include "asio/basic_socket.hpp"
#include "asio/basic_stream_socket.hpp"
#include "asio/detail/buffer_sequence_adapter.hpp"
#include "asio/detail/memory.hpp"
#include "asio/detail/throw_error.hpp"
#include "asio/io_context.hpp"
#include "asio/steady_timer.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

// A separate base class is used to ensure that the io_context member is
// initialised prior to the basic_socket_streambuf's basic_socket base class.
class socket_streambuf_io_context
{
protected:
  socket_streambuf_io_context(io_context* ctx)
    : default_io_context_(ctx)
  {
  }

  shared_ptr<io_context> default_io_context_;
};

// A separate base class is used to ensure that the dynamically allocated
// buffers are constructed prior to the basic_socket_streambuf's basic_socket
// base class. This makes moving the socket is the last potentially throwing
// step in the streambuf's move constructor, giving the constructor a strong
// exception safety guarantee.
class socket_streambuf_buffers
{
protected:
  socket_streambuf_buffers()
    : get_buffer_(buffer_size),
      put_buffer_(buffer_size)
  {
  }

  enum { buffer_size = 512 };
  std::vector<char> get_buffer_;
  std::vector<char> put_buffer_;
};

} // namespace detail

#if !defined(ASIO_BASIC_SOCKET_STREAMBUF_FWD_DECL)
#define ASIO_BASIC_SOCKET_STREAMBUF_FWD_DECL

// Forward declaration with defaulted arguments.
template <typename Protocol,
    typename Clock = chrono::steady_clock,
    typename WaitTraits = wait_traits<Clock>>
class basic_socket_streambuf;

#endif // !defined(ASIO_BASIC_SOCKET_STREAMBUF_FWD_DECL)

/// Iostream streambuf for a socket.
#if defined(GENERATING_DOCUMENTATION)
template <typename Protocol,
    typename Clock = chrono::steady_clock,
    typename WaitTraits = wait_traits<Clock>>
#else // defined(GENERATING_DOCUMENTATION)
template <typename Protocol, typename Clock, typename WaitTraits>
#endif // defined(GENERATING_DOCUMENTATION)
class basic_socket_streambuf
  : public std::streambuf,
    private detail::socket_streambuf_io_context,
    private detail::socket_streambuf_buffers,
    private basic_socket<Protocol>
{
private:
  typedef detail::chrono_time_traits<Clock, WaitTraits> traits_helper;

public:
  /// The protocol type.
  typedef Protocol protocol_type;

  /// The endpoint type.
  typedef typename Protocol::endpoint endpoint_type;

  /// The clock type.
  typedef Clock clock_type;

#if defined(GENERATING_DOCUMENTATION)
  /// The time type.
  typedef typename WaitTraits::time_point time_point;

  /// The duration type.
  typedef typename WaitTraits::duration duration;
#else
  typedef typename traits_helper::time_type time_point;
  typedef typename traits_helper::duration_type duration;
#endif

  /// Construct a basic_socket_streambuf without establishing a connection.
  basic_socket_streambuf()
    : detail::socket_streambuf_io_context(new io_context),
      basic_socket<Protocol>(*default_io_context_),
      expiry_time_(max_expiry_time())
  {
    init_buffers();
  }

  /// Construct a basic_socket_streambuf from the supplied socket.
  explicit basic_socket_streambuf(basic_stream_socket<protocol_type> s)
    : detail::socket_streambuf_io_context(0),
      basic_socket<Protocol>(std::move(s)),
      expiry_time_(max_expiry_time())
  {
    init_buffers();
  }

  /// Move-construct a basic_socket_streambuf from another.
  basic_socket_streambuf(basic_socket_streambuf&& other)
    : detail::socket_streambuf_io_context(other),
      basic_socket<Protocol>(std::move(other.socket())),
      ec_(other.ec_),
      expiry_time_(other.expiry_time_)
  {
    get_buffer_.swap(other.get_buffer_);
    put_buffer_.swap(other.put_buffer_);
    setg(other.eback(), other.gptr(), other.egptr());
    setp(other.pptr(), other.epptr());
    other.ec_ = asio::error_code();
    other.expiry_time_ = max_expiry_time();
    other.init_buffers();
  }

  /// Move-assign a basic_socket_streambuf from another.
  basic_socket_streambuf& operator=(basic_socket_streambuf&& other)
  {
    this->close();
    socket() = std::move(other.socket());
    detail::socket_streambuf_io_context::operator=(other);
    ec_ = other.ec_;
    expiry_time_ = other.expiry_time_;
    get_buffer_.swap(other.get_buffer_);
    put_buffer_.swap(other.put_buffer_);
    setg(other.eback(), other.gptr(), other.egptr());
    setp(other.pptr(), other.epptr());
    other.ec_ = asio::error_code();
    other.expiry_time_ = max_expiry_time();
    other.put_buffer_.resize(buffer_size);
    other.init_buffers();
    return *this;
  }

  /// Destructor flushes buffered data.
  virtual ~basic_socket_streambuf()
  {
    if (pptr() != pbase())
      overflow(traits_type::eof());
  }

  /// Establish a connection.
  /**
   * This function establishes a connection to the specified endpoint.
   *
   * @return \c this if a connection was successfully established, a null
   * pointer otherwise.
   */
  basic_socket_streambuf* connect(const endpoint_type& endpoint)
  {
    init_buffers();
    ec_ = asio::error_code();
    this->connect_to_endpoints(&endpoint, &endpoint + 1);
    return !ec_ ? this : 0;
  }

  /// Establish a connection.
  /**
   * This function automatically establishes a connection based on the supplied
   * resolver query parameters. The arguments are used to construct a resolver
   * query object.
   *
   * @return \c this if a connection was successfully established, a null
   * pointer otherwise.
   */
  template <typename... T>
  basic_socket_streambuf* connect(T... x)
  {
    init_buffers();
    typedef typename Protocol::resolver resolver_type;
    resolver_type resolver(socket().get_executor());
    connect_to_endpoints(resolver.resolve(x..., ec_));
    return !ec_ ? this : 0;
  }

  /// Close the connection.
  /**
   * @return \c this if a connection was successfully established, a null
   * pointer otherwise.
   */
  basic_socket_streambuf* close()
  {
    sync();
    socket().close(ec_);
    if (!ec_)
      init_buffers();
    return !ec_ ? this : 0;
  }

  /// Get a reference to the underlying socket.
  basic_socket<Protocol>& socket()
  {
    return *this;
  }

  /// Get the last error associated with the stream buffer.
  /**
   * @return An \c error_code corresponding to the last error from the stream
   * buffer.
   */
  const asio::error_code& error() const
  {
    return ec_;
  }

  /// Get the stream buffer's expiry time as an absolute time.
  /**
   * @return An absolute time value representing the stream buffer's expiry
   * time.
   */
  time_point expiry() const
  {
    return expiry_time_;
  }

  /// Set the stream buffer's expiry time as an absolute time.
  /**
   * This function sets the expiry time associated with the stream. Stream
   * operations performed after this time (where the operations cannot be
   * completed using the internal buffers) will fail with the error
   * asio::error::operation_aborted.
   *
   * @param expiry_time The expiry time to be used for the stream.
   */
  void expires_at(const time_point& expiry_time)
  {
    expiry_time_ = expiry_time;
  }

  /// Set the stream buffer's expiry time relative to now.
  /**
   * This function sets the expiry time associated with the stream. Stream
   * operations performed after this time (where the operations cannot be
   * completed using the internal buffers) will fail with the error
   * asio::error::operation_aborted.
   *
   * @param expiry_time The expiry time to be used for the timer.
   */
  void expires_after(const duration& expiry_time)
  {
    expiry_time_ = traits_helper::add(traits_helper::now(), expiry_time);
  }

protected:
  int_type underflow()
  {
#if defined(ASIO_WINDOWS_RUNTIME)
    ec_ = asio::error::operation_not_supported;
    return traits_type::eof();
#else // defined(ASIO_WINDOWS_RUNTIME)
    if (gptr() != egptr())
      return traits_type::eof();

    for (;;)
    {
      // Check if we are past the expiry time.
      if (traits_helper::less_than(expiry_time_, traits_helper::now()))
      {
        ec_ = asio::error::timed_out;
        return traits_type::eof();
      }

      // Try to complete the operation without blocking.
      if (!socket().native_non_blocking())
        socket().native_non_blocking(true, ec_);
      detail::buffer_sequence_adapter<mutable_buffer, mutable_buffer>
        bufs(asio::buffer(get_buffer_) + putback_max);
      detail::signed_size_type bytes = detail::socket_ops::recv(
          socket().native_handle(), bufs.buffers(), bufs.count(), 0, ec_);

      // Check if operation succeeded.
      if (bytes > 0)
      {
        setg(&get_buffer_[0], &get_buffer_[0] + putback_max,
            &get_buffer_[0] + putback_max + bytes);
        return traits_type::to_int_type(*gptr());
      }

      // Check for EOF.
      if (bytes == 0)
      {
        ec_ = asio::error::eof;
        return traits_type::eof();
      }

      // Operation failed.
      if (ec_ != asio::error::would_block
          && ec_ != asio::error::try_again)
        return traits_type::eof();

      // Wait for socket to become ready.
      if (detail::socket_ops::poll_read(
            socket().native_handle(), 0, timeout(), ec_) < 0)
        return traits_type::eof();
    }
#endif // defined(ASIO_WINDOWS_RUNTIME)
  }

  int_type overflow(int_type c)
  {
#if defined(ASIO_WINDOWS_RUNTIME)
    ec_ = asio::error::operation_not_supported;
    return traits_type::eof();
#else // defined(ASIO_WINDOWS_RUNTIME)
    char_type ch = traits_type::to_char_type(c);

    // Determine what needs to be sent.
    const_buffer output_buffer;
    if (put_buffer_.empty())
    {
      if (traits_type::eq_int_type(c, traits_type::eof()))
        return traits_type::not_eof(c); // Nothing to do.
      output_buffer = asio::buffer(&ch, sizeof(char_type));
    }
    else
    {
      output_buffer = asio::buffer(pbase(),
          (pptr() - pbase()) * sizeof(char_type));
    }

    while (output_buffer.size() > 0)
    {
      // Check if we are past the expiry time.
      if (traits_helper::less_than(expiry_time_, traits_helper::now()))
      {
        ec_ = asio::error::timed_out;
        return traits_type::eof();
      }

      // Try to complete the operation without blocking.
      if (!socket().native_non_blocking())
        socket().native_non_blocking(true, ec_);
      detail::buffer_sequence_adapter<
        const_buffer, const_buffer> bufs(output_buffer);
      detail::signed_size_type bytes = detail::socket_ops::send(
          socket().native_handle(), bufs.buffers(), bufs.count(), 0, ec_);

      // Check if operation succeeded.
      if (bytes > 0)
      {
        output_buffer += static_cast<std::size_t>(bytes);
        continue;
      }

      // Operation failed.
      if (ec_ != asio::error::would_block
          && ec_ != asio::error::try_again)
        return traits_type::eof();

      // Wait for socket to become ready.
      if (detail::socket_ops::poll_write(
            socket().native_handle(), 0, timeout(), ec_) < 0)
        return traits_type::eof();
    }

    if (!put_buffer_.empty())
    {
      setp(&put_buffer_[0], &put_buffer_[0] + put_buffer_.size());

      // If the new character is eof then our work here is done.
      if (traits_type::eq_int_type(c, traits_type::eof()))
        return traits_type::not_eof(c);

      // Add the new character to the output buffer.
      *pptr() = ch;
      pbump(1);
    }

    return c;
#endif // defined(ASIO_WINDOWS_RUNTIME)
  }

  int sync()
  {
    return overflow(traits_type::eof());
  }

  std::streambuf* setbuf(char_type* s, std::streamsize n)
  {
    if (pptr() == pbase() && s == 0 && n == 0)
    {
      put_buffer_.clear();
      setp(0, 0);
      sync();
      return this;
    }

    return 0;
  }

private:
  // Disallow copying and assignment.
  basic_socket_streambuf(const basic_socket_streambuf&) = delete;
  basic_socket_streambuf& operator=(
      const basic_socket_streambuf&) = delete;

  void init_buffers()
  {
    setg(&get_buffer_[0],
        &get_buffer_[0] + putback_max,
        &get_buffer_[0] + putback_max);

    if (put_buffer_.empty())
      setp(0, 0);
    else
      setp(&put_buffer_[0], &put_buffer_[0] + put_buffer_.size());
  }

  int timeout() const
  {
    int64_t msec = traits_helper::to_posix_duration(
        traits_helper::subtract(expiry_time_,
          traits_helper::now())).total_milliseconds();
    if (msec > (std::numeric_limits<int>::max)())
      msec = (std::numeric_limits<int>::max)();
    else if (msec < 0)
      msec = 0;
    return static_cast<int>(msec);
  }

  template <typename EndpointSequence>
  void connect_to_endpoints(const EndpointSequence& endpoints)
  {
    this->connect_to_endpoints(endpoints.begin(), endpoints.end());
  }

  template <typename EndpointIterator>
  void connect_to_endpoints(EndpointIterator begin, EndpointIterator end)
  {
#if defined(ASIO_WINDOWS_RUNTIME)
    ec_ = asio::error::operation_not_supported;
#else // defined(ASIO_WINDOWS_RUNTIME)
    if (ec_)
      return;

    ec_ = asio::error::not_found;
    for (EndpointIterator i = begin; i != end; ++i)
    {
      // Check if we are past the expiry time.
      if (traits_helper::less_than(expiry_time_, traits_helper::now()))
      {
        ec_ = asio::error::timed_out;
        return;
      }

      // Close and reopen the socket.
      typename Protocol::endpoint ep(*i);
      socket().close(ec_);
      socket().open(ep.protocol(), ec_);
      if (ec_)
        continue;

      // Try to complete the operation without blocking.
      if (!socket().native_non_blocking())
        socket().native_non_blocking(true, ec_);
      detail::socket_ops::connect(socket().native_handle(),
          ep.data(), ep.size(), ec_);

      // Check if operation succeeded.
      if (!ec_)
        return;

      // Operation failed.
      if (ec_ != asio::error::in_progress
          && ec_ != asio::error::would_block)
        continue;

      // Wait for socket to become ready.
      if (detail::socket_ops::poll_connect(
            socket().native_handle(), timeout(), ec_) < 0)
        continue;

      // Get the error code from the connect operation.
      int connect_error = 0;
      size_t connect_error_len = sizeof(connect_error);
      if (detail::socket_ops::getsockopt(socket().native_handle(), 0,
            SOL_SOCKET, SO_ERROR, &connect_error, &connect_error_len, ec_)
          == detail::socket_error_retval)
        return;

      // Check the result of the connect operation.
      ec_ = asio::error_code(connect_error,
          asio::error::get_system_category());
      if (!ec_)
        return;
    }
#endif // defined(ASIO_WINDOWS_RUNTIME)
  }

  // Helper function to get the maximum expiry time.
  static time_point max_expiry_time()
  {
    return (time_point::max)();
  }

  enum { putback_max = 8 };
  asio::error_code ec_;
  time_point expiry_time_;
};

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // !defined(ASIO_NO_IOSTREAM)

#endif // ASIO_BASIC_SOCKET_STREAMBUF_HPP
