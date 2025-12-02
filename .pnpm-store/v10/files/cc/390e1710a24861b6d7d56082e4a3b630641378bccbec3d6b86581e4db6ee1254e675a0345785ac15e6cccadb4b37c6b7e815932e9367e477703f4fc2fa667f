//
// impl/read_at.hpp
// ~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_READ_AT_HPP
#define ASIO_IMPL_READ_AT_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include <algorithm>
#include "asio/associator.hpp"
#include "asio/buffer.hpp"
#include "asio/detail/array_fwd.hpp"
#include "asio/detail/base_from_cancellation_state.hpp"
#include "asio/detail/base_from_completion_cond.hpp"
#include "asio/detail/bind_handler.hpp"
#include "asio/detail/consuming_buffers.hpp"
#include "asio/detail/dependent_type.hpp"
#include "asio/detail/handler_cont_helpers.hpp"
#include "asio/detail/handler_tracking.hpp"
#include "asio/detail/handler_type_requirements.hpp"
#include "asio/detail/non_const_lvalue.hpp"
#include "asio/detail/throw_error.hpp"
#include "asio/error.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

namespace detail
{
  template <typename SyncRandomAccessReadDevice, typename MutableBufferSequence,
      typename MutableBufferIterator, typename CompletionCondition>
  std::size_t read_at_buffer_sequence(SyncRandomAccessReadDevice& d,
      uint64_t offset, const MutableBufferSequence& buffers,
      const MutableBufferIterator&, CompletionCondition completion_condition,
      asio::error_code& ec)
  {
    ec = asio::error_code();
    asio::detail::consuming_buffers<mutable_buffer,
        MutableBufferSequence, MutableBufferIterator> tmp(buffers);
    while (!tmp.empty())
    {
      if (std::size_t max_size = detail::adapt_completion_condition_result(
            completion_condition(ec, tmp.total_consumed())))
      {
        tmp.consume(d.read_some_at(offset + tmp.total_consumed(),
              tmp.prepare(max_size), ec));
      }
      else
        break;
    }
    return tmp.total_consumed();
  }
} // namespace detail

template <typename SyncRandomAccessReadDevice, typename MutableBufferSequence,
    typename CompletionCondition>
std::size_t read_at(SyncRandomAccessReadDevice& d,
    uint64_t offset, const MutableBufferSequence& buffers,
    CompletionCondition completion_condition, asio::error_code& ec,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    >)
{
  return detail::read_at_buffer_sequence(d, offset, buffers,
      asio::buffer_sequence_begin(buffers),
      static_cast<CompletionCondition&&>(completion_condition), ec);
}

template <typename SyncRandomAccessReadDevice, typename MutableBufferSequence>
inline std::size_t read_at(SyncRandomAccessReadDevice& d,
    uint64_t offset, const MutableBufferSequence& buffers)
{
  asio::error_code ec;
  std::size_t bytes_transferred = read_at(
      d, offset, buffers, transfer_all(), ec);
  asio::detail::throw_error(ec, "read_at");
  return bytes_transferred;
}

template <typename SyncRandomAccessReadDevice, typename MutableBufferSequence>
inline std::size_t read_at(SyncRandomAccessReadDevice& d,
    uint64_t offset, const MutableBufferSequence& buffers,
    asio::error_code& ec)
{
  return read_at(d, offset, buffers, transfer_all(), ec);
}

template <typename SyncRandomAccessReadDevice, typename MutableBufferSequence,
    typename CompletionCondition>
inline std::size_t read_at(SyncRandomAccessReadDevice& d,
    uint64_t offset, const MutableBufferSequence& buffers,
    CompletionCondition completion_condition,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    >)
{
  asio::error_code ec;
  std::size_t bytes_transferred = read_at(d, offset, buffers,
      static_cast<CompletionCondition&&>(completion_condition), ec);
  asio::detail::throw_error(ec, "read_at");
  return bytes_transferred;
}

#if !defined(ASIO_NO_EXTENSIONS)
#if !defined(ASIO_NO_IOSTREAM)

template <typename SyncRandomAccessReadDevice, typename Allocator,
    typename CompletionCondition>
std::size_t read_at(SyncRandomAccessReadDevice& d,
    uint64_t offset, asio::basic_streambuf<Allocator>& b,
    CompletionCondition completion_condition, asio::error_code& ec,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    >)
{
  ec = asio::error_code();
  std::size_t total_transferred = 0;
  std::size_t max_size = detail::adapt_completion_condition_result(
        completion_condition(ec, total_transferred));
  std::size_t bytes_available = read_size_helper(b, max_size);
  while (bytes_available > 0)
  {
    std::size_t bytes_transferred = d.read_some_at(
        offset + total_transferred, b.prepare(bytes_available), ec);
    b.commit(bytes_transferred);
    total_transferred += bytes_transferred;
    max_size = detail::adapt_completion_condition_result(
          completion_condition(ec, total_transferred));
    bytes_available = read_size_helper(b, max_size);
  }
  return total_transferred;
}

template <typename SyncRandomAccessReadDevice, typename Allocator>
inline std::size_t read_at(SyncRandomAccessReadDevice& d,
    uint64_t offset, asio::basic_streambuf<Allocator>& b)
{
  asio::error_code ec;
  std::size_t bytes_transferred = read_at(
      d, offset, b, transfer_all(), ec);
  asio::detail::throw_error(ec, "read_at");
  return bytes_transferred;
}

template <typename SyncRandomAccessReadDevice, typename Allocator>
inline std::size_t read_at(SyncRandomAccessReadDevice& d,
    uint64_t offset, asio::basic_streambuf<Allocator>& b,
    asio::error_code& ec)
{
  return read_at(d, offset, b, transfer_all(), ec);
}

template <typename SyncRandomAccessReadDevice, typename Allocator,
    typename CompletionCondition>
inline std::size_t read_at(SyncRandomAccessReadDevice& d,
    uint64_t offset, asio::basic_streambuf<Allocator>& b,
    CompletionCondition completion_condition,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    >)
{
  asio::error_code ec;
  std::size_t bytes_transferred = read_at(d, offset, b,
      static_cast<CompletionCondition&&>(completion_condition), ec);
  asio::detail::throw_error(ec, "read_at");
  return bytes_transferred;
}

#endif // !defined(ASIO_NO_IOSTREAM)
#endif // !defined(ASIO_NO_EXTENSIONS)

namespace detail
{
  template <typename AsyncRandomAccessReadDevice,
      typename MutableBufferSequence, typename MutableBufferIterator,
      typename CompletionCondition, typename ReadHandler>
  class read_at_op
    : public base_from_cancellation_state<ReadHandler>,
      base_from_completion_cond<CompletionCondition>
  {
  public:
    read_at_op(AsyncRandomAccessReadDevice& device,
        uint64_t offset, const MutableBufferSequence& buffers,
        CompletionCondition& completion_condition, ReadHandler& handler)
      : base_from_cancellation_state<ReadHandler>(
          handler, enable_partial_cancellation()),
        base_from_completion_cond<CompletionCondition>(completion_condition),
        device_(device),
        offset_(offset),
        buffers_(buffers),
        start_(0),
        handler_(static_cast<ReadHandler&&>(handler))
    {
    }

    read_at_op(const read_at_op& other)
      : base_from_cancellation_state<ReadHandler>(other),
        base_from_completion_cond<CompletionCondition>(other),
        device_(other.device_),
        offset_(other.offset_),
        buffers_(other.buffers_),
        start_(other.start_),
        handler_(other.handler_)
    {
    }

    read_at_op(read_at_op&& other)
      : base_from_cancellation_state<ReadHandler>(
          static_cast<base_from_cancellation_state<ReadHandler>&&>(other)),
        base_from_completion_cond<CompletionCondition>(
          static_cast<base_from_completion_cond<CompletionCondition>&&>(other)),
        device_(other.device_),
        offset_(other.offset_),
        buffers_(static_cast<buffers_type&&>(other.buffers_)),
        start_(other.start_),
        handler_(static_cast<ReadHandler&&>(other.handler_))
    {
    }

    void operator()(asio::error_code ec,
        std::size_t bytes_transferred, int start = 0)
    {
      std::size_t max_size;
      switch (start_ = start)
      {
        case 1:
        max_size = this->check_for_completion(ec, buffers_.total_consumed());
        for (;;)
        {
          {
            ASIO_HANDLER_LOCATION((__FILE__, __LINE__, "async_read_at"));
            device_.async_read_some_at(
                offset_ + buffers_.total_consumed(), buffers_.prepare(max_size),
                static_cast<read_at_op&&>(*this));
          }
          return; default:
          buffers_.consume(bytes_transferred);
          if ((!ec && bytes_transferred == 0) || buffers_.empty())
            break;
          max_size = this->check_for_completion(ec, buffers_.total_consumed());
          if (max_size == 0)
            break;
          if (this->cancelled() != cancellation_type::none)
          {
            ec = asio::error::operation_aborted;
            break;
          }
        }

        static_cast<ReadHandler&&>(handler_)(
            static_cast<const asio::error_code&>(ec),
            static_cast<const std::size_t&>(buffers_.total_consumed()));
      }
    }

  //private:
    typedef asio::detail::consuming_buffers<mutable_buffer,
        MutableBufferSequence, MutableBufferIterator> buffers_type;

    AsyncRandomAccessReadDevice& device_;
    uint64_t offset_;
    buffers_type buffers_;
    int start_;
    ReadHandler handler_;
  };

  template <typename AsyncRandomAccessReadDevice,
      typename MutableBufferSequence, typename MutableBufferIterator,
      typename CompletionCondition, typename ReadHandler>
  inline bool asio_handler_is_continuation(
      read_at_op<AsyncRandomAccessReadDevice, MutableBufferSequence,
        MutableBufferIterator, CompletionCondition, ReadHandler>* this_handler)
  {
    return this_handler->start_ == 0 ? true
      : asio_handler_cont_helpers::is_continuation(
          this_handler->handler_);
  }

  template <typename AsyncRandomAccessReadDevice,
      typename MutableBufferSequence, typename MutableBufferIterator,
      typename CompletionCondition, typename ReadHandler>
  inline void start_read_at_op(AsyncRandomAccessReadDevice& d,
      uint64_t offset, const MutableBufferSequence& buffers,
      const MutableBufferIterator&, CompletionCondition& completion_condition,
      ReadHandler& handler)
  {
    detail::read_at_op<AsyncRandomAccessReadDevice, MutableBufferSequence,
      MutableBufferIterator, CompletionCondition, ReadHandler>(
        d, offset, buffers, completion_condition, handler)(
          asio::error_code(), 0, 1);
  }

  template <typename AsyncRandomAccessReadDevice>
  class initiate_async_read_at
  {
  public:
    typedef typename AsyncRandomAccessReadDevice::executor_type executor_type;

    explicit initiate_async_read_at(AsyncRandomAccessReadDevice& device)
      : device_(device)
    {
    }

    executor_type get_executor() const noexcept
    {
      return device_.get_executor();
    }

    template <typename ReadHandler, typename MutableBufferSequence,
        typename CompletionCondition>
    void operator()(ReadHandler&& handler,
        uint64_t offset, const MutableBufferSequence& buffers,
        CompletionCondition&& completion_cond) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a ReadHandler.
      ASIO_READ_HANDLER_CHECK(ReadHandler, handler) type_check;

      non_const_lvalue<ReadHandler> handler2(handler);
      non_const_lvalue<CompletionCondition> completion_cond2(completion_cond);
      start_read_at_op(device_, offset, buffers,
          asio::buffer_sequence_begin(buffers),
          completion_cond2.value, handler2.value);
    }

  private:
    AsyncRandomAccessReadDevice& device_;
  };
} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename AsyncRandomAccessReadDevice, typename MutableBufferSequence,
    typename MutableBufferIterator, typename CompletionCondition,
    typename ReadHandler, typename DefaultCandidate>
struct associator<Associator,
    detail::read_at_op<AsyncRandomAccessReadDevice, MutableBufferSequence,
      MutableBufferIterator, CompletionCondition, ReadHandler>,
    DefaultCandidate>
  : Associator<ReadHandler, DefaultCandidate>
{
  static typename Associator<ReadHandler, DefaultCandidate>::type get(
      const detail::read_at_op<AsyncRandomAccessReadDevice,
        MutableBufferSequence, MutableBufferIterator,
        CompletionCondition, ReadHandler>& h) noexcept
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(
      const detail::read_at_op<AsyncRandomAccessReadDevice,
        MutableBufferSequence, MutableBufferIterator,
        CompletionCondition, ReadHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

#if !defined(ASIO_NO_EXTENSIONS)
#if !defined(ASIO_NO_IOSTREAM)

namespace detail
{
  template <typename AsyncRandomAccessReadDevice, typename Allocator,
      typename CompletionCondition, typename ReadHandler>
  class read_at_streambuf_op
    : public base_from_cancellation_state<ReadHandler>,
      base_from_completion_cond<CompletionCondition>
  {
  public:
    read_at_streambuf_op(AsyncRandomAccessReadDevice& device,
        uint64_t offset, basic_streambuf<Allocator>& streambuf,
        CompletionCondition& completion_condition, ReadHandler& handler)
      : base_from_cancellation_state<ReadHandler>(
          handler, enable_partial_cancellation()),
        base_from_completion_cond<CompletionCondition>(completion_condition),
        device_(device),
        offset_(offset),
        streambuf_(streambuf),
        start_(0),
        total_transferred_(0),
        handler_(static_cast<ReadHandler&&>(handler))
    {
    }

    read_at_streambuf_op(const read_at_streambuf_op& other)
      : base_from_cancellation_state<ReadHandler>(other),
        base_from_completion_cond<CompletionCondition>(other),
        device_(other.device_),
        offset_(other.offset_),
        streambuf_(other.streambuf_),
        start_(other.start_),
        total_transferred_(other.total_transferred_),
        handler_(other.handler_)
    {
    }

    read_at_streambuf_op(read_at_streambuf_op&& other)
      : base_from_cancellation_state<ReadHandler>(
          static_cast<base_from_cancellation_state<ReadHandler>&&>(other)),
        base_from_completion_cond<CompletionCondition>(
          static_cast<base_from_completion_cond<CompletionCondition>&&>(other)),
        device_(other.device_),
        offset_(other.offset_),
        streambuf_(other.streambuf_),
        start_(other.start_),
        total_transferred_(other.total_transferred_),
        handler_(static_cast<ReadHandler&&>(other.handler_))
    {
    }

    void operator()(asio::error_code ec,
        std::size_t bytes_transferred, int start = 0)
    {
      std::size_t max_size, bytes_available;
      switch (start_ = start)
      {
        case 1:
        max_size = this->check_for_completion(ec, total_transferred_);
        bytes_available = read_size_helper(streambuf_, max_size);
        for (;;)
        {
          {
            ASIO_HANDLER_LOCATION((__FILE__, __LINE__, "async_read_at"));
            device_.async_read_some_at(offset_ + total_transferred_,
                streambuf_.prepare(bytes_available),
                static_cast<read_at_streambuf_op&&>(*this));
          }
          return; default:
          total_transferred_ += bytes_transferred;
          streambuf_.commit(bytes_transferred);
          max_size = this->check_for_completion(ec, total_transferred_);
          bytes_available = read_size_helper(streambuf_, max_size);
          if ((!ec && bytes_transferred == 0) || bytes_available == 0)
            break;
          if (this->cancelled() != cancellation_type::none)
          {
            ec = asio::error::operation_aborted;
            break;
          }
        }

        static_cast<ReadHandler&&>(handler_)(
            static_cast<const asio::error_code&>(ec),
            static_cast<const std::size_t&>(total_transferred_));
      }
    }

  //private:
    AsyncRandomAccessReadDevice& device_;
    uint64_t offset_;
    asio::basic_streambuf<Allocator>& streambuf_;
    int start_;
    std::size_t total_transferred_;
    ReadHandler handler_;
  };

  template <typename AsyncRandomAccessReadDevice, typename Allocator,
      typename CompletionCondition, typename ReadHandler>
  inline bool asio_handler_is_continuation(
      read_at_streambuf_op<AsyncRandomAccessReadDevice, Allocator,
        CompletionCondition, ReadHandler>* this_handler)
  {
    return this_handler->start_ == 0 ? true
      : asio_handler_cont_helpers::is_continuation(
          this_handler->handler_);
  }

  template <typename AsyncRandomAccessReadDevice>
  class initiate_async_read_at_streambuf
  {
  public:
    typedef typename AsyncRandomAccessReadDevice::executor_type executor_type;

    explicit initiate_async_read_at_streambuf(
        AsyncRandomAccessReadDevice& device)
      : device_(device)
    {
    }

    executor_type get_executor() const noexcept
    {
      return device_.get_executor();
    }

    template <typename ReadHandler,
        typename Allocator, typename CompletionCondition>
    void operator()(ReadHandler&& handler,
        uint64_t offset, basic_streambuf<Allocator>* b,
        CompletionCondition&& completion_cond) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a ReadHandler.
      ASIO_READ_HANDLER_CHECK(ReadHandler, handler) type_check;

      non_const_lvalue<ReadHandler> handler2(handler);
      non_const_lvalue<CompletionCondition> completion_cond2(completion_cond);
      read_at_streambuf_op<AsyncRandomAccessReadDevice, Allocator,
        CompletionCondition, decay_t<ReadHandler>>(
          device_, offset, *b, completion_cond2.value, handler2.value)(
            asio::error_code(), 0, 1);
    }

  private:
    AsyncRandomAccessReadDevice& device_;
  };
} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename AsyncRandomAccessReadDevice, typename Executor,
    typename CompletionCondition, typename ReadHandler,
    typename DefaultCandidate>
struct associator<Associator,
    detail::read_at_streambuf_op<AsyncRandomAccessReadDevice,
      Executor, CompletionCondition, ReadHandler>,
    DefaultCandidate>
  : Associator<ReadHandler, DefaultCandidate>
{
  static typename Associator<ReadHandler, DefaultCandidate>::type get(
      const detail::read_at_streambuf_op<AsyncRandomAccessReadDevice,
        Executor, CompletionCondition, ReadHandler>& h) noexcept
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(
      const detail::read_at_streambuf_op<AsyncRandomAccessReadDevice,
        Executor, CompletionCondition, ReadHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

#endif // !defined(ASIO_NO_IOSTREAM)
#endif // !defined(ASIO_NO_EXTENSIONS)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IMPL_READ_AT_HPP
