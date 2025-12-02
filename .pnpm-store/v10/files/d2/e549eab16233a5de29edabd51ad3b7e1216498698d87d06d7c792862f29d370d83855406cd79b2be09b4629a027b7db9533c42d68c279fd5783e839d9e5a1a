//
// ts/netfwd.hpp
// ~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_TS_NETFWD_HPP
#define ASIO_TS_NETFWD_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/chrono.hpp"

#if !defined(ASIO_USE_TS_EXECUTOR_AS_DEFAULT)
#include "asio/execution/blocking.hpp"
#include "asio/execution/outstanding_work.hpp"
#include "asio/execution/relationship.hpp"
#endif // !defined(ASIO_USE_TS_EXECUTOR_AS_DEFAULT)

#if !defined(GENERATING_DOCUMENTATION)

#include "asio/detail/push_options.hpp"

namespace asio {

class execution_context;

template <typename T, typename Executor>
class executor_binder;

#if !defined(ASIO_EXECUTOR_WORK_GUARD_DECL)
#define ASIO_EXECUTOR_WORK_GUARD_DECL

template <typename Executor, typename = void, typename = void>
class executor_work_guard;

#endif // !defined(ASIO_EXECUTOR_WORK_GUARD_DECL)

template <typename Blocking, typename Relationship, typename Allocator>
class basic_system_executor;

#if defined(ASIO_USE_TS_EXECUTOR_AS_DEFAULT)

class executor;

typedef executor any_io_executor;

#else // defined(ASIO_USE_TS_EXECUTOR_AS_DEFAULT)

namespace execution {

#if !defined(ASIO_EXECUTION_ANY_EXECUTOR_FWD_DECL)
#define ASIO_EXECUTION_ANY_EXECUTOR_FWD_DECL

template <typename... SupportableProperties>
class any_executor;

#endif // !defined(ASIO_EXECUTION_ANY_EXECUTOR_FWD_DECL)

template <typename U>
struct context_as_t;

template <typename Property>
struct prefer_only;

} // namespace execution

class any_io_executor;

#endif // defined(ASIO_USE_TS_EXECUTOR_AS_DEFAULT)

template <typename Executor>
class strand;

class io_context;

template <typename Clock>
struct wait_traits;

#if !defined(ASIO_BASIC_WAITABLE_TIMER_FWD_DECL)
#define ASIO_BASIC_WAITABLE_TIMER_FWD_DECL

template <typename Clock,
    typename WaitTraits = wait_traits<Clock>,
    typename Executor = any_io_executor>
class basic_waitable_timer;

#endif // !defined(ASIO_BASIC_WAITABLE_TIMER_FWD_DECL)

typedef basic_waitable_timer<chrono::system_clock> system_timer;

typedef basic_waitable_timer<chrono::steady_clock> steady_timer;

typedef basic_waitable_timer<chrono::high_resolution_clock>
  high_resolution_timer;

#if !defined(ASIO_BASIC_SOCKET_FWD_DECL)
#define ASIO_BASIC_SOCKET_FWD_DECL

template <typename Protocol, typename Executor = any_io_executor>
class basic_socket;

#endif // !defined(ASIO_BASIC_SOCKET_FWD_DECL)

#if !defined(ASIO_BASIC_DATAGRAM_SOCKET_FWD_DECL)
#define ASIO_BASIC_DATAGRAM_SOCKET_FWD_DECL

template <typename Protocol, typename Executor = any_io_executor>
class basic_datagram_socket;

#endif // !defined(ASIO_BASIC_DATAGRAM_SOCKET_FWD_DECL)

#if !defined(ASIO_BASIC_STREAM_SOCKET_FWD_DECL)
#define ASIO_BASIC_STREAM_SOCKET_FWD_DECL

// Forward declaration with defaulted arguments.
template <typename Protocol, typename Executor = any_io_executor>
class basic_stream_socket;

#endif // !defined(ASIO_BASIC_STREAM_SOCKET_FWD_DECL)

#if !defined(ASIO_BASIC_SOCKET_ACCEPTOR_FWD_DECL)
#define ASIO_BASIC_SOCKET_ACCEPTOR_FWD_DECL

template <typename Protocol, typename Executor = any_io_executor>
class basic_socket_acceptor;

#endif // !defined(ASIO_BASIC_SOCKET_ACCEPTOR_FWD_DECL)

#if !defined(ASIO_BASIC_SOCKET_STREAMBUF_FWD_DECL)
#define ASIO_BASIC_SOCKET_STREAMBUF_FWD_DECL

// Forward declaration with defaulted arguments.
template <typename Protocol,
    typename Clock = chrono::steady_clock,
    typename WaitTraits = wait_traits<Clock>>
class basic_socket_streambuf;

#endif // !defined(ASIO_BASIC_SOCKET_STREAMBUF_FWD_DECL)

#if !defined(ASIO_BASIC_SOCKET_IOSTREAM_FWD_DECL)
#define ASIO_BASIC_SOCKET_IOSTREAM_FWD_DECL

// Forward declaration with defaulted arguments.
template <typename Protocol,
    typename Clock = chrono::steady_clock,
    typename WaitTraits = wait_traits<Clock>>
class basic_socket_iostream;

#endif // !defined(ASIO_BASIC_SOCKET_IOSTREAM_FWD_DECL)

namespace ip {

class address;

class address_v4;

class address_v6;

template <typename Address>
class basic_address_iterator;

typedef basic_address_iterator<address_v4> address_v4_iterator;

typedef basic_address_iterator<address_v6> address_v6_iterator;

template <typename Address>
class basic_address_range;

typedef basic_address_range<address_v4> address_v4_range;

typedef basic_address_range<address_v6> address_v6_range;

class network_v4;

class network_v6;

template <typename InternetProtocol>
class basic_endpoint;

template <typename InternetProtocol>
class basic_resolver_entry;

template <typename InternetProtocol>
class basic_resolver_results;

#if !defined(ASIO_IP_BASIC_RESOLVER_FWD_DECL)
#define ASIO_IP_BASIC_RESOLVER_FWD_DECL

template <typename InternetProtocol, typename Executor = any_io_executor>
class basic_resolver;

#endif // !defined(ASIO_IP_BASIC_RESOLVER_FWD_DECL)

class tcp;

class udp;

} // namespace ip
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // !defined(GENERATING_DOCUMENTATION)

#endif // ASIO_TS_NETFWD_HPP
