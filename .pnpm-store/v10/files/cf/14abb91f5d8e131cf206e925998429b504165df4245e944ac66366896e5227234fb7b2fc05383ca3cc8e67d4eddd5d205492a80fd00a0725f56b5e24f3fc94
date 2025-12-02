//
// signal_set_base.hpp
// ~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_SIGNAL_SET_BASE_HPP
#define ASIO_SIGNAL_SET_BASE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/socket_types.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

/// The signal_set_base class is used as a base for the basic_signal_set class
/// templates so that we have a common place to define the flags enum.
class signal_set_base
{
public:
# if defined(GENERATING_DOCUMENTATION)
  /// Enumeration representing the different types of flags that may specified
  /// when adding a signal to a set.
  enum flags
  {
    /// Bitmask representing no flags.
    none = 0,

    /// Affects the behaviour of interruptible functions such that, if the
    /// function would have failed with error::interrupted when interrupted by
    /// the specified signal, the function shall instead be restarted and not
    /// fail with error::interrupted.
    restart = implementation_defined,

    /// Do not generate SIGCHLD when child processes stop or stopped child
    /// processes continue.
    no_child_stop = implementation_defined,

    /// Do not transform child processes into zombies when they terminate.
    no_child_wait = implementation_defined,

    /// Special value to indicate that the signal registration does not care
    /// which flags are set, and so will not conflict with any prior
    /// registrations of the same signal.
    dont_care = -1
  };

  /// Portability typedef.
  typedef flags flags_t;

#else // defined(GENERATING_DOCUMENTATION)

  enum class flags : int
  {
    none = 0,
    restart = ASIO_OS_DEF(SA_RESTART),
    no_child_stop = ASIO_OS_DEF(SA_NOCLDSTOP),
    no_child_wait = ASIO_OS_DEF(SA_NOCLDWAIT),
    dont_care = -1
  };

  typedef flags flags_t;

#endif // defined(GENERATING_DOCUMENTATION)

protected:
  /// Protected destructor to prevent deletion through this type.
  ~signal_set_base()
  {
  }
};

/// Negation operator.
/**
 * @relates signal_set_base::flags
 */
inline constexpr bool operator!(signal_set_base::flags_t x)
{
  return static_cast<int>(x) == 0;
}

/// Bitwise and operator.
/**
 * @relates signal_set_base::flags
 */
inline constexpr signal_set_base::flags_t operator&(
    signal_set_base::flags_t x, signal_set_base::flags_t y)
{
  return static_cast<signal_set_base::flags_t>(
      static_cast<int>(x) & static_cast<int>(y));
}

/// Bitwise or operator.
/**
 * @relates signal_set_base::flags
 */
inline constexpr signal_set_base::flags_t operator|(
    signal_set_base::flags_t x, signal_set_base::flags_t y)
{
  return static_cast<signal_set_base::flags_t>(
      static_cast<int>(x) | static_cast<int>(y));
}

/// Bitwise xor operator.
/**
 * @relates signal_set_base::flags
 */
inline constexpr signal_set_base::flags_t operator^(
    signal_set_base::flags_t x, signal_set_base::flags_t y)
{
  return static_cast<signal_set_base::flags_t>(
      static_cast<int>(x) ^ static_cast<int>(y));
}

/// Bitwise negation operator.
/**
 * @relates signal_set_base::flags
 */
inline constexpr signal_set_base::flags_t operator~(
    signal_set_base::flags_t x)
{
  return static_cast<signal_set_base::flags_t>(~static_cast<int>(x));
}

/// Bitwise and-assignment operator.
/**
 * @relates signal_set_base::flags
 */
inline signal_set_base::flags_t& operator&=(
    signal_set_base::flags_t& x, signal_set_base::flags_t y)
{
  x = x & y;
  return x;
}

/// Bitwise or-assignment operator.
/**
 * @relates signal_set_base::flags
 */
inline signal_set_base::flags_t& operator|=(
    signal_set_base::flags_t& x, signal_set_base::flags_t y)
{
  x = x | y;
  return x;
}

/// Bitwise xor-assignment operator.
/**
 * @relates signal_set_base::flags
 */
inline signal_set_base::flags_t& operator^=(
    signal_set_base::flags_t& x, signal_set_base::flags_t y)
{
  x = x ^ y;
  return x;
}

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_SIGNAL_SET_BASE_HPP
