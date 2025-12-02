//
// file_base.hpp
// ~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_FILE_BASE_HPP
#define ASIO_FILE_BASE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_FILE) \
  || defined(GENERATING_DOCUMENTATION)

#if !defined(ASIO_WINDOWS)
# include <fcntl.h>
#endif // !defined(ASIO_WINDOWS)

#include "asio/detail/push_options.hpp"

namespace asio {

/// The file_base class is used as a base for the basic_stream_file and
/// basic_random_access_file class templates so that we have a common place to
/// define flags.
class file_base
{
public:
#if defined(GENERATING_DOCUMENTATION)
  /// A bitmask type (C++ Std [lib.bitmask.types]).
  typedef unspecified flags;

  /// Open the file for reading.
  static const flags read_only = implementation_defined;

  /// Open the file for writing.
  static const flags write_only = implementation_defined;

  /// Open the file for reading and writing.
  static const flags read_write = implementation_defined;

  /// Open the file in append mode.
  static const flags append = implementation_defined;

  /// Create the file if it does not exist.
  static const flags create = implementation_defined;

  /// Ensure a new file is created. Must be combined with @c create.
  static const flags exclusive = implementation_defined;

  /// Open the file with any existing contents truncated.
  static const flags truncate = implementation_defined;

  /// Open the file so that write operations automatically synchronise the file
  /// data and metadata to disk.
  static const flags sync_all_on_write = implementation_defined;
#else
  enum flags
  {
#if defined(ASIO_WINDOWS)
    read_only = 1,
    write_only = 2,
    read_write = 4,
    append = 8,
    create = 16,
    exclusive = 32,
    truncate = 64,
    sync_all_on_write = 128
#else // defined(ASIO_WINDOWS)
    read_only = O_RDONLY,
    write_only = O_WRONLY,
    read_write = O_RDWR,
    append = O_APPEND,
    create = O_CREAT,
    exclusive = O_EXCL,
    truncate = O_TRUNC,
    sync_all_on_write = O_SYNC
#endif // defined(ASIO_WINDOWS)
  };

  // Implement bitmask operations as shown in C++ Std [lib.bitmask.types].

  friend flags operator&(flags x, flags y)
  {
    return static_cast<flags>(
        static_cast<unsigned int>(x) & static_cast<unsigned int>(y));
  }

  friend flags operator|(flags x, flags y)
  {
    return static_cast<flags>(
        static_cast<unsigned int>(x) | static_cast<unsigned int>(y));
  }

  friend flags operator^(flags x, flags y)
  {
    return static_cast<flags>(
        static_cast<unsigned int>(x) ^ static_cast<unsigned int>(y));
  }

  friend flags operator~(flags x)
  {
    return static_cast<flags>(~static_cast<unsigned int>(x));
  }

  friend flags& operator&=(flags& x, flags y)
  {
    x = x & y;
    return x;
  }

  friend flags& operator|=(flags& x, flags y)
  {
    x = x | y;
    return x;
  }

  friend flags& operator^=(flags& x, flags y)
  {
    x = x ^ y;
    return x;
  }
#endif

  /// Basis for seeking in a file.
  enum seek_basis
  {
#if defined(GENERATING_DOCUMENTATION)
    /// Seek to an absolute position.
    seek_set = implementation_defined,

    /// Seek to an offset relative to the current file position.
    seek_cur = implementation_defined,

    /// Seek to an offset relative to the end of the file.
    seek_end = implementation_defined
#else
    seek_set = SEEK_SET,
    seek_cur = SEEK_CUR,
    seek_end = SEEK_END
#endif
  };

protected:
  /// Protected destructor to prevent deletion through this type.
  ~file_base()
  {
  }
};

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // defined(ASIO_HAS_FILE)
       //   || defined(GENERATING_DOCUMENTATION)

#endif // ASIO_FILE_BASE_HPP
