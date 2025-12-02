//
// detail/base_from_cancellation_state.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_BASE_FROM_CANCELLATION_STATE_HPP
#define ASIO_DETAIL_BASE_FROM_CANCELLATION_STATE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/associated_cancellation_slot.hpp"
#include "asio/cancellation_state.hpp"
#include "asio/detail/type_traits.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

template <typename Handler, typename = void>
class base_from_cancellation_state
{
public:
  typedef cancellation_slot cancellation_slot_type;

  cancellation_slot_type get_cancellation_slot() const noexcept
  {
    return cancellation_state_.slot();
  }

  cancellation_state get_cancellation_state() const noexcept
  {
    return cancellation_state_;
  }

protected:
  explicit base_from_cancellation_state(const Handler& handler)
    : cancellation_state_(
        asio::get_associated_cancellation_slot(handler))
  {
  }

  template <typename Filter>
  base_from_cancellation_state(const Handler& handler, Filter filter)
    : cancellation_state_(
        asio::get_associated_cancellation_slot(handler), filter, filter)
  {
  }

  template <typename InFilter, typename OutFilter>
  base_from_cancellation_state(const Handler& handler,
      InFilter&& in_filter,
      OutFilter&& out_filter)
    : cancellation_state_(
        asio::get_associated_cancellation_slot(handler),
        static_cast<InFilter&&>(in_filter),
        static_cast<OutFilter&&>(out_filter))
  {
  }

  void reset_cancellation_state(const Handler& handler)
  {
    cancellation_state_ = cancellation_state(
        asio::get_associated_cancellation_slot(handler));
  }

  template <typename Filter>
  void reset_cancellation_state(const Handler& handler, Filter filter)
  {
    cancellation_state_ = cancellation_state(
        asio::get_associated_cancellation_slot(handler), filter, filter);
  }

  template <typename InFilter, typename OutFilter>
  void reset_cancellation_state(const Handler& handler,
      InFilter&& in_filter,
      OutFilter&& out_filter)
  {
    cancellation_state_ = cancellation_state(
        asio::get_associated_cancellation_slot(handler),
        static_cast<InFilter&&>(in_filter),
        static_cast<OutFilter&&>(out_filter));
  }

  cancellation_type_t cancelled() const noexcept
  {
    return cancellation_state_.cancelled();
  }

private:
  cancellation_state cancellation_state_;
};

template <typename Handler>
class base_from_cancellation_state<Handler,
    enable_if_t<
      is_same<
        typename associated_cancellation_slot<
          Handler, cancellation_slot
        >::asio_associated_cancellation_slot_is_unspecialised,
        void
      >::value
    >
  >
{
public:
  cancellation_state get_cancellation_state() const noexcept
  {
    return cancellation_state();
  }

protected:
  explicit base_from_cancellation_state(const Handler&)
  {
  }

  template <typename Filter>
  base_from_cancellation_state(const Handler&, Filter)
  {
  }

  template <typename InFilter, typename OutFilter>
  base_from_cancellation_state(const Handler&,
      InFilter&&,
      OutFilter&&)
  {
  }

  void reset_cancellation_state(const Handler&)
  {
  }

  template <typename Filter>
  void reset_cancellation_state(const Handler&, Filter)
  {
  }

  template <typename InFilter, typename OutFilter>
  void reset_cancellation_state(const Handler&,
      InFilter&&,
      OutFilter&&)
  {
  }

  constexpr cancellation_type_t cancelled() const noexcept
  {
    return cancellation_type::none;
  }
};

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DETAIL_BASE_FROM_CANCELLATION_STATE_HPP
