//
// experimental/detail/channel_service.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXPERIMENTAL_DETAIL_CHANNEL_SERVICE_HPP
#define ASIO_EXPERIMENTAL_DETAIL_CHANNEL_SERVICE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/associated_cancellation_slot.hpp"
#include "asio/cancellation_type.hpp"
#include "asio/detail/completion_message.hpp"
#include "asio/detail/completion_payload.hpp"
#include "asio/detail/completion_payload_handler.hpp"
#include "asio/detail/mutex.hpp"
#include "asio/detail/op_queue.hpp"
#include "asio/execution_context.hpp"
#include "asio/experimental/detail/channel_receive_op.hpp"
#include "asio/experimental/detail/channel_send_op.hpp"
#include "asio/experimental/detail/has_signature.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace experimental {
namespace detail {

template <typename Mutex>
class channel_service
  : public asio::detail::execution_context_service_base<
      channel_service<Mutex>>
{
public:
  // Possible states for a channel end.
  enum state
  {
    buffer = 0,
    waiter = 1,
    block = 2,
    closed = 3
  };

  // The base implementation type of all channels.
  struct base_implementation_type
  {
    // Default constructor.
    base_implementation_type()
      : receive_state_(block),
        send_state_(block),
        max_buffer_size_(0),
        next_(0),
        prev_(0)
    {
    }

    // The current state of the channel.
    state receive_state_ : 16;
    state send_state_ : 16;

    // The maximum number of elements that may be buffered in the channel.
    std::size_t max_buffer_size_;

    // The operations that are waiting on the channel.
    asio::detail::op_queue<channel_operation> waiters_;

    // Pointers to adjacent channel implementations in linked list.
    base_implementation_type* next_;
    base_implementation_type* prev_;

    // The mutex type to protect the internal implementation.
    mutable Mutex mutex_;
  };

  // The implementation for a specific value type.
  template <typename Traits, typename... Signatures>
  struct implementation_type;

  // Constructor.
  channel_service(asio::execution_context& ctx);

  // Destroy all user-defined handler objects owned by the service.
  void shutdown();

  // Construct a new channel implementation.
  void construct(base_implementation_type& impl, std::size_t max_buffer_size);

  // Destroy a channel implementation.
  template <typename Traits, typename... Signatures>
  void destroy(implementation_type<Traits, Signatures...>& impl);

  // Move-construct a new channel implementation.
  template <typename Traits, typename... Signatures>
  void move_construct(implementation_type<Traits, Signatures...>& impl,
      implementation_type<Traits, Signatures...>& other_impl);

  // Move-assign from another channel implementation.
  template <typename Traits, typename... Signatures>
  void move_assign(implementation_type<Traits, Signatures...>& impl,
      channel_service& other_service,
      implementation_type<Traits, Signatures...>& other_impl);

  // Get the capacity of the channel.
  std::size_t capacity(
      const base_implementation_type& impl) const noexcept;

  // Determine whether the channel is open.
  bool is_open(const base_implementation_type& impl) const noexcept;

  // Reset the channel to its initial state.
  template <typename Traits, typename... Signatures>
  void reset(implementation_type<Traits, Signatures...>& impl);

  // Close the channel.
  template <typename Traits, typename... Signatures>
  void close(implementation_type<Traits, Signatures...>& impl);

  // Cancel all operations associated with the channel.
  template <typename Traits, typename... Signatures>
  void cancel(implementation_type<Traits, Signatures...>& impl);

  // Cancel the operation associated with the channel that has the given key.
  template <typename Traits, typename... Signatures>
  void cancel_by_key(implementation_type<Traits, Signatures...>& impl,
      void* cancellation_key);

  // Determine whether a value can be read from the channel without blocking.
  bool ready(const base_implementation_type& impl) const noexcept;

  // Synchronously send a new value into the channel.
  template <typename Message, typename Traits,
      typename... Signatures, typename... Args>
  bool try_send(implementation_type<Traits, Signatures...>& impl,
      bool via_dispatch, Args&&... args);

  // Synchronously send a number of new values into the channel.
  template <typename Message, typename Traits,
      typename... Signatures, typename... Args>
  std::size_t try_send_n(implementation_type<Traits, Signatures...>& impl,
      std::size_t count, bool via_dispatch, Args&&... args);

  // Asynchronously send a new value into the channel.
  template <typename Traits, typename... Signatures,
      typename Handler, typename IoExecutor>
  void async_send(implementation_type<Traits, Signatures...>& impl,
      typename implementation_type<Traits,
        Signatures...>::payload_type&& payload,
      Handler& handler, const IoExecutor& io_ex)
  {
    associated_cancellation_slot_t<Handler> slot
      = asio::get_associated_cancellation_slot(handler);

    // Allocate and construct an operation to wrap the handler.
    typedef channel_send_op<
      typename implementation_type<Traits, Signatures...>::payload_type,
        Handler, IoExecutor> op;
    typename op::ptr p = { asio::detail::addressof(handler),
      op::ptr::allocate(handler), 0 };
    p.p = new (p.v) op(static_cast<typename implementation_type<
          Traits, Signatures...>::payload_type&&>(payload), handler, io_ex);

    // Optionally register for per-operation cancellation.
    if (slot.is_connected())
    {
      p.p->cancellation_key_ =
        &slot.template emplace<op_cancellation<Traits, Signatures...>>(
            this, &impl);
    }

    ASIO_HANDLER_CREATION((this->context(), *p.p,
          "channel", &impl, 0, "async_send"));

    start_send_op(impl, p.p);
    p.v = p.p = 0;
  }

  // Synchronously receive a value from the channel.
  template <typename Traits, typename... Signatures, typename Handler>
  bool try_receive(implementation_type<Traits, Signatures...>& impl,
      Handler&& handler);

  // Asynchronously receive a value from the channel.
  template <typename Traits, typename... Signatures,
      typename Handler, typename IoExecutor>
  void async_receive(implementation_type<Traits, Signatures...>& impl,
      Handler& handler, const IoExecutor& io_ex)
  {
    associated_cancellation_slot_t<Handler> slot
      = asio::get_associated_cancellation_slot(handler);

    // Allocate and construct an operation to wrap the handler.
    typedef channel_receive_op<
      typename implementation_type<Traits, Signatures...>::payload_type,
        Handler, IoExecutor> op;
    typename op::ptr p = { asio::detail::addressof(handler),
      op::ptr::allocate(handler), 0 };
    p.p = new (p.v) op(handler, io_ex);

    // Optionally register for per-operation cancellation.
    if (slot.is_connected())
    {
      p.p->cancellation_key_ =
        &slot.template emplace<op_cancellation<Traits, Signatures...>>(
            this, &impl);
    }

    ASIO_HANDLER_CREATION((this->context(), *p.p,
          "channel", &impl, 0, "async_receive"));

    start_receive_op(impl, p.p);
    p.v = p.p = 0;
  }

private:
  // Helper function object to handle a closed notification.
  template <typename Payload, typename Signature>
  struct post_receive
  {
    explicit post_receive(channel_receive<Payload>* op)
      : op_(op)
    {
    }

    template <typename... Args>
    void operator()(Args&&... args)
    {
      op_->post(
          asio::detail::completion_message<Signature>(0,
            static_cast<Args&&>(args)...));
    }

    channel_receive<Payload>* op_;
  };

  // Destroy a base channel implementation.
  void base_destroy(base_implementation_type& impl);

  // Helper function to start an asynchronous put operation.
  template <typename Traits, typename... Signatures>
  void start_send_op(implementation_type<Traits, Signatures...>& impl,
      channel_send<typename implementation_type<
        Traits, Signatures...>::payload_type>* send_op);

  // Helper function to start an asynchronous get operation.
  template <typename Traits, typename... Signatures>
  void start_receive_op(implementation_type<Traits, Signatures...>& impl,
      channel_receive<typename implementation_type<
        Traits, Signatures...>::payload_type>* receive_op);

  // Helper class used to implement per-operation cancellation.
  template <typename Traits, typename... Signatures>
  class op_cancellation
  {
  public:
    op_cancellation(channel_service* s,
        implementation_type<Traits, Signatures...>* impl)
      : service_(s),
        impl_(impl)
    {
    }

    void operator()(cancellation_type_t type)
    {
      if (!!(type &
            (cancellation_type::terminal
              | cancellation_type::partial
              | cancellation_type::total)))
      {
        service_->cancel_by_key(*impl_, this);
      }
    }

  private:
    channel_service* service_;
    implementation_type<Traits, Signatures...>* impl_;
  };

  // Mutex to protect access to the linked list of implementations.
  asio::detail::mutex mutex_;

  // The head of a linked list of all implementations.
  base_implementation_type* impl_list_;
};

// The implementation for a specific value type.
template <typename Mutex>
template <typename Traits, typename... Signatures>
struct channel_service<Mutex>::implementation_type : base_implementation_type
{
  // The traits type associated with the channel.
  typedef typename Traits::template rebind<Signatures...>::other traits_type;

  // Type of an element stored in the buffer.
  typedef conditional_t<
      has_signature<
        typename traits_type::receive_cancelled_signature,
        Signatures...
      >::value,
      conditional_t<
        has_signature<
          typename traits_type::receive_closed_signature,
          Signatures...
        >::value,
        asio::detail::completion_payload<Signatures...>,
        asio::detail::completion_payload<
          Signatures...,
          typename traits_type::receive_closed_signature
        >
      >,
      conditional_t<
        has_signature<
          typename traits_type::receive_closed_signature,
          Signatures...,
          typename traits_type::receive_cancelled_signature
        >::value,
        asio::detail::completion_payload<
          Signatures...,
          typename traits_type::receive_cancelled_signature
        >,
        asio::detail::completion_payload<
          Signatures...,
          typename traits_type::receive_cancelled_signature,
          typename traits_type::receive_closed_signature
        >
      >
    > payload_type;

  // Move from another buffer.
  void buffer_move_from(implementation_type& other)
  {
    buffer_ = static_cast<
        typename traits_type::template container<payload_type>::type&&>(
          other.buffer_);
    other.buffer_clear();
  }

  // Get number of buffered elements.
  std::size_t buffer_size() const
  {
    return buffer_.size();
  }

  // Push a new value to the back of the buffer.
  void buffer_push(payload_type payload)
  {
    buffer_.push_back(static_cast<payload_type&&>(payload));
  }

  // Push new values to the back of the buffer.
  std::size_t buffer_push_n(std::size_t count, payload_type payload)
  {
    std::size_t i = 0;
    for (; i < count && buffer_.size() < this->max_buffer_size_; ++i)
      buffer_.push_back(payload);
    return i;
  }

  // Get the element at the front of the buffer.
  payload_type buffer_front()
  {
    return static_cast<payload_type&&>(buffer_.front());
  }

  // Pop a value from the front of the buffer.
  void buffer_pop()
  {
    buffer_.pop_front();
  }

  // Clear all buffered values.
  void buffer_clear()
  {
    buffer_.clear();
  }

private:
  // Buffered values.
  typename traits_type::template container<payload_type>::type buffer_;
};

// The implementation for a void value type.
template <typename Mutex>
template <typename Traits, typename R>
struct channel_service<Mutex>::implementation_type<Traits, R()>
  : channel_service::base_implementation_type
{
  // The traits type associated with the channel.
  typedef typename Traits::template rebind<R()>::other traits_type;

  // Type of an element stored in the buffer.
  typedef conditional_t<
      has_signature<
        typename traits_type::receive_cancelled_signature,
        R()
      >::value,
      conditional_t<
        has_signature<
          typename traits_type::receive_closed_signature,
          R()
        >::value,
        asio::detail::completion_payload<R()>,
        asio::detail::completion_payload<
          R(),
          typename traits_type::receive_closed_signature
        >
      >,
      conditional_t<
        has_signature<
          typename traits_type::receive_closed_signature,
          R(),
          typename traits_type::receive_cancelled_signature
        >::value,
        asio::detail::completion_payload<
          R(),
          typename traits_type::receive_cancelled_signature
        >,
        asio::detail::completion_payload<
          R(),
          typename traits_type::receive_cancelled_signature,
          typename traits_type::receive_closed_signature
        >
      >
    > payload_type;

  // Construct with empty buffer.
  implementation_type()
    : buffer_(0)
  {
  }

  // Move from another buffer.
  void buffer_move_from(implementation_type& other)
  {
    buffer_ = other.buffer_;
    other.buffer_ = 0;
  }

  // Get number of buffered elements.
  std::size_t buffer_size() const
  {
    return buffer_;
  }

  // Push a new value to the back of the buffer.
  void buffer_push(payload_type)
  {
    ++buffer_;
  }

  // Push new values to the back of the buffer.
  std::size_t buffer_push_n(std::size_t count, payload_type)
  {
    std::size_t available = this->max_buffer_size_ - buffer_;
    count = (count < available) ? count : available;
    buffer_ += count;
    return count;
  }

  // Get the element at the front of the buffer.
  payload_type buffer_front()
  {
    return payload_type(asio::detail::completion_message<R()>(0));
  }

  // Pop a value from the front of the buffer.
  void buffer_pop()
  {
    --buffer_;
  }

  // Clear all values from the buffer.
  void buffer_clear()
  {
    buffer_ = 0;
  }

private:
  // Number of buffered "values".
  std::size_t buffer_;
};

// The implementation for an error_code signature.
template <typename Mutex>
template <typename Traits, typename R>
struct channel_service<Mutex>::implementation_type<
    Traits, R(asio::error_code)>
  : channel_service::base_implementation_type
{
  // The traits type associated with the channel.
  typedef typename Traits::template rebind<R(asio::error_code)>::other
    traits_type;

  // Type of an element stored in the buffer.
  typedef conditional_t<
      has_signature<
        typename traits_type::receive_cancelled_signature,
        R(asio::error_code)
      >::value,
      conditional_t<
        has_signature<
          typename traits_type::receive_closed_signature,
          R(asio::error_code)
        >::value,
        asio::detail::completion_payload<R(asio::error_code)>,
        asio::detail::completion_payload<
          R(asio::error_code),
          typename traits_type::receive_closed_signature
        >
      >,
      conditional_t<
        has_signature<
          typename traits_type::receive_closed_signature,
          R(asio::error_code),
          typename traits_type::receive_cancelled_signature
        >::value,
        asio::detail::completion_payload<
          R(asio::error_code),
          typename traits_type::receive_cancelled_signature
        >,
        asio::detail::completion_payload<
          R(asio::error_code),
          typename traits_type::receive_cancelled_signature,
          typename traits_type::receive_closed_signature
        >
      >
    > payload_type;

  // Construct with empty buffer.
  implementation_type()
    : size_(0)
  {
    first_.count_ = 0;
  }

  // Move from another buffer.
  void buffer_move_from(implementation_type& other)
  {
    size_ = other.buffer_;
    other.size_ = 0;
    first_ = other.first_;
    other.first.count_ = 0;
    rest_ = static_cast<
        typename traits_type::template container<buffered_value>::type&&>(
          other.rest_);
    other.buffer_clear();
  }

  // Get number of buffered elements.
  std::size_t buffer_size() const
  {
    return size_;
  }

  // Push a new value to the back of the buffer.
  void buffer_push(payload_type payload)
  {
    buffered_value& last = rest_.empty() ? first_ : rest_.back();
    if (last.count_ == 0)
    {
      value_handler handler{last.value_};
      payload.receive(handler);
      last.count_ = 1;
    }
    else
    {
      asio::error_code value{last.value_};
      value_handler handler{value};
      payload.receive(handler);
      if (last.value_ == value)
        ++last.count_;
      else
        rest_.push_back({value, 1});
    }
    ++size_;
  }

  // Push new values to the back of the buffer.
  std::size_t buffer_push_n(std::size_t count, payload_type payload)
  {
    std::size_t available = this->max_buffer_size_ - size_;
    count = (count < available) ? count : available;
    if (count > 0)
    {
      buffered_value& last = rest_.empty() ? first_ : rest_.back();
      if (last.count_ == 0)
      {
        payload.receive(value_handler{last.value_});
        last.count_ = count;
      }
      else
      {
        asio::error_code value{last.value_};
        payload.receive(value_handler{value});
        if (last.value_ == value)
          last.count_ += count;
        else
          rest_.push_back({value, count});
      }
      size_ += count;
    }
    return count;
  }

  // Get the element at the front of the buffer.
  payload_type buffer_front()
  {
    return payload_type({0, first_.value_});
  }

  // Pop a value from the front of the buffer.
  void buffer_pop()
  {
    --size_;
    if (--first_.count_ == 0 && !rest_.empty())
    {
      first_ = rest_.front();
      rest_.pop_front();
    }
  }

  // Clear all values from the buffer.
  void buffer_clear()
  {
    size_ = 0;
    first_.count_ == 0;
    rest_.clear();
  }

private:
  struct buffered_value
  {
    asio::error_code value_;
    std::size_t count_;
  };

  struct value_handler
  {
    asio::error_code& target_;

    template <typename... Args>
    void operator()(const asio::error_code& value, Args&&...)
    {
      target_ = value;
    }
  };

  buffered_value& last_value()
  {
    return rest_.empty() ? first_ : rest_.back();
  }

  // Total number of buffered values.
  std::size_t size_;

  // The first buffered value is maintained as a separate data member to avoid
  // allocating space in the container in the common case.
  buffered_value first_;

  // The rest of the buffered values.
  typename traits_type::template container<buffered_value>::type rest_;
};

} // namespace detail
} // namespace experimental
} // namespace asio

#include "asio/detail/pop_options.hpp"

#include "asio/experimental/detail/impl/channel_service.hpp"

#endif // ASIO_EXPERIMENTAL_DETAIL_CHANNEL_SERVICE_HPP
