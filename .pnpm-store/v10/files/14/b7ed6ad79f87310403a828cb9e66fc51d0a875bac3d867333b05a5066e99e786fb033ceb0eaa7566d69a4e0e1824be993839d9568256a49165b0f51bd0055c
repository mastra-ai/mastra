//
// detail/wrapped_handler.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_WRAPPED_HANDLER_HPP
#define ASIO_DETAIL_WRAPPED_HANDLER_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/bind_handler.hpp"
#include "asio/detail/handler_cont_helpers.hpp"
#include "asio/detail/initiate_dispatch.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

struct is_continuation_delegated
{
  template <typename Dispatcher, typename Handler>
  bool operator()(Dispatcher&, Handler& handler) const
  {
    return asio_handler_cont_helpers::is_continuation(handler);
  }
};

struct is_continuation_if_running
{
  template <typename Dispatcher, typename Handler>
  bool operator()(Dispatcher& dispatcher, Handler&) const
  {
    return dispatcher.running_in_this_thread();
  }
};

template <typename Dispatcher, typename = void>
struct wrapped_executor
{
  typedef Dispatcher executor_type;

  static const Dispatcher& get(const Dispatcher& dispatcher) noexcept
  {
    return dispatcher;
  }
};

template <typename Dispatcher>
struct wrapped_executor<Dispatcher,
    void_type<typename Dispatcher::executor_type>>
{
  typedef typename Dispatcher::executor_type executor_type;

  static executor_type get(const Dispatcher& dispatcher) noexcept
  {
    return dispatcher.get_executor();
  }
};

template <typename Dispatcher, typename Handler,
    typename IsContinuation = is_continuation_delegated>
class wrapped_handler
{
public:
  typedef void result_type;
  typedef typename wrapped_executor<Dispatcher>::executor_type executor_type;

  wrapped_handler(Dispatcher dispatcher, Handler& handler)
    : dispatcher_(dispatcher),
      handler_(static_cast<Handler&&>(handler))
  {
  }

  wrapped_handler(const wrapped_handler& other)
    : dispatcher_(other.dispatcher_),
      handler_(other.handler_)
  {
  }

  wrapped_handler(wrapped_handler&& other)
    : dispatcher_(other.dispatcher_),
      handler_(static_cast<Handler&&>(other.handler_))
  {
  }

  executor_type get_executor() const noexcept
  {
    return wrapped_executor<Dispatcher>::get(dispatcher_);
  }

  void operator()()
  {
    detail::initiate_dispatch_with_executor<executor_type>(
        this->get_executor())(static_cast<Handler&&>(handler_));
  }

  void operator()() const
  {
    detail::initiate_dispatch_with_executor<executor_type>(
        this->get_executor())(handler_);
  }

  template <typename Arg1>
  void operator()(const Arg1& arg1)
  {
    detail::initiate_dispatch_with_executor<executor_type>(
        this->get_executor())(detail::bind_handler(handler_, arg1));
  }

  template <typename Arg1>
  void operator()(const Arg1& arg1) const
  {
    detail::initiate_dispatch_with_executor<executor_type>(
        this->get_executor())(detail::bind_handler(handler_, arg1));
  }

  template <typename Arg1, typename Arg2>
  void operator()(const Arg1& arg1, const Arg2& arg2)
  {
    detail::initiate_dispatch_with_executor<executor_type>(
        this->get_executor())(detail::bind_handler(handler_, arg1, arg2));
  }

  template <typename Arg1, typename Arg2>
  void operator()(const Arg1& arg1, const Arg2& arg2) const
  {
    detail::initiate_dispatch_with_executor<executor_type>(
        this->get_executor())(detail::bind_handler(handler_, arg1, arg2));
  }

  template <typename Arg1, typename Arg2, typename Arg3>
  void operator()(const Arg1& arg1, const Arg2& arg2, const Arg3& arg3)
  {
    detail::initiate_dispatch_with_executor<executor_type>(
        this->get_executor())(detail::bind_handler(handler_, arg1, arg2, arg3));
  }

  template <typename Arg1, typename Arg2, typename Arg3>
  void operator()(const Arg1& arg1, const Arg2& arg2, const Arg3& arg3) const
  {
    detail::initiate_dispatch_with_executor<executor_type>(
        this->get_executor())(detail::bind_handler(handler_, arg1, arg2, arg3));
  }

  template <typename Arg1, typename Arg2, typename Arg3, typename Arg4>
  void operator()(const Arg1& arg1, const Arg2& arg2, const Arg3& arg3,
      const Arg4& arg4)
  {
    detail::initiate_dispatch_with_executor<executor_type>(
        this->get_executor())(
          detail::bind_handler(handler_, arg1, arg2, arg3, arg4));
  }

  template <typename Arg1, typename Arg2, typename Arg3, typename Arg4>
  void operator()(const Arg1& arg1, const Arg2& arg2, const Arg3& arg3,
      const Arg4& arg4) const
  {
    detail::initiate_dispatch_with_executor<executor_type>(
        this->get_executor())(
          detail::bind_handler(handler_, arg1, arg2, arg3, arg4));
  }

  template <typename Arg1, typename Arg2, typename Arg3, typename Arg4,
      typename Arg5>
  void operator()(const Arg1& arg1, const Arg2& arg2, const Arg3& arg3,
      const Arg4& arg4, const Arg5& arg5)
  {
    detail::initiate_dispatch_with_executor<executor_type>(
        this->get_executor())(
          detail::bind_handler(handler_, arg1, arg2, arg3, arg4, arg5));
  }

  template <typename Arg1, typename Arg2, typename Arg3, typename Arg4,
      typename Arg5>
  void operator()(const Arg1& arg1, const Arg2& arg2, const Arg3& arg3,
      const Arg4& arg4, const Arg5& arg5) const
  {
    detail::initiate_dispatch_with_executor<executor_type>(
        this->get_executor())(
          detail::bind_handler(handler_, arg1, arg2, arg3, arg4, arg5));
  }

//private:
  Dispatcher dispatcher_;
  Handler handler_;
};

template <typename Dispatcher, typename Handler, typename IsContinuation>
inline bool asio_handler_is_continuation(
    wrapped_handler<Dispatcher, Handler, IsContinuation>* this_handler)
{
  return IsContinuation()(this_handler->dispatcher_, this_handler->handler_);
}

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DETAIL_WRAPPED_HANDLER_HPP
