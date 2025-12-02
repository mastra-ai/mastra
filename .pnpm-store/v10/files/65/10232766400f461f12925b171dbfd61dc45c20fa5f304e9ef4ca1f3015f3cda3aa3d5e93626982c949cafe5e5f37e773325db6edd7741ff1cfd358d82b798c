//
// basic_socket_acceptor.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_BASIC_SOCKET_ACCEPTOR_HPP
#define ASIO_BASIC_SOCKET_ACCEPTOR_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include <utility>
#include "asio/detail/config.hpp"
#include "asio/any_io_executor.hpp"
#include "asio/basic_socket.hpp"
#include "asio/detail/handler_type_requirements.hpp"
#include "asio/detail/io_object_impl.hpp"
#include "asio/detail/non_const_lvalue.hpp"
#include "asio/detail/throw_error.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/error.hpp"
#include "asio/execution_context.hpp"
#include "asio/socket_base.hpp"

#if defined(ASIO_WINDOWS_RUNTIME)
# include "asio/detail/null_socket_service.hpp"
#elif defined(ASIO_HAS_IOCP)
# include "asio/detail/win_iocp_socket_service.hpp"
#elif defined(ASIO_HAS_IO_URING_AS_DEFAULT)
# include "asio/detail/io_uring_socket_service.hpp"
#else
# include "asio/detail/reactive_socket_service.hpp"
#endif

#include "asio/detail/push_options.hpp"

namespace asio {

#if !defined(ASIO_BASIC_SOCKET_ACCEPTOR_FWD_DECL)
#define ASIO_BASIC_SOCKET_ACCEPTOR_FWD_DECL

// Forward declaration with defaulted arguments.
template <typename Protocol, typename Executor = any_io_executor>
class basic_socket_acceptor;

#endif // !defined(ASIO_BASIC_SOCKET_ACCEPTOR_FWD_DECL)

/// Provides the ability to accept new connections.
/**
 * The basic_socket_acceptor class template is used for accepting new socket
 * connections.
 *
 * @par Thread Safety
 * @e Distinct @e objects: Safe.@n
 * @e Shared @e objects: Unsafe.
 *
 * Synchronous @c accept operations are thread safe, if the underlying
 * operating system calls are also thread safe. This means that it is permitted
 * to perform concurrent calls to synchronous @c accept operations on a single
 * socket object. Other synchronous operations, such as @c open or @c close, are
 * not thread safe.
 *
 * @par Example
 * Opening a socket acceptor with the SO_REUSEADDR option enabled:
 * @code
 * asio::ip::tcp::acceptor acceptor(my_context);
 * asio::ip::tcp::endpoint endpoint(asio::ip::tcp::v4(), port);
 * acceptor.open(endpoint.protocol());
 * acceptor.set_option(asio::ip::tcp::acceptor::reuse_address(true));
 * acceptor.bind(endpoint);
 * acceptor.listen();
 * @endcode
 */
template <typename Protocol, typename Executor>
class basic_socket_acceptor
  : public socket_base
{
private:
  class initiate_async_wait;
  class initiate_async_accept;
  class initiate_async_move_accept;

public:
  /// The type of the executor associated with the object.
  typedef Executor executor_type;

  /// Rebinds the acceptor type to another executor.
  template <typename Executor1>
  struct rebind_executor
  {
    /// The socket type when rebound to the specified executor.
    typedef basic_socket_acceptor<Protocol, Executor1> other;
  };

  /// The native representation of an acceptor.
#if defined(GENERATING_DOCUMENTATION)
  typedef implementation_defined native_handle_type;
#elif defined(ASIO_WINDOWS_RUNTIME)
  typedef typename detail::null_socket_service<
    Protocol>::native_handle_type native_handle_type;
#elif defined(ASIO_HAS_IOCP)
  typedef typename detail::win_iocp_socket_service<
    Protocol>::native_handle_type native_handle_type;
#elif defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  typedef typename detail::io_uring_socket_service<
    Protocol>::native_handle_type native_handle_type;
#else
  typedef typename detail::reactive_socket_service<
    Protocol>::native_handle_type native_handle_type;
#endif

  /// The protocol type.
  typedef Protocol protocol_type;

  /// The endpoint type.
  typedef typename Protocol::endpoint endpoint_type;

  /// Construct an acceptor without opening it.
  /**
   * This constructor creates an acceptor without opening it to listen for new
   * connections. The open() function must be called before the acceptor can
   * accept new socket connections.
   *
   * @param ex The I/O executor that the acceptor will use, by default, to
   * dispatch handlers for any asynchronous operations performed on the
   * acceptor.
   */
  explicit basic_socket_acceptor(const executor_type& ex)
    : impl_(0, ex)
  {
  }

  /// Construct an acceptor without opening it.
  /**
   * This constructor creates an acceptor without opening it to listen for new
   * connections. The open() function must be called before the acceptor can
   * accept new socket connections.
   *
   * @param context An execution context which provides the I/O executor that
   * the acceptor will use, by default, to dispatch handlers for any
   * asynchronous operations performed on the acceptor.
   */
  template <typename ExecutionContext>
  explicit basic_socket_acceptor(ExecutionContext& context,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value
      > = 0)
    : impl_(0, 0, context)
  {
  }

  /// Construct an open acceptor.
  /**
   * This constructor creates an acceptor and automatically opens it.
   *
   * @param ex The I/O executor that the acceptor will use, by default, to
   * dispatch handlers for any asynchronous operations performed on the
   * acceptor.
   *
   * @param protocol An object specifying protocol parameters to be used.
   *
   * @throws asio::system_error Thrown on failure.
   */
  basic_socket_acceptor(const executor_type& ex, const protocol_type& protocol)
    : impl_(0, ex)
  {
    asio::error_code ec;
    impl_.get_service().open(impl_.get_implementation(), protocol, ec);
    asio::detail::throw_error(ec, "open");
  }

  /// Construct an open acceptor.
  /**
   * This constructor creates an acceptor and automatically opens it.
   *
   * @param context An execution context which provides the I/O executor that
   * the acceptor will use, by default, to dispatch handlers for any
   * asynchronous operations performed on the acceptor.
   *
   * @param protocol An object specifying protocol parameters to be used.
   *
   * @throws asio::system_error Thrown on failure.
   */
  template <typename ExecutionContext>
  basic_socket_acceptor(ExecutionContext& context,
      const protocol_type& protocol,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value,
        defaulted_constraint
      > = defaulted_constraint())
    : impl_(0, 0, context)
  {
    asio::error_code ec;
    impl_.get_service().open(impl_.get_implementation(), protocol, ec);
    asio::detail::throw_error(ec, "open");
  }

  /// Construct an acceptor opened on the given endpoint.
  /**
   * This constructor creates an acceptor and automatically opens it to listen
   * for new connections on the specified endpoint.
   *
   * @param ex The I/O executor that the acceptor will use, by default, to
   * dispatch handlers for any asynchronous operations performed on the
   * acceptor.
   *
   * @param endpoint An endpoint on the local machine on which the acceptor
   * will listen for new connections.
   *
   * @param reuse_addr Whether the constructor should set the socket option
   * socket_base::reuse_address.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @note This constructor is equivalent to the following code:
   * @code
   * basic_socket_acceptor<Protocol> acceptor(my_context);
   * acceptor.open(endpoint.protocol());
   * if (reuse_addr)
   *   acceptor.set_option(socket_base::reuse_address(true));
   * acceptor.bind(endpoint);
   * acceptor.listen();
   * @endcode
   */
  basic_socket_acceptor(const executor_type& ex,
      const endpoint_type& endpoint, bool reuse_addr = true)
    : impl_(0, ex)
  {
    asio::error_code ec;
    const protocol_type protocol = endpoint.protocol();
    impl_.get_service().open(impl_.get_implementation(), protocol, ec);
    asio::detail::throw_error(ec, "open");
    if (reuse_addr)
    {
      impl_.get_service().set_option(impl_.get_implementation(),
          socket_base::reuse_address(true), ec);
      asio::detail::throw_error(ec, "set_option");
    }
    impl_.get_service().bind(impl_.get_implementation(), endpoint, ec);
    asio::detail::throw_error(ec, "bind");
    impl_.get_service().listen(impl_.get_implementation(),
        socket_base::max_listen_connections, ec);
    asio::detail::throw_error(ec, "listen");
  }

  /// Construct an acceptor opened on the given endpoint.
  /**
   * This constructor creates an acceptor and automatically opens it to listen
   * for new connections on the specified endpoint.
   *
   * @param context An execution context which provides the I/O executor that
   * the acceptor will use, by default, to dispatch handlers for any
   * asynchronous operations performed on the acceptor.
   *
   * @param endpoint An endpoint on the local machine on which the acceptor
   * will listen for new connections.
   *
   * @param reuse_addr Whether the constructor should set the socket option
   * socket_base::reuse_address.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @note This constructor is equivalent to the following code:
   * @code
   * basic_socket_acceptor<Protocol> acceptor(my_context);
   * acceptor.open(endpoint.protocol());
   * if (reuse_addr)
   *   acceptor.set_option(socket_base::reuse_address(true));
   * acceptor.bind(endpoint);
   * acceptor.listen();
   * @endcode
   */
  template <typename ExecutionContext>
  basic_socket_acceptor(ExecutionContext& context,
      const endpoint_type& endpoint, bool reuse_addr = true,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value
      > = 0)
    : impl_(0, 0, context)
  {
    asio::error_code ec;
    const protocol_type protocol = endpoint.protocol();
    impl_.get_service().open(impl_.get_implementation(), protocol, ec);
    asio::detail::throw_error(ec, "open");
    if (reuse_addr)
    {
      impl_.get_service().set_option(impl_.get_implementation(),
          socket_base::reuse_address(true), ec);
      asio::detail::throw_error(ec, "set_option");
    }
    impl_.get_service().bind(impl_.get_implementation(), endpoint, ec);
    asio::detail::throw_error(ec, "bind");
    impl_.get_service().listen(impl_.get_implementation(),
        socket_base::max_listen_connections, ec);
    asio::detail::throw_error(ec, "listen");
  }

  /// Construct a basic_socket_acceptor on an existing native acceptor.
  /**
   * This constructor creates an acceptor object to hold an existing native
   * acceptor.
   *
   * @param ex The I/O executor that the acceptor will use, by default, to
   * dispatch handlers for any asynchronous operations performed on the
   * acceptor.
   *
   * @param protocol An object specifying protocol parameters to be used.
   *
   * @param native_acceptor A native acceptor.
   *
   * @throws asio::system_error Thrown on failure.
   */
  basic_socket_acceptor(const executor_type& ex,
      const protocol_type& protocol, const native_handle_type& native_acceptor)
    : impl_(0, ex)
  {
    asio::error_code ec;
    impl_.get_service().assign(impl_.get_implementation(),
        protocol, native_acceptor, ec);
    asio::detail::throw_error(ec, "assign");
  }

  /// Construct a basic_socket_acceptor on an existing native acceptor.
  /**
   * This constructor creates an acceptor object to hold an existing native
   * acceptor.
   *
   * @param context An execution context which provides the I/O executor that
   * the acceptor will use, by default, to dispatch handlers for any
   * asynchronous operations performed on the acceptor.
   *
   * @param protocol An object specifying protocol parameters to be used.
   *
   * @param native_acceptor A native acceptor.
   *
   * @throws asio::system_error Thrown on failure.
   */
  template <typename ExecutionContext>
  basic_socket_acceptor(ExecutionContext& context,
      const protocol_type& protocol, const native_handle_type& native_acceptor,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value
      > = 0)
    : impl_(0, 0, context)
  {
    asio::error_code ec;
    impl_.get_service().assign(impl_.get_implementation(),
        protocol, native_acceptor, ec);
    asio::detail::throw_error(ec, "assign");
  }

  /// Move-construct a basic_socket_acceptor from another.
  /**
   * This constructor moves an acceptor from one object to another.
   *
   * @param other The other basic_socket_acceptor object from which the move
   * will occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_socket_acceptor(const executor_type&)
   * constructor.
   */
  basic_socket_acceptor(basic_socket_acceptor&& other) noexcept
    : impl_(std::move(other.impl_))
  {
  }

  /// Move-assign a basic_socket_acceptor from another.
  /**
   * This assignment operator moves an acceptor from one object to another.
   *
   * @param other The other basic_socket_acceptor object from which the move
   * will occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_socket_acceptor(const executor_type&)
   * constructor.
   */
  basic_socket_acceptor& operator=(basic_socket_acceptor&& other)
  {
    impl_ = std::move(other.impl_);
    return *this;
  }

  // All socket acceptors have access to each other's implementations.
  template <typename Protocol1, typename Executor1>
  friend class basic_socket_acceptor;

  /// Move-construct a basic_socket_acceptor from an acceptor of another
  /// protocol type.
  /**
   * This constructor moves an acceptor from one object to another.
   *
   * @param other The other basic_socket_acceptor object from which the move
   * will occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_socket_acceptor(const executor_type&)
   * constructor.
   */
  template <typename Protocol1, typename Executor1>
  basic_socket_acceptor(basic_socket_acceptor<Protocol1, Executor1>&& other,
      constraint_t<
        is_convertible<Protocol1, Protocol>::value
          && is_convertible<Executor1, Executor>::value
      > = 0)
    : impl_(std::move(other.impl_))
  {
  }

  /// Move-assign a basic_socket_acceptor from an acceptor of another protocol
  /// type.
  /**
   * This assignment operator moves an acceptor from one object to another.
   *
   * @param other The other basic_socket_acceptor object from which the move
   * will occur.
   *
   * @note Following the move, the moved-from object is in the same state as if
   * constructed using the @c basic_socket_acceptor(const executor_type&)
   * constructor.
   */
  template <typename Protocol1, typename Executor1>
  constraint_t<
    is_convertible<Protocol1, Protocol>::value
      && is_convertible<Executor1, Executor>::value,
    basic_socket_acceptor&
  > operator=(basic_socket_acceptor<Protocol1, Executor1>&& other)
  {
    basic_socket_acceptor tmp(std::move(other));
    impl_ = std::move(tmp.impl_);
    return *this;
  }

  /// Destroys the acceptor.
  /**
   * This function destroys the acceptor, cancelling any outstanding
   * asynchronous operations associated with the acceptor as if by calling
   * @c cancel.
   */
  ~basic_socket_acceptor()
  {
  }

  /// Get the executor associated with the object.
  const executor_type& get_executor() noexcept
  {
    return impl_.get_executor();
  }

  /// Open the acceptor using the specified protocol.
  /**
   * This function opens the socket acceptor so that it will use the specified
   * protocol.
   *
   * @param protocol An object specifying which protocol is to be used.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * acceptor.open(asio::ip::tcp::v4());
   * @endcode
   */
  void open(const protocol_type& protocol = protocol_type())
  {
    asio::error_code ec;
    impl_.get_service().open(impl_.get_implementation(), protocol, ec);
    asio::detail::throw_error(ec, "open");
  }

  /// Open the acceptor using the specified protocol.
  /**
   * This function opens the socket acceptor so that it will use the specified
   * protocol.
   *
   * @param protocol An object specifying which protocol is to be used.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * asio::error_code ec;
   * acceptor.open(asio::ip::tcp::v4(), ec);
   * if (ec)
   * {
   *   // An error occurred.
   * }
   * @endcode
   */
  ASIO_SYNC_OP_VOID open(const protocol_type& protocol,
      asio::error_code& ec)
  {
    impl_.get_service().open(impl_.get_implementation(), protocol, ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Assigns an existing native acceptor to the acceptor.
  /*
   * This function opens the acceptor to hold an existing native acceptor.
   *
   * @param protocol An object specifying which protocol is to be used.
   *
   * @param native_acceptor A native acceptor.
   *
   * @throws asio::system_error Thrown on failure.
   */
  void assign(const protocol_type& protocol,
      const native_handle_type& native_acceptor)
  {
    asio::error_code ec;
    impl_.get_service().assign(impl_.get_implementation(),
        protocol, native_acceptor, ec);
    asio::detail::throw_error(ec, "assign");
  }

  /// Assigns an existing native acceptor to the acceptor.
  /*
   * This function opens the acceptor to hold an existing native acceptor.
   *
   * @param protocol An object specifying which protocol is to be used.
   *
   * @param native_acceptor A native acceptor.
   *
   * @param ec Set to indicate what error occurred, if any.
   */
  ASIO_SYNC_OP_VOID assign(const protocol_type& protocol,
      const native_handle_type& native_acceptor, asio::error_code& ec)
  {
    impl_.get_service().assign(impl_.get_implementation(),
        protocol, native_acceptor, ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Determine whether the acceptor is open.
  bool is_open() const
  {
    return impl_.get_service().is_open(impl_.get_implementation());
  }

  /// Bind the acceptor to the given local endpoint.
  /**
   * This function binds the socket acceptor to the specified endpoint on the
   * local machine.
   *
   * @param endpoint An endpoint on the local machine to which the socket
   * acceptor will be bound.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * asio::ip::tcp::endpoint endpoint(asio::ip::tcp::v4(), 12345);
   * acceptor.open(endpoint.protocol());
   * acceptor.bind(endpoint);
   * @endcode
   */
  void bind(const endpoint_type& endpoint)
  {
    asio::error_code ec;
    impl_.get_service().bind(impl_.get_implementation(), endpoint, ec);
    asio::detail::throw_error(ec, "bind");
  }

  /// Bind the acceptor to the given local endpoint.
  /**
   * This function binds the socket acceptor to the specified endpoint on the
   * local machine.
   *
   * @param endpoint An endpoint on the local machine to which the socket
   * acceptor will be bound.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * asio::ip::tcp::endpoint endpoint(asio::ip::tcp::v4(), 12345);
   * acceptor.open(endpoint.protocol());
   * asio::error_code ec;
   * acceptor.bind(endpoint, ec);
   * if (ec)
   * {
   *   // An error occurred.
   * }
   * @endcode
   */
  ASIO_SYNC_OP_VOID bind(const endpoint_type& endpoint,
      asio::error_code& ec)
  {
    impl_.get_service().bind(impl_.get_implementation(), endpoint, ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Place the acceptor into the state where it will listen for new
  /// connections.
  /**
   * This function puts the socket acceptor into the state where it may accept
   * new connections.
   *
   * @param backlog The maximum length of the queue of pending connections.
   *
   * @throws asio::system_error Thrown on failure.
   */
  void listen(int backlog = socket_base::max_listen_connections)
  {
    asio::error_code ec;
    impl_.get_service().listen(impl_.get_implementation(), backlog, ec);
    asio::detail::throw_error(ec, "listen");
  }

  /// Place the acceptor into the state where it will listen for new
  /// connections.
  /**
   * This function puts the socket acceptor into the state where it may accept
   * new connections.
   *
   * @param backlog The maximum length of the queue of pending connections.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::error_code ec;
   * acceptor.listen(asio::socket_base::max_listen_connections, ec);
   * if (ec)
   * {
   *   // An error occurred.
   * }
   * @endcode
   */
  ASIO_SYNC_OP_VOID listen(int backlog, asio::error_code& ec)
  {
    impl_.get_service().listen(impl_.get_implementation(), backlog, ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Close the acceptor.
  /**
   * This function is used to close the acceptor. Any asynchronous accept
   * operations will be cancelled immediately.
   *
   * A subsequent call to open() is required before the acceptor can again be
   * used to again perform socket accept operations.
   *
   * @throws asio::system_error Thrown on failure.
   */
  void close()
  {
    asio::error_code ec;
    impl_.get_service().close(impl_.get_implementation(), ec);
    asio::detail::throw_error(ec, "close");
  }

  /// Close the acceptor.
  /**
   * This function is used to close the acceptor. Any asynchronous accept
   * operations will be cancelled immediately.
   *
   * A subsequent call to open() is required before the acceptor can again be
   * used to again perform socket accept operations.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::error_code ec;
   * acceptor.close(ec);
   * if (ec)
   * {
   *   // An error occurred.
   * }
   * @endcode
   */
  ASIO_SYNC_OP_VOID close(asio::error_code& ec)
  {
    impl_.get_service().close(impl_.get_implementation(), ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Release ownership of the underlying native acceptor.
  /**
   * This function causes all outstanding asynchronous accept operations to
   * finish immediately, and the handlers for cancelled operations will be
   * passed the asio::error::operation_aborted error. Ownership of the
   * native acceptor is then transferred to the caller.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @note This function is unsupported on Windows versions prior to Windows
   * 8.1, and will fail with asio::error::operation_not_supported on
   * these platforms.
   */
#if defined(ASIO_MSVC) && (ASIO_MSVC >= 1400) \
  && (!defined(_WIN32_WINNT) || _WIN32_WINNT < 0x0603)
  __declspec(deprecated("This function always fails with "
        "operation_not_supported when used on Windows versions "
        "prior to Windows 8.1."))
#endif
  native_handle_type release()
  {
    asio::error_code ec;
    native_handle_type s = impl_.get_service().release(
        impl_.get_implementation(), ec);
    asio::detail::throw_error(ec, "release");
    return s;
  }

  /// Release ownership of the underlying native acceptor.
  /**
   * This function causes all outstanding asynchronous accept operations to
   * finish immediately, and the handlers for cancelled operations will be
   * passed the asio::error::operation_aborted error. Ownership of the
   * native acceptor is then transferred to the caller.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @note This function is unsupported on Windows versions prior to Windows
   * 8.1, and will fail with asio::error::operation_not_supported on
   * these platforms.
   */
#if defined(ASIO_MSVC) && (ASIO_MSVC >= 1400) \
  && (!defined(_WIN32_WINNT) || _WIN32_WINNT < 0x0603)
  __declspec(deprecated("This function always fails with "
        "operation_not_supported when used on Windows versions "
        "prior to Windows 8.1."))
#endif
  native_handle_type release(asio::error_code& ec)
  {
    return impl_.get_service().release(impl_.get_implementation(), ec);
  }

  /// Get the native acceptor representation.
  /**
   * This function may be used to obtain the underlying representation of the
   * acceptor. This is intended to allow access to native acceptor functionality
   * that is not otherwise provided.
   */
  native_handle_type native_handle()
  {
    return impl_.get_service().native_handle(impl_.get_implementation());
  }

  /// Cancel all asynchronous operations associated with the acceptor.
  /**
   * This function causes all outstanding asynchronous connect, send and receive
   * operations to finish immediately, and the handlers for cancelled operations
   * will be passed the asio::error::operation_aborted error.
   *
   * @throws asio::system_error Thrown on failure.
   */
  void cancel()
  {
    asio::error_code ec;
    impl_.get_service().cancel(impl_.get_implementation(), ec);
    asio::detail::throw_error(ec, "cancel");
  }

  /// Cancel all asynchronous operations associated with the acceptor.
  /**
   * This function causes all outstanding asynchronous connect, send and receive
   * operations to finish immediately, and the handlers for cancelled operations
   * will be passed the asio::error::operation_aborted error.
   *
   * @param ec Set to indicate what error occurred, if any.
   */
  ASIO_SYNC_OP_VOID cancel(asio::error_code& ec)
  {
    impl_.get_service().cancel(impl_.get_implementation(), ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Set an option on the acceptor.
  /**
   * This function is used to set an option on the acceptor.
   *
   * @param option The new option value to be set on the acceptor.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @sa SettableSocketOption @n
   * asio::socket_base::reuse_address
   * asio::socket_base::enable_connection_aborted
   *
   * @par Example
   * Setting the SOL_SOCKET/SO_REUSEADDR option:
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::acceptor::reuse_address option(true);
   * acceptor.set_option(option);
   * @endcode
   */
  template <typename SettableSocketOption>
  void set_option(const SettableSocketOption& option)
  {
    asio::error_code ec;
    impl_.get_service().set_option(impl_.get_implementation(), option, ec);
    asio::detail::throw_error(ec, "set_option");
  }

  /// Set an option on the acceptor.
  /**
   * This function is used to set an option on the acceptor.
   *
   * @param option The new option value to be set on the acceptor.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @sa SettableSocketOption @n
   * asio::socket_base::reuse_address
   * asio::socket_base::enable_connection_aborted
   *
   * @par Example
   * Setting the SOL_SOCKET/SO_REUSEADDR option:
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::acceptor::reuse_address option(true);
   * asio::error_code ec;
   * acceptor.set_option(option, ec);
   * if (ec)
   * {
   *   // An error occurred.
   * }
   * @endcode
   */
  template <typename SettableSocketOption>
  ASIO_SYNC_OP_VOID set_option(const SettableSocketOption& option,
      asio::error_code& ec)
  {
    impl_.get_service().set_option(impl_.get_implementation(), option, ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Get an option from the acceptor.
  /**
   * This function is used to get the current value of an option on the
   * acceptor.
   *
   * @param option The option value to be obtained from the acceptor.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @sa GettableSocketOption @n
   * asio::socket_base::reuse_address
   *
   * @par Example
   * Getting the value of the SOL_SOCKET/SO_REUSEADDR option:
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::acceptor::reuse_address option;
   * acceptor.get_option(option);
   * bool is_set = option.get();
   * @endcode
   */
  template <typename GettableSocketOption>
  void get_option(GettableSocketOption& option) const
  {
    asio::error_code ec;
    impl_.get_service().get_option(impl_.get_implementation(), option, ec);
    asio::detail::throw_error(ec, "get_option");
  }

  /// Get an option from the acceptor.
  /**
   * This function is used to get the current value of an option on the
   * acceptor.
   *
   * @param option The option value to be obtained from the acceptor.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @sa GettableSocketOption @n
   * asio::socket_base::reuse_address
   *
   * @par Example
   * Getting the value of the SOL_SOCKET/SO_REUSEADDR option:
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::acceptor::reuse_address option;
   * asio::error_code ec;
   * acceptor.get_option(option, ec);
   * if (ec)
   * {
   *   // An error occurred.
   * }
   * bool is_set = option.get();
   * @endcode
   */
  template <typename GettableSocketOption>
  ASIO_SYNC_OP_VOID get_option(GettableSocketOption& option,
      asio::error_code& ec) const
  {
    impl_.get_service().get_option(impl_.get_implementation(), option, ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Perform an IO control command on the acceptor.
  /**
   * This function is used to execute an IO control command on the acceptor.
   *
   * @param command The IO control command to be performed on the acceptor.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @sa IoControlCommand @n
   * asio::socket_base::non_blocking_io
   *
   * @par Example
   * Getting the number of bytes ready to read:
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::acceptor::non_blocking_io command(true);
   * socket.io_control(command);
   * @endcode
   */
  template <typename IoControlCommand>
  void io_control(IoControlCommand& command)
  {
    asio::error_code ec;
    impl_.get_service().io_control(impl_.get_implementation(), command, ec);
    asio::detail::throw_error(ec, "io_control");
  }

  /// Perform an IO control command on the acceptor.
  /**
   * This function is used to execute an IO control command on the acceptor.
   *
   * @param command The IO control command to be performed on the acceptor.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @sa IoControlCommand @n
   * asio::socket_base::non_blocking_io
   *
   * @par Example
   * Getting the number of bytes ready to read:
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::acceptor::non_blocking_io command(true);
   * asio::error_code ec;
   * socket.io_control(command, ec);
   * if (ec)
   * {
   *   // An error occurred.
   * }
   * @endcode
   */
  template <typename IoControlCommand>
  ASIO_SYNC_OP_VOID io_control(IoControlCommand& command,
      asio::error_code& ec)
  {
    impl_.get_service().io_control(impl_.get_implementation(), command, ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Gets the non-blocking mode of the acceptor.
  /**
   * @returns @c true if the acceptor's synchronous operations will fail with
   * asio::error::would_block if they are unable to perform the requested
   * operation immediately. If @c false, synchronous operations will block
   * until complete.
   *
   * @note The non-blocking mode has no effect on the behaviour of asynchronous
   * operations. Asynchronous operations will never fail with the error
   * asio::error::would_block.
   */
  bool non_blocking() const
  {
    return impl_.get_service().non_blocking(impl_.get_implementation());
  }

  /// Sets the non-blocking mode of the acceptor.
  /**
   * @param mode If @c true, the acceptor's synchronous operations will fail
   * with asio::error::would_block if they are unable to perform the
   * requested operation immediately. If @c false, synchronous operations will
   * block until complete.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @note The non-blocking mode has no effect on the behaviour of asynchronous
   * operations. Asynchronous operations will never fail with the error
   * asio::error::would_block.
   */
  void non_blocking(bool mode)
  {
    asio::error_code ec;
    impl_.get_service().non_blocking(impl_.get_implementation(), mode, ec);
    asio::detail::throw_error(ec, "non_blocking");
  }

  /// Sets the non-blocking mode of the acceptor.
  /**
   * @param mode If @c true, the acceptor's synchronous operations will fail
   * with asio::error::would_block if they are unable to perform the
   * requested operation immediately. If @c false, synchronous operations will
   * block until complete.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @note The non-blocking mode has no effect on the behaviour of asynchronous
   * operations. Asynchronous operations will never fail with the error
   * asio::error::would_block.
   */
  ASIO_SYNC_OP_VOID non_blocking(
      bool mode, asio::error_code& ec)
  {
    impl_.get_service().non_blocking(impl_.get_implementation(), mode, ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Gets the non-blocking mode of the native acceptor implementation.
  /**
   * This function is used to retrieve the non-blocking mode of the underlying
   * native acceptor. This mode has no effect on the behaviour of the acceptor
   * object's synchronous operations.
   *
   * @returns @c true if the underlying acceptor is in non-blocking mode and
   * direct system calls may fail with asio::error::would_block (or the
   * equivalent system error).
   *
   * @note The current non-blocking mode is cached by the acceptor object.
   * Consequently, the return value may be incorrect if the non-blocking mode
   * was set directly on the native acceptor.
   */
  bool native_non_blocking() const
  {
    return impl_.get_service().native_non_blocking(impl_.get_implementation());
  }

  /// Sets the non-blocking mode of the native acceptor implementation.
  /**
   * This function is used to modify the non-blocking mode of the underlying
   * native acceptor. It has no effect on the behaviour of the acceptor object's
   * synchronous operations.
   *
   * @param mode If @c true, the underlying acceptor is put into non-blocking
   * mode and direct system calls may fail with asio::error::would_block
   * (or the equivalent system error).
   *
   * @throws asio::system_error Thrown on failure. If the @c mode is
   * @c false, but the current value of @c non_blocking() is @c true, this
   * function fails with asio::error::invalid_argument, as the
   * combination does not make sense.
   */
  void native_non_blocking(bool mode)
  {
    asio::error_code ec;
    impl_.get_service().native_non_blocking(
        impl_.get_implementation(), mode, ec);
    asio::detail::throw_error(ec, "native_non_blocking");
  }

  /// Sets the non-blocking mode of the native acceptor implementation.
  /**
   * This function is used to modify the non-blocking mode of the underlying
   * native acceptor. It has no effect on the behaviour of the acceptor object's
   * synchronous operations.
   *
   * @param mode If @c true, the underlying acceptor is put into non-blocking
   * mode and direct system calls may fail with asio::error::would_block
   * (or the equivalent system error).
   *
   * @param ec Set to indicate what error occurred, if any. If the @c mode is
   * @c false, but the current value of @c non_blocking() is @c true, this
   * function fails with asio::error::invalid_argument, as the
   * combination does not make sense.
   */
  ASIO_SYNC_OP_VOID native_non_blocking(
      bool mode, asio::error_code& ec)
  {
    impl_.get_service().native_non_blocking(
        impl_.get_implementation(), mode, ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Get the local endpoint of the acceptor.
  /**
   * This function is used to obtain the locally bound endpoint of the acceptor.
   *
   * @returns An object that represents the local endpoint of the acceptor.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::endpoint endpoint = acceptor.local_endpoint();
   * @endcode
   */
  endpoint_type local_endpoint() const
  {
    asio::error_code ec;
    endpoint_type ep = impl_.get_service().local_endpoint(
        impl_.get_implementation(), ec);
    asio::detail::throw_error(ec, "local_endpoint");
    return ep;
  }

  /// Get the local endpoint of the acceptor.
  /**
   * This function is used to obtain the locally bound endpoint of the acceptor.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @returns An object that represents the local endpoint of the acceptor.
   * Returns a default-constructed endpoint object if an error occurred and the
   * error handler did not throw an exception.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::error_code ec;
   * asio::ip::tcp::endpoint endpoint = acceptor.local_endpoint(ec);
   * if (ec)
   * {
   *   // An error occurred.
   * }
   * @endcode
   */
  endpoint_type local_endpoint(asio::error_code& ec) const
  {
    return impl_.get_service().local_endpoint(impl_.get_implementation(), ec);
  }

  /// Wait for the acceptor to become ready to read, ready to write, or to have
  /// pending error conditions.
  /**
   * This function is used to perform a blocking wait for an acceptor to enter
   * a ready to read, write or error condition state.
   *
   * @param w Specifies the desired acceptor state.
   *
   * @par Example
   * Waiting for an acceptor to become readable.
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * acceptor.wait(asio::ip::tcp::acceptor::wait_read);
   * @endcode
   */
  void wait(wait_type w)
  {
    asio::error_code ec;
    impl_.get_service().wait(impl_.get_implementation(), w, ec);
    asio::detail::throw_error(ec, "wait");
  }

  /// Wait for the acceptor to become ready to read, ready to write, or to have
  /// pending error conditions.
  /**
   * This function is used to perform a blocking wait for an acceptor to enter
   * a ready to read, write or error condition state.
   *
   * @param w Specifies the desired acceptor state.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @par Example
   * Waiting for an acceptor to become readable.
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::error_code ec;
   * acceptor.wait(asio::ip::tcp::acceptor::wait_read, ec);
   * @endcode
   */
  ASIO_SYNC_OP_VOID wait(wait_type w, asio::error_code& ec)
  {
    impl_.get_service().wait(impl_.get_implementation(), w, ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Asynchronously wait for the acceptor to become ready to read, ready to
  /// write, or to have pending error conditions.
  /**
   * This function is used to perform an asynchronous wait for an acceptor to
   * enter a ready to read, write or error condition state. It is an initiating
   * function for an @ref asynchronous_operation, and always returns
   * immediately.
   *
   * @param w Specifies the desired acceptor state.
   *
   * @param token The @ref completion_token that will be used to produce a
   * completion handler, which will be called when the wait completes.
   * Potential completion tokens include @ref use_future, @ref use_awaitable,
   * @ref yield_context, or a function object with the correct completion
   * signature. The function signature of the completion handler must be:
   * @code void handler(
   *   const asio::error_code& error // Result of operation.
   * ); @endcode
   * Regardless of whether the asynchronous operation completes immediately or
   * not, the completion handler will not be invoked from within this function.
   * On immediate completion, invocation of the handler will be performed in a
   * manner equivalent to using asio::async_immediate().
   *
   * @par Completion Signature
   * @code void(asio::error_code) @endcode
   *
   * @par Example
   * @code
   * void wait_handler(const asio::error_code& error)
   * {
   *   if (!error)
   *   {
   *     // Wait succeeded.
   *   }
   * }
   *
   * ...
   *
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * acceptor.async_wait(
   *     asio::ip::tcp::acceptor::wait_read,
   *     wait_handler);
   * @endcode
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
  template <
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code))
        WaitToken = default_completion_token_t<executor_type>>
  auto async_wait(wait_type w,
      WaitToken&& token = default_completion_token_t<executor_type>())
    -> decltype(
      async_initiate<WaitToken, void (asio::error_code)>(
        declval<initiate_async_wait>(), token, w))
  {
    return async_initiate<WaitToken, void (asio::error_code)>(
        initiate_async_wait(this), token, w);
  }

#if !defined(ASIO_NO_EXTENSIONS)
  /// Accept a new connection.
  /**
   * This function is used to accept a new connection from a peer into the
   * given socket. The function call will block until a new connection has been
   * accepted successfully or an error occurs.
   *
   * @param peer The socket into which the new connection will be accepted.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::socket socket(my_context);
   * acceptor.accept(socket);
   * @endcode
   */
  template <typename Protocol1, typename Executor1>
  void accept(basic_socket<Protocol1, Executor1>& peer,
      constraint_t<
        is_convertible<Protocol, Protocol1>::value
      > = 0)
  {
    asio::error_code ec;
    impl_.get_service().accept(impl_.get_implementation(),
        peer, static_cast<endpoint_type*>(0), ec);
    asio::detail::throw_error(ec, "accept");
  }

  /// Accept a new connection.
  /**
   * This function is used to accept a new connection from a peer into the
   * given socket. The function call will block until a new connection has been
   * accepted successfully or an error occurs.
   *
   * @param peer The socket into which the new connection will be accepted.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::socket socket(my_context);
   * asio::error_code ec;
   * acceptor.accept(socket, ec);
   * if (ec)
   * {
   *   // An error occurred.
   * }
   * @endcode
   */
  template <typename Protocol1, typename Executor1>
  ASIO_SYNC_OP_VOID accept(
      basic_socket<Protocol1, Executor1>& peer, asio::error_code& ec,
      constraint_t<
        is_convertible<Protocol, Protocol1>::value
      > = 0)
  {
    impl_.get_service().accept(impl_.get_implementation(),
        peer, static_cast<endpoint_type*>(0), ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Start an asynchronous accept.
  /**
   * This function is used to asynchronously accept a new connection into a
   * socket, and additionally obtain the endpoint of the remote peer. It is an
   * initiating function for an @ref asynchronous_operation, and always returns
   * immediately.
   *
   * @param peer The socket into which the new connection will be accepted.
   * Ownership of the peer object is retained by the caller, which must
   * guarantee that it is valid until the completion handler is called.
   *
   * @param token The @ref completion_token that will be used to produce a
   * completion handler, which will be called when the accept completes.
   * Potential completion tokens include @ref use_future, @ref use_awaitable,
   * @ref yield_context, or a function object with the correct completion
   * signature. The function signature of the completion handler must be:
   * @code void handler(
   *   const asio::error_code& error // Result of operation.
   * ); @endcode
   * Regardless of whether the asynchronous operation completes immediately or
   * not, the completion handler will not be invoked from within this function.
   * On immediate completion, invocation of the handler will be performed in a
   * manner equivalent to using asio::async_immediate().
   *
   * @par Completion Signature
   * @code void(asio::error_code) @endcode
   *
   * @par Example
   * @code
   * void accept_handler(const asio::error_code& error)
   * {
   *   if (!error)
   *   {
   *     // Accept succeeded.
   *   }
   * }
   *
   * ...
   *
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::socket socket(my_context);
   * acceptor.async_accept(socket, accept_handler);
   * @endcode
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
  template <typename Protocol1, typename Executor1,
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code))
        AcceptToken = default_completion_token_t<executor_type>>
  auto async_accept(basic_socket<Protocol1, Executor1>& peer,
      AcceptToken&& token = default_completion_token_t<executor_type>(),
      constraint_t<
        is_convertible<Protocol, Protocol1>::value
      > = 0)
    -> decltype(
      async_initiate<AcceptToken, void (asio::error_code)>(
        declval<initiate_async_accept>(), token,
        &peer, static_cast<endpoint_type*>(0)))
  {
    return async_initiate<AcceptToken, void (asio::error_code)>(
        initiate_async_accept(this), token,
        &peer, static_cast<endpoint_type*>(0));
  }

  /// Accept a new connection and obtain the endpoint of the peer
  /**
   * This function is used to accept a new connection from a peer into the
   * given socket, and additionally provide the endpoint of the remote peer.
   * The function call will block until a new connection has been accepted
   * successfully or an error occurs.
   *
   * @param peer The socket into which the new connection will be accepted.
   *
   * @param peer_endpoint An endpoint object which will receive the endpoint of
   * the remote peer.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::socket socket(my_context);
   * asio::ip::tcp::endpoint endpoint;
   * acceptor.accept(socket, endpoint);
   * @endcode
   */
  template <typename Executor1>
  void accept(basic_socket<protocol_type, Executor1>& peer,
      endpoint_type& peer_endpoint)
  {
    asio::error_code ec;
    impl_.get_service().accept(impl_.get_implementation(),
        peer, &peer_endpoint, ec);
    asio::detail::throw_error(ec, "accept");
  }

  /// Accept a new connection and obtain the endpoint of the peer
  /**
   * This function is used to accept a new connection from a peer into the
   * given socket, and additionally provide the endpoint of the remote peer.
   * The function call will block until a new connection has been accepted
   * successfully or an error occurs.
   *
   * @param peer The socket into which the new connection will be accepted.
   *
   * @param peer_endpoint An endpoint object which will receive the endpoint of
   * the remote peer.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::socket socket(my_context);
   * asio::ip::tcp::endpoint endpoint;
   * asio::error_code ec;
   * acceptor.accept(socket, endpoint, ec);
   * if (ec)
   * {
   *   // An error occurred.
   * }
   * @endcode
   */
  template <typename Executor1>
  ASIO_SYNC_OP_VOID accept(basic_socket<protocol_type, Executor1>& peer,
      endpoint_type& peer_endpoint, asio::error_code& ec)
  {
    impl_.get_service().accept(
        impl_.get_implementation(), peer, &peer_endpoint, ec);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  /// Start an asynchronous accept.
  /**
   * This function is used to asynchronously accept a new connection into a
   * socket, and additionally obtain the endpoint of the remote peer. It is an
   * initiating function for an @ref asynchronous_operation, and always returns
   * immediately.
   *
   * @param peer The socket into which the new connection will be accepted.
   * Ownership of the peer object is retained by the caller, which must
   * guarantee that it is valid until the completion handler is called.
   *
   * @param peer_endpoint An endpoint object into which the endpoint of the
   * remote peer will be written. Ownership of the peer_endpoint object is
   * retained by the caller, which must guarantee that it is valid until the
   * handler is called.
   *
   * @param token The @ref completion_token that will be used to produce a
   * completion handler, which will be called when the accept completes.
   * Potential completion tokens include @ref use_future, @ref use_awaitable,
   * @ref yield_context, or a function object with the correct completion
   * signature. The function signature of the completion handler must be:
   * @code void handler(
   *   const asio::error_code& error // Result of operation.
   * ); @endcode
   * Regardless of whether the asynchronous operation completes immediately or
   * not, the completion handler will not be invoked from within this function.
   * On immediate completion, invocation of the handler will be performed in a
   * manner equivalent to using asio::async_immediate().
   *
   * @par Completion Signature
   * @code void(asio::error_code) @endcode
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
  template <typename Executor1,
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code))
        AcceptToken = default_completion_token_t<executor_type>>
  auto async_accept(basic_socket<protocol_type, Executor1>& peer,
      endpoint_type& peer_endpoint,
      AcceptToken&& token = default_completion_token_t<executor_type>())
    -> decltype(
      async_initiate<AcceptToken, void (asio::error_code)>(
        declval<initiate_async_accept>(), token, &peer, &peer_endpoint))
  {
    return async_initiate<AcceptToken, void (asio::error_code)>(
        initiate_async_accept(this), token, &peer, &peer_endpoint);
  }
#endif // !defined(ASIO_NO_EXTENSIONS)

  /// Accept a new connection.
  /**
   * This function is used to accept a new connection from a peer. The function
   * call will block until a new connection has been accepted successfully or
   * an error occurs.
   *
   * This overload requires that the Protocol template parameter satisfy the
   * AcceptableProtocol type requirements.
   *
   * @returns A socket object representing the newly accepted connection.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::socket socket(acceptor.accept());
   * @endcode
   */
  typename Protocol::socket::template rebind_executor<executor_type>::other
  accept()
  {
    asio::error_code ec;
    typename Protocol::socket::template rebind_executor<
      executor_type>::other peer(impl_.get_executor());
    impl_.get_service().accept(impl_.get_implementation(), peer, 0, ec);
    asio::detail::throw_error(ec, "accept");
    return peer;
  }

  /// Accept a new connection.
  /**
   * This function is used to accept a new connection from a peer. The function
   * call will block until a new connection has been accepted successfully or
   * an error occurs.
   *
   * This overload requires that the Protocol template parameter satisfy the
   * AcceptableProtocol type requirements.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @returns On success, a socket object representing the newly accepted
   * connection. On error, a socket object where is_open() is false.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::socket socket(acceptor.accept(ec));
   * if (ec)
   * {
   *   // An error occurred.
   * }
   * @endcode
   */
  typename Protocol::socket::template rebind_executor<executor_type>::other
  accept(asio::error_code& ec)
  {
    typename Protocol::socket::template rebind_executor<
      executor_type>::other peer(impl_.get_executor());
    impl_.get_service().accept(impl_.get_implementation(), peer, 0, ec);
    return peer;
  }

  /// Start an asynchronous accept.
  /**
   * This function is used to asynchronously accept a new connection. It is an
   * initiating function for an @ref asynchronous_operation, and always returns
   * immediately.
   *
   * This overload requires that the Protocol template parameter satisfy the
   * AcceptableProtocol type requirements.
   *
   * @param token The @ref completion_token that will be used to produce a
   * completion handler, which will be called when the accept completes.
   * Potential completion tokens include @ref use_future, @ref use_awaitable,
   * @ref yield_context, or a function object with the correct completion
   * signature. The function signature of the completion handler must be:
   * @code void handler(
   *   // Result of operation.
   *   const asio::error_code& error,
   *
   *   // On success, the newly accepted socket.
   *   typename Protocol::socket::template
   *     rebind_executor<executor_type>::other peer
   * ); @endcode
   * Regardless of whether the asynchronous operation completes immediately or
   * not, the completion handler will not be invoked from within this function.
   * On immediate completion, invocation of the handler will be performed in a
   * manner equivalent to using asio::async_immediate().
   *
   * @par Completion Signature
   * @code void(asio::error_code,
   *    typename Protocol::socket::template
   *      rebind_executor<executor_type>::other)) @endcode
   *
   * @par Example
   * @code
   * void accept_handler(const asio::error_code& error,
   *     asio::ip::tcp::socket peer)
   * {
   *   if (!error)
   *   {
   *     // Accept succeeded.
   *   }
   * }
   *
   * ...
   *
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * acceptor.async_accept(accept_handler);
   * @endcode
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
  template <
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
        typename Protocol::socket::template rebind_executor<
          executor_type>::other)) MoveAcceptToken
            = default_completion_token_t<executor_type>>
  auto async_accept(
      MoveAcceptToken&& token = default_completion_token_t<executor_type>())
    -> decltype(
      async_initiate<MoveAcceptToken,
        void (asio::error_code, typename Protocol::socket::template
          rebind_executor<executor_type>::other)>(
            declval<initiate_async_move_accept>(), token,
            declval<const executor_type&>(), static_cast<endpoint_type*>(0),
            static_cast<typename Protocol::socket::template
              rebind_executor<executor_type>::other*>(0)))
  {
    return async_initiate<MoveAcceptToken,
      void (asio::error_code, typename Protocol::socket::template
        rebind_executor<executor_type>::other)>(
          initiate_async_move_accept(this), token,
          impl_.get_executor(), static_cast<endpoint_type*>(0),
          static_cast<typename Protocol::socket::template
            rebind_executor<executor_type>::other*>(0));
  }

  /// Accept a new connection.
  /**
   * This function is used to accept a new connection from a peer. The function
   * call will block until a new connection has been accepted successfully or
   * an error occurs.
   *
   * This overload requires that the Protocol template parameter satisfy the
   * AcceptableProtocol type requirements.
   *
   * @param ex The I/O executor object to be used for the newly
   * accepted socket.
   *
   * @returns A socket object representing the newly accepted connection.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::socket socket(acceptor.accept());
   * @endcode
   */
  template <typename Executor1>
  typename Protocol::socket::template rebind_executor<Executor1>::other
  accept(const Executor1& ex,
      constraint_t<
        is_executor<Executor1>::value
          || execution::is_executor<Executor1>::value
      > = 0)
  {
    asio::error_code ec;
    typename Protocol::socket::template
      rebind_executor<Executor1>::other peer(ex);
    impl_.get_service().accept(impl_.get_implementation(), peer, 0, ec);
    asio::detail::throw_error(ec, "accept");
    return peer;
  }

  /// Accept a new connection.
  /**
   * This function is used to accept a new connection from a peer. The function
   * call will block until a new connection has been accepted successfully or
   * an error occurs.
   *
   * This overload requires that the Protocol template parameter satisfy the
   * AcceptableProtocol type requirements.
   *
   * @param context The I/O execution context object to be used for the newly
   * accepted socket.
   *
   * @returns A socket object representing the newly accepted connection.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::socket socket(acceptor.accept());
   * @endcode
   */
  template <typename ExecutionContext>
  typename Protocol::socket::template rebind_executor<
      typename ExecutionContext::executor_type>::other
  accept(ExecutionContext& context,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value
      > = 0)
  {
    asio::error_code ec;
    typename Protocol::socket::template rebind_executor<
        typename ExecutionContext::executor_type>::other peer(context);
    impl_.get_service().accept(impl_.get_implementation(), peer, 0, ec);
    asio::detail::throw_error(ec, "accept");
    return peer;
  }

  /// Accept a new connection.
  /**
   * This function is used to accept a new connection from a peer. The function
   * call will block until a new connection has been accepted successfully or
   * an error occurs.
   *
   * This overload requires that the Protocol template parameter satisfy the
   * AcceptableProtocol type requirements.
   *
   * @param ex The I/O executor object to be used for the newly accepted
   * socket.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @returns On success, a socket object representing the newly accepted
   * connection. On error, a socket object where is_open() is false.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::socket socket(acceptor.accept(my_context2, ec));
   * if (ec)
   * {
   *   // An error occurred.
   * }
   * @endcode
   */
  template <typename Executor1>
  typename Protocol::socket::template rebind_executor<Executor1>::other
  accept(const Executor1& ex, asio::error_code& ec,
      constraint_t<
        is_executor<Executor1>::value
          || execution::is_executor<Executor1>::value
      > = 0)
  {
    typename Protocol::socket::template
      rebind_executor<Executor1>::other peer(ex);
    impl_.get_service().accept(impl_.get_implementation(), peer, 0, ec);
    return peer;
  }

  /// Accept a new connection.
  /**
   * This function is used to accept a new connection from a peer. The function
   * call will block until a new connection has been accepted successfully or
   * an error occurs.
   *
   * This overload requires that the Protocol template parameter satisfy the
   * AcceptableProtocol type requirements.
   *
   * @param context The I/O execution context object to be used for the newly
   * accepted socket.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @returns On success, a socket object representing the newly accepted
   * connection. On error, a socket object where is_open() is false.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::socket socket(acceptor.accept(my_context2, ec));
   * if (ec)
   * {
   *   // An error occurred.
   * }
   * @endcode
   */
  template <typename ExecutionContext>
  typename Protocol::socket::template rebind_executor<
      typename ExecutionContext::executor_type>::other
  accept(ExecutionContext& context, asio::error_code& ec,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value
      > = 0)
  {
    typename Protocol::socket::template rebind_executor<
        typename ExecutionContext::executor_type>::other peer(context);
    impl_.get_service().accept(impl_.get_implementation(), peer, 0, ec);
    return peer;
  }

  /// Start an asynchronous accept.
  /**
   * This function is used to asynchronously accept a new connection. It is an
   * initiating function for an @ref asynchronous_operation, and always returns
   * immediately.
   *
   * This overload requires that the Protocol template parameter satisfy the
   * AcceptableProtocol type requirements.
   *
   * @param ex The I/O executor object to be used for the newly accepted
   * socket.
   *
   * @param token The @ref completion_token that will be used to produce a
   * completion handler, which will be called when the accept completes.
   * Potential completion tokens include @ref use_future, @ref use_awaitable,
   * @ref yield_context, or a function object with the correct completion
   * signature. The function signature of the completion handler must be:
   * @code void handler(
   *   // Result of operation.
   *   const asio::error_code& error,
   *
   *   // On success, the newly accepted socket.
   *   typename Protocol::socket::template rebind_executor<
   *     Executor1>::other peer
   * ); @endcode
   * Regardless of whether the asynchronous operation completes immediately or
   * not, the completion handler will not be invoked from within this function.
   * On immediate completion, invocation of the handler will be performed in a
   * manner equivalent to using asio::async_immediate().
   *
   * @par Completion Signature
   * @code void(asio::error_code,
   *    typename Protocol::socket::template rebind_executor<
   *      Executor1>::other)) @endcode
   *
   * @par Example
   * @code
   * void accept_handler(const asio::error_code& error,
   *     asio::ip::tcp::socket peer)
   * {
   *   if (!error)
   *   {
   *     // Accept succeeded.
   *   }
   * }
   *
   * ...
   *
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * acceptor.async_accept(my_context2, accept_handler);
   * @endcode
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
  template <typename Executor1,
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
        typename Protocol::socket::template rebind_executor<
          constraint_t<is_executor<Executor1>::value
            || execution::is_executor<Executor1>::value,
              Executor1>>::other)) MoveAcceptToken
                = default_completion_token_t<executor_type>>
  auto async_accept(const Executor1& ex,
      MoveAcceptToken&& token = default_completion_token_t<executor_type>(),
      constraint_t<
        is_executor<Executor1>::value
          || execution::is_executor<Executor1>::value
      > = 0)
    -> decltype(
      async_initiate<MoveAcceptToken,
        void (asio::error_code,
          typename Protocol::socket::template rebind_executor<
            Executor1>::other)>(
              declval<initiate_async_move_accept>(), token,
              ex, static_cast<endpoint_type*>(0),
              static_cast<typename Protocol::socket::template
                rebind_executor<Executor1>::other*>(0)))
  {
    return async_initiate<MoveAcceptToken,
      void (asio::error_code,
        typename Protocol::socket::template rebind_executor<
          Executor1>::other)>(
            initiate_async_move_accept(this), token,
            ex, static_cast<endpoint_type*>(0),
            static_cast<typename Protocol::socket::template
              rebind_executor<Executor1>::other*>(0));
  }

  /// Start an asynchronous accept.
  /**
   * This function is used to asynchronously accept a new connection. It is an
   * initiating function for an @ref asynchronous_operation, and always returns
   * immediately.
   *
   * This overload requires that the Protocol template parameter satisfy the
   * AcceptableProtocol type requirements.
   *
   * @param context The I/O execution context object to be used for the newly
   * accepted socket.
   *
   * @param token The @ref completion_token that will be used to produce a
   * completion handler, which will be called when the accept completes.
   * Potential completion tokens include @ref use_future, @ref use_awaitable,
   * @ref yield_context, or a function object with the correct completion
   * signature. The function signature of the completion handler must be:
   * @code void handler(
   *   // Result of operation.
   *   const asio::error_code& error,
   *
   *   // On success, the newly accepted socket.
   *   typename Protocol::socket::template rebind_executor<
   *     typename ExecutionContext::executor_type>::other peer
   * ); @endcode
   * Regardless of whether the asynchronous operation completes immediately or
   * not, the completion handler will not be invoked from within this function.
   * On immediate completion, invocation of the handler will be performed in a
   * manner equivalent to using asio::async_immediate().
   *
   * @par Completion Signature
   * @code void(asio::error_code,
   *    typename Protocol::socket::template rebind_executor<
   *      typename ExecutionContext::executor_type>::other)) @endcode
   *
   * @par Example
   * @code
   * void accept_handler(const asio::error_code& error,
   *     asio::ip::tcp::socket peer)
   * {
   *   if (!error)
   *   {
   *     // Accept succeeded.
   *   }
   * }
   *
   * ...
   *
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * acceptor.async_accept(my_context2, accept_handler);
   * @endcode
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
  template <typename ExecutionContext,
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
        typename Protocol::socket::template rebind_executor<
          typename ExecutionContext::executor_type>::other)) MoveAcceptToken
            = default_completion_token_t<executor_type>>
  auto async_accept(ExecutionContext& context,
      MoveAcceptToken&& token = default_completion_token_t<executor_type>(),
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value
      > = 0)
    -> decltype(
      async_initiate<MoveAcceptToken,
        void (asio::error_code,
          typename Protocol::socket::template rebind_executor<
            typename ExecutionContext::executor_type>::other)>(
              declval<initiate_async_move_accept>(), token,
              context.get_executor(), static_cast<endpoint_type*>(0),
              static_cast<typename Protocol::socket::template rebind_executor<
                typename ExecutionContext::executor_type>::other*>(0)))
  {
    return async_initiate<MoveAcceptToken,
      void (asio::error_code,
        typename Protocol::socket::template rebind_executor<
          typename ExecutionContext::executor_type>::other)>(
            initiate_async_move_accept(this), token,
            context.get_executor(), static_cast<endpoint_type*>(0),
            static_cast<typename Protocol::socket::template rebind_executor<
              typename ExecutionContext::executor_type>::other*>(0));
  }

  /// Accept a new connection.
  /**
   * This function is used to accept a new connection from a peer. The function
   * call will block until a new connection has been accepted successfully or
   * an error occurs.
   *
   * This overload requires that the Protocol template parameter satisfy the
   * AcceptableProtocol type requirements.
   *
   * @param peer_endpoint An endpoint object into which the endpoint of the
   * remote peer will be written.
   *
   * @returns A socket object representing the newly accepted connection.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::endpoint endpoint;
   * asio::ip::tcp::socket socket(acceptor.accept(endpoint));
   * @endcode
   */
  typename Protocol::socket::template rebind_executor<executor_type>::other
  accept(endpoint_type& peer_endpoint)
  {
    asio::error_code ec;
    typename Protocol::socket::template rebind_executor<
      executor_type>::other peer(impl_.get_executor());
    impl_.get_service().accept(impl_.get_implementation(),
        peer, &peer_endpoint, ec);
    asio::detail::throw_error(ec, "accept");
    return peer;
  }

  /// Accept a new connection.
  /**
   * This function is used to accept a new connection from a peer. The function
   * call will block until a new connection has been accepted successfully or
   * an error occurs.
   *
   * This overload requires that the Protocol template parameter satisfy the
   * AcceptableProtocol type requirements.
   *
   * @param peer_endpoint An endpoint object into which the endpoint of the
   * remote peer will be written.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @returns On success, a socket object representing the newly accepted
   * connection. On error, a socket object where is_open() is false.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::endpoint endpoint;
   * asio::ip::tcp::socket socket(acceptor.accept(endpoint, ec));
   * if (ec)
   * {
   *   // An error occurred.
   * }
   * @endcode
   */
  typename Protocol::socket::template rebind_executor<executor_type>::other
  accept(endpoint_type& peer_endpoint, asio::error_code& ec)
  {
    typename Protocol::socket::template rebind_executor<
      executor_type>::other peer(impl_.get_executor());
    impl_.get_service().accept(impl_.get_implementation(),
        peer, &peer_endpoint, ec);
    return peer;
  }

  /// Start an asynchronous accept.
  /**
   * This function is used to asynchronously accept a new connection. It is an
   * initiating function for an @ref asynchronous_operation, and always returns
   * immediately.
   *
   * This overload requires that the Protocol template parameter satisfy the
   * AcceptableProtocol type requirements.
   *
   * @param peer_endpoint An endpoint object into which the endpoint of the
   * remote peer will be written. Ownership of the peer_endpoint object is
   * retained by the caller, which must guarantee that it is valid until the
   * completion handler is called.
   *
   * @param token The @ref completion_token that will be used to produce a
   * completion handler, which will be called when the accept completes.
   * Potential completion tokens include @ref use_future, @ref use_awaitable,
   * @ref yield_context, or a function object with the correct completion
   * signature. The function signature of the completion handler must be:
   * @code void handler(
   *   // Result of operation.
   *   const asio::error_code& error,
   *
   *   // On success, the newly accepted socket.
   *   typename Protocol::socket::template
   *     rebind_executor<executor_type>::other peer
   * ); @endcode
   * Regardless of whether the asynchronous operation completes immediately or
   * not, the completion handler will not be invoked from within this function.
   * On immediate completion, invocation of the handler will be performed in a
   * manner equivalent to using asio::async_immediate().
   *
   * @par Completion Signature
   * @code void(asio::error_code,
   *    typename Protocol::socket::template
   *      rebind_executor<executor_type>::other)) @endcode
   *
   * @par Example
   * @code
   * void accept_handler(const asio::error_code& error,
   *     asio::ip::tcp::socket peer)
   * {
   *   if (!error)
   *   {
   *     // Accept succeeded.
   *   }
   * }
   *
   * ...
   *
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::endpoint endpoint;
   * acceptor.async_accept(endpoint, accept_handler);
   * @endcode
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
  template <
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
        typename Protocol::socket::template rebind_executor<
          executor_type>::other)) MoveAcceptToken
            = default_completion_token_t<executor_type>>
  auto async_accept(endpoint_type& peer_endpoint,
      MoveAcceptToken&& token = default_completion_token_t<executor_type>())
    -> decltype(
      async_initiate<MoveAcceptToken,
        void (asio::error_code, typename Protocol::socket::template
          rebind_executor<executor_type>::other)>(
            declval<initiate_async_move_accept>(), token,
            declval<const executor_type&>(), &peer_endpoint,
            static_cast<typename Protocol::socket::template
              rebind_executor<executor_type>::other*>(0)))
  {
    return async_initiate<MoveAcceptToken,
      void (asio::error_code, typename Protocol::socket::template
        rebind_executor<executor_type>::other)>(
          initiate_async_move_accept(this), token,
          impl_.get_executor(), &peer_endpoint,
          static_cast<typename Protocol::socket::template
            rebind_executor<executor_type>::other*>(0));
  }

  /// Accept a new connection.
  /**
   * This function is used to accept a new connection from a peer. The function
   * call will block until a new connection has been accepted successfully or
   * an error occurs.
   *
   * This overload requires that the Protocol template parameter satisfy the
   * AcceptableProtocol type requirements.
   *
   * @param ex The I/O executor object to be used for the newly accepted
   * socket.
   *
   * @param peer_endpoint An endpoint object into which the endpoint of the
   * remote peer will be written.
   *
   * @returns A socket object representing the newly accepted connection.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::endpoint endpoint;
   * asio::ip::tcp::socket socket(
   *     acceptor.accept(my_context2, endpoint));
   * @endcode
   */
  template <typename Executor1>
  typename Protocol::socket::template rebind_executor<Executor1>::other
  accept(const Executor1& ex, endpoint_type& peer_endpoint,
      constraint_t<
        is_executor<Executor1>::value
          || execution::is_executor<Executor1>::value
      > = 0)
  {
    asio::error_code ec;
    typename Protocol::socket::template
        rebind_executor<Executor1>::other peer(ex);
    impl_.get_service().accept(impl_.get_implementation(),
        peer, &peer_endpoint, ec);
    asio::detail::throw_error(ec, "accept");
    return peer;
  }

  /// Accept a new connection.
  /**
   * This function is used to accept a new connection from a peer. The function
   * call will block until a new connection has been accepted successfully or
   * an error occurs.
   *
   * This overload requires that the Protocol template parameter satisfy the
   * AcceptableProtocol type requirements.
   *
   * @param context The I/O execution context object to be used for the newly
   * accepted socket.
   *
   * @param peer_endpoint An endpoint object into which the endpoint of the
   * remote peer will be written.
   *
   * @returns A socket object representing the newly accepted connection.
   *
   * @throws asio::system_error Thrown on failure.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::endpoint endpoint;
   * asio::ip::tcp::socket socket(
   *     acceptor.accept(my_context2, endpoint));
   * @endcode
   */
  template <typename ExecutionContext>
  typename Protocol::socket::template rebind_executor<
      typename ExecutionContext::executor_type>::other
  accept(ExecutionContext& context, endpoint_type& peer_endpoint,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value
      > = 0)
  {
    asio::error_code ec;
    typename Protocol::socket::template rebind_executor<
        typename ExecutionContext::executor_type>::other peer(context);
    impl_.get_service().accept(impl_.get_implementation(),
        peer, &peer_endpoint, ec);
    asio::detail::throw_error(ec, "accept");
    return peer;
  }

  /// Accept a new connection.
  /**
   * This function is used to accept a new connection from a peer. The function
   * call will block until a new connection has been accepted successfully or
   * an error occurs.
   *
   * This overload requires that the Protocol template parameter satisfy the
   * AcceptableProtocol type requirements.
   *
   * @param ex The I/O executor object to be used for the newly accepted
   * socket.
   *
   * @param peer_endpoint An endpoint object into which the endpoint of the
   * remote peer will be written.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @returns On success, a socket object representing the newly accepted
   * connection. On error, a socket object where is_open() is false.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::endpoint endpoint;
   * asio::ip::tcp::socket socket(
   *     acceptor.accept(my_context2, endpoint, ec));
   * if (ec)
   * {
   *   // An error occurred.
   * }
   * @endcode
   */
  template <typename Executor1>
  typename Protocol::socket::template rebind_executor<Executor1>::other
  accept(const executor_type& ex,
      endpoint_type& peer_endpoint, asio::error_code& ec,
      constraint_t<
        is_executor<Executor1>::value
          || execution::is_executor<Executor1>::value
      > = 0)
  {
    typename Protocol::socket::template
      rebind_executor<Executor1>::other peer(ex);
    impl_.get_service().accept(impl_.get_implementation(),
        peer, &peer_endpoint, ec);
    return peer;
  }

  /// Accept a new connection.
  /**
   * This function is used to accept a new connection from a peer. The function
   * call will block until a new connection has been accepted successfully or
   * an error occurs.
   *
   * This overload requires that the Protocol template parameter satisfy the
   * AcceptableProtocol type requirements.
   *
   * @param context The I/O execution context object to be used for the newly
   * accepted socket.
   *
   * @param peer_endpoint An endpoint object into which the endpoint of the
   * remote peer will be written.
   *
   * @param ec Set to indicate what error occurred, if any.
   *
   * @returns On success, a socket object representing the newly accepted
   * connection. On error, a socket object where is_open() is false.
   *
   * @par Example
   * @code
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::endpoint endpoint;
   * asio::ip::tcp::socket socket(
   *     acceptor.accept(my_context2, endpoint, ec));
   * if (ec)
   * {
   *   // An error occurred.
   * }
   * @endcode
   */
  template <typename ExecutionContext>
  typename Protocol::socket::template rebind_executor<
      typename ExecutionContext::executor_type>::other
  accept(ExecutionContext& context,
      endpoint_type& peer_endpoint, asio::error_code& ec,
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value
      > = 0)
  {
    typename Protocol::socket::template rebind_executor<
        typename ExecutionContext::executor_type>::other peer(context);
    impl_.get_service().accept(impl_.get_implementation(),
        peer, &peer_endpoint, ec);
    return peer;
  }

  /// Start an asynchronous accept.
  /**
   * This function is used to asynchronously accept a new connection. It is an
   * initiating function for an @ref asynchronous_operation, and always returns
   * immediately.
   *
   * This overload requires that the Protocol template parameter satisfy the
   * AcceptableProtocol type requirements.
   *
   * @param ex The I/O executor object to be used for the newly accepted
   * socket.
   *
   * @param peer_endpoint An endpoint object into which the endpoint of the
   * remote peer will be written. Ownership of the peer_endpoint object is
   * retained by the caller, which must guarantee that it is valid until the
   * completion handler is called.
   *
   * @param token The @ref completion_token that will be used to produce a
   * completion handler, which will be called when the accept completes.
   * Potential completion tokens include @ref use_future, @ref use_awaitable,
   * @ref yield_context, or a function object with the correct completion
   * signature. The function signature of the completion handler must be:
   * @code void handler(
   *   // Result of operation.
   *   const asio::error_code& error,
   *
   *   // On success, the newly accepted socket.
   *   typename Protocol::socket::template rebind_executor<
   *     Executor1>::other peer
   * ); @endcode
   * Regardless of whether the asynchronous operation completes immediately or
   * not, the completion handler will not be invoked from within this function.
   * On immediate completion, invocation of the handler will be performed in a
   * manner equivalent to using asio::async_immediate().
   *
   * @par Completion Signature
   * @code void(asio::error_code,
   *    typename Protocol::socket::template rebind_executor<
   *      Executor1>::other)) @endcode
   *
   * @par Example
   * @code
   * void accept_handler(const asio::error_code& error,
   *     asio::ip::tcp::socket peer)
   * {
   *   if (!error)
   *   {
   *     // Accept succeeded.
   *   }
   * }
   *
   * ...
   *
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::endpoint endpoint;
   * acceptor.async_accept(my_context2, endpoint, accept_handler);
   * @endcode
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
  template <typename Executor1,
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
        typename Protocol::socket::template rebind_executor<
          constraint_t<is_executor<Executor1>::value
            || execution::is_executor<Executor1>::value,
              Executor1>>::other)) MoveAcceptToken
                = default_completion_token_t<executor_type>>
  auto async_accept(const Executor1& ex, endpoint_type& peer_endpoint,
      MoveAcceptToken&& token = default_completion_token_t<executor_type>(),
      constraint_t<
        is_executor<Executor1>::value
          || execution::is_executor<Executor1>::value
      > = 0)
    -> decltype(
      async_initiate<MoveAcceptToken,
        void (asio::error_code,
          typename Protocol::socket::template rebind_executor<
            Executor1>::other)>(
          declval<initiate_async_move_accept>(), token, ex, &peer_endpoint,
          static_cast<typename Protocol::socket::template
            rebind_executor<Executor1>::other*>(0)))
  {
    return async_initiate<MoveAcceptToken,
      void (asio::error_code,
        typename Protocol::socket::template rebind_executor<
          Executor1>::other)>(
            initiate_async_move_accept(this), token, ex, &peer_endpoint,
            static_cast<typename Protocol::socket::template
              rebind_executor<Executor1>::other*>(0));
  }

  /// Start an asynchronous accept.
  /**
   * This function is used to asynchronously accept a new connection. It is an
   * initiating function for an @ref asynchronous_operation, and always returns
   * immediately.
   *
   * This overload requires that the Protocol template parameter satisfy the
   * AcceptableProtocol type requirements.
   *
   * @param context The I/O execution context object to be used for the newly
   * accepted socket.
   *
   * @param peer_endpoint An endpoint object into which the endpoint of the
   * remote peer will be written. Ownership of the peer_endpoint object is
   * retained by the caller, which must guarantee that it is valid until the
   * completion handler is called.
   *
   * @param token The @ref completion_token that will be used to produce a
   * completion handler, which will be called when the accept completes.
   * Potential completion tokens include @ref use_future, @ref use_awaitable,
   * @ref yield_context, or a function object with the correct completion
   * signature. The function signature of the completion handler must be:
   * @code void handler(
   *   // Result of operation.
   *   const asio::error_code& error,
   *
   *   // On success, the newly accepted socket.
   *   typename Protocol::socket::template rebind_executor<
   *     typename ExecutionContext::executor_type>::other peer
   * ); @endcode
   * Regardless of whether the asynchronous operation completes immediately or
   * not, the completion handler will not be invoked from within this function.
   * On immediate completion, invocation of the handler will be performed in a
   * manner equivalent to using asio::async_immediate().
   *
   * @par Completion Signature
   * @code void(asio::error_code,
   *    typename Protocol::socket::template rebind_executor<
   *      typename ExecutionContext::executor_type>::other)) @endcode
   *
   * @par Example
   * @code
   * void accept_handler(const asio::error_code& error,
   *     asio::ip::tcp::socket peer)
   * {
   *   if (!error)
   *   {
   *     // Accept succeeded.
   *   }
   * }
   *
   * ...
   *
   * asio::ip::tcp::acceptor acceptor(my_context);
   * ...
   * asio::ip::tcp::endpoint endpoint;
   * acceptor.async_accept(my_context2, endpoint, accept_handler);
   * @endcode
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
  template <typename ExecutionContext,
      ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
        typename Protocol::socket::template rebind_executor<
          typename ExecutionContext::executor_type>::other)) MoveAcceptToken
            = default_completion_token_t<executor_type>>
  auto async_accept(ExecutionContext& context, endpoint_type& peer_endpoint,
      MoveAcceptToken&& token = default_completion_token_t<executor_type>(),
      constraint_t<
        is_convertible<ExecutionContext&, execution_context&>::value
      > = 0)
    -> decltype(
      async_initiate<MoveAcceptToken,
        void (asio::error_code,
          typename Protocol::socket::template rebind_executor<
            typename ExecutionContext::executor_type>::other)>(
              declval<initiate_async_move_accept>(), token,
              context.get_executor(), &peer_endpoint,
              static_cast<typename Protocol::socket::template rebind_executor<
                typename ExecutionContext::executor_type>::other*>(0)))
  {
    return async_initiate<MoveAcceptToken,
      void (asio::error_code,
        typename Protocol::socket::template rebind_executor<
          typename ExecutionContext::executor_type>::other)>(
            initiate_async_move_accept(this), token,
            context.get_executor(), &peer_endpoint,
            static_cast<typename Protocol::socket::template rebind_executor<
              typename ExecutionContext::executor_type>::other*>(0));
  }

private:
  // Disallow copying and assignment.
  basic_socket_acceptor(const basic_socket_acceptor&) = delete;
  basic_socket_acceptor& operator=(
      const basic_socket_acceptor&) = delete;

  class initiate_async_wait
  {
  public:
    typedef Executor executor_type;

    explicit initiate_async_wait(basic_socket_acceptor* self)
      : self_(self)
    {
    }

    const executor_type& get_executor() const noexcept
    {
      return self_->get_executor();
    }

    template <typename WaitHandler>
    void operator()(WaitHandler&& handler, wait_type w) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a WaitHandler.
      ASIO_WAIT_HANDLER_CHECK(WaitHandler, handler) type_check;

      detail::non_const_lvalue<WaitHandler> handler2(handler);
      self_->impl_.get_service().async_wait(
          self_->impl_.get_implementation(), w,
          handler2.value, self_->impl_.get_executor());
    }

  private:
    basic_socket_acceptor* self_;
  };

  class initiate_async_accept
  {
  public:
    typedef Executor executor_type;

    explicit initiate_async_accept(basic_socket_acceptor* self)
      : self_(self)
    {
    }

    const executor_type& get_executor() const noexcept
    {
      return self_->get_executor();
    }

    template <typename AcceptHandler, typename Protocol1, typename Executor1>
    void operator()(AcceptHandler&& handler,
        basic_socket<Protocol1, Executor1>* peer,
        endpoint_type* peer_endpoint) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a AcceptHandler.
      ASIO_ACCEPT_HANDLER_CHECK(AcceptHandler, handler) type_check;

      detail::non_const_lvalue<AcceptHandler> handler2(handler);
      self_->impl_.get_service().async_accept(
          self_->impl_.get_implementation(), *peer, peer_endpoint,
          handler2.value, self_->impl_.get_executor());
    }

  private:
    basic_socket_acceptor* self_;
  };

  class initiate_async_move_accept
  {
  public:
    typedef Executor executor_type;

    explicit initiate_async_move_accept(basic_socket_acceptor* self)
      : self_(self)
    {
    }

    const executor_type& get_executor() const noexcept
    {
      return self_->get_executor();
    }

    template <typename MoveAcceptHandler, typename Executor1, typename Socket>
    void operator()(MoveAcceptHandler&& handler,
        const Executor1& peer_ex, endpoint_type* peer_endpoint, Socket*) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a MoveAcceptHandler.
      ASIO_MOVE_ACCEPT_HANDLER_CHECK(
          MoveAcceptHandler, handler, Socket) type_check;

      detail::non_const_lvalue<MoveAcceptHandler> handler2(handler);
      self_->impl_.get_service().async_move_accept(
          self_->impl_.get_implementation(), peer_ex, peer_endpoint,
          handler2.value, self_->impl_.get_executor());
    }

  private:
    basic_socket_acceptor* self_;
  };

#if defined(ASIO_WINDOWS_RUNTIME)
  detail::io_object_impl<
    detail::null_socket_service<Protocol>, Executor> impl_;
#elif defined(ASIO_HAS_IOCP)
  detail::io_object_impl<
    detail::win_iocp_socket_service<Protocol>, Executor> impl_;
#elif defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  detail::io_object_impl<
    detail::io_uring_socket_service<Protocol>, Executor> impl_;
#else
  detail::io_object_impl<
    detail::reactive_socket_service<Protocol>, Executor> impl_;
#endif
};

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_BASIC_SOCKET_ACCEPTOR_HPP
