//
// impl/buffered_write_stream.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_BUFFERED_WRITE_STREAM_HPP
#define ASIO_IMPL_BUFFERED_WRITE_STREAM_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/associator.hpp"
#include "asio/detail/handler_cont_helpers.hpp"
#include "asio/detail/handler_type_requirements.hpp"
#include "asio/detail/non_const_lvalue.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

template <typename Stream>
std::size_t buffered_write_stream<Stream>::flush()
{
  std::size_t bytes_written = write(next_layer_,
      buffer(storage_.data(), storage_.size()));
  storage_.consume(bytes_written);
  return bytes_written;
}

template <typename Stream>
std::size_t buffered_write_stream<Stream>::flush(asio::error_code& ec)
{
  std::size_t bytes_written = write(next_layer_,
      buffer(storage_.data(), storage_.size()),
      transfer_all(), ec);
  storage_.consume(bytes_written);
  return bytes_written;
}

namespace detail
{
  template <typename WriteHandler>
  class buffered_flush_handler
  {
  public:
    buffered_flush_handler(detail::buffered_stream_storage& storage,
        WriteHandler& handler)
      : storage_(storage),
        handler_(static_cast<WriteHandler&&>(handler))
    {
    }

    buffered_flush_handler(const buffered_flush_handler& other)
      : storage_(other.storage_),
        handler_(other.handler_)
    {
    }

    buffered_flush_handler(buffered_flush_handler&& other)
      : storage_(other.storage_),
        handler_(static_cast<WriteHandler&&>(other.handler_))
    {
    }

    void operator()(const asio::error_code& ec,
        const std::size_t bytes_written)
    {
      storage_.consume(bytes_written);
      static_cast<WriteHandler&&>(handler_)(ec, bytes_written);
    }

  //private:
    detail::buffered_stream_storage& storage_;
    WriteHandler handler_;
  };

  template <typename WriteHandler>
  inline bool asio_handler_is_continuation(
      buffered_flush_handler<WriteHandler>* this_handler)
  {
    return asio_handler_cont_helpers::is_continuation(
          this_handler->handler_);
  }

  template <typename Stream>
  class initiate_async_buffered_flush
  {
  public:
    typedef typename remove_reference_t<
      Stream>::lowest_layer_type::executor_type executor_type;

    explicit initiate_async_buffered_flush(
        remove_reference_t<Stream>& next_layer)
      : next_layer_(next_layer)
    {
    }

    executor_type get_executor() const noexcept
    {
      return next_layer_.lowest_layer().get_executor();
    }

    template <typename WriteHandler>
    void operator()(WriteHandler&& handler,
        buffered_stream_storage* storage) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a WriteHandler.
      ASIO_WRITE_HANDLER_CHECK(WriteHandler, handler) type_check;

      non_const_lvalue<WriteHandler> handler2(handler);
      async_write(next_layer_, buffer(storage->data(), storage->size()),
          buffered_flush_handler<decay_t<WriteHandler>>(
            *storage, handler2.value));
    }

  private:
    remove_reference_t<Stream>& next_layer_;
  };
} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename WriteHandler, typename DefaultCandidate>
struct associator<Associator,
    detail::buffered_flush_handler<WriteHandler>,
    DefaultCandidate>
  : Associator<WriteHandler, DefaultCandidate>
{
  static typename Associator<WriteHandler, DefaultCandidate>::type get(
      const detail::buffered_flush_handler<WriteHandler>& h) noexcept
  {
    return Associator<WriteHandler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(const detail::buffered_flush_handler<WriteHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<WriteHandler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<WriteHandler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

template <typename Stream>
template <
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      std::size_t)) WriteHandler>
inline auto buffered_write_stream<Stream>::async_flush(WriteHandler&& handler)
  -> decltype(
    async_initiate<WriteHandler,
      void (asio::error_code, std::size_t)>(
        declval<detail::initiate_async_buffered_flush<Stream>>(),
        handler, declval<detail::buffered_stream_storage*>()))
{
  return async_initiate<WriteHandler,
    void (asio::error_code, std::size_t)>(
      detail::initiate_async_buffered_flush<Stream>(next_layer_),
      handler, &storage_);
}

template <typename Stream>
template <typename ConstBufferSequence>
std::size_t buffered_write_stream<Stream>::write_some(
    const ConstBufferSequence& buffers)
{
  using asio::buffer_size;
  if (buffer_size(buffers) == 0)
    return 0;

  if (storage_.size() == storage_.capacity())
    this->flush();

  return this->copy(buffers);
}

template <typename Stream>
template <typename ConstBufferSequence>
std::size_t buffered_write_stream<Stream>::write_some(
    const ConstBufferSequence& buffers, asio::error_code& ec)
{
  ec = asio::error_code();

  using asio::buffer_size;
  if (buffer_size(buffers) == 0)
    return 0;

  if (storage_.size() == storage_.capacity() && !flush(ec))
    return 0;

  return this->copy(buffers);
}

namespace detail
{
  template <typename ConstBufferSequence, typename WriteHandler>
  class buffered_write_some_handler
  {
  public:
    buffered_write_some_handler(detail::buffered_stream_storage& storage,
        const ConstBufferSequence& buffers, WriteHandler& handler)
      : storage_(storage),
        buffers_(buffers),
        handler_(static_cast<WriteHandler&&>(handler))
    {
    }

    buffered_write_some_handler(const buffered_write_some_handler& other)
      : storage_(other.storage_),
        buffers_(other.buffers_),
        handler_(other.handler_)
    {
    }

    buffered_write_some_handler(buffered_write_some_handler&& other)
      : storage_(other.storage_),
        buffers_(other.buffers_),
        handler_(static_cast<WriteHandler&&>(other.handler_))
    {
    }

    void operator()(const asio::error_code& ec, std::size_t)
    {
      if (ec)
      {
        const std::size_t length = 0;
        static_cast<WriteHandler&&>(handler_)(ec, length);
      }
      else
      {
        using asio::buffer_size;
        std::size_t orig_size = storage_.size();
        std::size_t space_avail = storage_.capacity() - orig_size;
        std::size_t bytes_avail = buffer_size(buffers_);
        std::size_t length = bytes_avail < space_avail
          ? bytes_avail : space_avail;
        storage_.resize(orig_size + length);
        const std::size_t bytes_copied = asio::buffer_copy(
            storage_.data() + orig_size, buffers_, length);
        static_cast<WriteHandler&&>(handler_)(ec, bytes_copied);
      }
    }

  //private:
    detail::buffered_stream_storage& storage_;
    ConstBufferSequence buffers_;
    WriteHandler handler_;
  };

  template <typename ConstBufferSequence, typename WriteHandler>
  inline bool asio_handler_is_continuation(
      buffered_write_some_handler<
        ConstBufferSequence, WriteHandler>* this_handler)
  {
    return asio_handler_cont_helpers::is_continuation(
          this_handler->handler_);
  }

  template <typename Stream>
  class initiate_async_buffered_write_some
  {
  public:
    typedef typename remove_reference_t<
      Stream>::lowest_layer_type::executor_type executor_type;

    explicit initiate_async_buffered_write_some(
        remove_reference_t<Stream>& next_layer)
      : next_layer_(next_layer)
    {
    }

    executor_type get_executor() const noexcept
    {
      return next_layer_.lowest_layer().get_executor();
    }

    template <typename WriteHandler, typename ConstBufferSequence>
    void operator()(WriteHandler&& handler,
        buffered_stream_storage* storage,
        const ConstBufferSequence& buffers) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a WriteHandler.
      ASIO_WRITE_HANDLER_CHECK(WriteHandler, handler) type_check;

      using asio::buffer_size;
      non_const_lvalue<WriteHandler> handler2(handler);
      if (buffer_size(buffers) == 0 || storage->size() < storage->capacity())
      {
        next_layer_.async_write_some(const_buffer(0, 0),
            buffered_write_some_handler<ConstBufferSequence,
              decay_t<WriteHandler>>(
                *storage, buffers, handler2.value));
      }
      else
      {
        initiate_async_buffered_flush<Stream>(this->next_layer_)(
            buffered_write_some_handler<ConstBufferSequence,
              decay_t<WriteHandler>>(
                *storage, buffers, handler2.value),
            storage);
      }
    }

  private:
    remove_reference_t<Stream>& next_layer_;
  };
} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename ConstBufferSequence, typename WriteHandler,
    typename DefaultCandidate>
struct associator<Associator,
    detail::buffered_write_some_handler<ConstBufferSequence, WriteHandler>,
    DefaultCandidate>
  : Associator<WriteHandler, DefaultCandidate>
{
  static typename Associator<WriteHandler, DefaultCandidate>::type get(
      const detail::buffered_write_some_handler<
        ConstBufferSequence, WriteHandler>& h) noexcept
  {
    return Associator<WriteHandler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(
      const detail::buffered_write_some_handler<
        ConstBufferSequence, WriteHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<WriteHandler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<WriteHandler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

template <typename Stream>
template <typename ConstBufferSequence,
    ASIO_COMPLETION_TOKEN_FOR(void (asio::error_code,
      std::size_t)) WriteHandler>
inline auto buffered_write_stream<Stream>::async_write_some(
    const ConstBufferSequence& buffers, WriteHandler&& handler)
  -> decltype(
    async_initiate<WriteHandler,
      void (asio::error_code, std::size_t)>(
        declval<detail::initiate_async_buffered_write_some<Stream>>(),
        handler, declval<detail::buffered_stream_storage*>(), buffers))
{
  return async_initiate<WriteHandler,
    void (asio::error_code, std::size_t)>(
      detail::initiate_async_buffered_write_some<Stream>(next_layer_),
      handler, &storage_, buffers);
}

template <typename Stream>
template <typename ConstBufferSequence>
std::size_t buffered_write_stream<Stream>::copy(
    const ConstBufferSequence& buffers)
{
  using asio::buffer_size;
  std::size_t orig_size = storage_.size();
  std::size_t space_avail = storage_.capacity() - orig_size;
  std::size_t bytes_avail = buffer_size(buffers);
  std::size_t length = bytes_avail < space_avail ? bytes_avail : space_avail;
  storage_.resize(orig_size + length);
  return asio::buffer_copy(
      storage_.data() + orig_size, buffers, length);
}

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IMPL_BUFFERED_WRITE_STREAM_HPP
