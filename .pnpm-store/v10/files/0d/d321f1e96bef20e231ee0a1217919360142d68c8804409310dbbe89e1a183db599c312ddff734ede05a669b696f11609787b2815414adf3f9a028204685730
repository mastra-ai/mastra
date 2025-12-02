//
// impl/detached.hpp
// ~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_DETACHED_HPP
#define ASIO_IMPL_DETACHED_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/async_result.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

  // Class to adapt a detached_t as a completion handler.
  class detached_handler
  {
  public:
    typedef void result_type;

    detached_handler(detached_t)
    {
    }

    template <typename... Args>
    void operator()(Args...)
    {
    }
  };

} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <typename... Signatures>
struct async_result<detached_t, Signatures...>
{
  typedef asio::detail::detached_handler completion_handler_type;

  typedef void return_type;

  explicit async_result(completion_handler_type&)
  {
  }

  void get()
  {
  }

  template <typename Initiation, typename RawCompletionToken, typename... Args>
  static return_type initiate(Initiation&& initiation,
      RawCompletionToken&&, Args&&... args)
  {
    static_cast<Initiation&&>(initiation)(
        detail::detached_handler(detached_t()),
        static_cast<Args&&>(args)...);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IMPL_DETACHED_HPP
