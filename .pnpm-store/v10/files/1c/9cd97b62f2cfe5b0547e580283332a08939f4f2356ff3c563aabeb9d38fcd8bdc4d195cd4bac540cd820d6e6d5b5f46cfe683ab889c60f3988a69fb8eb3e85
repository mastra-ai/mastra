//
// traits/execute_member.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_TRAITS_EXECUTE_MEMBER_HPP
#define ASIO_TRAITS_EXECUTE_MEMBER_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/type_traits.hpp"

#if defined(ASIO_HAS_WORKING_EXPRESSION_SFINAE)
# define ASIO_HAS_DEDUCED_EXECUTE_MEMBER_TRAIT 1
#endif // defined(ASIO_HAS_WORKING_EXPRESSION_SFINAE)

#include "asio/detail/push_options.hpp"

namespace asio {
namespace traits {

template <typename T, typename F, typename = void>
struct execute_member_default;

template <typename T, typename F, typename = void>
struct execute_member;

} // namespace traits
namespace detail {

struct no_execute_member
{
  static constexpr bool is_valid = false;
  static constexpr bool is_noexcept = false;
};

#if defined(ASIO_HAS_DEDUCED_EXECUTE_MEMBER_TRAIT)

template <typename T, typename F, typename = void>
struct execute_member_trait : no_execute_member
{
};

template <typename T, typename F>
struct execute_member_trait<T, F,
  void_t<
    decltype(declval<T>().execute(declval<F>()))
  >>
{
  static constexpr bool is_valid = true;

  using result_type = decltype(
    declval<T>().execute(declval<F>()));

  static constexpr bool is_noexcept =
    noexcept(declval<T>().execute(declval<F>()));
};

#else // defined(ASIO_HAS_DEDUCED_EXECUTE_MEMBER_TRAIT)

template <typename T, typename F, typename = void>
struct execute_member_trait :
  conditional_t<
    is_same<T, decay_t<T>>::value
      && is_same<F, decay_t<F>>::value,
    no_execute_member,
    traits::execute_member<
      decay_t<T>,
      decay_t<F>>
  >
{
};

#endif // defined(ASIO_HAS_DEDUCED_EXECUTE_MEMBER_TRAIT)

} // namespace detail
namespace traits {

template <typename T, typename F, typename>
struct execute_member_default :
  detail::execute_member_trait<T, F>
{
};

template <typename T, typename F, typename>
struct execute_member :
  execute_member_default<T, F>
{
};

} // namespace traits
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_TRAITS_EXECUTE_MEMBER_HPP
