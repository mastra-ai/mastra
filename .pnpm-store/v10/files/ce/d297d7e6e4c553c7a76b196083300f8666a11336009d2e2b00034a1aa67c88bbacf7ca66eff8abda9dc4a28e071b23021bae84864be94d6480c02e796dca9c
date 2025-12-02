//
// detail/atomic_count.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_ATOMIC_COUNT_HPP
#define ASIO_DETAIL_ATOMIC_COUNT_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if !defined(ASIO_HAS_THREADS)
// Nothing to include.
#else // !defined(ASIO_HAS_THREADS)
# include <atomic>
#endif // !defined(ASIO_HAS_THREADS)

namespace asio {
namespace detail {

#if !defined(ASIO_HAS_THREADS)
typedef long atomic_count;
inline void increment(atomic_count& a, long b) { a += b; }
inline void decrement(atomic_count& a, long b) { a -= b; }
inline void ref_count_up(atomic_count& a) { ++a; }
inline bool ref_count_down(atomic_count& a) { return --a == 0; }
#else // !defined(ASIO_HAS_THREADS)
typedef std::atomic<long> atomic_count;
inline void increment(atomic_count& a, long b) { a += b; }
inline void decrement(atomic_count& a, long b) { a -= b; }

inline void ref_count_up(atomic_count& a)
{
  a.fetch_add(1, std::memory_order_relaxed);
}

inline bool ref_count_down(atomic_count& a)
{
  if (a.fetch_sub(1, std::memory_order_release) == 1)
  {
    std::atomic_thread_fence(std::memory_order_acquire);
    return true;
  }
  return false;
}
#endif // !defined(ASIO_HAS_THREADS)

} // namespace detail
} // namespace asio

#endif // ASIO_DETAIL_ATOMIC_COUNT_HPP
