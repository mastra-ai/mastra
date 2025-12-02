//
// ip/basic_resolver.hpp
// ~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IP_BASIC_RESOLVER_HPP
#define ASIO_IP_BASIC_RESOLVER_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <string>
#include <utility>
#include "asio/any_io_executor.hpp"
#include "asio/async_result.hpp"
#include "asio/detail/handler_type_requirements.hpp"
#include "asio/detail/io_object_impl.hpp"
#include "asio/detail/non_const_lvalue.hpp"
#include "asio/detail/string_view.hpp"
#include "asio/detail/throw_error.hpp"
#include "asio/error.hpp"
#include "asio/execution_context.hpp"
#include "asio/ip/basic_resolver_iterator.hpp"
#include "asio/ip/basic_resolver_query.hpp"
#include "asio/ip/basic_resolver_results.hpp"
#include "asio/ip/resolver_base.hpp"
#if defined(ASIO_WINDOWS_RUNTIME)
# include "asio/detail/winrt_resolver_service.hpp"
#else
# include "asio/detail/resolver_service.hpp"
#endif

#include "asio/detail/push_options.hpp"

namespace asio {
namespace ip {

#if !defined(ASIO_IP_BASIC_RESOLVER_FWD_DECL)
#define ASIO_IP_BASIC_RESOLVER_FWD_DECL

// Forward declaration with defaulted arguments.
template <typename InternetProtocol, typename Executor = any_io_executor>
class basic_resolver;

#endif // !defined(ASIO_IP_BASIC_RESOLVER_FWD_DECL)

/// Provides endpoint resolution functionality.
/**
 * The basic_resolver class template provides the ability to resolve a query
 * to a list of endpoints.
 *
 * @par Thread Safety
 * @e Distinct @e objects: Safe.@n
 * @e Shared @e objects: Unsafe.
 */
template <typename InternetProtocol, typename Executor>
class basic_resolver
  : public resolver_base
{
private:
  class initiate_async_resolve;

public:
  /// The type of the executor associated with the object.
  typedef Executor executor_type;

  /// Rebinds the resolver type to another executor.
  template <typename Executor1>
  struct rebind_executor
  {
    /// The resolver type when rebound to the specified executor.
    typedef basic_resolver<InternetProtocol, Executor1> other;
  };

  /// The protocol type.
  typedef InternetProtocol protocol_type;

  /// The endpoint type.
  typedef typename InternetProtocol::endpoint endpoint_type;

  /// The results type.
  typedef basic_resolver_results<InternetProtocol> results_type;

  /// Construct with executor.
  /**
   * This constructor creates a basic_resolver.
   *
   * @param ex The I/O executor that the resolver will use, by default, to
   * dispatch handlers for any asynchronous operations performed on the
   * resolver.
   */
  explicit basic_resolver(const executor_type& ex)
    : impl_(0, ex)
  {
  }

  /// Construct with execution context.
  /**
   * This constructor creates a basic_resolver.
   *
   * @param context An execution context which provides the I/O executor that
   * the resolver will use, by default, to dispatch handlers for any
   * asynchronous operations performed on the resolver.
   */
  template <typename ExecutionContext>
  explicit basic_resolver(ExecutionContext& context,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value
      > = 0)
    : impl_(0, 0, context)
  {
  }

  /// Move-construct a basic_resolver from another.
  /**
   * This constructor moves a resolver from one object to another.
   *
   * @param other The other basic_resolver object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_resolver(const executor_type&) constructor.
   */
  basic_resolver(basic_resolver&& other)
    : impl_(std::move(other.impl_))
  {
  }

  // All resolvers have access to each other's implementations.
  template <typename InternetProtocol1, typename Executor1>
  friend class basic_resolver;

  /// Move-construct a basic_resolver from another.
  /**
   * This constructor moves a resolver from one object to another.
   *
   * @param other The other basic_resolver object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_resolver(const executor_type&) constructor.
   */
  template <typename Executor1>
  basic_resolver(basic_resolver<InternetProtocol, Executor1>&& other,
      constraint_t<
          is_convertible<Executor1, Executor>::value
      > = 0)
    : impl_(std::move(other.impl_))
  {
  }

  /// Move-assign a basic_resolver from another.
  /**
   * This assignment operator moves a resolver from one object to another.
   * Cancels any outstanding asynchronous operations associated with the target
   * object.
   *
   * @param other The other basic_resolver object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_resolver(const executor_type&) constructor.
   */
  basic_resolver& operator=(basic_resolver&& other)
  {
    impl_ = std::move(other.impl_);
    return *this;
  }

  /// Move-assign a basic_resolver from another.
  /**
   * This assignment operator moves a resolver from one object to another.
   * Cancels any outstanding asynchronous operations associated with the target
   * object.
   *
   * @param other The other basic_resolver object from which the move will
   * occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_resolver(const executor_type&) constructor.
   */
  template <typename Executor1>
  constraint_t<
    is_convertible<Executor1, Executor>::value,
    basic_resolver&
  > operator=(basic_resolver<InternetProtocol, Executor1>&& other)
  {
    basic_resolver tmp(std::move(other));
    impl_ = std::move(tmp.impl_);
    return *this;
  }

  /// Destroys the resolver.
  /**
   * This function destroys the resolver, cancelling any outstanding
   * asynchronous wait operations associated with the resolver as if by calling
   * @c cancel.
   */
  ~basic_resolver()
  {
  }

  /// Get the executor associated with the object.
  executor_type get_executor() noexcept
  {
    return impl_.get_executor();
  }

  /// Cancel any asynchronous operations that are waiting on the resolver.
  /**
   * This function forces the completion of any pending asynchronous
   * operations on the host resolver. The handler for each cancelled operation
   * will be invoked with the asio::error::operation_aborted error code.
   */
  void cancel()
  {
    return impl_.get_service().cancel(impl_.get_implementation());
  }

  /// Perform forward resolution of a query to a list of entries.
  /**
   * This function is used to resolve host and service names into a list of
   * endpoint entries.
   *
   * @param host A string identifying a location. May be a descriptive name or
   * a numeric address string. If an empty string and the passive flag has been
   * specified, the resolved endpoints are suitable for local service binding.
   * If an empty string and passive is not specified, the resolved endpoints
   * will use the loopback address.
   *
   * @param service A string identifying the requested service. This may be a
   * descriptive name or a numeric string corresponding to a port number. May
   * be an empty string, in which case all resolved endpoints will have a port
   * number of 0.
   *
   * @returns A range object representing the list of endpoint entries. A
   * successful call to this function is guaranteed to return a non-empty
   * range.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @note On POSIX systems, host names may be locally defined in the file
   * <tt>/etc/hosts</tt>. On Windows, host names may be defined in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\hosts</tt>. Remote host name
   * resolution is performed using DNS. Operating systems may use additional
   * locations when resolving host names (such as NETBIOS names on Windows).
   *
   * On POSIX systems, service names are typically defined in the file
   * <tt>/etc/services</tt>. On Windows, service names may be found in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\services</tt>. Operating systems
   * may use additional locations when resolving service names.
   */
  results_type resolve(ASIO_STRING_VIEW_PARAM host,
      ASIO_STRING_VIEW_PARAM service)
  {
    return resolve(host, service, resolver_base::flags());
  }

  /// Perform forward resolution of a query to a list of entries.
  /**
   * This function is used to resolve host and service names into a list of
   * endpoint entries.
   *
   * @param host A string identifying a location. May be a descriptive name or
   * a numeric address string. If an empty string and the passive flag has been
   * specified, the resolved endpoints are suitable for local service binding.
   * If an empty string and passive is not specified, the resolved endpoints
   * will use the loopback address.
   *
   * @param service A string identifying the requested service. This may be a
   * descriptive name or a numeric string corresponding to a port number. May
   * be an empty string, in which case all resolved endpoints will have a port
   * number of 0.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @returns A range object representing the list of endpoint entries. An
   * empty range is returned if an error occurs. A successful call to this
   * function is guaranteed to return a non-empty range.
   *
   * @note On POSIX systems, host names may be locally defined in the file
   * <tt>/etc/hosts</tt>. On Windows, host names may be defined in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\hosts</tt>. Remote host name
   * resolution is performed using DNS. Operating systems may use additional
   * locations when resolving host names (such as NETBIOS names on Windows).
   *
   * On POSIX systems, service names are typically defined in the file
   * <tt>/etc/services</tt>. On Windows, service names may be found in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\services</tt>. Operating systems
   * may use additional locations when resolving service names.
   */
  results_type resolve(ASIO_STRING_VIEW_PARAM host,
      ASIO_STRING_VIEW_PARAM service, asio::error_code& ec)
  {
    return resolve(host, service, resolver_base::flags(), ec);
  }

  /// Perform forward resolution of a query to a list of entries.
  /**
   * This function is used to resolve host and service names into a list of
   * endpoint entries.
   *
   * @param host A string identifying a location. May be a descriptive name or
   * a numeric address string. If an empty string and the passive flag has been
   * specified, the resolved endpoints are suitable for local service binding.
   * If an empty string and passive is not specified, the resolved endpoints
   * will use the loopback address.
   *
   * @param service A string identifying the requested service. This may be a
   * descriptive name or a numeric string corresponding to a port number. May
   * be an empty string, in which case all resolved endpoints will have a port
   * number of 0.
   *
   * @param resolve_flags A set of flags that determine how name resolution
   * should be performed. The default flags are suitable for communication with
   * remote hosts. See the @ref resolver_base documentation for the set of
   * available flags.
   *
   * @returns A range object representing the list of endpoint entries. A
   * successful call to this function is guaranteed to return a non-empty
   * range.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @note On POSIX systems, host names may be locally defined in the file
   * <tt>/etc/hosts</tt>. On Windows, host names may be defined in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\hosts</tt>. Remote host name
   * resolution is performed using DNS. Operating systems may use additional
   * locations when resolving host names (such as NETBIOS names on Windows).
   *
   * On POSIX systems, service names are typically defined in the file
   * <tt>/etc/services</tt>. On Windows, service names may be found in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\services</tt>. Operating systems
   * may use additional locations when resolving service names.
   */
  results_type resolve(ASIO_STRING_VIEW_PARAM host,
      ASIO_STRING_VIEW_PARAM service, resolver_base::flags resolve_flags)
  {
    asio::error_code ec;
    basic_resolver_query<protocol_type> q(static_cast<std::string>(host),
        static_cast<std::string>(service), resolve_flags);
    results_type r = impl_.get_service().resolve(
        impl_.get_implementation(), q, ec);
    asio::detail::throw_error(ec, "resolve");
    return r;
  }

  /// Perform forward resolution of a query to a list of entries.
  /**
   * This function is used to resolve host and service names into a list of
   * endpoint entries.
   *
   * @param host A string identifying a location. May be a descriptive name or
   * a numeric address string. If an empty string and the passive flag has been
   * specified, the resolved endpoints are suitable for local service binding.
   * If an empty string and passive is not specified, the resolved endpoints
   * will use the loopback address.
   *
   * @param service A string identifying the requested service. This may be a
   * descriptive name or a numeric string corresponding to a port number. May
   * be an empty string, in which case all resolved endpoints will have a port
   * number of 0.
   *
   * @param resolve_flags A set of flags that determine how name resolution
   * should be performed. The default flags are suitable for communication with
   * remote hosts. See the @ref resolver_base documentation for the set of
   * available flags.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @returns A range object representing the list of endpoint entries. An
   * empty range is returned if an error occurs. A successful call to this
   * function is guaranteed to return a non-empty range.
   *
   * @note On POSIX systems, host names may be locally defined in the file
   * <tt>/etc/hosts</tt>. On Windows, host names may be defined in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\hosts</tt>. Remote host name
   * resolution is performed using DNS. Operating systems may use additional
   * locations when resolving host names (such as NETBIOS names on Windows).
   *
   * On POSIX systems, service names are typically defined in the file
   * <tt>/etc/services</tt>. On Windows, service names may be found in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\services</tt>. Operating systems
   * may use additional locations when resolving service names.
   */
  results_type resolve(ASIO_STRING_VIEW_PARAM host,
      ASIO_STRING_VIEW_PARAM service, resolver_base::flags resolve_flags,
      asio::error_code& ec)
  {
    basic_resolver_query<protocol_type> q(static_cast<std::string>(host),
        static_cast<std::string>(service), resolve_flags);
    return impl_.get_service().resolve(impl_.get_implementation(), q, ec);
  }

  /// Perform forward resolution of a query to a list of entries.
  /**
   * This function is used to resolve host and service names into a list of
   * endpoint entries.
   *
   * @param protocol A protocol object, normally representing either the IPv4 or
   * IPv6 version of an internet protocol.
   *
   * @param host A string identifying a location. May be a descriptive name or
   * a numeric address string. If an empty string and the passive flag has been
   * specified, the resolved endpoints are suitable for local service binding.
   * If an empty string and passive is not specified, the resolved endpoints
   * will use the loopback address.
   *
   * @param service A string identifying the requested service. This may be a
   * descriptive name or a numeric string corresponding to a port number. May
   * be an empty string, in which case all resolved endpoints will have a port
   * number of 0.
   *
   * @returns A range object representing the list of endpoint entries. A
   * successful call to this function is guaranteed to return a non-empty
   * range.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @note On POSIX systems, host names may be locally defined in the file
   * <tt>/etc/hosts</tt>. On Windows, host names may be defined in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\hosts</tt>. Remote host name
   * resolution is performed using DNS. Operating systems may use additional
   * locations when resolving host names (such as NETBIOS names on Windows).
   *
   * On POSIX systems, service names are typically defined in the file
   * <tt>/etc/services</tt>. On Windows, service names may be found in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\services</tt>. Operating systems
   * may use additional locations when resolving service names.
   */
  results_type resolve(const protocol_type& protocol,
      ASIO_STRING_VIEW_PARAM host, ASIO_STRING_VIEW_PARAM service)
  {
    return resolve(protocol, host, service, resolver_base::flags());
  }

  /// Perform forward resolution of a query to a list of entries.
  /**
   * This function is used to resolve host and service names into a list of
   * endpoint entries.
   *
   * @param protocol A protocol object, normally representing either the IPv4 or
   * IPv6 version of an internet protocol.
   *
   * @param host A string identifying a location. May be a descriptive name or
   * a numeric address string. If an empty string and the passive flag has been
   * specified, the resolved endpoints are suitable for local service binding.
   * If an empty string and passive is not specified, the resolved endpoints
   * will use the loopback address.
   *
   * @param service A string identifying the requested service. This may be a
   * descriptive name or a numeric string corresponding to a port number. May
   * be an empty string, in which case all resolved endpoints will have a port
   * number of 0.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @returns A range object representing the list of endpoint entries. An
   * empty range is returned if an error occurs. A successful call to this
   * function is guaranteed to return a non-empty range.
   *
   * @note On POSIX systems, host names may be locally defined in the file
   * <tt>/etc/hosts</tt>. On Windows, host names may be defined in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\hosts</tt>. Remote host name
   * resolution is performed using DNS. Operating systems may use additional
   * locations when resolving host names (such as NETBIOS names on Windows).
   *
   * On POSIX systems, service names are typically defined in the file
   * <tt>/etc/services</tt>. On Windows, service names may be found in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\services</tt>. Operating systems
   * may use additional locations when resolving service names.
   */
  results_type resolve(const protocol_type& protocol,
      ASIO_STRING_VIEW_PARAM host, ASIO_STRING_VIEW_PARAM service,
      asio::error_code& ec)
  {
    return resolve(protocol, host, service, resolver_base::flags(), ec);
  }

  /// Perform forward resolution of a query to a list of entries.
  /**
   * This function is used to resolve host and service names into a list of
   * endpoint entries.
   *
   * @param protocol A protocol object, normally representing either the IPv4 or
   * IPv6 version of an internet protocol.
   *
   * @param host A string identifying a location. May be a descriptive name or
   * a numeric address string. If an empty string and the passive flag has been
   * specified, the resolved endpoints are suitable for local service binding.
   * If an empty string and passive is not specified, the resolved endpoints
   * will use the loopback address.
   *
   * @param service A string identifying the requested service. This may be a
   * descriptive name or a numeric string corresponding to a port number. May
   * be an empty string, in which case all resolved endpoints will have a port
   * number of 0.
   *
   * @param resolve_flags A set of flags that determine how name resolution
   * should be performed. The default flags are suitable for communication with
   * remote hosts. See the @ref resolver_base documentation for the set of
   * available flags.
   *
   * @returns A range object representing the list of endpoint entries. A
   * successful call to this function is guaranteed to return a non-empty
   * range.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @note On POSIX systems, host names may be locally defined in the file
   * <tt>/etc/hosts</tt>. On Windows, host names may be defined in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\hosts</tt>. Remote host name
   * resolution is performed using DNS. Operating systems may use additional
   * locations when resolving host names (such as NETBIOS names on Windows).
   *
   * On POSIX systems, service names are typically defined in the file
   * <tt>/etc/services</tt>. On Windows, service names may be found in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\services</tt>. Operating systems
   * may use additional locations when resolving service names.
   */
  results_type resolve(const protocol_type& protocol,
      ASIO_STRING_VIEW_PARAM host, ASIO_STRING_VIEW_PARAM service,
      resolver_base::flags resolve_flags)
  {
    asio::error_code ec;
    basic_resolver_query<protocol_type> q(
        protocol, static_cast<std::string>(host),
        static_cast<std::string>(service), resolve_flags);
    results_type r = impl_.get_service().resolve(
        impl_.get_implementation(), q, ec);
    asio::detail::throw_error(ec, "resolve");
    return r;
  }

  /// Perform forward resolution of a query to a list of entries.
  /**
   * This function is used to resolve host and service names into a list of
   * endpoint entries.
   *
   * @param protocol A protocol object, normally representing either the IPv4 or
   * IPv6 version of an internet protocol.
   *
   * @param host A string identifying a location. May be a descriptive name or
   * a numeric address string. If an empty string and the passive flag has been
   * specified, the resolved endpoints are suitable for local service binding.
   * If an empty string and passive is not specified, the resolved endpoints
   * will use the loopback address.
   *
   * @param service A string identifying the requested service. This may be a
   * descriptive name or a numeric string corresponding to a port number. May
   * be an empty string, in which case all resolved endpoints will have a port
   * number of 0.
   *
   * @param resolve_flags A set of flags that determine how name resolution
   * should be performed. The default flags are suitable for communication with
   * remote hosts. See the @ref resolver_base documentation for the set of
   * available flags.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @returns A range object representing the list of endpoint entries. An
   * empty range is returned if an error occurs. A successful call to this
   * function is guaranteed to return a non-empty range.
   *
   * @note On POSIX systems, host names may be locally defined in the file
   * <tt>/etc/hosts</tt>. On Windows, host names may be defined in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\hosts</tt>. Remote host name
   * resolution is performed using DNS. Operating systems may use additional
   * locations when resolving host names (such as NETBIOS names on Windows).
   *
   * On POSIX systems, service names are typically defined in the file
   * <tt>/etc/services</tt>. On Windows, service names may be found in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\services</tt>. Operating systems
   * may use additional locations when resolving service names.
   */
  results_type resolve(const protocol_type& protocol,
      ASIO_STRING_VIEW_PARAM host, ASIO_STRING_VIEW_PARAM service,
      resolver_base::flags resolve_flags, asio::error_code& ec)
  {
    basic_resolver_query<protocol_type> q(
        protocol, static_cast<std::string>(host),
        static_cast<std::string>(service), resolve_flags);
    return impl_.get_service().resolve(impl_.get_implementation(), q, ec);
  }

  /// Asynchronously perform forward resolution of a query to a list of entries.
  /**
   * This function is used to resolve host and service names into a list of
   * endpoint entries.
   *
   * @param host A string identifying a location. May be a descriptive name or
   * a numeric address string. If an empty string and the passive flag has been
   * specified, the resolved endpoints are suitable for local service binding.
   * If an empty string and passive is not specified, the resolved endpoints
   * will use the loopback address.
   *
   * @param service A string identifying the requested service. This may be a
   * descriptive name or a numeric string corresponding to a port number. May
   * be an empty string, in which case all resolved endpoints will have a port
   * number of 0.
   *
   * @param token The @ref completion_token that will be used to produce a
   * completion handler, which will be called when the resolve completes.
   * Potential completion tokens include @ref use_future, @ref use_awaitable,
   * @ref yield_context, or a function object with the correct completion
   * signature. The function signature of the completion handler must be:
   * @code void handler(
   *   const asio::error_code& error, // Result of operation.
   *   resolver::results_type results // Resolved endpoints as a range.
   * ); @endcode
   * Regardless of whether the asynchronous operation completes immediately or
   * not, the completion handler will not be invoked from within this function.
   * On immediate completion, invocation of the handler will be performed in a
   * manner equivalent to using asio::async_immediate().
   *
   * A successful resolve operation is guaranteed to pass a non-empty range to
   * the handler.
   *
   * @par Completion Signature
   * @code void(asio::error_code, results_type) @endcode
   *
   * @note On POSIX systems, host names may be locally defined in the file
   * <tt>/etc/hosts</tt>. On Windows, host names may be defined in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\hosts</tt>. Remote host name
   * resolution is performed using DNS. Operating systems may use additional
   * locations when resolving host names (such as NETBIOS names on Windows).
   *
   * On POSIX systems, service names are typically defined in the file
   * <tt>/etc/services</tt>. On Windows, service names may be found in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\services</tt>. Operating systems
   * may use additional locations when resolving service names.
   */
  template <
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
        results_type)) ResolveToken = default_completion_token_t<executor_type>>
  auto async_resolve(ASIO_STRING_VIEW_PARAM host,
      ASIO_STRING_VIEW_PARAM service,
      ResolveToken&& token = default_completion_token_t<executor_type>())
    -> decltype(
      asio::async_initiate<ResolveToken,
        void (asio::error_code, results_type)>(
          declval<initiate_async_resolve>(), token,
          declval<basic_resolver_query<protocol_type>&>()))
  {
    return async_resolve(host, service, resolver_base::flags(),
        static_cast<ResolveToken&&>(token));
  }

  /// Asynchronously perform forward resolution of a query to a list of entries.
  /**
   * This function is used to resolve host and service names into a list of
   * endpoint entries. It is an initiating function for an @ref
   * asynchronous_operation, and always returns immediately.
   *
   * @param host A string identifying a location. May be a descriptive name or
   * a numeric address string. If an empty string and the passive flag has been
   * specified, the resolved endpoints are suitable for local service binding.
   * If an empty string and passive is not specified, the resolved endpoints
   * will use the loopback address.
   *
   * @param service A string identifying the requested service. This may be a
   * descriptive name or a numeric string corresponding to a port number. May
   * be an empty string, in which case all resolved endpoints will have a port
   * number of 0.
   *
   * @param resolve_flags A set of flags that determine how name resolution
   * should be performed. The default flags are suitable for communication with
   * remote hosts. See the @ref resolver_base documentation for the set of
   * available flags.
   *
   * @param token The @ref completion_token that will be used to produce a
   * completion handler, which will be called when the resolve completes.
   * Potential completion tokens include @ref use_future, @ref use_awaitable,
   * @ref yield_context, or a function object with the correct completion
   * signature. The function signature of the completion handler must be:
   * @code void handler(
   *   const asio::error_code& error, // Result of operation.
   *   resolver::results_type results // Resolved endpoints as a range.
   * ); @endcode
   * Regardless of whether the asynchronous operation completes immediately or
   * not, the completion handler will not be invoked from within this function.
   * On immediate completion, invocation of the handler will be performed in a
   * manner equivalent to using asio::async_immediate().
   *
   * A successful resolve operation is guaranteed to pass a non-empty range to
   * the handler.
   *
   * @par Completion Signature
   * @code void(asio::error_code, results_type) @endcode
   *
   * @note On POSIX systems, host names may be locally defined in the file
   * <tt>/etc/hosts</tt>. On Windows, host names may be defined in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\hosts</tt>. Remote host name
   * resolution is performed using DNS. Operating systems may use additional
   * locations when resolving host names (such as NETBIOS names on Windows).
   *
   * On POSIX systems, service names are typically defined in the file
   * <tt>/etc/services</tt>. On Windows, service names may be found in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\services</tt>. Operating systems
   * may use additional locations when resolving service names.
   */
  template <
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
        results_type)) ResolveToken = default_completion_token_t<executor_type>>
  auto async_resolve(ASIO_STRING_VIEW_PARAM host,
      ASIO_STRING_VIEW_PARAM service, resolver_base::flags resolve_flags,
      ResolveToken&& token = default_completion_token_t<executor_type>())
    -> decltype(
      asio::async_initiate<ResolveToken,
        void (asio::error_code, results_type)>(
          declval<initiate_async_resolve>(), token,
          declval<basic_resolver_query<protocol_type>&>()))
  {
    basic_resolver_query<protocol_type> q(static_cast<std::string>(host),
        static_cast<std::string>(service), resolve_flags);

    return asio::async_initiate<ResolveToken,
      void (asio::error_code, results_type)>(
        initiate_async_resolve(this), token, q);
  }

  /// Asynchronously perform forward resolution of a query to a list of entries.
  /**
   * This function is used to resolve host and service names into a list of
   * endpoint entries. It is an initiating function for an @ref
   * asynchronous_operation, and always returns immediately.
   *
   * @param protocol A protocol object, normally representing either the IPv4 or
   * IPv6 version of an internet protocol.
   *
   * @param host A string identifying a location. May be a descriptive name or
   * a numeric address string. If an empty string and the passive flag has been
   * specified, the resolved endpoints are suitable for local service binding.
   * If an empty string and passive is not specified, the resolved endpoints
   * will use the loopback address.
   *
   * @param service A string identifying the requested service. This may be a
   * descriptive name or a numeric string corresponding to a port number. May
   * be an empty string, in which case all resolved endpoints will have a port
   * number of 0.
   *
   * @param token The @ref completion_token that will be used to produce a
   * completion handler, which will be called when the resolve completes.
   * Potential completion tokens include @ref use_future, @ref use_awaitable,
   * @ref yield_context, or a function object with the correct completion
   * signature. The function signature of the completion handler must be:
   * @code void handler(
   *   const asio::error_code& error, // Result of operation.
   *   resolver::results_type results // Resolved endpoints as a range.
   * ); @endcode
   * Regardless of whether the asynchronous operation completes immediately or
   * not, the completion handler will not be invoked from within this function.
   * On immediate completion, invocation of the handler will be performed in a
   * manner equivalent to using asio::async_immediate().
   *
   * A successful resolve operation is guaranteed to pass a non-empty range to
   * the handler.
   *
   * @par Completion Signature
   * @code void(asio::error_code, results_type) @endcode
   *
   * @note On POSIX systems, host names may be locally defined in the file
   * <tt>/etc/hosts</tt>. On Windows, host names may be defined in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\hosts</tt>. Remote host name
   * resolution is performed using DNS. Operating systems may use additional
   * locations when resolving host names (such as NETBIOS names on Windows).
   *
   * On POSIX systems, service names are typically defined in the file
   * <tt>/etc/services</tt>. On Windows, service names may be found in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\services</tt>. Operating systems
   * may use additional locations when resolving service names.
   */
  template <
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
        results_type)) ResolveToken = default_completion_token_t<executor_type>>
  auto async_resolve(const protocol_type& protocol,
      ASIO_STRING_VIEW_PARAM host, ASIO_STRING_VIEW_PARAM service,
      ResolveToken&& token = default_completion_token_t<executor_type>())
    -> decltype(
      asio::async_initiate<ResolveToken,
        void (asio::error_code, results_type)>(
          declval<initiate_async_resolve>(), token,
          declval<basic_resolver_query<protocol_type>&>()))
  {
    return async_resolve(protocol, host, service, resolver_base::flags(),
        static_cast<ResolveToken&&>(token));
  }

  /// Asynchronously perform forward resolution of a query to a list of entries.
  /**
   * This function is used to resolve host and service names into a list of
   * endpoint entries. It is an initiating function for an @ref
   * asynchronous_operation, and always returns immediately.
   *
   * @param protocol A protocol object, normally representing either the IPv4 or
   * IPv6 version of an internet protocol.
   *
   * @param host A string identifying a location. May be a descriptive name or
   * a numeric address string. If an empty string and the passive flag has been
   * specified, the resolved endpoints are suitable for local service binding.
   * If an empty string and passive is not specified, the resolved endpoints
   * will use the loopback address.
   *
   * @param service A string identifying the requested service. This may be a
   * descriptive name or a numeric string corresponding to a port number. May
   * be an empty string, in which case all resolved endpoints will have a port
   * number of 0.
   *
   * @param resolve_flags A set of flags that determine how name resolution
   * should be performed. The default flags are suitable for communication with
   * remote hosts. See the @ref resolver_base documentation for the set of
   * available flags.
   *
   * @param token The @ref completion_token that will be used to produce a
   * completion handler, which will be called when the resolve completes.
   * Potential completion tokens include @ref use_future, @ref use_awaitable,
   * @ref yield_context, or a function object with the correct completion
   * signature. The function signature of the completion handler must be:
   * @code void handler(
   *   const asio::error_code& error, // Result of operation.
   *   resolver::results_type results // Resolved endpoints as a range.
   * ); @endcode
   * Regardless of whether the asynchronous operation completes immediately or
   * not, the completion handler will not be invoked from within this function.
   * On immediate completion, invocation of the handler will be performed in a
   * manner equivalent to using asio::async_immediate().
   *
   * A successful resolve operation is guaranteed to pass a non-empty range to
   * the handler.
   *
   * @par Completion Signature
   * @code void(asio::error_code, results_type) @endcode
   *
   * @note On POSIX systems, host names may be locally defined in the file
   * <tt>/etc/hosts</tt>. On Windows, host names may be defined in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\hosts</tt>. Remote host name
   * resolution is performed using DNS. Operating systems may use additional
   * locations when resolving host names (such as NETBIOS names on Windows).
   *
   * On POSIX systems, service names are typically defined in the file
   * <tt>/etc/services</tt>. On Windows, service names may be found in the file
   * <tt>c:\\windows\\system32\\drivers\\etc\\services</tt>. Operating systems
   * may use additional locations when resolving service names.
   */
  template <
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
        results_type)) ResolveToken = default_completion_token_t<executor_type>>
  auto async_resolve(const protocol_type& protocol,
      ASIO_STRING_VIEW_PARAM host, ASIO_STRING_VIEW_PARAM service,
      resolver_base::flags resolve_flags,
      ResolveToken&& token = default_completion_token_t<executor_type>())
    -> decltype(
      asio::async_initiate<ResolveToken,
        void (asio::error_code, results_type)>(
          declval<initiate_async_resolve>(), token,
          declval<basic_resolver_query<protocol_type>&>()))
  {
    basic_resolver_query<protocol_type> q(
        protocol, static_cast<std::string>(host),
        static_cast<std::string>(service), resolve_flags);

    return asio::async_initiate<ResolveToken,
      void (asio::error_code, results_type)>(
        initiate_async_resolve(this), token, q);
  }

  /// Perform reverse resolution of an endpoint to a list of entries.
  /**
   * This function is used to resolve an endpoint into a list of endpoint
   * entries.
   *
   * @param e An endpoint object that determines what endpoints will be
   * returned.
   *
   * @returns A range object representing the list of endpoint entries. A
   * successful call to this function is guaranteed to return a non-empty
   * range.
   *
   * @throws asio::system_error Thrown on failure.
   */
  results_type resolve(const endpoint_type& e)
  {
    asio::error_code ec;
    results_type i = impl_.get_service().resolve(
        impl_.get_implementation(), e, ec);
    asio::detail::throw_error(ec, "resolve");
    return i;
  }

  /// Perform reverse resolution of an endpoint to a list of entries.
  /**
   * This function is used to resolve an endpoint into a list of endpoint
   * entries.
   *
   * @param e An endpoint object that determines what endpoints will be
   * returned.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @returns A range object representing the list of endpoint entries. An
   * empty range is returned if an error occurs. A successful call to this
   * function is guaranteed to return a non-empty range.
   */
  results_type resolve(const endpoint_type& e, asio::error_code& ec)
  {
    return impl_.get_service().resolve(impl_.get_implementation(), e, ec);
  }

  /// Asynchronously perform reverse resolution of an endpoint to a list of
  /// entries.
  /**
   * This function is used to asynchronously resolve an endpoint into a list of
   * endpoint entries. It is an initiating function for an @ref
   * asynchronous_operation, and always returns immediately.
   *
   * @param e An endpoint object that determines what endpoints will be
   * returned.
   *
   * @param token The @ref completion_token that will be used to produce a
   * completion handler, which will be called when the resolve completes.
   * Potential completion tokens include @ref use_future, @ref use_awaitable,
   * @ref yield_context, or a function object with the correct completion
   * signature. The function signature of the completion handler must be:
   * @code void handler(
   *   const asio::error_code& error, // Result of operation.
   *   resolver::results_type results // Resolved endpoints as a range.
   * ); @endcode
   * Regardless of whether the asynchronous operation completes immediately or
   * not, the completion handler will not be invoked from within this function.
   * On immediate completion, invocation of the handler will be performed in a
   * manner equivalent to using asio::async_immediate().
   *
   * A successful resolve operation is guaranteed to pass a non-empty range to
   * the handler.
   *
   * @par Completion Signature
   * @code void(asio::error_code, results_type) @endcode
   */
  template <
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
        results_type)) ResolveToken = default_completion_token_t<executor_type>>
  auto async_resolve(const endpoint_type& e,
      ResolveToken&& token = default_completion_token_t<executor_type>())
    -> decltype(
      asio::async_initiate<ResolveToken,
        void (asio::error_code, results_type)>(
          declval<initiate_async_resolve>(), token, e))
  {
    return asio::async_initiate<ResolveToken,
      void (asio::error_code, results_type)>(
        initiate_async_resolve(this), token, e);
  }

private:
  // Disallow copying and assignment.
  basic_resolver(const basic_resolver&) = delete;
  basic_resolver& operator=(const basic_resolver&) = delete;

  class initiate_async_resolve
  {
  public:
    typedef Executor executor_type;

    explicit initiate_async_resolve(basic_resolver* self)
      : self_(self)
    {
    }

    executor_type get_executor() const noexcept
    {
      return self_->get_executor();
    }

    template <typename ResolveHandler, typename Query>
    void operator()(ResolveHandler&& handler,
        const Query& q) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a ResolveHandler.
      ASIO_RESOLVE_HANDLER_CHECK(
          ResolveHandler, handler, results_type) type_check;

      asio::detail::non_const_lvalue<ResolveHandler> handler2(handler);
      self_->impl_.get_service().async_resolve(
          self_->impl_.get_implementation(), q,
          handler2.value, self_->impl_.get_executor());
    }

  private:
    basic_resolver* self_;
  };

# if defined(ASIO_WINDOWS_RUNTIME)
  asio::detail::io_object_impl<
    asio::detail::winrt_resolver_service<InternetProtocol>,
    Executor> impl_;
# else
  asio::detail::io_object_impl<
    asio::detail::resolver_service<InternetProtocol>,
    Executor> impl_;
# endif
};

} // namespace ip
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IP_BASIC_RESOLVER_HPP
