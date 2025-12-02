//
// detail/impl/win_iocp_file_service.ipp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_IMPL_WIN_IOCP_FILE_SERVICE_IPP
#define ASIO_DETAIL_IMPL_WIN_IOCP_FILE_SERVICE_IPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_FILE) \
  && defined(ASIO_HAS_WINDOWS_RANDOM_ACCESS_HANDLE)

#include <cstring>
#include <sys/stat.h>
#include "asio/detail/win_iocp_file_service.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

win_iocp_file_service::win_iocp_file_service(
    execution_context& context)
  : execution_context_service_base<win_iocp_file_service>(context),
    handle_service_(context),
    nt_flush_buffers_file_ex_(0)
{
  if (FARPROC nt_flush_buffers_file_ex_ptr = ::GetProcAddress(
        ::GetModuleHandleA("NTDLL"), "NtFlushBuffersFileEx"))
  {
    nt_flush_buffers_file_ex_ = reinterpret_cast<nt_flush_buffers_file_ex_fn>(
        reinterpret_cast<void*>(nt_flush_buffers_file_ex_ptr));
  }
}

void win_iocp_file_service::shutdown()
{
  handle_service_.shutdown();
}

asio::error_code win_iocp_file_service::open(
    win_iocp_file_service::implementation_type& impl,
    const char* path, file_base::flags open_flags,
    asio::error_code& ec)
{
  if (is_open(impl))
  {
    ec = asio::error::already_open;
    ASIO_ERROR_LOCATION(ec);
    return ec;
  }

  DWORD access = 0;
  if ((open_flags & file_base::read_only) != 0)
    access = GENERIC_READ;
  else if ((open_flags & file_base::write_only) != 0)
    access = GENERIC_WRITE;
  else if ((open_flags & file_base::read_write) != 0)
    access = GENERIC_READ | GENERIC_WRITE;

  DWORD share = FILE_SHARE_READ | FILE_SHARE_WRITE;

  DWORD disposition = 0;
  if ((open_flags & file_base::create) != 0)
  {
    if ((open_flags & file_base::exclusive) != 0)
      disposition = CREATE_NEW;
    else
      disposition = OPEN_ALWAYS;
  }
  else
  {
    if ((open_flags & file_base::truncate) != 0)
      disposition = TRUNCATE_EXISTING;
    else
      disposition = OPEN_EXISTING;
  }

  DWORD flags = FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OVERLAPPED;
  if (impl.is_stream_)
    flags |= FILE_FLAG_SEQUENTIAL_SCAN;
  else
    flags |= FILE_FLAG_RANDOM_ACCESS;
  if ((open_flags & file_base::sync_all_on_write) != 0)
    flags |= FILE_FLAG_WRITE_THROUGH;

  impl.offset_ = 0;
  HANDLE handle = ::CreateFileA(path, access, share, 0, disposition, flags, 0);
  if (handle != INVALID_HANDLE_VALUE)
  {
    if (disposition == OPEN_ALWAYS)
    {
      if ((open_flags & file_base::truncate) != 0)
      {
        if (!::SetEndOfFile(handle))
        {
          DWORD last_error = ::GetLastError();
          ::CloseHandle(handle);
          ec.assign(last_error, asio::error::get_system_category());
          ASIO_ERROR_LOCATION(ec);
          return ec;
        }
      }
    }
    if (disposition == OPEN_ALWAYS || disposition == OPEN_EXISTING)
    {
      if ((open_flags & file_base::append) != 0)
      {
        LARGE_INTEGER distance, new_offset;
        distance.QuadPart = 0;
        if (::SetFilePointerEx(handle, distance, &new_offset, FILE_END))
        {
          impl.offset_ = static_cast<uint64_t>(new_offset.QuadPart);
        }
        else
        {
          DWORD last_error = ::GetLastError();
          ::CloseHandle(handle);
          ec.assign(last_error, asio::error::get_system_category());
          ASIO_ERROR_LOCATION(ec);
          return ec;
        }
      }
    }

    handle_service_.assign(impl, handle, ec);
    if (ec)
      ::CloseHandle(handle);
    ASIO_ERROR_LOCATION(ec);
    return ec;
  }
  else
  {
    DWORD last_error = ::GetLastError();
    ec.assign(last_error, asio::error::get_system_category());
    ASIO_ERROR_LOCATION(ec);
    return ec;
  }
}

uint64_t win_iocp_file_service::size(
    const win_iocp_file_service::implementation_type& impl,
    asio::error_code& ec) const
{
  LARGE_INTEGER result;
  if (::GetFileSizeEx(native_handle(impl), &result))
  {
    asio::error::clear(ec);
    return static_cast<uint64_t>(result.QuadPart);
  }
  else
  {
    DWORD last_error = ::GetLastError();
    ec.assign(last_error, asio::error::get_system_category());
    ASIO_ERROR_LOCATION(ec);
    return 0;
  }
}

asio::error_code win_iocp_file_service::resize(
    win_iocp_file_service::implementation_type& impl,
    uint64_t n, asio::error_code& ec)
{
  LARGE_INTEGER distance;
  distance.QuadPart = n;
  if (::SetFilePointerEx(native_handle(impl), distance, 0, FILE_BEGIN))
  {
    BOOL result = ::SetEndOfFile(native_handle(impl));
    DWORD last_error = ::GetLastError();

    distance.QuadPart = static_cast<LONGLONG>(impl.offset_);
    if (!::SetFilePointerEx(native_handle(impl), distance, 0, FILE_BEGIN))
    {
      result = FALSE;
      last_error = ::GetLastError();
    }

    if (result)
      asio::error::clear(ec);
    else
      ec.assign(last_error, asio::error::get_system_category());
    ASIO_ERROR_LOCATION(ec);
    return ec;
  }
  else
  {
    DWORD last_error = ::GetLastError();
    ec.assign(last_error, asio::error::get_system_category());
    ASIO_ERROR_LOCATION(ec);
    return ec;
  }
}

asio::error_code win_iocp_file_service::sync_all(
    win_iocp_file_service::implementation_type& impl,
    asio::error_code& ec)
{
  BOOL result = ::FlushFileBuffers(native_handle(impl));
  if (result)
  {
    asio::error::clear(ec);
    return ec;
  }
  else
  {
    DWORD last_error = ::GetLastError();
    ec.assign(last_error, asio::error::get_system_category());
    ASIO_ERROR_LOCATION(ec);
    return ec;
  }
}

asio::error_code win_iocp_file_service::sync_data(
    win_iocp_file_service::implementation_type& impl,
    asio::error_code& ec)
{
  if (nt_flush_buffers_file_ex_)
  {
    io_status_block status = {};
    if (!nt_flush_buffers_file_ex_(native_handle(impl),
          flush_flags_file_data_sync_only, 0, 0, &status))
    {
      asio::error::clear(ec);
      return ec;
    }
  }
  return sync_all(impl, ec);
}

uint64_t win_iocp_file_service::seek(
    win_iocp_file_service::implementation_type& impl, int64_t offset,
    file_base::seek_basis whence, asio::error_code& ec)
{
  DWORD method;
  switch (whence)
  {
  case file_base::seek_set:
    method = FILE_BEGIN;
    break;
  case file_base::seek_cur:
    method = FILE_BEGIN;
    offset = static_cast<int64_t>(impl.offset_) + offset;
    break;
  case file_base::seek_end:
    method = FILE_END;
    break;
  default:
    ec = asio::error::invalid_argument;
    ASIO_ERROR_LOCATION(ec);
    return 0;
  }

  LARGE_INTEGER distance, new_offset;
  distance.QuadPart = offset;
  if (::SetFilePointerEx(native_handle(impl), distance, &new_offset, method))
  {
    impl.offset_ = new_offset.QuadPart;
    asio::error::clear(ec);
    return impl.offset_;
  }
  else
  {
    DWORD last_error = ::GetLastError();
    ec.assign(last_error, asio::error::get_system_category());
    ASIO_ERROR_LOCATION(ec);
    return 0;
  }
}

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // defined(ASIO_HAS_FILE)
       //   && defined(ASIO_HAS_WINDOWS_RANDOM_ACCESS_HANDLE)

#endif // ASIO_DETAIL_IMPL_WIN_IOCP_FILE_SERVICE_IPP
