//
// impl/write_at.hpp
// ~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_WRITE_AT_HPP
#define ASIO_IMPL_WRITE_AT_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

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

#include "asio/detail/push_options.hpp"

namespace asio {

namespace detail
{
  template <typename SyncRandomAccessWriteDevice, typename ConstBufferSequence,
      typename ConstBufferIterator, typename CompletionCondition>
  std::size_t write_at_buffer_sequence(SyncRandomAccessWriteDevice& d,
      uint64_t offset, const ConstBufferSequence& buffers,
      const ConstBufferIterator&, CompletionCondition completion_condition,
      asio::error_code& ec)
  {
    ec = asio::error_code();
    asio::detail::consuming_buffers<const_buffer,
        ConstBufferSequence, ConstBufferIterator> tmp(buffers);
    while (!tmp.empty())
    {
      if (std::size_t max_size = detail::adapt_completion_condition_result(
            completion_condition(ec, tmp.total_consumed())))
      {
        tmp.consume(d.write_some_at(offset + tmp.total_consumed(),
              tmp.prepare(max_size), ec));
      }
      else
        break;
    }
    return tmp.total_consumed();
  }
} // namespace detail

template <typename SyncRandomAccessWriteDevice, typename ConstBufferSequence,
    typename CompletionCondition>
std::size_t write_at(SyncRandomAccessWriteDevice& d,
    uint64_t offset, const ConstBufferSequence& buffers,
    CompletionCondition completion_condition, asio::error_code& ec,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    >)
{
  return detail::write_at_buffer_sequence(d, offset, buffers,
      asio::buffer_sequence_begin(buffers),
      static_cast<CompletionCondition&&>(completion_condition), ec);
}

template <typename SyncRandomAccessWriteDevice, typename ConstBufferSequence>
inline std::size_t write_at(SyncRandomAccessWriteDevice& d,
    uint64_t offset, const ConstBufferSequence& buffers)
{
  asio::error_code ec;
  std::size_t bytes_transferred = write_at(
      d, offset, buffers, transfer_all(), ec);
  asio::detail::throw_error(ec, "write_at");
  return bytes_transferred;
}

template <typename SyncRandomAccessWriteDevice, typename ConstBufferSequence>
inline std::size_t write_at(SyncRandomAccessWriteDevice& d,
    uint64_t offset, const ConstBufferSequence& buffers,
    asio::error_code& ec)
{
  return write_at(d, offset, buffers, transfer_all(), ec);
}

template <typename SyncRandomAccessWriteDevice, typename ConstBufferSequence,
    typename CompletionCondition>
inline std::size_t write_at(SyncRandomAccessWriteDevice& d,
    uint64_t offset, const ConstBufferSequence& buffers,
    CompletionCondition completion_condition,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    >)
{
  asio::error_code ec;
  std::size_t bytes_transferred = write_at(d, offset, buffers,
      static_cast<CompletionCondition&&>(completion_condition), ec);
  asio::detail::throw_error(ec, "write_at");
  return bytes_transferred;
}

#if !defined(ASIO_NO_EXTENSIONS)
#if !defined(ASIO_NO_IOSTREAM)

template <typename SyncRandomAccessWriteDevice, typename Allocator,
    typename CompletionCondition>
std::size_t write_at(SyncRandomAccessWriteDevice& d,
    uint64_t offset, asio::basic_streambuf<Allocator>& b,
    CompletionCondition completion_condition, asio::error_code& ec,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    >)
{
  std::size_t bytes_transferred = write_at(d, offset, b.data(),
      static_cast<CompletionCondition&&>(completion_condition), ec);
  b.consume(bytes_transferred);
  return bytes_transferred;
}

template <typename SyncRandomAccessWriteDevice, typename Allocator>
inline std::size_t write_at(SyncRandomAccessWriteDevice& d,
    uint64_t offset, asio::basic_streambuf<Allocator>& b)
{
  asio::error_code ec;
  std::size_t bytes_transferred = write_at(d, offset, b, transfer_all(), ec);
  asio::detail::throw_error(ec, "write_at");
  return bytes_transferred;
}

template <typename SyncRandomAccessWriteDevice, typename Allocator>
inline std::size_t write_at(SyncRandomAccessWriteDevice& d,
    uint64_t offset, asio::basic_streambuf<Allocator>& b,
    asio::error_code& ec)
{
  return write_at(d, offset, b, transfer_all(), ec);
}

template <typename SyncRandomAccessWriteDevice, typename Allocator,
    typename CompletionCondition>
inline std::size_t write_at(SyncRandomAccessWriteDevice& d,
    uint64_t offset, asio::basic_streambuf<Allocator>& b,
    CompletionCondition completion_condition,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    >)
{
  asio::error_code ec;
  std::size_t bytes_transferred = write_at(d, offset, b,
      static_cast<CompletionCondition&&>(completion_condition), ec);
  asio::detail::throw_error(ec, "write_at");
  return bytes_transferred;
}

#endif // !defined(ASIO_NO_IOSTREAM)
#endif // !defined(ASIO_NO_EXTENSIONS)

namespace detail
{
  template <typename AsyncRandomAccessWriteDevice,
      typename ConstBufferSequence, typename ConstBufferIterator,
      typename CompletionCondition, typename WriteHandler>
  class write_at_op
    : public base_from_cancellation_state<WriteHandler>,
      base_from_completion_cond<CompletionCondition>
  {
  public:
    write_at_op(AsyncRandomAccessWriteDevice& device,
        uint64_t offset, const ConstBufferSequence& buffers,
        CompletionCondition& completion_condition, WriteHandler& handler)
      : base_from_cancellation_state<WriteHandler>(
          handler, enable_partial_cancellation()),
        base_from_completion_cond<CompletionCondition>(completion_condition),
        device_(device),
        offset_(offset),
        buffers_(buffers),
        start_(0),
        handler_(static_cast<WriteHandler&&>(handler))
    {
    }

    write_at_op(const write_at_op& other)
      : base_from_cancellation_state<WriteHandler>(other),
        base_from_completion_cond<CompletionCondition>(other),
        device_(other.device_),
        offset_(other.offset_),
        buffers_(other.buffers_),
        start_(other.start_),
        handler_(other.handler_)
    {
    }

    write_at_op(write_at_op&& other)
      : base_from_cancellation_state<WriteHandler>(
          static_cast<base_from_cancellation_state<WriteHandler>&&>(other)),
        base_from_completion_cond<CompletionCondition>(
          static_cast<base_from_completion_cond<CompletionCondition>&&>(other)),
        device_(other.device_),
        offset_(other.offset_),
        buffers_(static_cast<buffers_type&&>(other.buffers_)),
        start_(other.start_),
        handler_(static_cast<WriteHandler&&>(other.handler_))
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
            ASIO_HANDLER_LOCATION((__FILE__, __LINE__, "async_write_at"));
            device_.async_write_some_at(
                offset_ + buffers_.total_consumed(), buffers_.prepare(max_size),
                static_cast<write_at_op&&>(*this));
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

        static_cast<WriteHandler&&>(handler_)(
            static_cast<const asio::error_code&>(ec),
            static_cast<const std::size_t&>(buffers_.total_consumed()));
      }
    }

  //private:
    typedef asio::detail::consuming_buffers<const_buffer,
        ConstBufferSequence, ConstBufferIterator> buffers_type;

    AsyncRandomAccessWriteDevice& device_;
    uint64_t offset_;
    buffers_type buffers_;
    int start_;
    WriteHandler handler_;
  };

  template <typename AsyncRandomAccessWriteDevice,
      typename ConstBufferSequence, typename ConstBufferIterator,
      typename CompletionCondition, typename WriteHandler>
  inline bool asio_handler_is_continuation(
      write_at_op<AsyncRandomAccessWriteDevice, ConstBufferSequence,
        ConstBufferIterator, CompletionCondition, WriteHandler>* this_handler)
  {
    return this_handler->start_ == 0 ? true
      : asio_handler_cont_helpers::is_continuation(
          this_handler->handler_);
  }

  template <typename AsyncRandomAccessWriteDevice,
      typename ConstBufferSequence, typename ConstBufferIterator,
      typename CompletionCondition, typename WriteHandler>
  inline void start_write_at_op(AsyncRandomAccessWriteDevice& d,
      uint64_t offset, const ConstBufferSequence& buffers,
      const ConstBufferIterator&, CompletionCondition& completion_condition,
      WriteHandler& handler)
  {
    detail::write_at_op<AsyncRandomAccessWriteDevice, ConstBufferSequence,
      ConstBufferIterator, CompletionCondition, WriteHandler>(
        d, offset, buffers, completion_condition, handler)(
          asio::error_code(), 0, 1);
  }

  template <typename AsyncRandomAccessWriteDevice>
  class initiate_async_write_at
  {
  public:
    typedef typename AsyncRandomAccessWriteDevice::executor_type executor_type;

    explicit initiate_async_write_at(AsyncRandomAccessWriteDevice& device)
      : device_(device)
    {
    }

    executor_type get_executor() const noexcept
    {
      return device_.get_executor();
    }

    template <typename WriteHandler, typename ConstBufferSequence,
        typename CompletionCondition>
    void operator()(WriteHandler&& handler,
        uint64_t offset, const ConstBufferSequence& buffers,
        CompletionCondition&& completion_cond) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a WriteHandler.
      ASIO_WRITE_HANDLER_CHECK(WriteHandler, handler) type_check;

      non_const_lvalue<WriteHandler> handler2(handler);
      non_const_lvalue<CompletionCondition> completion_cond2(completion_cond);
      start_write_at_op(device_, offset, buffers,
          asio::buffer_sequence_begin(buffers),
          completion_cond2.value, handler2.value);
    }

  private:
    AsyncRandomAccessWriteDevice& device_;
  };
} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename AsyncRandomAccessWriteDevice, typename ConstBufferSequence,
    typename ConstBufferIterator, typename CompletionCondition,
    typename WriteHandler, typename DefaultCandidate>
struct associator<Associator,
    detail::write_at_op<AsyncRandomAccessWriteDevice, ConstBufferSequence,
      ConstBufferIterator, CompletionCondition, WriteHandler>,
    DefaultCandidate>
  : Associator<WriteHandler, DefaultCandidate>
{
  static typename Associator<WriteHandler, DefaultCandidate>::type get(
      const detail::write_at_op<AsyncRandomAccessWriteDevice,
        ConstBufferSequence, ConstBufferIterator,
        CompletionCondition, WriteHandler>& h) noexcept
  {
    return Associator<WriteHandler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(
      const detail::write_at_op<AsyncRandomAccessWriteDevice,
        ConstBufferSequence, ConstBufferIterator,
        CompletionCondition, WriteHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<WriteHandler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<WriteHandler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

#if !defined(ASIO_NO_EXTENSIONS)
#if !defined(ASIO_NO_IOSTREAM)

namespace detail
{
  template <typename Allocator, typename WriteHandler>
  class write_at_streambuf_op
  {
  public:
    write_at_streambuf_op(
        asio::basic_streambuf<Allocator>& streambuf,
        WriteHandler& handler)
      : streambuf_(streambuf),
        handler_(static_cast<WriteHandler&&>(handler))
    {
    }

    write_at_streambuf_op(const write_at_streambuf_op& other)
      : streambuf_(other.streambuf_),
        handler_(other.handler_)
    {
    }

    write_at_streambuf_op(write_at_streambuf_op&& other)
      : streambuf_(other.streambuf_),
        handler_(static_cast<WriteHandler&&>(other.handler_))
    {
    }

    void operator()(const asio::error_code& ec,
        const std::size_t bytes_transferred)
    {
      streambuf_.consume(bytes_transferred);
      static_cast<WriteHandler&&>(handler_)(ec, bytes_transferred);
    }

  //private:
    asio::basic_streambuf<Allocator>& streambuf_;
    WriteHandler handler_;
  };

  template <typename Allocator, typename WriteHandler>
  inline bool asio_handler_is_continuation(
      write_at_streambuf_op<Allocator, WriteHandler>* this_handler)
  {
    return asio_handler_cont_helpers::is_continuation(
        this_handler->handler_);
  }

  template <typename AsyncRandomAccessWriteDevice>
  class initiate_async_write_at_streambuf
  {
  public:
    typedef typename AsyncRandomAccessWriteDevice::executor_type executor_type;

    explicit initiate_async_write_at_streambuf(
        AsyncRandomAccessWriteDevice& device)
      : device_(device)
    {
    }

    executor_type get_executor() const noexcept
    {
      return device_.get_executor();
    }

    template <typename WriteHandler,
        typename Allocator, typename CompletionCondition>
    void operator()(WriteHandler&& handler,
        uint64_t offset, basic_streambuf<Allocator>* b,
        CompletionCondition&& completion_condition) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a WriteHandler.
      ASIO_WRITE_HANDLER_CHECK(WriteHandler, handler) type_check;

      non_const_lvalue<WriteHandler> handler2(handler);
      async_write_at(device_, offset, b->data(),
          static_cast<CompletionCondition&&>(completion_condition),
          write_at_streambuf_op<Allocator, decay_t<WriteHandler>>(
            *b, handler2.value));
    }

  private:
    AsyncRandomAccessWriteDevice& device_;
  };
} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename Executor, typename WriteHandler, typename DefaultCandidate>
struct associator<Associator,
    detail::write_at_streambuf_op<Executor, WriteHandler>,
    DefaultCandidate>
  : Associator<WriteHandler, DefaultCandidate>
{
  static typename Associator<WriteHandler, DefaultCandidate>::type get(
      const detail::write_at_streambuf_op<Executor, WriteHandler>& h) noexcept
  {
    return Associator<WriteHandler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(
      const detail::write_at_streambuf_op<Executor, WriteHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<WriteHandler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<WriteHandler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

#endif // !defined(ASIO_NO_IOSTREAM)
#endif // !defined(ASIO_NO_EXTENSIONS)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IMPL_WRITE_AT_HPP
