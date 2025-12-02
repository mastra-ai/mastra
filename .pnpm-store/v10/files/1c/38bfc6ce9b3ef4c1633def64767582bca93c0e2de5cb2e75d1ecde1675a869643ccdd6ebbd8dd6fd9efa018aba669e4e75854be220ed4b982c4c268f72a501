//
// traits/equality_comparable.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_TRAITS_EQUALITY_COMPARABLE_HPP
#define ASIO_TRAITS_EQUALITY_COMPARABLE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/type_traits.hpp"

#if defined(ASIO_HAS_WORKING_EXPRESSION_SFINAE)
# define ASIO_HAS_DEDUCED_EQUALITY_COMPARABLE_TRAIT 1
#endif // defined(ASIO_HAS_WORKING_EXPRESSION_SFINAE)

namespace asio {
namespace traits {

template <typename T, typename = void>
struct equality_comparable_default;

template <typename T, typename = void>
struct equality_comparable;

} // namespace traits
namespace detail {

struct no_equality_comparable
{
  static constexpr bool is_valid = false;
  static constexpr bool is_noexcept = false;
};

#if defined(ASIO_HAS_DEDUCED_EQUALITY_COMPARABLE_TRAIT)

template <typename T, typename = void>
struct equality_comparable_trait : no_equality_comparable
{
};

template <typename T>
struct equality_comparable_trait<T,
  void_t<
    decltype(
      static_cast<void>(
        static_cast<bool>(declval<const T>() == declval<const T>())
      ),
      static_cast<void>(
        static_cast<bool>(declval<const T>() != declval<const T>())
      )
    )
  >>
{
  static constexpr bool is_valid = true;

  static constexpr bool is_noexcept =
    noexcept(declval<const T>() == declval<const T>())
      && noexcept(declval<const T>() != declval<const T>());
};

#else // defined(ASIO_HAS_DEDUCED_EQUALITY_COMPARABLE_TRAIT)

template <typename T, typename = void>
struct equality_comparable_trait :
  conditional_t<
    is_same<T, decay_t<T>>::value,
    no_equality_comparable,
    traits::equality_comparable<decay_t<T>>
  >
{
};

#endif // defined(ASIO_HAS_DEDUCED_EQUALITY_COMPARABLE_TRAIT)

} // namespace detail
namespace traits {

template <typename T, typename>
struct equality_comparable_default : detail::equality_comparable_trait<T>
{
};

template <typename T, typename>
struct equality_comparable : equality_comparable_default<T>
{
};

} // namespace traits
} // namespace asio

#endif // ASIO_TRAITS_EQUALITY_COMPARABLE_HPP
