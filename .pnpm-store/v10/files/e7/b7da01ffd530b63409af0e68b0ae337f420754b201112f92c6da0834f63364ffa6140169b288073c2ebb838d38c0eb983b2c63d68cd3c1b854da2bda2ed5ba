//
// composed.hpp
// ~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_COMPOSED_HPP
#define ASIO_COMPOSED_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/associated_executor.hpp"
#include "asio/async_result.hpp"
#include "asio/detail/base_from_cancellation_state.hpp"
#include "asio/detail/composed_work.hpp"
#include "asio/detail/handler_cont_helpers.hpp"
#include "asio/detail/type_traits.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

template <typename Impl, typename Work,
    typename Handler, typename... Signatures>
class composed_op;

template <typename Impl, typename Work, typename Handler>
class composed_op<Impl, Work, Handler>
  : public base_from_cancellation_state<Handler>
{
public:
  template <typename I, typename W, typename H>
  composed_op(I&& impl,
      W&& work,
      H&& handler)
    : base_from_cancellation_state<Handler>(
        handler, enable_terminal_cancellation()),
      impl_(static_cast<I&&>(impl)),
      work_(static_cast<W&&>(work)),
      handler_(static_cast<H&&>(handler)),
      invocations_(0)
  {
  }

  composed_op(composed_op&& other)
    : base_from_cancellation_state<Handler>(
        static_cast<base_from_cancellation_state<Handler>&&>(other)),
      impl_(static_cast<Impl&&>(other.impl_)),
      work_(static_cast<Work&&>(other.work_)),
      handler_(static_cast<Handler&&>(other.handler_)),
      invocations_(other.invocations_)
  {
  }

  typedef typename composed_work_guard<
    typename Work::head_type>::executor_type io_executor_type;

  io_executor_type get_io_executor() const noexcept
  {
    return work_.head_.get_executor();
  }

  typedef associated_executor_t<Handler, io_executor_type> executor_type;

  executor_type get_executor() const noexcept
  {
    return (get_associated_executor)(handler_, work_.head_.get_executor());
  }

  typedef associated_allocator_t<Handler, std::allocator<void>> allocator_type;

  allocator_type get_allocator() const noexcept
  {
    return (get_associated_allocator)(handler_, std::allocator<void>());
  }

  template <typename... T>
  void operator()(T&&... t)
  {
    if (invocations_ < ~0u)
      ++invocations_;
    this->get_cancellation_state().slot().clear();
    impl_(*this, static_cast<T&&>(t)...);
  }

  template <typename... Args>
  auto complete(Args&&... args)
    -> decltype(declval<Handler>()(static_cast<Args&&>(args)...))
  {
    return static_cast<Handler&&>(this->handler_)(static_cast<Args&&>(args)...);
  }

  void reset_cancellation_state()
  {
    base_from_cancellation_state<Handler>::reset_cancellation_state(handler_);
  }

  template <typename Filter>
  void reset_cancellation_state(Filter&& filter)
  {
    base_from_cancellation_state<Handler>::reset_cancellation_state(handler_,
        static_cast<Filter&&>(filter));
  }

  template <typename InFilter, typename OutFilter>
  void reset_cancellation_state(InFilter&& in_filter,
      OutFilter&& out_filter)
  {
    base_from_cancellation_state<Handler>::reset_cancellation_state(handler_,
        static_cast<InFilter&&>(in_filter),
        static_cast<OutFilter&&>(out_filter));
  }

  cancellation_type_t cancelled() const noexcept
  {
    return base_from_cancellation_state<Handler>::cancelled();
  }

//private:
  Impl impl_;
  Work work_;
  Handler handler_;
  unsigned invocations_;
};

template <typename Impl, typename Work, typename Handler,
    typename R, typename... Args>
class composed_op<Impl, Work, Handler, R(Args...)>
  : public composed_op<Impl, Work, Handler>
{
public:
  using composed_op<Impl, Work, Handler>::composed_op;

  template <typename... T>
  void operator()(T&&... t)
  {
    if (this->invocations_ < ~0u)
      ++this->invocations_;
    this->get_cancellation_state().slot().clear();
    this->impl_(*this, static_cast<T&&>(t)...);
  }

  void complete(Args... args)
  {
    this->work_.reset();
    static_cast<Handler&&>(this->handler_)(static_cast<Args&&>(args)...);
  }
};

template <typename Impl, typename Work, typename Handler,
    typename R, typename... Args, typename... Signatures>
class composed_op<Impl, Work, Handler, R(Args...), Signatures...>
  : public composed_op<Impl, Work, Handler, Signatures...>
{
public:
  using composed_op<Impl, Work, Handler, Signatures...>::composed_op;

  template <typename... T>
  void operator()(T&&... t)
  {
    if (this->invocations_ < ~0u)
      ++this->invocations_;
    this->get_cancellation_state().slot().clear();
    this->impl_(*this, static_cast<T&&>(t)...);
  }

  using composed_op<Impl, Work, Handler, Signatures...>::complete;

  void complete(Args... args)
  {
    this->work_.reset();
    static_cast<Handler&&>(this->handler_)(static_cast<Args&&>(args)...);
  }
};

template <typename Impl, typename Work, typename Handler, typename Signature>
inline bool asio_handler_is_continuation(
    composed_op<Impl, Work, Handler, Signature>* this_handler)
{
  return this_handler->invocations_ > 1 ? true
    : asio_handler_cont_helpers::is_continuation(
        this_handler->handler_);
}

template <typename Implementation, typename Executors, typename... Signatures>
class initiate_composed
{
public:
  typedef typename composed_io_executors<Executors>::head_type executor_type;

  template <typename I>
  initiate_composed(I&& impl, composed_io_executors<Executors>&& executors)
    : implementation_(std::forward<I>(impl)),
      executors_(std::move(executors))
  {
  }

  executor_type get_executor() const noexcept
  {
    return executors_.head_;
  }

  template <typename Handler, typename... Args>
  void operator()(Handler&& handler, Args&&... args) const &
  {
    composed_op<decay_t<Implementation>, composed_work<Executors>,
      decay_t<Handler>, Signatures...>(implementation_,
        composed_work<Executors>(executors_),
        static_cast<Handler&&>(handler))(static_cast<Args&&>(args)...);
  }

  template <typename Handler, typename... Args>
  void operator()(Handler&& handler, Args&&... args) &&
  {
    composed_op<decay_t<Implementation>, composed_work<Executors>,
      decay_t<Handler>, Signatures...>(
        static_cast<Implementation&&>(implementation_),
        composed_work<Executors>(executors_),
        static_cast<Handler&&>(handler))(static_cast<Args&&>(args)...);
  }

private:
  Implementation implementation_;
  composed_io_executors<Executors> executors_;
};

template <typename Implementation, typename... Signatures>
class initiate_composed<Implementation, void(), Signatures...>
{
public:
  template <typename I>
  initiate_composed(I&& impl, composed_io_executors<void()>&&)
    : implementation_(std::forward<I>(impl))
  {
  }

  template <typename Handler, typename... Args>
  void operator()(Handler&& handler, Args&&... args) const &
  {
    composed_op<decay_t<Implementation>, composed_work<void()>,
      decay_t<Handler>, Signatures...>(implementation_,
        composed_work<void()>(composed_io_executors<void()>()),
        static_cast<Handler&&>(handler))(static_cast<Args&&>(args)...);
  }

  template <typename Handler, typename... Args>
  void operator()(Handler&& handler, Args&&... args) &&
  {
    composed_op<decay_t<Implementation>, composed_work<void()>,
      decay_t<Handler>, Signatures...>(
        static_cast<Implementation&&>(implementation_),
        composed_work<void()>(composed_io_executors<void()>()),
        static_cast<Handler&&>(handler))(static_cast<Args&&>(args)...);
  }

private:
  Implementation implementation_;
};

template <typename... Signatures, typename Implementation, typename Executors>
inline initiate_composed<Implementation, Executors, Signatures...>
make_initiate_composed(Implementation&& implementation,
    composed_io_executors<Executors>&& executors)
{
  return initiate_composed<decay_t<Implementation>, Executors, Signatures...>(
      static_cast<Implementation&&>(implementation),
      static_cast<composed_io_executors<Executors>&&>(executors));
}

} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename Impl, typename Work, typename Handler,
    typename Signature, typename DefaultCandidate>
struct associator<Associator,
    detail::composed_op<Impl, Work, Handler, Signature>,
    DefaultCandidate>
  : Associator<Handler, DefaultCandidate>
{
  static typename Associator<Handler, DefaultCandidate>::type get(
      const detail::composed_op<Impl, Work, Handler, Signature>& h) noexcept
  {
    return Associator<Handler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(const detail::composed_op<Impl, Work, Handler, Signature>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<Handler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<Handler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

/// Creates an initiation function object that may be used to launch an
/// asynchronous operation with a stateful implementation.
/**
 * The @c composed function simplifies the implementation of composed
 * asynchronous operations automatically by wrapping a stateful function object
 * for use as an initiation function object.
 *
 * @param implementation A function object that contains the implementation of
 * the composed asynchronous operation. The first argument to the function
 * object is a non-const reference to the enclosing intermediate completion
 * handler. The remaining arguments are any arguments that originate from the
 * completion handlers of any asynchronous operations performed by the
 * implementation.
 *
 * @param io_objects_or_executors Zero or more I/O objects or I/O executors for
 * which outstanding work must be maintained.
 *
 * @par Per-Operation Cancellation
 * By default, terminal per-operation cancellation is enabled for composed
 * operations that are implemented using @c composed. To disable cancellation
 * for the composed operation, or to alter its supported cancellation types,
 * call the @c self object's @c reset_cancellation_state function.
 *
 * @par Example:
 *
 * @code struct async_echo_implementation
 * {
 *   tcp::socket& socket_;
 *   asio::mutable_buffer buffer_;
 *   enum { starting, reading, writing } state_;
 *
 *   template <typename Self>
 *   void operator()(Self& self,
 *       asio::error_code error,
 *       std::size_t n)
 *   {
 *     switch (state_)
 *     {
 *     case starting:
 *       state_ = reading;
 *       socket_.async_read_some(
 *           buffer_, std::move(self));
 *       break;
 *     case reading:
 *       if (error)
 *       {
 *         self.complete(error, 0);
 *       }
 *       else
 *       {
 *         state_ = writing;
 *         asio::async_write(socket_, buffer_,
 *             asio::transfer_exactly(n),
 *             std::move(self));
 *       }
 *       break;
 *     case writing:
 *       self.complete(error, n);
 *       break;
 *     }
 *   }
 * };
 *
 * template <typename CompletionToken>
 * auto async_echo(tcp::socket& socket,
 *     asio::mutable_buffer buffer,
 *     CompletionToken&& token)
 *   -> decltype(
 *     asio::async_initiate<CompletionToken,
 *       void(asio::error_code, std::size_t)>(
 *         asio::composed(
 *           async_echo_implementation{socket, buffer,
 *             async_echo_implementation::starting}, socket),
 *         token))
 * {
 *   return asio::async_initiate<CompletionToken,
 *     void(asio::error_code, std::size_t)>(
 *       asio::composed(
 *         async_echo_implementation{socket, buffer,
 *           async_echo_implementation::starting}, socket),
 *       token, asio::error_code{}, 0);
 * } @endcode
 */
template <ASIO_COMPLETION_SIGNATURE... Signatures,
    typename Implementation, typename... IoObjectsOrExecutors>
inline auto composed(Implementation&& implementation,
    IoObjectsOrExecutors&&... io_objects_or_executors)
  -> decltype(
    detail::make_initiate_composed<Signatures...>(
      static_cast<Implementation&&>(implementation),
      detail::make_composed_io_executors(
        detail::get_composed_io_executor(
          static_cast<IoObjectsOrExecutors&&>(
            io_objects_or_executors))...)))
{
  return detail::make_initiate_composed<Signatures...>(
      static_cast<Implementation&&>(implementation),
      detail::make_composed_io_executors(
        detail::get_composed_io_executor(
          static_cast<IoObjectsOrExecutors&&>(
            io_objects_or_executors))...));
}

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_COMPOSE_HPP
