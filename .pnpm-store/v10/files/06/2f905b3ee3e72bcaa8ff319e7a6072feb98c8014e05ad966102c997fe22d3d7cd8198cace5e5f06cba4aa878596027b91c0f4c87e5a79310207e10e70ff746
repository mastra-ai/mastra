//
// disposition.hpp
// ~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DISPOSITION_HPP
#define ASIO_DISPOSITION_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/throw_exception.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/error_code.hpp"
#include "asio/system_error.hpp"
#include <exception>

#include "asio/detail/push_options.hpp"

namespace asio {

/// Traits type to adapt arbitrary error types as dispositions.
/**
 * This type may be specialised for user-defined types, to allow them to be
 * treated as a disposition by asio.
 *
 * The primary trait is not defined.
 */
#if defined(GENERATING_DOCUMENTATION)
template <typename T>
struct disposition_traits
{
  /// Determine whether a disposition represents no error.
  static bool not_an_error(const T& d) noexcept;

  /// Throw an exception if the disposition represents an error.
  static void throw_exception(T d);

  /// Convert a disposition into an @c exception_ptr.
  static std::exception_ptr to_exception_ptr(T d) noexcept;
};
#else // defined(GENERATING_DOCUMENTATION)
template <typename T>
struct disposition_traits;
#endif // defined(GENERATING_DOCUMENTATION)

namespace detail {

template <typename T, typename = void, typename = void,
  typename = void, typename = void, typename = void, typename = void>
struct is_disposition_impl : false_type
{
};

template <typename T>
struct is_disposition_impl<T,
  enable_if_t<
    is_nothrow_default_constructible<T>::value
  >,
  enable_if_t<
    is_nothrow_move_constructible<T>::value
  >,
  enable_if_t<
    is_nothrow_move_assignable<T>::value
  >,
  enable_if_t<
    is_same<
      decltype(disposition_traits<T>::not_an_error(declval<const T&>())),
      bool
    >::value
  >,
  void_t<
    decltype(disposition_traits<T>::throw_exception(declval<T>()))
  >,
  enable_if_t<
    is_same<
      decltype(disposition_traits<T>::to_exception_ptr(declval<T>())),
      std::exception_ptr
    >::value
  >> : true_type
{
};

} // namespace detail

/// Trait used for testing whether a type satisfies the requirements of a
/// disposition.
/**
 * To be a valid disposition, a type must be nothrow default-constructible,
 * nothrow move-constructible, nothrow move-assignable, and there must be a
 * specialisation of the disposition_traits template for the type that provides
 * the following static member functions:
 * @li @c not_an_error: Takes an argument of type <tt>const T&</tt> and returns
 *     a @c bool.
 * @li @c throw_exception: Takes an argument of type <tt>T</tt>. The
 *     caller of this function must not pass a disposition value for which
 *     @c not_an_error returns true. This function must not return.
 * @li @c to_exception_ptr: Takes an argument of type <tt>T</tt> and returns a
 *     value of type @c std::exception_ptr.
 */
template <typename T>
struct is_disposition :
#if defined(GENERATING_DOCUMENTATION)
  integral_constant<bool, automatically_determined>
#else // defined(GENERATING_DOCUMENTATION)
  detail::is_disposition_impl<T>
#endif // defined(GENERATING_DOCUMENTATION)
{
};

#if defined(ASIO_HAS_VARIABLE_TEMPLATES)

template <typename T>
constexpr const bool is_disposition_v = is_disposition<T>::value;

#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

#if defined(ASIO_HAS_CONCEPTS)

template <typename T>
ASIO_CONCEPT disposition = is_disposition<T>::value;

#define ASIO_DISPOSITION ::asio::disposition

#else // defined(ASIO_HAS_CONCEPTS)

#define ASIO_DISPOSITION typename

#endif // defined(ASIO_HAS_CONCEPTS)

/// Specialisation of @c disposition_traits for @c error_code.
template <>
struct disposition_traits<asio::error_code>
{
  static bool not_an_error(const asio::error_code& ec) noexcept
  {
    return !ec;
  }

  static void throw_exception(const asio::error_code& ec)
  {
    detail::throw_exception(asio::system_error(ec));
  }

  static std::exception_ptr to_exception_ptr(
      const asio::error_code& ec) noexcept
  {
    return ec
      ? std::make_exception_ptr(asio::system_error(ec))
      : nullptr;
  }
};

/// Specialisation of @c disposition_traits for @c std::exception_ptr.
template <>
struct disposition_traits<std::exception_ptr>
{
  static bool not_an_error(const std::exception_ptr& e) noexcept
  {
    return !e;
  }

  static void throw_exception(std::exception_ptr e)
  {
    std::rethrow_exception(static_cast<std::exception_ptr&&>(e));
  }

  static std::exception_ptr to_exception_ptr(std::exception_ptr e) noexcept
  {
    return e;
  }
};

/// A tag type used to indicate the absence of an error.
struct no_error_t
{
  /// Default constructor.
  constexpr no_error_t()
  {
  }

  /// Equality operator.
  friend constexpr bool operator==(
      const no_error_t&, const no_error_t&) noexcept
  {
    return true;
  }

  /// Inequality operator.
  friend constexpr bool operator!=(
      const no_error_t&, const no_error_t&) noexcept
  {
    return false;
  }

  /// Equality operator, returns true if the disposition does not contain an
  /// error.
  template <ASIO_DISPOSITION Disposition>
  friend constexpr constraint_t<is_disposition<Disposition>::value, bool>
  operator==(const no_error_t&, const Disposition& d) noexcept
  {
    return disposition_traits<Disposition>::not_an_error(d);
  }

  /// Equality operator, returns true if the disposition does not contain an
  /// error.
  template <ASIO_DISPOSITION Disposition>
  friend constexpr constraint_t<is_disposition<Disposition>::value, bool>
  operator==(const Disposition& d, const no_error_t&) noexcept
  {
    return disposition_traits<Disposition>::not_an_error(d);
  }

  /// Inequality operator, returns true if the disposition contains an error.
  template <ASIO_DISPOSITION Disposition>
  friend constexpr constraint_t<is_disposition<Disposition>::value, bool>
  operator!=(const no_error_t&, const Disposition& d) noexcept
  {
    return !disposition_traits<Disposition>::not_an_error(d);
  }

  /// Inequality operator, returns true if the disposition contains an error.
  template <ASIO_DISPOSITION Disposition>
  friend constexpr constraint_t<is_disposition<Disposition>::value, bool>
  operator!=(const Disposition& d, const no_error_t&) noexcept
  {
    return !disposition_traits<Disposition>::not_an_error(d);
  }
};

/// A special value used to indicate the absence of an error.
ASIO_INLINE_VARIABLE constexpr no_error_t no_error;

/// Specialisation of @c disposition_traits for @c no_error_t.
template <>
struct disposition_traits<no_error_t>
{
  static bool not_an_error(no_error_t) noexcept
  {
    return true;
  }

  static void throw_exception(no_error_t)
  {
  }

  static std::exception_ptr to_exception_ptr(no_error_t) noexcept
  {
    return std::exception_ptr();
  }
};

/// Helper function to throw an exception arising from a disposition.
template <typename Disposition>
inline void throw_exception(Disposition&& d,
    constraint_t<is_disposition<decay_t<Disposition>>::value> = 0)
{
  disposition_traits<decay_t<Disposition>>::throw_exception(
      static_cast<Disposition&&>(d));
}

/// Helper function to convert a disposition to an @c exception_ptr.
template <typename Disposition>
inline std::exception_ptr to_exception_ptr(Disposition&& d,
    constraint_t<is_disposition<decay_t<Disposition>>::value> = 0) noexcept
{
  return disposition_traits<decay_t<Disposition>>::to_exception_ptr(
      static_cast<Disposition&&>(d));
}

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DISPOSITION_HPP
