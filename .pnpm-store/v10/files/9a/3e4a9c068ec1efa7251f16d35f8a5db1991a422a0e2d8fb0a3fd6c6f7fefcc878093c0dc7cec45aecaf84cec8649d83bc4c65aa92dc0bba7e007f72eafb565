//
// experimental/detail/coro_promise_allocator.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2021-2023 Klemens D. Morgenstern
//                         (klemens dot morgenstern at gmx dot net)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXPERIMENTAL_DETAIL_CORO_PROMISE_ALLOCATOR_HPP
#define ASIO_EXPERIMENTAL_DETAIL_CORO_PROMISE_ALLOCATOR_HPP

#include "asio/detail/config.hpp"
#include <limits>
#include "asio/experimental/coro_traits.hpp"

namespace asio {
namespace experimental {
namespace detail {

/// Allocate the memory and put the allocator behind the coro memory
template <typename AllocatorType>
void* allocate_coroutine(const std::size_t size, AllocatorType alloc_)
{
  using alloc_type = typename std::allocator_traits<AllocatorType>::template
    rebind_alloc<unsigned char>;
  alloc_type alloc{alloc_};

  const auto align_needed = size % alignof(alloc_type);
  const auto align_offset = align_needed != 0
    ? alignof(alloc_type) - align_needed : 0ull;
  const auto alloc_size = size + sizeof(alloc_type) + align_offset;
  const auto raw =
    std::allocator_traits<alloc_type>::allocate(alloc, alloc_size);
  new(raw + size + align_offset) alloc_type(std::move(alloc));

  return raw;
}

/// Deallocate the memory and destroy the allocator in the coro memory.
template <typename AllocatorType>
void deallocate_coroutine(void* raw_, const std::size_t size)
{
  using alloc_type = typename std::allocator_traits<AllocatorType>::template
    rebind_alloc<unsigned char>;

  const auto raw = static_cast<unsigned char *>(raw_);

  const auto align_needed = size % alignof(alloc_type);
  const auto align_offset = align_needed != 0
    ? alignof(alloc_type) - align_needed : 0ull;
  const auto alloc_size = size + sizeof(alloc_type) + align_offset;

  auto alloc_p = reinterpret_cast<alloc_type *>(raw + size + align_offset);
  auto alloc = std::move(*alloc_p);
  alloc_p->~alloc_type();
  std::allocator_traits<alloc_type>::deallocate(alloc, raw, alloc_size);
}

template <typename T>
constexpr std::size_t variadic_first(std::size_t = 0u)
{
  return std::numeric_limits<std::size_t>::max();
}

template <typename T, typename First, typename... Args>
constexpr std::size_t variadic_first(std::size_t pos = 0u)
{
  if constexpr (std::is_same_v<std::decay_t<First>, T>)
    return pos;
  else
    return variadic_first<T, Args...>(pos+1);
}

template <std::size_t Idx, typename First, typename... Args>
  requires (Idx <= sizeof...(Args))
constexpr decltype(auto) get_variadic(First&& first, Args&&... args)
{
  if constexpr (Idx == 0u)
    return static_cast<First>(first);
  else
    return get_variadic<Idx-1u>(static_cast<Args>(args)...);
}

template <std::size_t Idx>
constexpr decltype(auto) get_variadic();

template <typename Allocator>
struct coro_promise_allocator
{
  using allocator_type = Allocator;
  allocator_type get_allocator() const {return alloc_;}

  template <typename... Args>
  void* operator new(std::size_t size, Args & ... args)
  {
    return allocate_coroutine(size,
        get_variadic<variadic_first<std::allocator_arg_t,
          std::decay_t<Args>...>() + 1u>(args...));
  }

  void operator delete(void* raw, std::size_t size)
  {
    deallocate_coroutine<allocator_type>(raw, size);
  }

  template <typename... Args>
  coro_promise_allocator(Args&& ... args)
    : alloc_(
        get_variadic<variadic_first<std::allocator_arg_t,
          std::decay_t<Args>...>() + 1u>(args...))
  {
  }

private:
  allocator_type alloc_;
};

template <>
struct coro_promise_allocator<std::allocator<void>>
{
  using allocator_type = std::allocator<void>;

  template <typename... Args>
  coro_promise_allocator(Args&&...)
  {
  }

  allocator_type get_allocator() const
  {
    return {};
  }
};

} // namespace detail
} // namespace experimental
} // namespace asio

#endif // ASIO_EXPERIMENTAL_DETAIL_CORO_PROMISE_ALLOCATOR_HPP
