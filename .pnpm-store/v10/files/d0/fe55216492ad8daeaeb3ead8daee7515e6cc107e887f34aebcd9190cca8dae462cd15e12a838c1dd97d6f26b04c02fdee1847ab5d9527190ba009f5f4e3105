//
// detail/posix_serial_port_service.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
// Copyright (c) 2008 Rep Invariant Systems, Inc. (info@repinvariant.com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_POSIX_SERIAL_PORT_SERVICE_HPP
#define ASIO_DETAIL_POSIX_SERIAL_PORT_SERVICE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_SERIAL_PORT)
#if !defined(ASIO_WINDOWS) && !defined(__CYGWIN__)

#include <string>
#include "asio/error.hpp"
#include "asio/execution_context.hpp"
#include "asio/serial_port_base.hpp"
#include "asio/detail/descriptor_ops.hpp"

#if defined(ASIO_HAS_IO_URING_AS_DEFAULT)
# include "asio/detail/io_uring_descriptor_service.hpp"
#else // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
# include "asio/detail/reactive_descriptor_service.hpp"
#endif // defined(ASIO_HAS_IO_URING_AS_DEFAULT)

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

// Extend a descriptor_service to provide serial port support.
class posix_serial_port_service :
  public execution_context_service_base<posix_serial_port_service>
{
public:
#if defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  typedef io_uring_descriptor_service descriptor_service;
#else // defined(ASIO_HAS_IO_URING_AS_DEFAULT)
  typedef reactive_descriptor_service descriptor_service;
#endif // defined(ASIO_HAS_IO_URING_AS_DEFAULT)

  // The native type of a serial port.
  typedef descriptor_service::native_handle_type native_handle_type;

  // The implementation type of the serial port.
  typedef descriptor_service::implementation_type implementation_type;

  ASIO_DECL posix_serial_port_service(execution_context& context);

  // Destroy all user-defined handler objects owned by the service.
  ASIO_DECL void shutdown();

  // Construct a new serial port implementation.
  void construct(implementation_type& impl)
  {
    descriptor_service_.construct(impl);
  }

  // Move-construct a new serial port implementation.
  void move_construct(implementation_type& impl,
      implementation_type& other_impl)
  {
    descriptor_service_.move_construct(impl, other_impl);
  }

  // Move-assign from another serial port implementation.
  void move_assign(implementation_type& impl,
      posix_serial_port_service& other_service,
      implementation_type& other_impl)
  {
    descriptor_service_.move_assign(impl,
        other_service.descriptor_service_, other_impl);
  }

  // Destroy a serial port implementation.
  void destroy(implementation_type& impl)
  {
    descriptor_service_.destroy(impl);
  }

  // Open the serial port using the specified device name.
  ASIO_DECL asio::error_code open(implementation_type& impl,
      const std::string& device, asio::error_code& ec);

  // Assign a native descriptor to a serial port implementation.
  asio::error_code assign(implementation_type& impl,
      const native_handle_type& native_descriptor,
      asio::error_code& ec)
  {
    return descriptor_service_.assign(impl, native_descriptor, ec);
  }

  // Determine whether the serial port is open.
  bool is_open(const implementation_type& impl) const
  {
    return descriptor_service_.is_open(impl);
  }

  // Destroy a serial port implementation.
  asio::error_code close(implementation_type& impl,
      asio::error_code& ec)
  {
    return descriptor_service_.close(impl, ec);
  }

  // Get the native serial port representation.
  native_handle_type native_handle(implementation_type& impl)
  {
    return descriptor_service_.native_handle(impl);
  }

  // Cancel all operations associated with the serial port.
  asio::error_code cancel(implementation_type& impl,
      asio::error_code& ec)
  {
    return descriptor_service_.cancel(impl, ec);
  }

  // Set an option on the serial port.
  template <typename SettableSerialPortOption>
  asio::error_code set_option(implementation_type& impl,
      const SettableSerialPortOption& option, asio::error_code& ec)
  {
    return do_set_option(impl,
        &posix_serial_port_service::store_option<SettableSerialPortOption>,
        &option, ec);
  }

  // Get an option from the serial port.
  template <typename GettableSerialPortOption>
  asio::error_code get_option(const implementation_type& impl,
      GettableSerialPortOption& option, asio::error_code& ec) const
  {
    return do_get_option(impl,
        &posix_serial_port_service::load_option<GettableSerialPortOption>,
        &option, ec);
  }

  // Send a break sequence to the serial port.
  asio::error_code send_break(implementation_type& impl,
      asio::error_code& ec)
  {
    int result = ::tcsendbreak(descriptor_service_.native_handle(impl), 0);
    descriptor_ops::get_last_error(ec, result < 0);
    ASIO_ERROR_LOCATION(ec);
    return ec;
  }

  // Write the given data. Returns the number of bytes sent.
  template <typename ConstBufferSequence>
  size_t write_some(implementation_type& impl,
      const ConstBufferSequence& buffers, asio::error_code& ec)
  {
    return descriptor_service_.write_some(impl, buffers, ec);
  }

  // Start an asynchronous write. The data being written must be valid for the
  // lifetime of the asynchronous operation.
  template <typename ConstBufferSequence, typename Handler, typename IoExecutor>
  void async_write_some(implementation_type& impl,
      const ConstBufferSequence& buffers,
      Handler& handler, const IoExecutor& io_ex)
  {
    descriptor_service_.async_write_some(impl, buffers, handler, io_ex);
  }

  // Read some data. Returns the number of bytes received.
  template <typename MutableBufferSequence>
  size_t read_some(implementation_type& impl,
      const MutableBufferSequence& buffers, asio::error_code& ec)
  {
    return descriptor_service_.read_some(impl, buffers, ec);
  }

  // Start an asynchronous read. The buffer for the data being received must be
  // valid for the lifetime of the asynchronous operation.
  template <typename MutableBufferSequence,
      typename Handler, typename IoExecutor>
  void async_read_some(implementation_type& impl,
      const MutableBufferSequence& buffers,
      Handler& handler, const IoExecutor& io_ex)
  {
    descriptor_service_.async_read_some(impl, buffers, handler, io_ex);
  }

private:
  // Function pointer type for storing a serial port option.
  typedef asio::error_code (*store_function_type)(
      const void*, termios&, asio::error_code&);

  // Helper function template to store a serial port option.
  template <typename SettableSerialPortOption>
  static asio::error_code store_option(const void* option,
      termios& storage, asio::error_code& ec)
  {
    static_cast<const SettableSerialPortOption*>(option)->store(storage, ec);
    return ec;
  }

  // Helper function to set a serial port option.
  ASIO_DECL asio::error_code do_set_option(
      implementation_type& impl, store_function_type store,
      const void* option, asio::error_code& ec);

  // Function pointer type for loading a serial port option.
  typedef asio::error_code (*load_function_type)(
      void*, const termios&, asio::error_code&);

  // Helper function template to load a serial port option.
  template <typename GettableSerialPortOption>
  static asio::error_code load_option(void* option,
      const termios& storage, asio::error_code& ec)
  {
    static_cast<GettableSerialPortOption*>(option)->load(storage, ec);
    return ec;
  }

  // Helper function to get a serial port option.
  ASIO_DECL asio::error_code do_get_option(
      const implementation_type& impl, load_function_type load,
      void* option, asio::error_code& ec) const;

  // The implementation used for initiating asynchronous operations.
  descriptor_service descriptor_service_;
};

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#if defined(ASIO_HEADER_ONLY)
# include "asio/detail/impl/posix_serial_port_service.ipp"
#endif // defined(ASIO_HEADER_ONLY)

#endif // !defined(ASIO_WINDOWS) && !defined(__CYGWIN__)
#endif // defined(ASIO_HAS_SERIAL_PORT)

#endif // ASIO_DETAIL_POSIX_SERIAL_PORT_SERVICE_HPP
