//
// basic_socket_iostream.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_BASIC_SOCKET_IOSTREAM_HPP
#define ASIO_BASIC_SOCKET_IOSTREAM_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if !defined(ASIO_NO_IOSTREAM)

#include <istream>
#include <ostream>
#include "asio/basic_socket_streambuf.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

// A separate base class is used to ensure that the streambuf is initialised
// prior to the basic_socket_iostream's basic_iostream base class.
template <typename Protocol, typename Clock, typename WaitTraits>
class socket_iostream_base
{
protected:
  socket_iostream_base()
  {
  }

  socket_iostream_base(socket_iostream_base&& other)
    : streambuf_(std::move(other.streambuf_))
  {
  }

  socket_iostream_base(basic_stream_socket<Protocol> s)
    : streambuf_(std::move(s))
  {
  }

  socket_iostream_base& operator=(socket_iostream_base&& other)
  {
    streambuf_ = std::move(other.streambuf_);
    return *this;
  }

  basic_socket_streambuf<Protocol, Clock, WaitTraits> streambuf_;
};

} // namespace detail

#if !defined(ASIO_BASIC_SOCKET_IOSTREAM_FWD_DECL)
#define ASIO_BASIC_SOCKET_IOSTREAM_FWD_DECL

// Forward declaration with defaulted arguments.
template <typename Protocol,
    typename Clock = chrono::steady_clock,
    typename WaitTraits = wait_traits<Clock>>
class basic_socket_iostream;

#endif // !defined(ASIO_BASIC_SOCKET_IOSTREAM_FWD_DECL)

/// Iostream interface for a socket.
#if defined(GENERATING_DOCUMENTATION)
template <typename Protocol,
    typename Clock = chrono::steady_clock,
    typename WaitTraits = wait_traits<Clock>>
#else // defined(GENERATING_DOCUMENTATION)
template <typename Protocol, typename Clock, typename WaitTraits>
#endif // defined(GENERATING_DOCUMENTATION)
class basic_socket_iostream
  : private detail::socket_iostream_base<Protocol, Clock, WaitTraits>,
    public std::basic_iostream<char>
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

  /// Construct a basic_socket_iostream without establishing a connection.
  basic_socket_iostream()
    : std::basic_iostream<char>(
        &this->detail::socket_iostream_base<
          Protocol, Clock, WaitTraits>::streambuf_)
  {
    this->setf(std::ios_base::unitbuf);
  }

  /// Construct a basic_socket_iostream from the supplied socket.
  explicit basic_socket_iostream(basic_stream_socket<protocol_type> s)
    : detail::socket_iostream_base<
        Protocol, Clock, WaitTraits>(std::move(s)),
      std::basic_iostream<char>(
        &this->detail::socket_iostream_base<
          Protocol, Clock, WaitTraits>::streambuf_)
  {
    this->setf(std::ios_base::unitbuf);
  }

  /// Move-construct a basic_socket_iostream from another.
  basic_socket_iostream(basic_socket_iostream&& other)
    : detail::socket_iostream_base<
        Protocol, Clock, WaitTraits>(std::move(other)),
      std::basic_iostream<char>(std::move(other))
  {
    this->set_rdbuf(&this->detail::socket_iostream_base<
          Protocol, Clock, WaitTraits>::streambuf_);
  }

  /// Move-assign a basic_socket_iostream from another.
  basic_socket_iostream& operator=(basic_socket_iostream&& other)
  {
    std::basic_iostream<char>::operator=(std::move(other));
    detail::socket_iostream_base<
        Protocol, Clock, WaitTraits>::operator=(std::move(other));
    return *this;
  }

  /// Establish a connection to an endpoint corresponding to a resolver query.
  /**
   * This constructor automatically establishes a connection based on the
   * supplied resolver query parameters. The arguments are used to construct
   * a resolver query object.
   */
  template <typename... T>
  explicit basic_socket_iostream(T... x)
    : std::basic_iostream<char>(
        &this->detail::socket_iostream_base<
          Protocol, Clock, WaitTraits>::streambuf_)
  {
    this->setf(std::ios_base::unitbuf);
    if (rdbuf()->connect(x...) == 0)
      this->setstate(std::ios_base::failbit);
  }

  /// Establish a connection to an endpoint corresponding to a resolver query.
  /**
   * This function automatically establishes a connection based on the supplied
   * resolver query parameters. The arguments are used to construct a resolver
   * query object.
   */
  template <typename... T>
  void connect(T... x)
  {
    if (rdbuf()->connect(x...) == 0)
      this->setstate(std::ios_base::failbit);
  }

  /// Close the connection.
  void close()
  {
    if (rdbuf()->close() == 0)
      this->setstate(std::ios_base::failbit);
  }

  /// Return a pointer to the underlying streambuf.
  basic_socket_streambuf<Protocol, Clock, WaitTraits>* rdbuf() const
  {
    return const_cast<basic_socket_streambuf<Protocol, Clock, WaitTraits>*>(
        &this->detail::socket_iostream_base<
          Protocol, Clock, WaitTraits>::streambuf_);
  }

  /// Get a reference to the underlying socket.
  basic_socket<Protocol>& socket()
  {
    return rdbuf()->socket();
  }

  /// Get the last error associated with the stream.
  /**
   * @return An \c error_code corresponding to the last error from the stream.
   *
   * @par Example
   * To print the error associated with a failure to establish a connection:
   * @code tcp::iostream s("www.boost.org", "http");
   * if (!s)
   * {
   *   std::cout << "Error: " << s.error().message() << std::endl;
   * } @endcode
   */
  const asio::error_code& error() const
  {
    return rdbuf()->error();
  }

  /// Get the stream's expiry time as an absolute time.
  /**
   * @return An absolute time value representing the stream's expiry time.
   */
  time_point expiry() const
  {
    return rdbuf()->expiry();
  }

  /// Set the stream's expiry time as an absolute time.
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
    rdbuf()->expires_at(expiry_time);
  }

  /// Set the stream's expiry time relative to now.
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
    rdbuf()->expires_after(expiry_time);
  }

private:
  // Disallow copying and assignment.
  basic_socket_iostream(const basic_socket_iostream&) = delete;
  basic_socket_iostream& operator=(
      const basic_socket_iostream&) = delete;
};

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // !defined(ASIO_NO_IOSTREAM)

#endif // ASIO_BASIC_SOCKET_IOSTREAM_HPP
