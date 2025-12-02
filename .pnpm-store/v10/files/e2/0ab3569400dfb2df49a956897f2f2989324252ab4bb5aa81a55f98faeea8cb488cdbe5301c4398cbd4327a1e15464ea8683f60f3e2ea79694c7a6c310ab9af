//
// recycling_allocator.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_RECYCLING_ALLOCATOR_HPP
#define ASIO_RECYCLING_ALLOCATOR_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/recycling_allocator.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

/// An allocator that caches memory blocks in thread-local storage for reuse.
/**
 * The @recycling_allocator uses a simple strategy where a limited number of
 * small memory blocks are cached in thread-local storage, if the current
 * thread is running an @c io_context or is part of a @c thread_pool.
 */
template <typename T>
class recycling_allocator
{
public:
  /// The type of object allocated by the recycling allocator.
  typedef T value_type;

  /// Rebind the allocator to another value_type.
  template <typename U>
  struct rebind
  {
    /// The rebound @c allocator type.
    typedef recycling_allocator<U> other;
  };

  /// Default constructor.
  constexpr recycling_allocator() noexcept
  {
  }

  /// Converting constructor.
  template <typename U>
  constexpr recycling_allocator(
      const recycling_allocator<U>&) noexcept
  {
  }

  /// Equality operator. Always returns true.
  constexpr bool operator==(
      const recycling_allocator&) const noexcept
  {
    return true;
  }

  /// Inequality operator. Always returns false.
  constexpr bool operator!=(
      const recycling_allocator&) const noexcept
  {
    return false;
  }

  /// Allocate memory for the specified number of values.
  T* allocate(std::size_t n)
  {
    return detail::recycling_allocator<T>().allocate(n);
  }

  /// Deallocate memory for the specified number of values.
  void deallocate(T* p, std::size_t n)
  {
    detail::recycling_allocator<T>().deallocate(p, n);
  }
};

/// A proto-allocator that caches memory blocks in thread-local storage for
/// reuse.
/**
 * The @recycling_allocator uses a simple strategy where a limited number of
 * small memory blocks are cached in thread-local storage, if the current
 * thread is running an @c io_context or is part of a @c thread_pool.
 */
template <>
class recycling_allocator<void>
{
public:
  /// No values are allocated by a proto-allocator.
  typedef void value_type;

  /// Rebind the allocator to another value_type.
  template <typename U>
  struct rebind
  {
    /// The rebound @c allocator type.
    typedef recycling_allocator<U> other;
  };

  /// Default constructor.
  constexpr recycling_allocator() noexcept
  {
  }

  /// Converting constructor.
  template <typename U>
  constexpr recycling_allocator(
      const recycling_allocator<U>&) noexcept
  {
  }

  /// Equality operator. Always returns true.
  constexpr bool operator==(
      const recycling_allocator&) const noexcept
  {
    return true;
  }

  /// Inequality operator. Always returns false.
  constexpr bool operator!=(
      const recycling_allocator&) const noexcept
  {
    return false;
  }
};

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_RECYCLING_ALLOCATOR_HPP
