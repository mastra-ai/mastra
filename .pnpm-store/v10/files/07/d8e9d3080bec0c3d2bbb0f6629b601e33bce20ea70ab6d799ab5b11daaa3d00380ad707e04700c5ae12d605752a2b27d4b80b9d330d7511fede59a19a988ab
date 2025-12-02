//
// ip/address_v4.hpp
// ~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IP_ADDRESS_V4_HPP
#define ASIO_IP_ADDRESS_V4_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <functional>
#include <string>
#include "asio/detail/array.hpp"
#include "asio/detail/cstdint.hpp"
#include "asio/detail/socket_types.hpp"
#include "asio/detail/string_view.hpp"
#include "asio/detail/winsock_init.hpp"
#include "asio/error_code.hpp"

#if !defined(ASIO_NO_IOSTREAM)
# include <iosfwd>
#endif // !defined(ASIO_NO_IOSTREAM)

#include "asio/detail/push_options.hpp"

namespace asio {
namespace ip {

/// Implements IP version 4 style addresses.
/**
 * The asio::ip::address_v4 class provides the ability to use and
 * manipulate IP version 4 addresses.
 *
 * @par Thread Safety
 * @e Distinct @e objects: Safe.@n
 * @e Shared @e objects: Unsafe.
 */
class address_v4
{
public:
  /// The type used to represent an address as an unsigned integer.
  typedef uint_least32_t uint_type;

  /// The type used to represent an address as an array of bytes.
  /**
   * @note This type is defined in terms of the C++0x template @c std::array
   * when it is available. Otherwise, it uses @c boost:array.
   */
#if defined(GENERATING_DOCUMENTATION)
  typedef array<unsigned char, 4> bytes_type;
#else
  typedef asio::detail::array<unsigned char, 4> bytes_type;
#endif

  /// Default constructor.
  /**
   * Initialises the @c address_v4 object such that:
   * @li <tt>to_bytes()</tt> yields <tt>{0, 0, 0, 0}</tt>; and
   * @li <tt>to_uint() == 0</tt>.
   */
  address_v4() noexcept
  {
    addr_.s_addr = 0;
  }

  /// Construct an address from raw bytes.
  /**
   * Initialises the @c address_v4 object such that <tt>to_bytes() ==
   * bytes</tt>.
   *
   * @throws out_of_range Thrown if any element in @c bytes is not in the range
   * <tt>0 - 0xFF</tt>. Note that no range checking is required for platforms
   * where <tt>std::numeric_limits<unsigned char>::max()</tt> is <tt>0xFF</tt>.
   */
  ASIO_DECL explicit address_v4(const bytes_type& bytes);

  /// Construct an address from an unsigned integer in host byte order.
  /**
   * Initialises the @c address_v4 object such that <tt>to_uint() == addr</tt>.
   */
  ASIO_DECL explicit address_v4(uint_type addr);

  /// Copy constructor.
  address_v4(const address_v4& other) noexcept
    : addr_(other.addr_)
  {
  }

  /// Move constructor.
  address_v4(address_v4&& other) noexcept
    : addr_(other.addr_)
  {
  }

  /// Assign from another address.
  address_v4& operator=(const address_v4& other) noexcept
  {
    addr_ = other.addr_;
    return *this;
  }

  /// Move-assign from another address.
  address_v4& operator=(address_v4&& other) noexcept
  {
    addr_ = other.addr_;
    return *this;
  }

  /// Get the address in bytes, in network byte order.
  ASIO_DECL bytes_type to_bytes() const noexcept;

  /// Get the address as an unsigned integer in host byte order.
  ASIO_DECL uint_type to_uint() const noexcept;

  /// Get the address as a string in dotted decimal format.
  ASIO_DECL std::string to_string() const;

  /// Determine whether the address is a loopback address.
  /**
   * This function tests whether the address is in the address block
   * <tt>127.0.0.0/8</tt>, which corresponds to the address range
   * <tt>127.0.0.0 - 127.255.255.255</tt>.
   *
   * @returns <tt>(to_uint() & 0xFF000000) == 0x7F000000</tt>.
   */
  ASIO_DECL bool is_loopback() const noexcept;

  /// Determine whether the address is unspecified.
  /**
   * This function tests whether the address is the unspecified address
   * <tt>0.0.0.0</tt>.
   *
   * @returns <tt>to_uint() == 0</tt>.
   */
  ASIO_DECL bool is_unspecified() const noexcept;

  /// Determine whether the address is a multicast address.
  /**
   * This function tests whether the address is in the multicast address block
   * <tt>224.0.0.0/4</tt>, which corresponds to the address range
   * <tt>224.0.0.0 - 239.255.255.255</tt>.
   *
   * @returns <tt>(to_uint() & 0xF0000000) == 0xE0000000</tt>.
   */
  ASIO_DECL bool is_multicast() const noexcept;

  /// Compare two addresses for equality.
  friend bool operator==(const address_v4& a1,
      const address_v4& a2) noexcept
  {
    return a1.addr_.s_addr == a2.addr_.s_addr;
  }

  /// Compare two addresses for inequality.
  friend bool operator!=(const address_v4& a1,
      const address_v4& a2) noexcept
  {
    return a1.addr_.s_addr != a2.addr_.s_addr;
  }

  /// Compare addresses for ordering.
  /**
   * Compares two addresses in host byte order.
   *
   * @returns <tt>a1.to_uint() < a2.to_uint()</tt>.
   */
  friend bool operator<(const address_v4& a1,
      const address_v4& a2) noexcept
  {
    return a1.to_uint() < a2.to_uint();
  }

  /// Compare addresses for ordering.
  /**
   * Compares two addresses in host byte order.
   *
   * @returns <tt>a1.to_uint() > a2.to_uint()</tt>.
   */
  friend bool operator>(const address_v4& a1,
      const address_v4& a2) noexcept
  {
    return a1.to_uint() > a2.to_uint();
  }

  /// Compare addresses for ordering.
  /**
   * Compares two addresses in host byte order.
   *
   * @returns <tt>a1.to_uint() <= a2.to_uint()</tt>.
   */
  friend bool operator<=(const address_v4& a1,
      const address_v4& a2) noexcept
  {
    return a1.to_uint() <= a2.to_uint();
  }

  /// Compare addresses for ordering.
  /**
   * Compares two addresses in host byte order.
   *
   * @returns <tt>a1.to_uint() >= a2.to_uint()</tt>.
   */
  friend bool operator>=(const address_v4& a1,
      const address_v4& a2) noexcept
  {
    return a1.to_uint() >= a2.to_uint();
  }

  /// Obtain an address object that represents any address.
  /**
   * This functions returns an address that represents the "any" address
   * <tt>0.0.0.0</tt>.
   *
   * @returns A default-constructed @c address_v4 object.
   */
  static address_v4 any() noexcept
  {
    return address_v4();
  }

  /// Obtain an address object that represents the loopback address.
  /**
   * This function returns an address that represents the well-known loopback
   * address <tt>127.0.0.1</tt>.
   *
   * @returns <tt>address_v4(0x7F000001)</tt>.
   */
  static address_v4 loopback() noexcept
  {
    return address_v4(0x7F000001);
  }

  /// Obtain an address object that represents the broadcast address.
  /**
   * This function returns an address that represents the broadcast address
   * <tt>255.255.255.255</tt>.
   *
   * @returns <tt>address_v4(0xFFFFFFFF)</tt>.
   */
  static address_v4 broadcast() noexcept
  {
    return address_v4(0xFFFFFFFF);
  }

private:
  // The underlying IPv4 address.
  asio::detail::in4_addr_type addr_;
};

/// Create an IPv4 address from raw bytes in network order.
/**
 * @relates address_v4
 */
inline address_v4 make_address_v4(const address_v4::bytes_type& bytes)
{
  return address_v4(bytes);
}

/// Create an IPv4 address from an unsigned integer in host byte order.
/**
 * @relates address_v4
 */
inline address_v4 make_address_v4(address_v4::uint_type addr)
{
  return address_v4(addr);
}

/// Create an IPv4 address from an IP address string in dotted decimal form.
/**
 * @relates address_v4
 */
ASIO_DECL address_v4 make_address_v4(const char* str);

/// Create an IPv4 address from an IP address string in dotted decimal form.
/**
 * @relates address_v4
 */
ASIO_DECL address_v4 make_address_v4(const char* str,
    asio::error_code& ec) noexcept;

/// Create an IPv4 address from an IP address string in dotted decimal form.
/**
 * @relates address_v4
 */
ASIO_DECL address_v4 make_address_v4(const std::string& str);

/// Create an IPv4 address from an IP address string in dotted decimal form.
/**
 * @relates address_v4
 */
ASIO_DECL address_v4 make_address_v4(const std::string& str,
    asio::error_code& ec) noexcept;

#if defined(ASIO_HAS_STRING_VIEW) \
  || defined(GENERATING_DOCUMENTATION)

/// Create an IPv4 address from an IP address string in dotted decimal form.
/**
 * @relates address_v4
 */
ASIO_DECL address_v4 make_address_v4(string_view str);

/// Create an IPv4 address from an IP address string in dotted decimal form.
/**
 * @relates address_v4
 */
ASIO_DECL address_v4 make_address_v4(string_view str,
    asio::error_code& ec) noexcept;

#endif // defined(ASIO_HAS_STRING_VIEW)
       //  || defined(GENERATING_DOCUMENTATION)

#if !defined(ASIO_NO_IOSTREAM)

/// Output an address as a string.
/**
 * Used to output a human-readable string for a specified address.
 *
 * @param os The output stream to which the string will be written.
 *
 * @param addr The address to be written.
 *
 * @return The output stream.
 *
 * @relates asio::ip::address_v4
 */
template <typename Elem, typename Traits>
std::basic_ostream<Elem, Traits>& operator<<(
    std::basic_ostream<Elem, Traits>& os, const address_v4& addr);

#endif // !defined(ASIO_NO_IOSTREAM)

} // namespace ip
} // namespace asio

namespace std {

template <>
struct hash<asio::ip::address_v4>
{
  std::size_t operator()(const asio::ip::address_v4& addr)
    const noexcept
  {
    return std::hash<unsigned int>()(addr.to_uint());
  }
};

} // namespace std

#include "asio/detail/pop_options.hpp"

#include "asio/ip/impl/address_v4.hpp"
#if defined(ASIO_HEADER_ONLY)
# include "asio/ip/impl/address_v4.ipp"
#endif // defined(ASIO_HEADER_ONLY)

#endif // ASIO_IP_ADDRESS_V4_HPP
