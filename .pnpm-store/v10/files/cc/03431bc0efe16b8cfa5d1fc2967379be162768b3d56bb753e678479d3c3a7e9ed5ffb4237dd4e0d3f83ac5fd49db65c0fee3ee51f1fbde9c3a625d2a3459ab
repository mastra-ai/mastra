//
// detail/win_iocp_file_service.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_WIN_IOCP_FILE_SERVICE_HPP
#define ASIO_DETAIL_WIN_IOCP_FILE_SERVICE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_IOCP) && defined(ASIO_HAS_FILE)

#include <string>
#include "asio/detail/cstdint.hpp"
#include "asio/detail/win_iocp_handle_service.hpp"
#include "asio/error.hpp"
#include "asio/execution_context.hpp"
#include "asio/file_base.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

// Extend win_iocp_handle_service to provide file support.
class win_iocp_file_service :
  public execution_context_service_base<win_iocp_file_service>
{
public:
  // The native type of a file.
  typedef win_iocp_handle_service::native_handle_type native_handle_type;

  // The implementation type of the file.
  class implementation_type : win_iocp_handle_service::implementation_type
  {
  private:
    // Only this service will have access to the internal values.
    friend class win_iocp_file_service;

    uint64_t offset_;
    bool is_stream_;
  };

  // Constructor.
  ASIO_DECL win_iocp_file_service(execution_context& context);

  // Destroy all user-defined handler objects owned by the service.
  ASIO_DECL void shutdown();

  // Construct a new file implementation.
  void construct(implementation_type& impl)
  {
    handle_service_.construct(impl);
    impl.offset_ = 0;
    impl.is_stream_ = false;
  }

  // Move-construct a new file implementation.
  void move_construct(implementation_type& impl,
      implementation_type& other_impl)
  {
    handle_service_.move_construct(impl, other_impl);
    impl.offset_ = other_impl.offset_;
    impl.is_stream_ = other_impl.is_stream_;
    other_impl.offset_ = 0;
  }

  // Move-assign from another file implementation.
  void move_assign(implementation_type& impl,
      win_iocp_file_service& other_service,
      implementation_type& other_impl)
  {
    handle_service_.move_assign(impl,
        other_service.handle_service_, other_impl);
    impl.offset_ = other_impl.offset_;
    impl.is_stream_ = other_impl.is_stream_;
    other_impl.offset_ = 0;
  }

  // Destroy a file implementation.
  void destroy(implementation_type& impl)
  {
    handle_service_.destroy(impl);
  }

  // Set whether the implementation is stream-oriented.
  void set_is_stream(implementation_type& impl, bool is_stream)
  {
    impl.is_stream_ = is_stream;
  }

  // Open the file using the specified path name.
  ASIO_DECL asio::error_code open(implementation_type& impl,
      const char* path, file_base::flags open_flags,
      asio::error_code& ec);

  // Assign a native handle to a file implementation.
  asio::error_code assign(implementation_type& impl,
      const native_handle_type& native_handle,
      asio::error_code& ec)
  {
    return handle_service_.assign(impl, native_handle, ec);
  }

  // Determine whether the file is open.
  bool is_open(const implementation_type& impl) const
  {
    return handle_service_.is_open(impl);
  }

  // Destroy a file implementation.
  asio::error_code close(implementation_type& impl,
      asio::error_code& ec)
  {
    return handle_service_.close(impl, ec);
  }

  // Get the native file representation.
  native_handle_type native_handle(const implementation_type& impl) const
  {
    return handle_service_.native_handle(impl);
  }

  // Release ownership of a file.
  native_handle_type release(implementation_type& impl,
      asio::error_code& ec)
  {
    return handle_service_.release(impl, ec);
  }

  // Cancel all operations associated with the file.
  asio::error_code cancel(implementation_type& impl,
      asio::error_code& ec)
  {
    return handle_service_.cancel(impl, ec);
  }

  // Get the size of the file.
  ASIO_DECL uint64_t size(const implementation_type& impl,
      asio::error_code& ec) const;

  // Alter the size of the file.
  ASIO_DECL asio::error_code resize(implementation_type& impl,
      uint64_t n, asio::error_code& ec);

  // Synchronise the file to disk.
  ASIO_DECL asio::error_code sync_all(implementation_type& impl,
      asio::error_code& ec);

  // Synchronise the file data to disk.
  ASIO_DECL asio::error_code sync_data(implementation_type& impl,
      asio::error_code& ec);

  // Seek to a position in the file.
  ASIO_DECL uint64_t seek(implementation_type& impl, int64_t offset,
      file_base::seek_basis whence, asio::error_code& ec);

  // Write the given data. Returns the number of bytes written.
  template <typename ConstBufferSequence>
  size_t write_some(implementation_type& impl,
      const ConstBufferSequence& buffers, asio::error_code& ec)
  {
    uint64_t offset = impl.offset_;
    impl.offset_ += asio::buffer_size(buffers);
    return handle_service_.write_some_at(impl, offset, buffers, ec);
  }

  // Start an asynchronous write. The data being written must be valid for the
  // lifetime of the asynchronous operation.
  template <typename ConstBufferSequence, typename Handler, typename IoExecutor>
  void async_write_some(implementation_type& impl,
      const ConstBufferSequence& buffers,
      Handler& handler, const IoExecutor& io_ex)
  {
    uint64_t offset = impl.offset_;
    impl.offset_ += asio::buffer_size(buffers);
    handle_service_.async_write_some_at(impl, offset, buffers, handler, io_ex);
  }

  // Write the given data at the specified location. Returns the number of
  // bytes written.
  template <typename ConstBufferSequence>
  size_t write_some_at(implementation_type& impl, uint64_t offset,
      const ConstBufferSequence& buffers, asio::error_code& ec)
  {
    return handle_service_.write_some_at(impl, offset, buffers, ec);
  }

  // Start an asynchronous write at the specified location. The data being
  // written must be valid for the lifetime of the asynchronous operation.
  template <typename ConstBufferSequence, typename Handler, typename IoExecutor>
  void async_write_some_at(implementation_type& impl,
      uint64_t offset, const ConstBufferSequence& buffers,
      Handler& handler, const IoExecutor& io_ex)
  {
    handle_service_.async_write_some_at(impl, offset, buffers, handler, io_ex);
  }

  // Read some data. Returns the number of bytes read.
  template <typename MutableBufferSequence>
  size_t read_some(implementation_type& impl,
      const MutableBufferSequence& buffers, asio::error_code& ec)
  {
    uint64_t offset = impl.offset_;
    impl.offset_ += asio::buffer_size(buffers);
    return handle_service_.read_some_at(impl, offset, buffers, ec);
  }

  // Start an asynchronous read. The buffer for the data being read must be
  // valid for the lifetime of the asynchronous operation.
  template <typename MutableBufferSequence,
      typename Handler, typename IoExecutor>
  void async_read_some(implementation_type& impl,
      const MutableBufferSequence& buffers,
      Handler& handler, const IoExecutor& io_ex)
  {
    uint64_t offset = impl.offset_;
    impl.offset_ += asio::buffer_size(buffers);
    handle_service_.async_read_some_at(impl, offset, buffers, handler, io_ex);
  }

  // Read some data. Returns the number of bytes read.
  template <typename MutableBufferSequence>
  size_t read_some_at(implementation_type& impl, uint64_t offset,
      const MutableBufferSequence& buffers, asio::error_code& ec)
  {
    return handle_service_.read_some_at(impl, offset, buffers, ec);
  }

  // Start an asynchronous read. The buffer for the data being read must be
  // valid for the lifetime of the asynchronous operation.
  template <typename MutableBufferSequence,
      typename Handler, typename IoExecutor>
  void async_read_some_at(implementation_type& impl,
      uint64_t offset, const MutableBufferSequence& buffers,
      Handler& handler, const IoExecutor& io_ex)
  {
    handle_service_.async_read_some_at(impl, offset, buffers, handler, io_ex);
  }

private:
  // The implementation used for initiating asynchronous operations.
  win_iocp_handle_service handle_service_;

  // Emulation of Windows IO_STATUS_BLOCK structure.
  struct io_status_block
  {
    union u
    {
      LONG Status;
      void* Pointer;
    };
    ULONG_PTR Information;
  };

  // Emulation of flag passed to NtFlushBuffersFileEx.
  enum { flush_flags_file_data_sync_only = 4 };

  // The type of a NtFlushBuffersFileEx function pointer.
  typedef LONG (NTAPI *nt_flush_buffers_file_ex_fn)(
      HANDLE, ULONG, void*, ULONG, io_status_block*);

  // The NTFlushBuffersFileEx function pointer.
  nt_flush_buffers_file_ex_fn nt_flush_buffers_file_ex_;
};

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#if defined(ASIO_HEADER_ONLY)
# include "asio/detail/impl/win_iocp_file_service.ipp"
#endif // defined(ASIO_HEADER_ONLY)

#endif // defined(ASIO_HAS_IOCP) && defined(ASIO_HAS_FILE)

#endif // ASIO_DETAIL_WIN_IOCP_FILE_SERVICE_HPP
