//
// traits/require_free.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_TRAITS_REQUIRE_FREE_HPP
#define ASIO_TRAITS_REQUIRE_FREE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/type_traits.hpp"

#if defined(ASIO_HAS_WORKING_EXPRESSION_SFINAE)
# define ASIO_HAS_DEDUCED_REQUIRE_FREE_TRAIT 1
#endif // defined(ASIO_HAS_WORKING_EXPRESSION_SFINAE)

#include "asio/detail/push_options.hpp"

namespace asio {
namespace traits {

template <typename T, typename Property, typename = void>
struct require_free_default;

template <typename T, typename Property, typename = void>
struct require_free;

} // namespace traits
namespace detail {

struct no_require_free
{
  static constexpr bool is_valid = false;
  static constexpr bool is_noexcept = false;
};

#if defined(ASIO_HAS_DEDUCED_REQUIRE_FREE_TRAIT)

template <typename T, typename Property, typename = void>
struct require_free_trait : no_require_free
{
};

template <typename T, typename Property>
struct require_free_trait<T, Property,
  void_t<
    decltype(require(declval<T>(), declval<Property>()))
  >>
{
  static constexpr bool is_valid = true;

  using result_type = decltype(
    require(declval<T>(), declval<Property>()));

  static constexpr bool is_noexcept =
    noexcept(require(declval<T>(), declval<Property>()));
};

#else // defined(ASIO_HAS_DEDUCED_REQUIRE_FREE_TRAIT)

template <typename T, typename Property, typename = void>
struct require_free_trait :
  conditional_t<
    is_same<T, decay_t<T>>::value
      && is_same<Property, decay_t<Property>>::value,
    no_require_free,
    traits::require_free<
      decay_t<T>,
      decay_t<Property>>
  >
{
};

#endif // defined(ASIO_HAS_DEDUCED_REQUIRE_FREE_TRAIT)

} // namespace detail
namespace traits {

template <typename T, typename Property, typename>
struct require_free_default :
  detail::require_free_trait<T, Property>
{
};

template <typename T, typename Property, typename>
struct require_free :
  require_free_default<T, Property>
{
};

} // namespace traits
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_TRAITS_REQUIRE_FREE_HPP
