//
// ip/bad_address_cast.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IP_BAD_ADDRESS_CAST_HPP
#define ASIO_IP_BAD_ADDRESS_CAST_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <typeinfo>

#include "asio/detail/push_options.hpp"

namespace asio {
namespace ip {

/// Thrown to indicate a failed address conversion.
class bad_address_cast :
#if defined(ASIO_MSVC) && defined(_HAS_EXCEPTIONS) && !_HAS_EXCEPTIONS
  public std::exception
#else
  public std::bad_cast
#endif
{
public:
  /// Default constructor.
  bad_address_cast() {}

  /// Copy constructor.
  bad_address_cast(const bad_address_cast& other) noexcept
#if defined(ASIO_MSVC) && defined(_HAS_EXCEPTIONS) && !_HAS_EXCEPTIONS
    : std::exception(static_cast<const std::exception&>(other))
#else
    : std::bad_cast(static_cast<const std::bad_cast&>(other))
#endif
  {
  }

  /// Destructor.
  virtual ~bad_address_cast() noexcept {}

  /// Get the message associated with the exception.
  virtual const char* what() const noexcept
  {
    return "bad address cast";
  }
};

} // namespace ip
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IP_ADDRESS_HPP
