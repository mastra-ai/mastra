//
// cancellation_signal.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_CANCELLATION_SIGNAL_HPP
#define ASIO_CANCELLATION_SIGNAL_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <cassert>
#include <new>
#include <utility>
#include "asio/cancellation_type.hpp"
#include "asio/detail/cstddef.hpp"
#include "asio/detail/type_traits.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

class cancellation_handler_base
{
public:
  virtual void call(cancellation_type_t) = 0;
  virtual std::pair<void*, std::size_t> destroy() noexcept = 0;

protected:
  ~cancellation_handler_base() {}
};

template <typename Handler>
class cancellation_handler
  : public cancellation_handler_base
{
public:
  template <typename... Args>
  cancellation_handler(std::size_t size, Args&&... args)
    : handler_(static_cast<Args&&>(args)...),
      size_(size)
  {
  }

  void call(cancellation_type_t type)
  {
    handler_(type);
  }

  std::pair<void*, std::size_t> destroy() noexcept
  {
    std::pair<void*, std::size_t> mem(this, size_);
    this->cancellation_handler::~cancellation_handler();
    return mem;
  }

  Handler& handler() noexcept
  {
    return handler_;
  }

private:
  ~cancellation_handler()
  {
  }

  Handler handler_;
  std::size_t size_;
};

} // namespace detail

class cancellation_slot;

/// A cancellation signal with a single slot.
class cancellation_signal
{
public:
  constexpr cancellation_signal()
    : handler_(0)
  {
  }

  ASIO_DECL ~cancellation_signal();

  /// Emits the signal and causes invocation of the slot's handler, if any.
  void emit(cancellation_type_t type)
  {
    if (handler_)
      handler_->call(type);
  }

  /// Returns the single slot associated with the signal.
  /**
   * The signal object must remain valid for as long the slot may be used.
   * Destruction of the signal invalidates the slot.
   */
  cancellation_slot slot() noexcept;

private:
  cancellation_signal(const cancellation_signal&) = delete;
  cancellation_signal& operator=(const cancellation_signal&) = delete;

  detail::cancellation_handler_base* handler_;
};

/// A slot associated with a cancellation signal.
class cancellation_slot
{
public:
  /// Creates a slot that is not connected to any cancellation signal.
  constexpr cancellation_slot()
    : handler_(0)
  {
  }

  /// Installs a handler into the slot, constructing the new object directly.
  /**
   * Destroys any existing handler in the slot, then installs the new handler,
   * constructing it with the supplied @c args.
   *
   * The handler is a function object to be called when the signal is emitted.
   * The signature of the handler must be
   * @code void handler(asio::cancellation_type_t); @endcode
   *
   * @param args Arguments to be passed to the @c CancellationHandler object's
   * constructor.
   *
   * @returns A reference to the newly installed handler.
   *
   * @note Handlers installed into the slot via @c emplace are not required to
   * be copy constructible or move constructible.
   */
  template <typename CancellationHandler, typename... Args>
  CancellationHandler& emplace(Args&&... args)
  {
    typedef detail::cancellation_handler<CancellationHandler>
      cancellation_handler_type;
    auto_delete_helper del = { prepare_memory(
        sizeof(cancellation_handler_type),
        alignof(CancellationHandler)) };
    cancellation_handler_type* handler_obj =
      new (del.mem.first) cancellation_handler_type(
        del.mem.second, static_cast<Args&&>(args)...);
    del.mem.first = 0;
    *handler_ = handler_obj;
    return handler_obj->handler();
  }

  /// Installs a handler into the slot.
  /**
   * Destroys any existing handler in the slot, then installs the new handler,
   * constructing it as a decay-copy of the supplied handler.
   *
   * The handler is a function object to be called when the signal is emitted.
   * The signature of the handler must be
   * @code void handler(asio::cancellation_type_t); @endcode
   *
   * @param handler The handler to be installed.
   *
   * @returns A reference to the newly installed handler.
   */
  template <typename CancellationHandler>
  decay_t<CancellationHandler>& assign(CancellationHandler&& handler)
  {
    return this->emplace<decay_t<CancellationHandler>>(
        static_cast<CancellationHandler&&>(handler));
  }

  /// Clears the slot.
  /**
   * Destroys any existing handler in the slot.
   */
  ASIO_DECL void clear();

  /// Returns whether the slot is connected to a signal.
  constexpr bool is_connected() const noexcept
  {
    return handler_ != 0;
  }

  /// Returns whether the slot is connected and has an installed handler.
  constexpr bool has_handler() const noexcept
  {
    return handler_ != 0 && *handler_ != 0;
  }

  /// Compare two slots for equality.
  friend constexpr bool operator==(const cancellation_slot& lhs,
      const cancellation_slot& rhs) noexcept
  {
    return lhs.handler_ == rhs.handler_;
  }

  /// Compare two slots for inequality.
  friend constexpr bool operator!=(const cancellation_slot& lhs,
      const cancellation_slot& rhs) noexcept
  {
    return lhs.handler_ != rhs.handler_;
  }

private:
  friend class cancellation_signal;

  constexpr cancellation_slot(int,
      detail::cancellation_handler_base** handler)
    : handler_(handler)
  {
  }

  ASIO_DECL std::pair<void*, std::size_t> prepare_memory(
      std::size_t size, std::size_t align);

  struct auto_delete_helper
  {
    std::pair<void*, std::size_t> mem;

    ASIO_DECL ~auto_delete_helper();
  };

  detail::cancellation_handler_base** handler_;
};

inline cancellation_slot cancellation_signal::slot() noexcept
{
  return cancellation_slot(0, &handler_);
}

} // namespace asio

#include "asio/detail/pop_options.hpp"

#if defined(ASIO_HEADER_ONLY)
# include "asio/impl/cancellation_signal.ipp"
#endif // defined(ASIO_HEADER_ONLY)

#endif // ASIO_CANCELLATION_SIGNAL_HPP
