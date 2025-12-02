//
// traits/static_require_concept.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_TRAITS_STATIC_REQUIRE_CONCEPT_HPP
#define ASIO_TRAITS_STATIC_REQUIRE_CONCEPT_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/traits/static_query.hpp"

#define ASIO_HAS_DEDUCED_STATIC_REQUIRE_CONCEPT_TRAIT 1

#include "asio/detail/push_options.hpp"

namespace asio {
namespace traits {

template <typename T, typename Property, typename = void>
struct static_require_concept_default;

template <typename T, typename Property, typename = void>
struct static_require_concept;

} // namespace traits
namespace detail {

struct no_static_require_concept
{
  static constexpr bool is_valid = false;
};

template <typename T, typename Property, typename = void>
struct static_require_concept_trait :
  conditional_t<
    is_same<T, decay_t<T>>::value
      && is_same<Property, decay_t<Property>>::value,
    no_static_require_concept,
    traits::static_require_concept<
      decay_t<T>,
      decay_t<Property>>
  >
{
};

#if defined(ASIO_HAS_WORKING_EXPRESSION_SFINAE)

template <typename T, typename Property>
struct static_require_concept_trait<T, Property,
  enable_if_t<
    decay_t<Property>::value() == traits::static_query<T, Property>::value()
  >>
{
  static constexpr bool is_valid = true;
};

#else // defined(ASIO_HAS_WORKING_EXPRESSION_SFINAE)

false_type static_require_concept_test(...);

template <typename T, typename Property>
true_type static_require_concept_test(T*, Property*,
    enable_if_t<
      Property::value() == traits::static_query<T, Property>::value()
    >* = 0);

template <typename T, typename Property>
struct has_static_require_concept
{
  static constexpr bool value =
    decltype((static_require_concept_test)(
      static_cast<T*>(0), static_cast<Property*>(0)))::value;
};

template <typename T, typename Property>
struct static_require_concept_trait<T, Property,
  enable_if_t<
    has_static_require_concept<decay_t<T>,
      decay_t<Property>>::value
  >>
{
  static constexpr bool is_valid = true;
};

#endif // defined(ASIO_HAS_WORKING_EXPRESSION_SFINAE)

} // namespace detail
namespace traits {

template <typename T, typename Property, typename>
struct static_require_concept_default :
  detail::static_require_concept_trait<T, Property>
{
};

template <typename T, typename Property, typename>
struct static_require_concept : static_require_concept_default<T, Property>
{
};

} // namespace traits
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_TRAITS_STATIC_REQUIRE_CONCEPT_HPP
