//
// impl/write.hpp
// ~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_WRITE_HPP
#define ASIO_IMPL_WRITE_HPP

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
  template <typename SyncWriteStream, typename ConstBufferSequence,
      typename ConstBufferIterator, typename CompletionCondition>
  std::size_t write(SyncWriteStream& s,
      const ConstBufferSequence& buffers, const ConstBufferIterator&,
      CompletionCondition completion_condition, asio::error_code& ec)
  {
    ec = asio::error_code();
    asio::detail::consuming_buffers<const_buffer,
        ConstBufferSequence, ConstBufferIterator> tmp(buffers);
    while (!tmp.empty())
    {
      if (std::size_t max_size = detail::adapt_completion_condition_result(
            completion_condition(ec, tmp.total_consumed())))
        tmp.consume(s.write_some(tmp.prepare(max_size), ec));
      else
        break;
    }
    return tmp.total_consumed();
  }
} // namespace detail

template <typename SyncWriteStream, typename ConstBufferSequence,
    typename CompletionCondition>
inline std::size_t write(SyncWriteStream& s, const ConstBufferSequence& buffers,
    CompletionCondition completion_condition, asio::error_code& ec,
    constraint_t<
      is_const_buffer_sequence<ConstBufferSequence>::value
    >,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    >)
{
  return detail::write(s, buffers,
      asio::buffer_sequence_begin(buffers),
      static_cast<CompletionCondition&&>(completion_condition), ec);
}

template <typename SyncWriteStream, typename ConstBufferSequence>
inline std::size_t write(SyncWriteStream& s, const ConstBufferSequence& buffers,
    constraint_t<
      is_const_buffer_sequence<ConstBufferSequence>::value
    >)
{
  asio::error_code ec;
  std::size_t bytes_transferred = write(s, buffers, transfer_all(), ec);
  asio::detail::throw_error(ec, "write");
  return bytes_transferred;
}

template <typename SyncWriteStream, typename ConstBufferSequence>
inline std::size_t write(SyncWriteStream& s, const ConstBufferSequence& buffers,
    asio::error_code& ec,
    constraint_t<
      is_const_buffer_sequence<ConstBufferSequence>::value
    >)
{
  return write(s, buffers, transfer_all(), ec);
}

template <typename SyncWriteStream, typename ConstBufferSequence,
    typename CompletionCondition>
inline std::size_t write(SyncWriteStream& s, const ConstBufferSequence& buffers,
    CompletionCondition completion_condition,
    constraint_t<
      is_const_buffer_sequence<ConstBufferSequence>::value
    >,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    >)
{
  asio::error_code ec;
  std::size_t bytes_transferred = write(s, buffers,
      static_cast<CompletionCondition&&>(completion_condition), ec);
  asio::detail::throw_error(ec, "write");
  return bytes_transferred;
}

#if !defined(ASIO_NO_DYNAMIC_BUFFER_V1)

template <typename SyncWriteStream, typename DynamicBuffer_v1,
    typename CompletionCondition>
std::size_t write(SyncWriteStream& s,
    DynamicBuffer_v1&& buffers,
    CompletionCondition completion_condition, asio::error_code& ec,
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    >,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    >,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    >)
{
  decay_t<DynamicBuffer_v1> b(
      static_cast<DynamicBuffer_v1&&>(buffers));

  std::size_t bytes_transferred = write(s, b.data(),
      static_cast<CompletionCondition&&>(completion_condition), ec);
  b.consume(bytes_transferred);
  return bytes_transferred;
}

template <typename SyncWriteStream, typename DynamicBuffer_v1>
inline std::size_t write(SyncWriteStream& s,
    DynamicBuffer_v1&& buffers,
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    >,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    >)
{
  asio::error_code ec;
  std::size_t bytes_transferred = write(s,
      static_cast<DynamicBuffer_v1&&>(buffers),
      transfer_all(), ec);
  asio::detail::throw_error(ec, "write");
  return bytes_transferred;
}

template <typename SyncWriteStream, typename DynamicBuffer_v1>
inline std::size_t write(SyncWriteStream& s,
    DynamicBuffer_v1&& buffers,
    asio::error_code& ec,
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    >,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    >)
{
  return write(s, static_cast<DynamicBuffer_v1&&>(buffers),
      transfer_all(), ec);
}

template <typename SyncWriteStream, typename DynamicBuffer_v1,
    typename CompletionCondition>
inline std::size_t write(SyncWriteStream& s,
    DynamicBuffer_v1&& buffers,
    CompletionCondition completion_condition,
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    >,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    >,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    >)
{
  asio::error_code ec;
  std::size_t bytes_transferred = write(s,
      static_cast<DynamicBuffer_v1&&>(buffers),
      static_cast<CompletionCondition&&>(completion_condition), ec);
  asio::detail::throw_error(ec, "write");
  return bytes_transferred;
}

#if !defined(ASIO_NO_EXTENSIONS)
#if !defined(ASIO_NO_IOSTREAM)

template <typename SyncWriteStream, typename Allocator,
    typename CompletionCondition>
inline std::size_t write(SyncWriteStream& s,
    asio::basic_streambuf<Allocator>& b,
    CompletionCondition completion_condition, asio::error_code& ec,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    >)
{
  return write(s, basic_streambuf_ref<Allocator>(b),
      static_cast<CompletionCondition&&>(completion_condition), ec);
}

template <typename SyncWriteStream, typename Allocator>
inline std::size_t write(SyncWriteStream& s,
    asio::basic_streambuf<Allocator>& b)
{
  return write(s, basic_streambuf_ref<Allocator>(b));
}

template <typename SyncWriteStream, typename Allocator>
inline std::size_t write(SyncWriteStream& s,
    asio::basic_streambuf<Allocator>& b,
    asio::error_code& ec)
{
  return write(s, basic_streambuf_ref<Allocator>(b), ec);
}

template <typename SyncWriteStream, typename Allocator,
    typename CompletionCondition>
inline std::size_t write(SyncWriteStream& s,
    asio::basic_streambuf<Allocator>& b,
    CompletionCondition completion_condition,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    >)
{
  return write(s, basic_streambuf_ref<Allocator>(b),
      static_cast<CompletionCondition&&>(completion_condition));
}

#endif // !defined(ASIO_NO_IOSTREAM)
#endif // !defined(ASIO_NO_EXTENSIONS)
#endif // !defined(ASIO_NO_DYNAMIC_BUFFER_V1)

template <typename SyncWriteStream, typename DynamicBuffer_v2,
    typename CompletionCondition>
std::size_t write(SyncWriteStream& s, DynamicBuffer_v2 buffers,
    CompletionCondition completion_condition, asio::error_code& ec,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    >,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    >)
{
  std::size_t bytes_transferred = write(s, buffers.data(0, buffers.size()),
      static_cast<CompletionCondition&&>(completion_condition), ec);
  buffers.consume(bytes_transferred);
  return bytes_transferred;
}

template <typename SyncWriteStream, typename DynamicBuffer_v2>
inline std::size_t write(SyncWriteStream& s, DynamicBuffer_v2 buffers,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    >)
{
  asio::error_code ec;
  std::size_t bytes_transferred = write(s,
      static_cast<DynamicBuffer_v2&&>(buffers),
      transfer_all(), ec);
  asio::detail::throw_error(ec, "write");
  return bytes_transferred;
}

template <typename SyncWriteStream, typename DynamicBuffer_v2>
inline std::size_t write(SyncWriteStream& s, DynamicBuffer_v2 buffers,
    asio::error_code& ec,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    >)
{
  return write(s, static_cast<DynamicBuffer_v2&&>(buffers),
      transfer_all(), ec);
}

template <typename SyncWriteStream, typename DynamicBuffer_v2,
    typename CompletionCondition>
inline std::size_t write(SyncWriteStream& s, DynamicBuffer_v2 buffers,
    CompletionCondition completion_condition,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    >,
    constraint_t<
      is_completion_condition<CompletionCondition>::value
    >)
{
  asio::error_code ec;
  std::size_t bytes_transferred = write(s,
      static_cast<DynamicBuffer_v2&&>(buffers),
      static_cast<CompletionCondition&&>(completion_condition), ec);
  asio::detail::throw_error(ec, "write");
  return bytes_transferred;
}

namespace detail
{
  template <typename AsyncWriteStream, typename ConstBufferSequence,
      typename ConstBufferIterator, typename CompletionCondition,
      typename WriteHandler>
  class write_op
    : public base_from_cancellation_state<WriteHandler>,
      base_from_completion_cond<CompletionCondition>
  {
  public:
    write_op(AsyncWriteStream& stream, const ConstBufferSequence& buffers,
        CompletionCondition& completion_condition, WriteHandler& handler)
      : base_from_cancellation_state<WriteHandler>(
          handler, enable_partial_cancellation()),
        base_from_completion_cond<CompletionCondition>(completion_condition),
        stream_(stream),
        buffers_(buffers),
        start_(0),
        handler_(static_cast<WriteHandler&&>(handler))
    {
    }

    write_op(const write_op& other)
      : base_from_cancellation_state<WriteHandler>(other),
        base_from_completion_cond<CompletionCondition>(other),
        stream_(other.stream_),
        buffers_(other.buffers_),
        start_(other.start_),
        handler_(other.handler_)
    {
    }

    write_op(write_op&& other)
      : base_from_cancellation_state<WriteHandler>(
          static_cast<base_from_cancellation_state<WriteHandler>&&>(other)),
        base_from_completion_cond<CompletionCondition>(
          static_cast<base_from_completion_cond<CompletionCondition>&&>(other)),
        stream_(other.stream_),
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
            ASIO_HANDLER_LOCATION((__FILE__, __LINE__, "async_write"));
            stream_.async_write_some(buffers_.prepare(max_size),
                static_cast<write_op&&>(*this));
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
            ec = error::operation_aborted;
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

    AsyncWriteStream& stream_;
    buffers_type buffers_;
    int start_;
    WriteHandler handler_;
  };

  template <typename AsyncWriteStream, typename ConstBufferSequence,
      typename ConstBufferIterator, typename CompletionCondition,
      typename WriteHandler>
  inline bool asio_handler_is_continuation(
      write_op<AsyncWriteStream, ConstBufferSequence, ConstBufferIterator,
        CompletionCondition, WriteHandler>* this_handler)
  {
    return this_handler->start_ == 0 ? true
      : asio_handler_cont_helpers::is_continuation(
          this_handler->handler_);
  }

  template <typename AsyncWriteStream, typename ConstBufferSequence,
      typename ConstBufferIterator, typename CompletionCondition,
      typename WriteHandler>
  inline void start_write_op(AsyncWriteStream& stream,
      const ConstBufferSequence& buffers, const ConstBufferIterator&,
      CompletionCondition& completion_condition, WriteHandler& handler)
  {
    detail::write_op<AsyncWriteStream, ConstBufferSequence,
      ConstBufferIterator, CompletionCondition, WriteHandler>(
        stream, buffers, completion_condition, handler)(
          asio::error_code(), 0, 1);
  }

  template <typename AsyncWriteStream>
  class initiate_async_write
  {
  public:
    typedef typename AsyncWriteStream::executor_type executor_type;

    explicit initiate_async_write(AsyncWriteStream& stream)
      : stream_(stream)
    {
    }

    executor_type get_executor() const noexcept
    {
      return stream_.get_executor();
    }

    template <typename WriteHandler, typename ConstBufferSequence,
        typename CompletionCondition>
    void operator()(WriteHandler&& handler,
        const ConstBufferSequence& buffers,
        CompletionCondition&& completion_cond) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a WriteHandler.
      ASIO_WRITE_HANDLER_CHECK(WriteHandler, handler) type_check;

      non_const_lvalue<WriteHandler> handler2(handler);
      non_const_lvalue<CompletionCondition> completion_cond2(completion_cond);
      start_write_op(stream_, buffers,
          asio::buffer_sequence_begin(buffers),
          completion_cond2.value, handler2.value);
    }

  private:
    AsyncWriteStream& stream_;
  };
} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename AsyncWriteStream, typename ConstBufferSequence,
    typename ConstBufferIterator, typename CompletionCondition,
    typename WriteHandler, typename DefaultCandidate>
struct associator<Associator,
    detail::write_op<AsyncWriteStream, ConstBufferSequence,
      ConstBufferIterator, CompletionCondition, WriteHandler>,
    DefaultCandidate>
  : Associator<WriteHandler, DefaultCandidate>
{
  static typename Associator<WriteHandler, DefaultCandidate>::type get(
      const detail::write_op<AsyncWriteStream, ConstBufferSequence,
        ConstBufferIterator, CompletionCondition, WriteHandler>& h) noexcept
  {
    return Associator<WriteHandler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(
      const detail::write_op<AsyncWriteStream, ConstBufferSequence,
        ConstBufferIterator, CompletionCondition, WriteHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<WriteHandler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<WriteHandler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

#if !defined(ASIO_NO_DYNAMIC_BUFFER_V1)

namespace detail
{
  template <typename AsyncWriteStream, typename DynamicBuffer_v1,
      typename CompletionCondition, typename WriteHandler>
  class write_dynbuf_v1_op
  {
  public:
    template <typename BufferSequence>
    write_dynbuf_v1_op(AsyncWriteStream& stream,
        BufferSequence&& buffers,
        CompletionCondition& completion_condition, WriteHandler& handler)
      : stream_(stream),
        buffers_(static_cast<BufferSequence&&>(buffers)),
        completion_condition_(
          static_cast<CompletionCondition&&>(completion_condition)),
        handler_(static_cast<WriteHandler&&>(handler))
    {
    }

    write_dynbuf_v1_op(const write_dynbuf_v1_op& other)
      : stream_(other.stream_),
        buffers_(other.buffers_),
        completion_condition_(other.completion_condition_),
        handler_(other.handler_)
    {
    }

    write_dynbuf_v1_op(write_dynbuf_v1_op&& other)
      : stream_(other.stream_),
        buffers_(static_cast<DynamicBuffer_v1&&>(other.buffers_)),
        completion_condition_(
          static_cast<CompletionCondition&&>(
            other.completion_condition_)),
        handler_(static_cast<WriteHandler&&>(other.handler_))
    {
    }

    void operator()(const asio::error_code& ec,
        std::size_t bytes_transferred, int start = 0)
    {
      switch (start)
      {
        case 1:
        async_write(stream_, buffers_.data(),
            static_cast<CompletionCondition&&>(completion_condition_),
            static_cast<write_dynbuf_v1_op&&>(*this));
        return; default:
        buffers_.consume(bytes_transferred);
        static_cast<WriteHandler&&>(handler_)(ec,
            static_cast<const std::size_t&>(bytes_transferred));
      }
    }

  //private:
    AsyncWriteStream& stream_;
    DynamicBuffer_v1 buffers_;
    CompletionCondition completion_condition_;
    WriteHandler handler_;
  };

  template <typename AsyncWriteStream, typename DynamicBuffer_v1,
      typename CompletionCondition, typename WriteHandler>
  inline bool asio_handler_is_continuation(
      write_dynbuf_v1_op<AsyncWriteStream, DynamicBuffer_v1,
        CompletionCondition, WriteHandler>* this_handler)
  {
    return asio_handler_cont_helpers::is_continuation(
        this_handler->handler_);
  }

  template <typename AsyncWriteStream>
  class initiate_async_write_dynbuf_v1
  {
  public:
    typedef typename AsyncWriteStream::executor_type executor_type;

    explicit initiate_async_write_dynbuf_v1(AsyncWriteStream& stream)
      : stream_(stream)
    {
    }

    executor_type get_executor() const noexcept
    {
      return stream_.get_executor();
    }

    template <typename WriteHandler, typename DynamicBuffer_v1,
        typename CompletionCondition>
    void operator()(WriteHandler&& handler,
        DynamicBuffer_v1&& buffers,
        CompletionCondition&& completion_cond) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a WriteHandler.
      ASIO_WRITE_HANDLER_CHECK(WriteHandler, handler) type_check;

      non_const_lvalue<WriteHandler> handler2(handler);
      non_const_lvalue<CompletionCondition> completion_cond2(completion_cond);
      write_dynbuf_v1_op<AsyncWriteStream,
        decay_t<DynamicBuffer_v1>,
          CompletionCondition, decay_t<WriteHandler>>(
            stream_, static_cast<DynamicBuffer_v1&&>(buffers),
              completion_cond2.value, handler2.value)(
                asio::error_code(), 0, 1);
    }

  private:
    AsyncWriteStream& stream_;
  };
} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename AsyncWriteStream, typename DynamicBuffer_v1,
    typename CompletionCondition, typename WriteHandler,
    typename DefaultCandidate>
struct associator<Associator,
    detail::write_dynbuf_v1_op<AsyncWriteStream,
      DynamicBuffer_v1, CompletionCondition, WriteHandler>,
    DefaultCandidate>
  : Associator<WriteHandler, DefaultCandidate>
{
  static typename Associator<WriteHandler, DefaultCandidate>::type get(
      const detail::write_dynbuf_v1_op<AsyncWriteStream, DynamicBuffer_v1,
        CompletionCondition, WriteHandler>& h) noexcept
  {
    return Associator<WriteHandler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(
      const detail::write_dynbuf_v1_op<AsyncWriteStream,
        DynamicBuffer_v1, CompletionCondition, WriteHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<WriteHandler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<WriteHandler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

#endif // !defined(ASIO_NO_DYNAMIC_BUFFER_V1)

namespace detail
{
  template <typename AsyncWriteStream, typename DynamicBuffer_v2,
      typename CompletionCondition, typename WriteHandler>
  class write_dynbuf_v2_op
  {
  public:
    template <typename BufferSequence>
    write_dynbuf_v2_op(AsyncWriteStream& stream,
        BufferSequence&& buffers,
        CompletionCondition& completion_condition, WriteHandler& handler)
      : stream_(stream),
        buffers_(static_cast<BufferSequence&&>(buffers)),
        completion_condition_(
          static_cast<CompletionCondition&&>(completion_condition)),
        handler_(static_cast<WriteHandler&&>(handler))
    {
    }

    write_dynbuf_v2_op(const write_dynbuf_v2_op& other)
      : stream_(other.stream_),
        buffers_(other.buffers_),
        completion_condition_(other.completion_condition_),
        handler_(other.handler_)
    {
    }

    write_dynbuf_v2_op(write_dynbuf_v2_op&& other)
      : stream_(other.stream_),
        buffers_(static_cast<DynamicBuffer_v2&&>(other.buffers_)),
        completion_condition_(
          static_cast<CompletionCondition&&>(
            other.completion_condition_)),
        handler_(static_cast<WriteHandler&&>(other.handler_))
    {
    }

    void operator()(const asio::error_code& ec,
        std::size_t bytes_transferred, int start = 0)
    {
      switch (start)
      {
        case 1:
        async_write(stream_, buffers_.data(0, buffers_.size()),
            static_cast<CompletionCondition&&>(completion_condition_),
            static_cast<write_dynbuf_v2_op&&>(*this));
        return; default:
        buffers_.consume(bytes_transferred);
        static_cast<WriteHandler&&>(handler_)(ec,
            static_cast<const std::size_t&>(bytes_transferred));
      }
    }

  //private:
    AsyncWriteStream& stream_;
    DynamicBuffer_v2 buffers_;
    CompletionCondition completion_condition_;
    WriteHandler handler_;
  };

  template <typename AsyncWriteStream, typename DynamicBuffer_v2,
      typename CompletionCondition, typename WriteHandler>
  inline bool asio_handler_is_continuation(
      write_dynbuf_v2_op<AsyncWriteStream, DynamicBuffer_v2,
        CompletionCondition, WriteHandler>* this_handler)
  {
    return asio_handler_cont_helpers::is_continuation(
        this_handler->handler_);
  }

  template <typename AsyncWriteStream>
  class initiate_async_write_dynbuf_v2
  {
  public:
    typedef typename AsyncWriteStream::executor_type executor_type;

    explicit initiate_async_write_dynbuf_v2(AsyncWriteStream& stream)
      : stream_(stream)
    {
    }

    executor_type get_executor() const noexcept
    {
      return stream_.get_executor();
    }

    template <typename WriteHandler, typename DynamicBuffer_v2,
        typename CompletionCondition>
    void operator()(WriteHandler&& handler,
        DynamicBuffer_v2&& buffers,
        CompletionCondition&& completion_cond) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a WriteHandler.
      ASIO_WRITE_HANDLER_CHECK(WriteHandler, handler) type_check;

      non_const_lvalue<WriteHandler> handler2(handler);
      non_const_lvalue<CompletionCondition> completion_cond2(completion_cond);
      write_dynbuf_v2_op<AsyncWriteStream, decay_t<DynamicBuffer_v2>,
        CompletionCondition, decay_t<WriteHandler>>(
          stream_, static_cast<DynamicBuffer_v2&&>(buffers),
            completion_cond2.value, handler2.value)(
              asio::error_code(), 0, 1);
    }

  private:
    AsyncWriteStream& stream_;
  };
} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename AsyncWriteStream, typename DynamicBuffer_v2,
    typename CompletionCondition, typename WriteHandler,
    typename DefaultCandidate>
struct associator<Associator,
    detail::write_dynbuf_v2_op<AsyncWriteStream,
      DynamicBuffer_v2, CompletionCondition, WriteHandler>,
    DefaultCandidate>
  : Associator<WriteHandler, DefaultCandidate>
{
  static typename Associator<WriteHandler, DefaultCandidate>::type get(
      const detail::write_dynbuf_v2_op<AsyncWriteStream, DynamicBuffer_v2,
        CompletionCondition, WriteHandler>& h) noexcept
  {
    return Associator<WriteHandler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(
      const detail::write_dynbuf_v2_op<AsyncWriteStream,
        DynamicBuffer_v2, CompletionCondition, WriteHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<WriteHandler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<WriteHandler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IMPL_WRITE_HPP
