//
// impl/connect.hpp
// ~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_CONNECT_HPP
#define ASIO_IMPL_CONNECT_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include <algorithm>
#include "asio/associator.hpp"
#include "asio/detail/base_from_cancellation_state.hpp"
#include "asio/detail/bind_handler.hpp"
#include "asio/detail/handler_cont_helpers.hpp"
#include "asio/detail/handler_tracking.hpp"
#include "asio/detail/handler_type_requirements.hpp"
#include "asio/detail/non_const_lvalue.hpp"
#include "asio/detail/throw_error.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/error.hpp"
#include "asio/post.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

namespace detail
{
  template <typename Protocol, typename Iterator>
  inline typename Protocol::endpoint deref_connect_result(
      Iterator iter, asio::error_code& ec)
  {
    return ec ? typename Protocol::endpoint() : *iter;
  }

  template <typename ConnectCondition, typename Iterator>
  inline Iterator call_connect_condition(ConnectCondition& connect_condition,
      const asio::error_code& ec, Iterator next, Iterator end,
      constraint_t<
        is_same<
          result_of_t<ConnectCondition(asio::error_code, Iterator)>,
          Iterator
        >::value
      > = 0)
  {
    if (next != end)
      return connect_condition(ec, next);
    return end;
  }

  template <typename ConnectCondition, typename Iterator>
  inline Iterator call_connect_condition(ConnectCondition& connect_condition,
      const asio::error_code& ec, Iterator next, Iterator end,
      constraint_t<
        is_same<
          result_of_t<ConnectCondition(asio::error_code,
            decltype(*declval<Iterator>()))>,
          bool
        >::value
      > = 0)
  {
    for (;next != end; ++next)
      if (connect_condition(ec, *next))
        return next;
    return end;
  }
} // namespace detail

template <typename Protocol, typename Executor, typename EndpointSequence>
typename Protocol::endpoint connect(basic_socket<Protocol, Executor>& s,
    const EndpointSequence& endpoints,
    constraint_t<
      is_endpoint_sequence<EndpointSequence>::value
    >)
{
  asio::error_code ec;
  typename Protocol::endpoint result = connect(s, endpoints, ec);
  asio::detail::throw_error(ec, "connect");
  return result;
}

template <typename Protocol, typename Executor, typename EndpointSequence>
typename Protocol::endpoint connect(basic_socket<Protocol, Executor>& s,
    const EndpointSequence& endpoints, asio::error_code& ec,
    constraint_t<
      is_endpoint_sequence<EndpointSequence>::value
    >)
{
  return detail::deref_connect_result<Protocol>(
      connect(s, endpoints.begin(), endpoints.end(),
        detail::default_connect_condition(), ec), ec);
}

template <typename Protocol, typename Executor, typename Iterator>
Iterator connect(basic_socket<Protocol, Executor>& s,
    Iterator begin, Iterator end)
{
  asio::error_code ec;
  Iterator result = connect(s, begin, end, ec);
  asio::detail::throw_error(ec, "connect");
  return result;
}

template <typename Protocol, typename Executor, typename Iterator>
inline Iterator connect(basic_socket<Protocol, Executor>& s,
    Iterator begin, Iterator end, asio::error_code& ec)
{
  return connect(s, begin, end, detail::default_connect_condition(), ec);
}

template <typename Protocol, typename Executor,
    typename EndpointSequence, typename ConnectCondition>
typename Protocol::endpoint connect(basic_socket<Protocol, Executor>& s,
    const EndpointSequence& endpoints, ConnectCondition connect_condition,
    constraint_t<
      is_endpoint_sequence<EndpointSequence>::value
    >,
    constraint_t<
      is_connect_condition<ConnectCondition,
        decltype(declval<const EndpointSequence&>().begin())>::value
    >)
{
  asio::error_code ec;
  typename Protocol::endpoint result = connect(
      s, endpoints, connect_condition, ec);
  asio::detail::throw_error(ec, "connect");
  return result;
}

template <typename Protocol, typename Executor,
    typename EndpointSequence, typename ConnectCondition>
typename Protocol::endpoint connect(basic_socket<Protocol, Executor>& s,
    const EndpointSequence& endpoints, ConnectCondition connect_condition,
    asio::error_code& ec,
    constraint_t<
      is_endpoint_sequence<EndpointSequence>::value
    >,
    constraint_t<
      is_connect_condition<ConnectCondition,
        decltype(declval<const EndpointSequence&>().begin())>::value
    >)
{
  return detail::deref_connect_result<Protocol>(
      connect(s, endpoints.begin(), endpoints.end(),
        connect_condition, ec), ec);
}

template <typename Protocol, typename Executor,
    typename Iterator, typename ConnectCondition>
Iterator connect(basic_socket<Protocol, Executor>& s, Iterator begin,
    Iterator end, ConnectCondition connect_condition,
    constraint_t<
      is_connect_condition<ConnectCondition, Iterator>::value
    >)
{
  asio::error_code ec;
  Iterator result = connect(s, begin, end, connect_condition, ec);
  asio::detail::throw_error(ec, "connect");
  return result;
}

template <typename Protocol, typename Executor,
    typename Iterator, typename ConnectCondition>
Iterator connect(basic_socket<Protocol, Executor>& s, Iterator begin,
    Iterator end, ConnectCondition connect_condition,
    asio::error_code& ec,
    constraint_t<
      is_connect_condition<ConnectCondition, Iterator>::value
    >)
{
  ec = asio::error_code();

  for (Iterator iter = begin; iter != end; ++iter)
  {
    iter = (detail::call_connect_condition(connect_condition, ec, iter, end));
    if (iter != end)
    {
      s.close(ec);
      s.connect(*iter, ec);
      if (!ec)
        return iter;
    }
    else
      break;
  }

  if (!ec)
    ec = asio::error::not_found;

  return end;
}

namespace detail
{
  // Enable the empty base class optimisation for the connect condition.
  template <typename ConnectCondition>
  class base_from_connect_condition
  {
  protected:
    explicit base_from_connect_condition(
        const ConnectCondition& connect_condition)
      : connect_condition_(connect_condition)
    {
    }

    template <typename Iterator>
    void check_condition(const asio::error_code& ec,
        Iterator& iter, Iterator& end)
    {
      iter = detail::call_connect_condition(connect_condition_, ec, iter, end);
    }

  private:
    ConnectCondition connect_condition_;
  };

  // The default_connect_condition implementation is essentially a no-op. This
  // template specialisation lets us eliminate all costs associated with it.
  template <>
  class base_from_connect_condition<default_connect_condition>
  {
  protected:
    explicit base_from_connect_condition(const default_connect_condition&)
    {
    }

    template <typename Iterator>
    void check_condition(const asio::error_code&, Iterator&, Iterator&)
    {
    }
  };

  template <typename Protocol, typename Executor, typename EndpointSequence,
      typename ConnectCondition, typename RangeConnectHandler>
  class range_connect_op
    : public base_from_cancellation_state<RangeConnectHandler>,
      base_from_connect_condition<ConnectCondition>
  {
  public:
    range_connect_op(basic_socket<Protocol, Executor>& sock,
        const EndpointSequence& endpoints,
        const ConnectCondition& connect_condition,
        RangeConnectHandler& handler)
      : base_from_cancellation_state<RangeConnectHandler>(
          handler, enable_partial_cancellation()),
        base_from_connect_condition<ConnectCondition>(connect_condition),
        socket_(sock),
        endpoints_(endpoints),
        index_(0),
        start_(0),
        handler_(static_cast<RangeConnectHandler&&>(handler))
    {
    }

    range_connect_op(const range_connect_op& other)
      : base_from_cancellation_state<RangeConnectHandler>(other),
        base_from_connect_condition<ConnectCondition>(other),
        socket_(other.socket_),
        endpoints_(other.endpoints_),
        index_(other.index_),
        start_(other.start_),
        handler_(other.handler_)
    {
    }

    range_connect_op(range_connect_op&& other)
      : base_from_cancellation_state<RangeConnectHandler>(
          static_cast<base_from_cancellation_state<RangeConnectHandler>&&>(
            other)),
        base_from_connect_condition<ConnectCondition>(other),
        socket_(other.socket_),
        endpoints_(other.endpoints_),
        index_(other.index_),
        start_(other.start_),
        handler_(static_cast<RangeConnectHandler&&>(other.handler_))
    {
    }

    void operator()(asio::error_code ec, int start = 0)
    {
      this->process(ec, start,
          const_cast<const EndpointSequence&>(endpoints_).begin(),
          const_cast<const EndpointSequence&>(endpoints_).end());
    }

  //private:
    template <typename Iterator>
    void process(asio::error_code ec,
        int start, Iterator begin, Iterator end)
    {
      Iterator iter = begin;
      std::advance(iter, index_);

      switch (start_ = start)
      {
        case 1:
        for (;;)
        {
          this->check_condition(ec, iter, end);
          index_ = std::distance(begin, iter);

          if (iter != end)
          {
            socket_.close(ec);
            ASIO_HANDLER_LOCATION((__FILE__, __LINE__, "async_connect"));
            socket_.async_connect(*iter,
                static_cast<range_connect_op&&>(*this));
            return;
          }

          if (start)
          {
            ec = asio::error::not_found;
            ASIO_HANDLER_LOCATION((__FILE__, __LINE__, "async_connect"));
            asio::post(socket_.get_executor(),
                detail::bind_handler(
                  static_cast<range_connect_op&&>(*this), ec));
            return;
          }

          /* fall-through */ default:

          if (iter == end)
            break;

          if (!socket_.is_open())
          {
            ec = asio::error::operation_aborted;
            break;
          }

          if (!ec)
            break;

          if (this->cancelled() != cancellation_type::none)
          {
            ec = asio::error::operation_aborted;
            break;
          }

          ++iter;
          ++index_;
        }

        static_cast<RangeConnectHandler&&>(handler_)(
            static_cast<const asio::error_code&>(ec),
            static_cast<const typename Protocol::endpoint&>(
              ec || iter == end ? typename Protocol::endpoint() : *iter));
      }
    }

    basic_socket<Protocol, Executor>& socket_;
    EndpointSequence endpoints_;
    std::size_t index_;
    int start_;
    RangeConnectHandler handler_;
  };

  template <typename Protocol, typename Executor, typename EndpointSequence,
      typename ConnectCondition, typename RangeConnectHandler>
  inline bool asio_handler_is_continuation(
      range_connect_op<Protocol, Executor, EndpointSequence,
        ConnectCondition, RangeConnectHandler>* this_handler)
  {
    return asio_handler_cont_helpers::is_continuation(
        this_handler->handler_);
  }

  template <typename Protocol, typename Executor>
  class initiate_async_range_connect
  {
  public:
    typedef Executor executor_type;

    explicit initiate_async_range_connect(basic_socket<Protocol, Executor>& s)
      : socket_(s)
    {
    }

    executor_type get_executor() const noexcept
    {
      return socket_.get_executor();
    }

    template <typename RangeConnectHandler,
        typename EndpointSequence, typename ConnectCondition>
    void operator()(RangeConnectHandler&& handler,
        const EndpointSequence& endpoints,
        const ConnectCondition& connect_condition) const
    {
      // If you get an error on the following line it means that your
      // handler does not meet the documented type requirements for an
      // RangeConnectHandler.
      ASIO_RANGE_CONNECT_HANDLER_CHECK(RangeConnectHandler,
          handler, typename Protocol::endpoint) type_check;

      non_const_lvalue<RangeConnectHandler> handler2(handler);
      range_connect_op<Protocol, Executor, EndpointSequence, ConnectCondition,
        decay_t<RangeConnectHandler>>(socket_, endpoints,
          connect_condition, handler2.value)(asio::error_code(), 1);
    }

  private:
    basic_socket<Protocol, Executor>& socket_;
  };

  template <typename Protocol, typename Executor, typename Iterator,
      typename ConnectCondition, typename IteratorConnectHandler>
  class iterator_connect_op
    : public base_from_cancellation_state<IteratorConnectHandler>,
      base_from_connect_condition<ConnectCondition>
  {
  public:
    iterator_connect_op(basic_socket<Protocol, Executor>& sock,
        const Iterator& begin, const Iterator& end,
        const ConnectCondition& connect_condition,
        IteratorConnectHandler& handler)
      : base_from_cancellation_state<IteratorConnectHandler>(
          handler, enable_partial_cancellation()),
        base_from_connect_condition<ConnectCondition>(connect_condition),
        socket_(sock),
        iter_(begin),
        end_(end),
        start_(0),
        handler_(static_cast<IteratorConnectHandler&&>(handler))
    {
    }

    iterator_connect_op(const iterator_connect_op& other)
      : base_from_cancellation_state<IteratorConnectHandler>(other),
        base_from_connect_condition<ConnectCondition>(other),
        socket_(other.socket_),
        iter_(other.iter_),
        end_(other.end_),
        start_(other.start_),
        handler_(other.handler_)
    {
    }

    iterator_connect_op(iterator_connect_op&& other)
      : base_from_cancellation_state<IteratorConnectHandler>(
          static_cast<base_from_cancellation_state<IteratorConnectHandler>&&>(
            other)),
        base_from_connect_condition<ConnectCondition>(other),
        socket_(other.socket_),
        iter_(other.iter_),
        end_(other.end_),
        start_(other.start_),
        handler_(static_cast<IteratorConnectHandler&&>(other.handler_))
    {
    }

    void operator()(asio::error_code ec, int start = 0)
    {
      switch (start_ = start)
      {
        case 1:
        for (;;)
        {
          this->check_condition(ec, iter_, end_);

          if (iter_ != end_)
          {
            socket_.close(ec);
            ASIO_HANDLER_LOCATION((__FILE__, __LINE__, "async_connect"));
            socket_.async_connect(*iter_,
                static_cast<iterator_connect_op&&>(*this));
            return;
          }

          if (start)
          {
            ec = asio::error::not_found;
            ASIO_HANDLER_LOCATION((__FILE__, __LINE__, "async_connect"));
            asio::post(socket_.get_executor(),
                detail::bind_handler(
                  static_cast<iterator_connect_op&&>(*this), ec));
            return;
          }

          /* fall-through */ default:

          if (iter_ == end_)
            break;

          if (!socket_.is_open())
          {
            ec = asio::error::operation_aborted;
            break;
          }

          if (!ec)
            break;

          if (this->cancelled() != cancellation_type::none)
          {
            ec = asio::error::operation_aborted;
            break;
          }

          ++iter_;
        }

        static_cast<IteratorConnectHandler&&>(handler_)(
            static_cast<const asio::error_code&>(ec),
            static_cast<const Iterator&>(iter_));
      }
    }

  //private:
    basic_socket<Protocol, Executor>& socket_;
    Iterator iter_;
    Iterator end_;
    int start_;
    IteratorConnectHandler handler_;
  };

  template <typename Protocol, typename Executor, typename Iterator,
      typename ConnectCondition, typename IteratorConnectHandler>
  inline bool asio_handler_is_continuation(
      iterator_connect_op<Protocol, Executor, Iterator,
        ConnectCondition, IteratorConnectHandler>* this_handler)
  {
    return asio_handler_cont_helpers::is_continuation(
        this_handler->handler_);
  }

  template <typename Protocol, typename Executor>
  class initiate_async_iterator_connect
  {
  public:
    typedef Executor executor_type;

    explicit initiate_async_iterator_connect(
        basic_socket<Protocol, Executor>& s)
      : socket_(s)
    {
    }

    executor_type get_executor() const noexcept
    {
      return socket_.get_executor();
    }

    template <typename IteratorConnectHandler,
        typename Iterator, typename ConnectCondition>
    void operator()(IteratorConnectHandler&& handler,
        Iterator begin, Iterator end,
        const ConnectCondition& connect_condition) const
    {
      // If you get an error on the following line it means that your
      // handler does not meet the documented type requirements for an
      // IteratorConnectHandler.
      ASIO_ITERATOR_CONNECT_HANDLER_CHECK(
          IteratorConnectHandler, handler, Iterator) type_check;

      non_const_lvalue<IteratorConnectHandler> handler2(handler);
      iterator_connect_op<Protocol, Executor, Iterator, ConnectCondition,
        decay_t<IteratorConnectHandler>>(socket_, begin, end,
          connect_condition, handler2.value)(asio::error_code(), 1);
    }

  private:
    basic_socket<Protocol, Executor>& socket_;
  };
} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename Protocol, typename Executor, typename EndpointSequence,
    typename ConnectCondition, typename RangeConnectHandler,
    typename DefaultCandidate>
struct associator<Associator,
    detail::range_connect_op<Protocol, Executor,
      EndpointSequence, ConnectCondition, RangeConnectHandler>,
    DefaultCandidate>
  : Associator<RangeConnectHandler, DefaultCandidate>
{
  static typename Associator<RangeConnectHandler, DefaultCandidate>::type get(
      const detail::range_connect_op<Protocol, Executor, EndpointSequence,
        ConnectCondition, RangeConnectHandler>& h) noexcept
  {
    return Associator<RangeConnectHandler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(
      const detail::range_connect_op<Protocol, Executor,
        EndpointSequence, ConnectCondition, RangeConnectHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(
      Associator<RangeConnectHandler, DefaultCandidate>::get(
        h.handler_, c))
  {
    return Associator<RangeConnectHandler, DefaultCandidate>::get(
        h.handler_, c);
  }
};

template <template <typename, typename> class Associator,
    typename Protocol, typename Executor, typename Iterator,
    typename ConnectCondition, typename IteratorConnectHandler,
    typename DefaultCandidate>
struct associator<Associator,
    detail::iterator_connect_op<Protocol, Executor,
      Iterator, ConnectCondition, IteratorConnectHandler>,
    DefaultCandidate>
  : Associator<IteratorConnectHandler, DefaultCandidate>
{
  static typename Associator<IteratorConnectHandler, DefaultCandidate>::type
  get(const detail::iterator_connect_op<Protocol, Executor, Iterator,
        ConnectCondition, IteratorConnectHandler>& h) noexcept
  {
    return Associator<IteratorConnectHandler, DefaultCandidate>::get(
        h.handler_);
  }

  static auto get(
      const detail::iterator_connect_op<Protocol, Executor,
        Iterator, ConnectCondition, IteratorConnectHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(
      Associator<IteratorConnectHandler, DefaultCandidate>::get(
        h.handler_, c))
  {
    return Associator<IteratorConnectHandler, DefaultCandidate>::get(
        h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IMPL_CONNECT_HPP
