//
// experimental/channel_error.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXPERIMENTAL_CHANNEL_ERROR_HPP
#define ASIO_EXPERIMENTAL_CHANNEL_ERROR_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/error_code.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace experimental {
namespace error {

enum channel_errors
{
  /// The channel was closed.
  channel_closed = 1,

  /// The channel was cancelled.
  channel_cancelled = 2
};

extern ASIO_DECL
const asio::error_category& get_channel_category();

static const asio::error_category&
  channel_category ASIO_UNUSED_VARIABLE
  = asio::experimental::error::get_channel_category();

} // namespace error
namespace channel_errc {
  // Simulates a scoped enum.
  using error::channel_closed;
  using error::channel_cancelled;
} // namespace channel_errc
} // namespace experimental
} // namespace asio

namespace std {

template<> struct is_error_code_enum<
    asio::experimental::error::channel_errors>
{
  static const bool value = true;
};

} // namespace std

namespace asio {
namespace experimental {
namespace error {

inline asio::error_code make_error_code(channel_errors e)
{
  return asio::error_code(
      static_cast<int>(e), get_channel_category());
}

} // namespace error
} // namespace experimental
} // namespace asio

#include "asio/detail/pop_options.hpp"

#if defined(ASIO_HEADER_ONLY)
# include "asio/experimental/impl/channel_error.ipp"
#endif // defined(ASIO_HEADER_ONLY)

#endif // ASIO_EXPERIMENTAL_CHANNEL_ERROR_HPP
