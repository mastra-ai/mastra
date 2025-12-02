//
// experimental/impl/as_single.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_EXPERIMENTAL_AS_SINGLE_HPP
#define ASIO_IMPL_EXPERIMENTAL_AS_SINGLE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <tuple>
#include "asio/associator.hpp"
#include "asio/async_result.hpp"
#include "asio/detail/handler_cont_helpers.hpp"
#include "asio/detail/initiation_base.hpp"
#include "asio/detail/type_traits.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace experimental {
namespace detail {

// Class to adapt a as_single_t as a completion handler.
template <typename Handler>
class as_single_handler
{
public:
  typedef void result_type;

  template <typename CompletionToken>
  as_single_handler(as_single_t<CompletionToken> e)
    : handler_(static_cast<CompletionToken&&>(e.token_))
  {
  }

  template <typename RedirectedHandler>
  as_single_handler(RedirectedHandler&& h)
    : handler_(static_cast<RedirectedHandler&&>(h))
  {
  }

  void operator()()
  {
    static_cast<Handler&&>(handler_)();
  }

  template <typename Arg>
  void operator()(Arg&& arg)
  {
    static_cast<Handler&&>(handler_)(static_cast<Arg&&>(arg));
  }

  template <typename... Args>
  void operator()(Args&&... args)
  {
    static_cast<Handler&&>(handler_)(
        std::make_tuple(static_cast<Args&&>(args)...));
  }

//private:
  Handler handler_;
};

template <typename Handler>
inline bool asio_handler_is_continuation(
    as_single_handler<Handler>* this_handler)
{
  return asio_handler_cont_helpers::is_continuation(
        this_handler->handler_);
}

template <typename Signature>
struct as_single_signature
{
  typedef Signature type;
};

template <typename R>
struct as_single_signature<R()>
{
  typedef R type();
};

template <typename R, typename Arg>
struct as_single_signature<R(Arg)>
{
  typedef R type(Arg);
};

template <typename R, typename... Args>
struct as_single_signature<R(Args...)>
{
  typedef R type(std::tuple<decay_t<Args>...>);
};

} // namespace detail
} // namespace experimental

#if !defined(GENERATING_DOCUMENTATION)

template <typename CompletionToken, typename Signature>
struct async_result<experimental::as_single_t<CompletionToken>, Signature>
{
  template <typename Initiation>
  struct init_wrapper : detail::initiation_base<Initiation>
  {
    using detail::initiation_base<Initiation>::initiation_base;

    template <typename Handler, typename... Args>
    void operator()(Handler&& handler, Args&&... args) &&
    {
      static_cast<Initiation&&>(*this)(
          experimental::detail::as_single_handler<decay_t<Handler>>(
            static_cast<Handler&&>(handler)),
          static_cast<Args&&>(args)...);
    }

    template <typename Handler, typename... Args>
    void operator()(Handler&& handler, Args&&... args) const &
    {
      static_cast<const Initiation&>(*this)(
          experimental::detail::as_single_handler<decay_t<Handler>>(
            static_cast<Handler&&>(handler)),
          static_cast<Args&&>(args)...);
    }
  };

  template <typename Initiation, typename RawCompletionToken, typename... Args>
  static auto initiate(Initiation&& initiation,
      RawCompletionToken&& token, Args&&... args)
    -> decltype(
      async_initiate<CompletionToken,
        typename experimental::detail::as_single_signature<Signature>::type>(
          init_wrapper<decay_t<Initiation>>(
            static_cast<Initiation&&>(initiation)),
          token.token_, static_cast<Args&&>(args)...))
  {
    return async_initiate<CompletionToken,
      typename experimental::detail::as_single_signature<Signature>::type>(
        init_wrapper<decay_t<Initiation>>(
          static_cast<Initiation&&>(initiation)),
        token.token_, static_cast<Args&&>(args)...);
  }
};

template <template <typename, typename> class Associator,
    typename Handler, typename DefaultCandidate>
struct associator<Associator,
    experimental::detail::as_single_handler<Handler>, DefaultCandidate>
  : Associator<Handler, DefaultCandidate>
{
  static typename Associator<Handler, DefaultCandidate>::type get(
      const experimental::detail::as_single_handler<Handler>& h) noexcept
  {
    return Associator<Handler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(const experimental::detail::as_single_handler<Handler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<Handler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<Handler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IMPL_EXPERIMENTAL_AS_SINGLE_HPP
