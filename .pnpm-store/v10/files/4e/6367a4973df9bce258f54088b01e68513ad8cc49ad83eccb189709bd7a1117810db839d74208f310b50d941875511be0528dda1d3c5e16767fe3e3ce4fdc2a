//
// connect.hpp
// ~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_CONNECT_HPP
#define ASIO_CONNECT_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/async_result.hpp"
#include "asio/basic_socket.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/error.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

namespace detail
{
  struct default_connect_condition;
  template <typename, typename> class initiate_async_range_connect;
  template <typename, typename> class initiate_async_iterator_connect;

  template <typename T, typename = void, typename = void>
  struct is_endpoint_sequence_helper : false_type
  {
  };

  template <typename T>
  struct is_endpoint_sequence_helper<T,
      void_t<
        decltype(declval<T>().begin())
      >,
      void_t<
        decltype(declval<T>().end())
      >
    > : true_type
  {
  };

  template <typename T, typename Iterator, typename = void>
  struct is_connect_condition_helper : false_type
  {
  };

  template <typename T, typename Iterator>
  struct is_connect_condition_helper<T, Iterator,
      enable_if_t<
        is_same<
          result_of_t<T(asio::error_code, Iterator)>,
          Iterator
        >::value
      >
    > : true_type
  {
  };

  template <typename T, typename Iterator>
  struct is_connect_condition_helper<T, Iterator,
      enable_if_t<
        is_same<
          result_of_t<T(asio::error_code,
            decltype(*declval<Iterator>()))>,
          bool
        >::value
      >
    > : true_type
  {
  };

  struct default_connect_condition
  {
    template <typename Endpoint>
    bool operator()(const asio::error_code&, const Endpoint&)
    {
      return true;
    }
  };
} // namespace detail

#if defined(GENERATING_DOCUMENTATION)

/// Type trait used to determine whether a type is an endpoint sequence that can
/// be used with with @c connect and @c async_connect.
template <typename T>
struct is_endpoint_sequence
{
  /// The value member is true if the type may be used as an endpoint sequence.
  static const bool value = automatically_determined;
};

/// Trait for determining whether a function object is a connect condition that
/// can be used with @c connect and @c async_connect.
template <typename T, typename Iterator>
struct is_connect_condition
{
  /// The value member is true if the type may be used as a connect condition.
  static constexpr bool value = automatically_determined;
};

#else // defined(GENERATING_DOCUMENTATION)

template <typename T>
struct is_endpoint_sequence : detail::is_endpoint_sequence_helper<T>
{
};

template <typename T, typename Iterator>
struct is_connect_condition : detail::is_connect_condition_helper<T, Iterator>
{
};

#endif // defined(GENERATING_DOCUMENTATION)

/**
 * @defgroup connect asio::connect
 *
 * @brief The @c connect function is a composed operation that establishes a
 * socket connection by trying each endpoint in a sequence.
 */
/*@{*/

/// Establishes a socket connection by trying each endpoint in a sequence.
/**
 * This function attempts to connect a socket to one of a sequence of
 * endpoints. It does this by repeated calls to the socket's @c connect member
 * function, once for each endpoint in the sequence, until a connection is
 * successfully established.
 *
 * @param s The socket to be connected. If the socket is already open, it will
 * be closed.
 *
 * @param endpoints A sequence of endpoints.
 *
 * @returns The successfully connected endpoint.
 *
 * @throws asio::system_error Thrown on failure. If the sequence is
 * empty, the associated @c error_code is asio::error::not_found.
 * Otherwise, contains the error from the last connection attempt.
 *
 * @par Example
 * @code tcp::resolver r(my_context);
 * tcp::resolver::query q("host", "service");
 * tcp::socket s(my_context);
 * asio::connect(s, r.resolve(q)); @endcode
 */
template <typename Protocol, typename Executor, typename EndpointSequence>
typename Protocol::endpoint connect(basic_socket<Protocol, Executor>& s,
    const EndpointSequence& endpoints,
    constraint_t<
      is_endpoint_sequence<EndpointSequence>::value
    > = 0);

/// Establishes a socket connection by trying each endpoint in a sequence.
/**
 * This function attempts to connect a socket to one of a sequence of
 * endpoints. It does this by repeated calls to the socket's @c connect member
 * function, once for each endpoint in the sequence, until a connection is
 * successfully established.
 *
 * @param s The socket to be connected. If the socket is already open, it will
 * be closed.
 *
 * @param endpoints A sequence of endpoints.
 *
 * @param ec Set to indicate what error occurred, if any. If the sequence is
 * empty, set to asio::error::not_found. Otherwise, contains the error
 * from the last connection attempt.
 *
 * @returns On success, the successfully connected endpoint. Otherwise, a
 * default-constructed endpoint.
 *
 * @par Example
 * @code tcp::resolver r(my_context);
 * tcp::resolver::query q("host", "service");
 * tcp::socket s(my_context);
 * asio::error_code ec;
 * asio::connect(s, r.resolve(q), ec);
 * if (ec)
 * {
 *   // An error occurred.
 * } @endcode
 */
template <typename Protocol, typename Executor, typename EndpointSequence>
typename Protocol::endpoint connect(basic_socket<Protocol, Executor>& s,
    const EndpointSequence& endpoints, asio::error_code& ec,
    constraint_t<
      is_endpoint_sequence<EndpointSequence>::value
    > = 0);

/// Establishes a socket connection by trying each endpoint in a sequence.
/**
 * This function attempts to connect a socket to one of a sequence of
 * endpoints. It does this by repeated calls to the socket's @c connect member
 * function, once for each endpoint in the sequence, until a connection is
 * successfully established.
 *
 * @param s The socket to be connected. If the socket is already open, it will
 * be closed.
 *
 * @param begin An iterator pointing to the start of a sequence of endpoints.
 *
 * @param end An iterator pointing to the end of a sequence of endpoints.
 *
 * @returns An iterator denoting the successfully connected endpoint.
 *
 * @throws asio::system_error Thrown on failure. If the sequence is
 * empty, the associated @c error_code is asio::error::not_found.
 * Otherwise, contains the error from the last connection attempt.
 *
 * @par Example
 * @code tcp::resolver r(my_context);
 * tcp::resolver::query q("host", "service");
 * tcp::resolver::results_type e = r.resolve(q);
 * tcp::socket s(my_context);
 * asio::connect(s, e.begin(), e.end()); @endcode
 */
template <typename Protocol, typename Executor, typename Iterator>
Iterator connect(basic_socket<Protocol, Executor>& s,
    Iterator begin, Iterator end);

/// Establishes a socket connection by trying each endpoint in a sequence.
/**
 * This function attempts to connect a socket to one of a sequence of
 * endpoints. It does this by repeated calls to the socket's @c connect member
 * function, once for each endpoint in the sequence, until a connection is
 * successfully established.
 *
 * @param s The socket to be connected. If the socket is already open, it will
 * be closed.
 *
 * @param begin An iterator pointing to the start of a sequence of endpoints.
 *
 * @param end An iterator pointing to the end of a sequence of endpoints.
 *
 * @param ec Set to indicate what error occurred, if any. If the sequence is
 * empty, set to asio::error::not_found. Otherwise, contains the error
 * from the last connection attempt.
 *
 * @returns On success, an iterator denoting the successfully connected
 * endpoint. Otherwise, the end iterator.
 *
 * @par Example
 * @code tcp::resolver r(my_context);
 * tcp::resolver::query q("host", "service");
 * tcp::resolver::results_type e = r.resolve(q);
 * tcp::socket s(my_context);
 * asio::error_code ec;
 * asio::connect(s, e.begin(), e.end(), ec);
 * if (ec)
 * {
 *   // An error occurred.
 * } @endcode
 */
template <typename Protocol, typename Executor, typename Iterator>
Iterator connect(basic_socket<Protocol, Executor>& s,
    Iterator begin, Iterator end, asio::error_code& ec);

/// Establishes a socket connection by trying each endpoint in a sequence.
/**
 * This function attempts to connect a socket to one of a sequence of
 * endpoints. It does this by repeated calls to the socket's @c connect member
 * function, once for each endpoint in the sequence, until a connection is
 * successfully established.
 *
 * @param s The socket to be connected. If the socket is already open, it will
 * be closed.
 *
 * @param endpoints A sequence of endpoints.
 *
 * @param connect_condition A function object that is called prior to each
 * connection attempt. The signature of the function object must be:
 * @code bool connect_condition(
 *     const asio::error_code& ec,
 *     const typename Protocol::endpoint& next); @endcode
 * The @c ec parameter contains the result from the most recent connect
 * operation. Before the first connection attempt, @c ec is always set to
 * indicate success. The @c next parameter is the next endpoint to be tried.
 * The function object should return true if the next endpoint should be tried,
 * and false if it should be skipped.
 *
 * @returns The successfully connected endpoint.
 *
 * @throws asio::system_error Thrown on failure. If the sequence is
 * empty, the associated @c error_code is asio::error::not_found.
 * Otherwise, contains the error from the last connection attempt.
 *
 * @par Example
 * The following connect condition function object can be used to output
 * information about the individual connection attempts:
 * @code struct my_connect_condition
 * {
 *   bool operator()(
 *       const asio::error_code& ec,
 *       const::tcp::endpoint& next)
 *   {
 *     if (ec) std::cout << "Error: " << ec.message() << std::endl;
 *     std::cout << "Trying: " << next << std::endl;
 *     return true;
 *   }
 * }; @endcode
 * It would be used with the asio::connect function as follows:
 * @code tcp::resolver r(my_context);
 * tcp::resolver::query q("host", "service");
 * tcp::socket s(my_context);
 * tcp::endpoint e = asio::connect(s,
 *     r.resolve(q), my_connect_condition());
 * std::cout << "Connected to: " << e << std::endl; @endcode
 */
template <typename Protocol, typename Executor,
    typename EndpointSequence, typename ConnectCondition>
typename Protocol::endpoint connect(basic_socket<Protocol, Executor>& s,
    const EndpointSequence& endpoints, ConnectCondition connect_condition,
    constraint_t<
      is_endpoint_sequence<EndpointSequence>::value
    > = 0,
    constraint_t<
      is_connect_condition<ConnectCondition,
        decltype(declval<const EndpointSequence&>().begin())>::value
    > = 0);

/// Establishes a socket connection by trying each endpoint in a sequence.
/**
 * This function attempts to connect a socket to one of a sequence of
 * endpoints. It does this by repeated calls to the socket's @c connect member
 * function, once for each endpoint in the sequence, until a connection is
 * successfully established.
 *
 * @param s The socket to be connected. If the socket is already open, it will
 * be closed.
 *
 * @param endpoints A sequence of endpoints.
 *
 * @param connect_condition A function object that is called prior to each
 * connection attempt. The signature of the function object must be:
 * @code bool connect_condition(
 *     const asio::error_code& ec,
 *     const typename Protocol::endpoint& next); @endcode
 * The @c ec parameter contains the result from the most recent connect
 * operation. Before the first connection attempt, @c ec is always set to
 * indicate success. The @c next parameter is the next endpoint to be tried.
 * The function object should return true if the next endpoint should be tried,
 * and false if it should be skipped.
 *
 * @param ec Set to indicate what error occurred, if any. If the sequence is
 * empty, set to asio::error::not_found. Otherwise, contains the error
 * from the last connection attempt.
 *
 * @returns On success, the successfully connected endpoint. Otherwise, a
 * default-constructed endpoint.
 *
 * @par Example
 * The following connect condition function object can be used to output
 * information about the individual connection attempts:
 * @code struct my_connect_condition
 * {
 *   bool operator()(
 *       const asio::error_code& ec,
 *       const::tcp::endpoint& next)
 *   {
 *     if (ec) std::cout << "Error: " << ec.message() << std::endl;
 *     std::cout << "Trying: " << next << std::endl;
 *     return true;
 *   }
 * }; @endcode
 * It would be used with the asio::connect function as follows:
 * @code tcp::resolver r(my_context);
 * tcp::resolver::query q("host", "service");
 * tcp::socket s(my_context);
 * asio::error_code ec;
 * tcp::endpoint e = asio::connect(s,
 *     r.resolve(q), my_connect_condition(), ec);
 * if (ec)
 * {
 *   // An error occurred.
 * }
 * else
 * {
 *   std::cout << "Connected to: " << e << std::endl;
 * } @endcode
 */
template <typename Protocol, typename Executor,
    typename EndpointSequence, typename ConnectCondition>
typename Protocol::endpoint connect(basic_socket<Protocol, Executor>& s,
    const EndpointSequence& endpoints, ConnectCondition connect_condition,
    asio::error_code& ec,
    constraint_t<
      is_endpoint_sequence<EndpointSequence>::value
    > = 0,
    constraint_t<
      is_connect_condition<ConnectCondition,
        decltype(declval<const EndpointSequence&>().begin())>::value
    > = 0);

/// Establishes a socket connection by trying each endpoint in a sequence.
/**
 * This function attempts to connect a socket to one of a sequence of
 * endpoints. It does this by repeated calls to the socket's @c connect member
 * function, once for each endpoint in the sequence, until a connection is
 * successfully established.
 *
 * @param s The socket to be connected. If the socket is already open, it will
 * be closed.
 *
 * @param begin An iterator pointing to the start of a sequence of endpoints.
 *
 * @param end An iterator pointing to the end of a sequence of endpoints.
 *
 * @param connect_condition A function object that is called prior to each
 * connection attempt. The signature of the function object must be:
 * @code bool connect_condition(
 *     const asio::error_code& ec,
 *     const typename Protocol::endpoint& next); @endcode
 * The @c ec parameter contains the result from the most recent connect
 * operation. Before the first connection attempt, @c ec is always set to
 * indicate success. The @c next parameter is the next endpoint to be tried.
 * The function object should return true if the next endpoint should be tried,
 * and false if it should be skipped.
 *
 * @returns An iterator denoting the successfully connected endpoint.
 *
 * @throws asio::system_error Thrown on failure. If the sequence is
 * empty, the associated @c error_code is asio::error::not_found.
 * Otherwise, contains the error from the last connection attempt.
 *
 * @par Example
 * The following connect condition function object can be used to output
 * information about the individual connection attempts:
 * @code struct my_connect_condition
 * {
 *   bool operator()(
 *       const asio::error_code& ec,
 *       const::tcp::endpoint& next)
 *   {
 *     if (ec) std::cout << "Error: " << ec.message() << std::endl;
 *     std::cout << "Trying: " << next << std::endl;
 *     return true;
 *   }
 * }; @endcode
 * It would be used with the asio::connect function as follows:
 * @code tcp::resolver r(my_context);
 * tcp::resolver::query q("host", "service");
 * tcp::resolver::results_type e = r.resolve(q);
 * tcp::socket s(my_context);
 * tcp::resolver::results_type::iterator i = asio::connect(
 *     s, e.begin(), e.end(), my_connect_condition());
 * std::cout << "Connected to: " << i->endpoint() << std::endl; @endcode
 */
template <typename Protocol, typename Executor,
    typename Iterator, typename ConnectCondition>
Iterator connect(basic_socket<Protocol, Executor>& s, Iterator begin,
    Iterator end, ConnectCondition connect_condition,
    constraint_t<
      is_connect_condition<ConnectCondition, Iterator>::value
    > = 0);

/// Establishes a socket connection by trying each endpoint in a sequence.
/**
 * This function attempts to connect a socket to one of a sequence of
 * endpoints. It does this by repeated calls to the socket's @c connect member
 * function, once for each endpoint in the sequence, until a connection is
 * successfully established.
 *
 * @param s The socket to be connected. If the socket is already open, it will
 * be closed.
 *
 * @param begin An iterator pointing to the start of a sequence of endpoints.
 *
 * @param end An iterator pointing to the end of a sequence of endpoints.
 *
 * @param connect_condition A function object that is called prior to each
 * connection attempt. The signature of the function object must be:
 * @code bool connect_condition(
 *     const asio::error_code& ec,
 *     const typename Protocol::endpoint& next); @endcode
 * The @c ec parameter contains the result from the most recent connect
 * operation. Before the first connection attempt, @c ec is always set to
 * indicate success. The @c next parameter is the next endpoint to be tried.
 * The function object should return true if the next endpoint should be tried,
 * and false if it should be skipped.
 *
 * @param ec Set to indicate what error occurred, if any. If the sequence is
 * empty, set to asio::error::not_found. Otherwise, contains the error
 * from the last connection attempt.
 *
 * @returns On success, an iterator denoting the successfully connected
 * endpoint. Otherwise, the end iterator.
 *
 * @par Example
 * The following connect condition function object can be used to output
 * information about the individual connection attempts:
 * @code struct my_connect_condition
 * {
 *   bool operator()(
 *       const asio::error_code& ec,
 *       const::tcp::endpoint& next)
 *   {
 *     if (ec) std::cout << "Error: " << ec.message() << std::endl;
 *     std::cout << "Trying: " << next << std::endl;
 *     return true;
 *   }
 * }; @endcode
 * It would be used with the asio::connect function as follows:
 * @code tcp::resolver r(my_context);
 * tcp::resolver::query q("host", "service");
 * tcp::resolver::results_type e = r.resolve(q);
 * tcp::socket s(my_context);
 * asio::error_code ec;
 * tcp::resolver::results_type::iterator i = asio::connect(
 *     s, e.begin(), e.end(), my_connect_condition());
 * if (ec)
 * {
 *   // An error occurred.
 * }
 * else
 * {
 *   std::cout << "Connected to: " << i->endpoint() << std::endl;
 * } @endcode
 */
template <typename Protocol, typename Executor,
    typename Iterator, typename ConnectCondition>
Iterator connect(basic_socket<Protocol, Executor>& s,
    Iterator begin, Iterator end, ConnectCondition connect_condition,
    asio::error_code& ec,
    constraint_t<
      is_connect_condition<ConnectCondition, Iterator>::value
    > = 0);

/*@}*/

/**
 * @defgroup async_connect asio::async_connect
 *
 * @brief The @c async_connect function is a composed asynchronous operation
 * that establishes a socket connection by trying each endpoint in a sequence.
 */
/*@{*/

/// Asynchronously establishes a socket connection by trying each endpoint in a
/// sequence.
/**
 * This function attempts to connect a socket to one of a sequence of
 * endpoints. It does this by repeated calls to the socket's @c async_connect
 * member function, once for each endpoint in the sequence, until a connection
 * is successfully established. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately.
 *
 * @param s The socket to be connected. If the socket is already open, it will
 * be closed.
 *
 * @param endpoints A sequence of endpoints.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler, which will be called when the connect completes.
 * Potential completion tokens include @ref use_future, @ref use_awaitable,
 * @ref yield_context, or a function object with the correct completion
 * signature. The function signature of the completion handler must be:
 * @code void handler(
 *   // Result of operation. if the sequence is empty, set to
 *   // asio::error::not_found. Otherwise, contains the
 *   // error from the last connection attempt.
 *   const asio::error_code& error,
 *
 *   // On success, the successfully connected endpoint.
 *   // Otherwise, a default-constructed endpoint.
 *   const typename Protocol::endpoint& endpoint
 * ); @endcode
 * Regardless of whether the asynchronous operation completes immediately or
 * not, the completion handler will not be invoked from within this function.
 * On immediate completion, invocation of the handler will be performed in a
 * manner equivalent to using asio::async_immediate().
 *
 * @par Completion Signature
 * @code void(asio::error_code, typename Protocol::endpoint) @endcode
 *
 * @par Example
 * @code tcp::resolver r(my_context);
 * tcp::resolver::query q("host", "service");
 * tcp::socket s(my_context);
 *
 * // ...
 *
 * r.async_resolve(q, resolve_handler);
 *
 * // ...
 *
 * void resolve_handler(
 *     const asio::error_code& ec,
 *     tcp::resolver::results_type results)
 * {
 *   if (!ec)
 *   {
 *     asio::async_connect(s, results, connect_handler);
 *   }
 * }
 *
 * // ...
 *
 * void connect_handler(
 *     const asio::error_code& ec,
 *     const tcp::endpoint& endpoint)
 * {
 *   // ...
 * } @endcode
 *
 * @par Per-Operation Cancellation
 * This asynchronous operation supports cancellation for the following
 * asio::cancellation_type values:
 *
 * @li @c cancellation_type::terminal
 *
 * @li @c cancellation_type::partial
 *
 * if they are also supported by the socket's @c async_connect operation.
 */
template <typename Protocol, typename Executor, typename EndpointSequence,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      typename Protocol::endpoint)) RangeConnectToken
        = default_completion_token_t<Executor>>
inline auto async_connect(basic_socket<Protocol, Executor>& s,
    const EndpointSequence& endpoints,
    RangeConnectToken&& token = default_completion_token_t<Executor>(),
    constraint_t<
      is_endpoint_sequence<EndpointSequence>::value
    > = 0,
    constraint_t<
      !is_connect_condition<RangeConnectToken,
        decltype(declval<const EndpointSequence&>().begin())>::value
    > = 0)
  -> decltype(
    async_initiate<RangeConnectToken,
      void (asio::error_code, typename Protocol::endpoint)>(
        declval<detail::initiate_async_range_connect<Protocol, Executor>>(),
        token, endpoints, declval<detail::default_connect_condition>()))
{
  return async_initiate<RangeConnectToken,
    void (asio::error_code, typename Protocol::endpoint)>(
      detail::initiate_async_range_connect<Protocol, Executor>(s),
      token, endpoints, detail::default_connect_condition());
}

/// Asynchronously establishes a socket connection by trying each endpoint in a
/// sequence.
/**
 * This function attempts to connect a socket to one of a sequence of
 * endpoints. It does this by repeated calls to the socket's @c async_connect
 * member function, once for each endpoint in the sequence, until a connection
 * is successfully established. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately.
 *
 * @param s The socket to be connected. If the socket is already open, it will
 * be closed.
 *
 * @param begin An iterator pointing to the start of a sequence of endpoints.
 *
 * @param end An iterator pointing to the end of a sequence of endpoints.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler, which will be called when the connect completes.
 * Potential completion tokens include @ref use_future, @ref use_awaitable,
 * @ref yield_context, or a function object with the correct completion
 * signature. The function signature of the completion handler must be:
 * @code void handler(
 *   // Result of operation. if the sequence is empty, set to
 *   // asio::error::not_found. Otherwise, contains the
 *   // error from the last connection attempt.
 *   const asio::error_code& error,
 *
 *   // On success, an iterator denoting the successfully
 *   // connected endpoint. Otherwise, the end iterator.
 *   Iterator iterator
 * ); @endcode
 * Regardless of whether the asynchronous operation completes immediately or
 * not, the completion handler will not be invoked from within this function.
 * On immediate completion, invocation of the handler will be performed in a
 * manner equivalent to using asio::async_immediate().
 *
 * @par Completion Signature
 * @code void(asio::error_code, Iterator) @endcode
 *
 * @par Example
 * @code std::vector<tcp::endpoint> endpoints = ...;
 * tcp::socket s(my_context);
 * asio::async_connect(s,
 *     endpoints.begin(), endpoints.end(),
 *     connect_handler);
 *
 * // ...
 *
 * void connect_handler(
 *     const asio::error_code& ec,
 *     std::vector<tcp::endpoint>::iterator i)
 * {
 *   // ...
 * } @endcode
 *
 * @par Per-Operation Cancellation
 * This asynchronous operation supports cancellation for the following
 * asio::cancellation_type values:
 *
 * @li @c cancellation_type::terminal
 *
 * @li @c cancellation_type::partial
 *
 * if they are also supported by the socket's @c async_connect operation.
 */
template <typename Protocol, typename Executor, typename Iterator,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      Iterator)) IteratorConnectToken = default_completion_token_t<Executor>>
inline auto async_connect(
    basic_socket<Protocol, Executor>& s, Iterator begin, Iterator end,
    IteratorConnectToken&& token = default_completion_token_t<Executor>(),
    constraint_t<
      !is_connect_condition<IteratorConnectToken, Iterator>::value
    > = 0)
  -> decltype(
    async_initiate<IteratorConnectToken,
      void (asio::error_code, Iterator)>(
        declval<detail::initiate_async_iterator_connect<Protocol, Executor>>(),
        token, begin, end, declval<detail::default_connect_condition>()))
{
  return async_initiate<IteratorConnectToken,
    void (asio::error_code, Iterator)>(
      detail::initiate_async_iterator_connect<Protocol, Executor>(s),
      token, begin, end, detail::default_connect_condition());
}

/// Asynchronously establishes a socket connection by trying each endpoint in a
/// sequence.
/**
 * This function attempts to connect a socket to one of a sequence of
 * endpoints. It does this by repeated calls to the socket's @c async_connect
 * member function, once for each endpoint in the sequence, until a connection
 * is successfully established. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately.
 *
 * @param s The socket to be connected. If the socket is already open, it will
 * be closed.
 *
 * @param endpoints A sequence of endpoints.
 *
 * @param connect_condition A function object that is called prior to each
 * connection attempt. The signature of the function object must be:
 * @code bool connect_condition(
 *     const asio::error_code& ec,
 *     const typename Protocol::endpoint& next); @endcode
 * The @c ec parameter contains the result from the most recent connect
 * operation. Before the first connection attempt, @c ec is always set to
 * indicate success. The @c next parameter is the next endpoint to be tried.
 * The function object should return true if the next endpoint should be tried,
 * and false if it should be skipped.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler, which will be called when the connect completes.
 * Potential completion tokens include @ref use_future, @ref use_awaitable,
 * @ref yield_context, or a function object with the correct completion
 * signature. The function signature of the completion handler must be:
 * @code void handler(
 *   // Result of operation. if the sequence is empty, set to
 *   // asio::error::not_found. Otherwise, contains the
 *   // error from the last connection attempt.
 *   const asio::error_code& error,
 *
 *   // On success, an iterator denoting the successfully
 *   // connected endpoint. Otherwise, the end iterator.
 *   Iterator iterator
 * ); @endcode
 * Regardless of whether the asynchronous operation completes immediately or
 * not, the completion handler will not be invoked from within this function.
 * On immediate completion, invocation of the handler will be performed in a
 * manner equivalent to using asio::async_immediate().
 *
 * @par Completion Signature
 * @code void(asio::error_code, typename Protocol::endpoint) @endcode
 *
 * @par Example
 * The following connect condition function object can be used to output
 * information about the individual connection attempts:
 * @code struct my_connect_condition
 * {
 *   bool operator()(
 *       const asio::error_code& ec,
 *       const::tcp::endpoint& next)
 *   {
 *     if (ec) std::cout << "Error: " << ec.message() << std::endl;
 *     std::cout << "Trying: " << next << std::endl;
 *     return true;
 *   }
 * }; @endcode
 * It would be used with the asio::connect function as follows:
 * @code tcp::resolver r(my_context);
 * tcp::resolver::query q("host", "service");
 * tcp::socket s(my_context);
 *
 * // ...
 *
 * r.async_resolve(q, resolve_handler);
 *
 * // ...
 *
 * void resolve_handler(
 *     const asio::error_code& ec,
 *     tcp::resolver::results_type results)
 * {
 *   if (!ec)
 *   {
 *     asio::async_connect(s, results,
 *         my_connect_condition(),
 *         connect_handler);
 *   }
 * }
 *
 * // ...
 *
 * void connect_handler(
 *     const asio::error_code& ec,
 *     const tcp::endpoint& endpoint)
 * {
 *   if (ec)
 *   {
 *     // An error occurred.
 *   }
 *   else
 *   {
 *     std::cout << "Connected to: " << endpoint << std::endl;
 *   }
 * } @endcode
 *
 * @par Per-Operation Cancellation
 * This asynchronous operation supports cancellation for the following
 * asio::cancellation_type values:
 *
 * @li @c cancellation_type::terminal
 *
 * @li @c cancellation_type::partial
 *
 * if they are also supported by the socket's @c async_connect operation.
 */
template <typename Protocol, typename Executor,
    typename EndpointSequence, typename ConnectCondition,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      typename Protocol::endpoint)) RangeConnectToken
        = default_completion_token_t<Executor>>
inline auto async_connect(basic_socket<Protocol, Executor>& s,
    const EndpointSequence& endpoints, ConnectCondition connect_condition,
    RangeConnectToken&& token = default_completion_token_t<Executor>(),
    constraint_t<
      is_endpoint_sequence<EndpointSequence>::value
    > = 0,
    constraint_t<
      is_connect_condition<ConnectCondition,
        decltype(declval<const EndpointSequence&>().begin())>::value
    > = 0)
  -> decltype(
    async_initiate<RangeConnectToken,
      void (asio::error_code, typename Protocol::endpoint)>(
        declval<detail::initiate_async_range_connect<Protocol, Executor>>(),
        token, endpoints, connect_condition))
{
  return async_initiate<RangeConnectToken,
    void (asio::error_code, typename Protocol::endpoint)>(
      detail::initiate_async_range_connect<Protocol, Executor>(s),
      token, endpoints, connect_condition);
}

/// Asynchronously establishes a socket connection by trying each endpoint in a
/// sequence.
/**
 * This function attempts to connect a socket to one of a sequence of
 * endpoints. It does this by repeated calls to the socket's @c async_connect
 * member function, once for each endpoint in the sequence, until a connection
 * is successfully established. It is an initiating function for an @ref
 * asynchronous_operation, and always returns immediately.
 *
 * @param s The socket to be connected. If the socket is already open, it will
 * be closed.
 *
 * @param begin An iterator pointing to the start of a sequence of endpoints.
 *
 * @param end An iterator pointing to the end of a sequence of endpoints.
 *
 * @param connect_condition A function object that is called prior to each
 * connection attempt. The signature of the function object must be:
 * @code bool connect_condition(
 *     const asio::error_code& ec,
 *     const typename Protocol::endpoint& next); @endcode
 * The @c ec parameter contains the result from the most recent connect
 * operation. Before the first connection attempt, @c ec is always set to
 * indicate success. The @c next parameter is the next endpoint to be tried.
 * The function object should return true if the next endpoint should be tried,
 * and false if it should be skipped.
 *
 * @param token The @ref completion_token that will be used to produce a
 * completion handler, which will be called when the connect completes.
 * Potential completion tokens include @ref use_future, @ref use_awaitable,
 * @ref yield_context, or a function object with the correct completion
 * signature. The function signature of the completion handler must be:
 * @code void handler(
 *   // Result of operation. if the sequence is empty, set to
 *   // asio::error::not_found. Otherwise, contains the
 *   // error from the last connection attempt.
 *   const asio::error_code& error,
 *
 *   // On success, an iterator denoting the successfully
 *   // connected endpoint. Otherwise, the end iterator.
 *   Iterator iterator
 * ); @endcode
 * Regardless of whether the asynchronous operation completes immediately or
 * not, the completion handler will not be invoked from within this function.
 * On immediate completion, invocation of the handler will be performed in a
 * manner equivalent to using asio::async_immediate().
 *
 * @par Completion Signature
 * @code void(asio::error_code, Iterator) @endcode
 *
 * @par Example
 * The following connect condition function object can be used to output
 * information about the individual connection attempts:
 * @code struct my_connect_condition
 * {
 *   bool operator()(
 *       const asio::error_code& ec,
 *       const::tcp::endpoint& next)
 *   {
 *     if (ec) std::cout << "Error: " << ec.message() << std::endl;
 *     std::cout << "Trying: " << next << std::endl;
 *     return true;
 *   }
 * }; @endcode
 * It would be used with the asio::connect function as follows:
 * @code tcp::resolver r(my_context);
 * tcp::resolver::query q("host", "service");
 * tcp::socket s(my_context);
 *
 * // ...
 *
 * r.async_resolve(q, resolve_handler);
 *
 * // ...
 *
 * void resolve_handler(
 *     const asio::error_code& ec,
 *     tcp::resolver::iterator i)
 * {
 *   if (!ec)
 *   {
 *     tcp::resolver::iterator end;
 *     asio::async_connect(s, i, end,
 *         my_connect_condition(),
 *         connect_handler);
 *   }
 * }
 *
 * // ...
 *
 * void connect_handler(
 *     const asio::error_code& ec,
 *     tcp::resolver::iterator i)
 * {
 *   if (ec)
 *   {
 *     // An error occurred.
 *   }
 *   else
 *   {
 *     std::cout << "Connected to: " << i->endpoint() << std::endl;
 *   }
 * } @endcode
 *
 * @par Per-Operation Cancellation
 * This asynchronous operation supports cancellation for the following
 * asio::cancellation_type values:
 *
 * @li @c cancellation_type::terminal
 *
 * @li @c cancellation_type::partial
 *
 * if they are also supported by the socket's @c async_connect operation.
 */
template <typename Protocol, typename Executor,
    typename Iterator, typename ConnectCondition,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      Iterator)) IteratorConnectToken = default_completion_token_t<Executor>>
inline auto async_connect(basic_socket<Protocol, Executor>& s,
    Iterator begin, Iterator end, ConnectCondition connect_condition,
    IteratorConnectToken&& token = default_completion_token_t<Executor>(),
    constraint_t<
      is_connect_condition<ConnectCondition, Iterator>::value
    > = 0)
  -> decltype(
    async_initiate<IteratorConnectToken,
      void (asio::error_code, Iterator)>(
        declval<detail::initiate_async_iterator_connect<Protocol, Executor>>(),
        token, begin, end, connect_condition))
{
  return async_initiate<IteratorConnectToken,
    void (asio::error_code, Iterator)>(
      detail::initiate_async_iterator_connect<Protocol, Executor>(s),
      token, begin, end, connect_condition);
}

/*@}*/

} // namespace asio

#include "asio/detail/pop_options.hpp"

#include "asio/impl/connect.hpp"

#endif // ASIO_CONNECT_HPP
