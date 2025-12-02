//
// detail/completion_message.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_COMPLETION_MESSAGE_HPP
#define ASIO_DETAIL_COMPLETION_MESSAGE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <tuple>
#include "asio/detail/type_traits.hpp"
#include "asio/detail/utility.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

template <typename Signature>
class completion_message;

template <typename R>
class completion_message<R()>
{
public:
  completion_message(int)
  {
  }

  template <typename Handler>
  void receive(Handler& handler)
  {
    static_cast<Handler&&>(handler)();
  }
};

template <typename R, typename Arg0>
class completion_message<R(Arg0)>
{
public:
  template <typename T0>
  completion_message(int, T0&& t0)
    : arg0_(static_cast<T0&&>(t0))
  {
  }

  template <typename Handler>
  void receive(Handler& handler)
  {
    static_cast<Handler&&>(handler)(
        static_cast<arg0_type&&>(arg0_));
  }

private:
  typedef decay_t<Arg0> arg0_type;
  arg0_type arg0_;
};

template <typename R, typename Arg0, typename Arg1>
class completion_message<R(Arg0, Arg1)>
{
public:
  template <typename T0, typename T1>
  completion_message(int, T0&& t0, T1&& t1)
    : arg0_(static_cast<T0&&>(t0)),
      arg1_(static_cast<T1&&>(t1))
  {
  }

  template <typename Handler>
  void receive(Handler& handler)
  {
    static_cast<Handler&&>(handler)(
        static_cast<arg0_type&&>(arg0_),
        static_cast<arg1_type&&>(arg1_));
  }

private:
  typedef decay_t<Arg0> arg0_type;
  arg0_type arg0_;
  typedef decay_t<Arg1> arg1_type;
  arg1_type arg1_;
};

template <typename R, typename... Args>
class completion_message<R(Args...)>
{
public:
  template <typename... T>
  completion_message(int, T&&... t)
    : args_(static_cast<T&&>(t)...)
  {
  }

  template <typename Handler>
  void receive(Handler& h)
  {
    this->do_receive(h, asio::detail::index_sequence_for<Args...>());
  }

private:
  template <typename Handler, std::size_t... I>
  void do_receive(Handler& h, asio::detail::index_sequence<I...>)
  {
    static_cast<Handler&&>(h)(
        std::get<I>(static_cast<args_type&&>(args_))...);
  }

  typedef std::tuple<decay_t<Args>...> args_type;
  args_type args_;
};

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DETAIL_COMPLETION_MESSAGE_HPP
