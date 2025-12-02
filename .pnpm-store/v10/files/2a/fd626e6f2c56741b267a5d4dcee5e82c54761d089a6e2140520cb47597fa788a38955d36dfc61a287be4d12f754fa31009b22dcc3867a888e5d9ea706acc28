//
// experimental/use_promise.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2021-2023 Klemens D. Morgenstern
//                         (klemens dot morgenstern at gmx dot net)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXPERIMENTAL_USE_PROMISE_HPP
#define ASIO_EXPERIMENTAL_USE_PROMISE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <memory>
#include "asio/detail/type_traits.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace experimental {

template <typename Allocator = std::allocator<void>>
struct use_promise_t
{
  /// The allocator type. The allocator is used when constructing the
  /// @c promise object for a given asynchronous operation.
  typedef Allocator allocator_type;

  /// Construct using default-constructed allocator.
  constexpr use_promise_t()
  {
  }

  /// Construct using specified allocator.
  explicit use_promise_t(const Allocator& allocator)
    : allocator_(allocator)
  {
  }

  /// Obtain allocator.
  allocator_type get_allocator() const noexcept
  {
    return allocator_;
  }

  /// Adapts an executor to add the @c use_promise_t completion token as the
  /// default.
  template <typename InnerExecutor>
  struct executor_with_default : InnerExecutor
  {
    /// Specify @c use_promise_t as the default completion token type.
    typedef use_promise_t<Allocator> default_completion_token_type;

    /// Construct the adapted executor from the inner executor type.
    executor_with_default(const InnerExecutor& ex) noexcept
      : InnerExecutor(ex)
    {
    }

    /// Convert the specified executor to the inner executor type, then use
    /// that to construct the adapted executor.
    template <typename OtherExecutor>
    executor_with_default(const OtherExecutor& ex,
        constraint_t<
          is_convertible<OtherExecutor, InnerExecutor>::value
        > = 0) noexcept
      : InnerExecutor(ex)
    {
    }
  };

  /// Function helper to adapt an I/O object to use @c use_promise_t as its
  /// default completion token type.
  template <typename T>
  static typename decay_t<T>::template rebind_executor<
      executor_with_default<typename decay_t<T>::executor_type>
    >::other
  as_default_on(T&& object)
  {
    return typename decay_t<T>::template rebind_executor<
        executor_with_default<typename decay_t<T>::executor_type>
      >::other(static_cast<T&&>(object));
  }

  /// Specify an alternate allocator.
  template <typename OtherAllocator>
  use_promise_t<OtherAllocator> rebind(const OtherAllocator& allocator) const
  {
    return use_promise_t<OtherAllocator>(allocator);
  }

private:
  Allocator allocator_;
};

ASIO_INLINE_VARIABLE constexpr use_promise_t<> use_promise;

} // namespace experimental
} // namespace asio

#include "asio/detail/pop_options.hpp"

#include "asio/experimental/impl/use_promise.hpp"

#endif // ASIO_EXPERIMENTAL_USE_CORO_HPP
