//
// experimental/impl/use_promise.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2021-2023 Klemens D. Morgenstern
//                         (klemens dot morgenstern at gmx dot net)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXPERIMENTAL_IMPL_USE_PROMISE_HPP
#define ASIO_EXPERIMENTAL_IMPL_USE_PROMISE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <memory>
#include "asio/async_result.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace experimental {

template <typename Allocator>
struct use_promise_t;

namespace detail {

template<typename Signature, typename Executor, typename Allocator>
struct promise_handler;

} // namespace detail
} // namespace experimental

#if !defined(GENERATING_DOCUMENTATION)

template <typename Allocator, typename R, typename... Args>
struct async_result<experimental::use_promise_t<Allocator>, R(Args...)>
{
  template <typename Initiation, typename... InitArgs>
  static auto initiate(Initiation initiation,
      experimental::use_promise_t<Allocator> up, InitArgs... args)
    -> experimental::promise<void(decay_t<Args>...),
      asio::associated_executor_t<Initiation>, Allocator>
  {
    using handler_type = experimental::detail::promise_handler<
      void(decay_t<Args>...),
      asio::associated_executor_t<Initiation>, Allocator>;

    handler_type ht{up.get_allocator(), get_associated_executor(initiation)};
    std::move(initiation)(ht, std::move(args)...);
    return ht.make_promise();
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_EXPERIMENTAL_IMPL_USE_PROMISE_HPP
