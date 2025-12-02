//
// impl/use_awaitable.hpp
// ~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_USE_AWAITABLE_HPP
#define ASIO_IMPL_USE_AWAITABLE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/async_result.hpp"
#include "asio/cancellation_signal.hpp"
#include "asio/disposition.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

template <typename Executor, typename T>
class awaitable_handler_base
  : public awaitable_thread<Executor>
{
public:
  typedef void result_type;
  typedef awaitable<T, Executor> awaitable_type;

  // Construct from the entry point of a new thread of execution.
  awaitable_handler_base(awaitable<awaitable_thread_entry_point, Executor> a,
      const Executor& ex, cancellation_slot pcs, cancellation_state cs)
    : awaitable_thread<Executor>(std::move(a), ex, pcs, cs)
  {
  }

  // Transfer ownership from another awaitable_thread.
  explicit awaitable_handler_base(awaitable_thread<Executor>* h)
    : awaitable_thread<Executor>(std::move(*h))
  {
  }

protected:
  awaitable_frame<T, Executor>* frame() noexcept
  {
    return static_cast<awaitable_frame<T, Executor>*>(
        this->entry_point()->top_of_stack_);
  }
};

template <typename, typename...>
class awaitable_handler;

template <typename Executor>
class awaitable_handler<Executor>
  : public awaitable_handler_base<Executor, void>
{
public:
  using awaitable_handler_base<Executor, void>::awaitable_handler_base;

  void operator()()
  {
    this->frame()->attach_thread(this);
    this->frame()->return_void();
    this->frame()->clear_cancellation_slot();
    this->frame()->pop_frame();
    this->pump();
  }
};

template <typename Executor, typename T>
class awaitable_handler<Executor, T>
  : public awaitable_handler_base<Executor,
      conditional_t<is_disposition<T>::value, void, T>>
{
public:
  using awaitable_handler_base<Executor,
    conditional_t<is_disposition<T>::value, void, T>>
      ::awaitable_handler_base;

  template <typename Arg>
  void operator()(Arg&& arg)
  {
    this->frame()->attach_thread(this);
    if constexpr (is_disposition<T>::value)
    {
      if (arg == no_error)
        this->frame()->return_void();
      else
        this->frame()->set_disposition(arg);
    }
    else
      this->frame()->return_value(std::forward<Arg>(arg));
    this->frame()->clear_cancellation_slot();
    this->frame()->pop_frame();
    this->pump();
  }
};

template <typename Executor, typename T0, typename T1>
class awaitable_handler<Executor, T0, T1>
  : public awaitable_handler_base<Executor,
      conditional_t<is_disposition<T0>::value, T1, std::tuple<T0, T1>>>
{
public:
  using awaitable_handler_base<Executor,
    conditional_t<is_disposition<T0>::value, T1, std::tuple<T0, T1>>>
      ::awaitable_handler_base;

  template <typename Arg0, typename Arg1>
  void operator()(Arg0&& arg0, Arg1&& arg1)
  {
    this->frame()->attach_thread(this);
    if constexpr (is_disposition<T0>::value)
    {
      if (arg0 == no_error)
        this->frame()->return_value(std::forward<Arg1>(arg1));
      else
        this->frame()->set_disposition(std::forward<Arg0>(arg0));
    }
    else
    {
      this->frame()->return_values(std::forward<Arg0>(arg0),
          std::forward<Arg1>(arg1));
    }
    this->frame()->clear_cancellation_slot();
    this->frame()->pop_frame();
    this->pump();
  }
};

template <typename Executor, typename T0, typename... Ts>
class awaitable_handler<Executor, T0, Ts...>
  : public awaitable_handler_base<Executor,
      conditional_t<is_disposition<T0>::value,
        std::tuple<Ts...>, std::tuple<T0, Ts...>>>
{
public:
  using awaitable_handler_base<Executor,
      conditional_t<is_disposition<T0>::value,
        std::tuple<Ts...>, std::tuple<T0, Ts...>>>
          ::awaitable_handler_base;

  template <typename Arg0, typename... Args>
  void operator()(Arg0&& arg0, Args&&... args)
  {
    this->frame()->attach_thread(this);
    if constexpr (is_disposition<T0>::value)
    {
      if (arg0 == no_error)
        this->frame()->return_values(std::forward<Args>(args)...);
      else
        this->frame()->set_disposition(std::forward<Arg0>(arg0));
    }
    else
    {
      this->frame()->return_values(std::forward<Arg0>(arg0),
          std::forward<Args>(args)...);
    }
    this->frame()->clear_cancellation_slot();
    this->frame()->pop_frame();
    this->pump();
  }
};

} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

#if defined(_MSC_VER)
template <typename T>
T dummy_return()
{
  return std::move(*static_cast<T*>(nullptr));
}

template <>
inline void dummy_return()
{
}
#endif // defined(_MSC_VER)

template <typename Executor, typename R, typename... Args>
class async_result<use_awaitable_t<Executor>, R(Args...)>
{
public:
  typedef typename detail::awaitable_handler<
      Executor, decay_t<Args>...> handler_type;
  typedef typename handler_type::awaitable_type return_type;

  template <typename Initiation, typename... InitArgs>
#if defined(__APPLE_CC__) && (__clang_major__ == 13)
  __attribute__((noinline))
#endif // defined(__APPLE_CC__) && (__clang_major__ == 13)
  static handler_type* do_init(
      detail::awaitable_frame_base<Executor>* frame, Initiation& initiation,
      use_awaitable_t<Executor> u, InitArgs&... args)
  {
    (void)u;
    ASIO_HANDLER_LOCATION((u.file_name_, u.line_, u.function_name_));
    handler_type handler(frame->detach_thread());
    std::move(initiation)(std::move(handler), std::move(args)...);
    return nullptr;
  }

  template <typename Initiation, typename... InitArgs>
  static return_type initiate(Initiation initiation,
      use_awaitable_t<Executor> u, InitArgs... args)
  {
    co_await [&] (auto* frame)
      {
        return do_init(frame, initiation, u, args...);
      };

    for (;;) {} // Never reached.
#if defined(_MSC_VER)
    co_return dummy_return<typename return_type::value_type>();
#endif // defined(_MSC_VER)
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IMPL_USE_AWAITABLE_HPP
