//
// detail/memory.hpp
// ~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_MEMORY_HPP
#define ASIO_DETAIL_MEMORY_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <cstddef>
#include <cstdlib>
#include <memory>
#include <new>
#include "asio/detail/cstdint.hpp"
#include "asio/detail/throw_exception.hpp"

#if !defined(ASIO_HAS_STD_ALIGNED_ALLOC) \
  && defined(ASIO_HAS_BOOST_ALIGN)
# include <boost/align/aligned_alloc.hpp>
#endif // !defined(ASIO_HAS_STD_ALIGNED_ALLOC)
       //   && defined(ASIO_HAS_BOOST_ALIGN)

namespace asio {
namespace detail {

using std::allocate_shared;
using std::make_shared;
using std::shared_ptr;
using std::weak_ptr;
using std::addressof;

#if defined(ASIO_HAS_STD_TO_ADDRESS)
using std::to_address;
#else // defined(ASIO_HAS_STD_TO_ADDRESS)
template <typename T>
inline T* to_address(T* p) { return p; }
template <typename T>
inline const T* to_address(const T* p) { return p; }
template <typename T>
inline volatile T* to_address(volatile T* p) { return p; }
template <typename T>
inline const volatile T* to_address(const volatile T* p) { return p; }
#endif // defined(ASIO_HAS_STD_TO_ADDRESS)

inline void* align(std::size_t alignment,
    std::size_t size, void*& ptr, std::size_t& space)
{
  return std::align(alignment, size, ptr, space);
}

} // namespace detail

using std::allocator_arg_t;
# define ASIO_USES_ALLOCATOR(t) \
  namespace std { \
    template <typename Allocator> \
    struct uses_allocator<t, Allocator> : true_type {}; \
  } \
  /**/
# define ASIO_REBIND_ALLOC(alloc, t) \
  typename std::allocator_traits<alloc>::template rebind_alloc<t>
  /**/

inline void* aligned_new(std::size_t align, std::size_t size)
{
#if defined(ASIO_HAS_STD_ALIGNED_ALLOC)
  align = (align < ASIO_DEFAULT_ALIGN) ? ASIO_DEFAULT_ALIGN : align;
  size = (size % align == 0) ? size : size + (align - size % align);
  void* ptr = std::aligned_alloc(align, size);
  if (!ptr)
  {
    std::bad_alloc ex;
    asio::detail::throw_exception(ex);
  }
  return ptr;
#elif defined(ASIO_HAS_BOOST_ALIGN)
  align = (align < ASIO_DEFAULT_ALIGN) ? ASIO_DEFAULT_ALIGN : align;
  size = (size % align == 0) ? size : size + (align - size % align);
  void* ptr = boost::alignment::aligned_alloc(align, size);
  if (!ptr)
  {
    std::bad_alloc ex;
    asio::detail::throw_exception(ex);
  }
  return ptr;
#elif defined(ASIO_MSVC)
  align = (align < ASIO_DEFAULT_ALIGN) ? ASIO_DEFAULT_ALIGN : align;
  size = (size % align == 0) ? size : size + (align - size % align);
  void* ptr = _aligned_malloc(size, align);
  if (!ptr)
  {
    std::bad_alloc ex;
    asio::detail::throw_exception(ex);
  }
  return ptr;
#else // defined(ASIO_MSVC)
  (void)align;
  return ::operator new(size);
#endif // defined(ASIO_MSVC)
}

inline void aligned_delete(void* ptr)
{
#if defined(ASIO_HAS_STD_ALIGNED_ALLOC)
  std::free(ptr);
#elif defined(ASIO_HAS_BOOST_ALIGN)
  boost::alignment::aligned_free(ptr);
#elif defined(ASIO_MSVC)
  _aligned_free(ptr);
#else // defined(ASIO_MSVC)
  ::operator delete(ptr);
#endif // defined(ASIO_MSVC)
}

} // namespace asio

#endif // ASIO_DETAIL_MEMORY_HPP
