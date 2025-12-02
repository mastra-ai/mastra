//
// ip/address_v6_range.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//                         Oliver Kowalke (oliver dot kowalke at gmail dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IP_ADDRESS_V6_RANGE_HPP
#define ASIO_IP_ADDRESS_V6_RANGE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/ip/address_v6_iterator.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace ip {

template <typename> class basic_address_range;

/// Represents a range of IPv6 addresses.
/**
 * @par Thread Safety
 * @e Distinct @e objects: Safe.@n
 * @e Shared @e objects: Unsafe.
 */
template <> class basic_address_range<address_v6>
{
public:
  /// The type of an iterator that points into the range.
  typedef basic_address_iterator<address_v6> iterator;

  /// Construct an empty range.
  basic_address_range() noexcept
    : begin_(address_v6()),
      end_(address_v6())
  {
  }

  /// Construct an range that represents the given range of addresses.
  explicit basic_address_range(const iterator& first,
      const iterator& last) noexcept
    : begin_(first),
      end_(last)
  {
  }

  /// Copy constructor.
  basic_address_range(const basic_address_range& other) noexcept
    : begin_(other.begin_),
      end_(other.end_)
  {
  }

  /// Move constructor.
  basic_address_range(basic_address_range&& other) noexcept
    : begin_(static_cast<iterator&&>(other.begin_)),
      end_(static_cast<iterator&&>(other.end_))
  {
  }

  /// Assignment operator.
  basic_address_range& operator=(
      const basic_address_range& other) noexcept
  {
    begin_ = other.begin_;
    end_ = other.end_;
    return *this;
  }

  /// Move assignment operator.
  basic_address_range& operator=(basic_address_range&& other) noexcept
  {
    begin_ = static_cast<iterator&&>(other.begin_);
    end_ = static_cast<iterator&&>(other.end_);
    return *this;
  }

  /// Obtain an iterator that points to the start of the range.
  iterator begin() const noexcept
  {
    return begin_;
  }

  /// Obtain an iterator that points to the end of the range.
  iterator end() const noexcept
  {
    return end_;
  }

  /// Determine whether the range is empty.
  bool empty() const noexcept
  {
    return begin_ == end_;
  }

  /// Find an address in the range.
  iterator find(const address_v6& addr) const noexcept
  {
    return addr >= *begin_ && addr < *end_ ? iterator(addr) : end_;
  }

private:
  iterator begin_;
  iterator end_;
};

/// Represents a range of IPv6 addresses.
typedef basic_address_range<address_v6> address_v6_range;

} // namespace ip
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IP_ADDRESS_V6_RANGE_HPP
