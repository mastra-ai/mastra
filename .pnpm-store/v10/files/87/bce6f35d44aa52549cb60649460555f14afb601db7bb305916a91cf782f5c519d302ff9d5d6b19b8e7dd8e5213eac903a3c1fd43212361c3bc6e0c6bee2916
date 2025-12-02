//
// execution/context_as.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXECUTION_CONTEXT_AS_HPP
#define ASIO_EXECUTION_CONTEXT_AS_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/execution/context.hpp"
#include "asio/execution/executor.hpp"
#include "asio/is_applicable_property.hpp"
#include "asio/query.hpp"
#include "asio/traits/query_static_constexpr_member.hpp"
#include "asio/traits/static_query.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

#if defined(GENERATING_DOCUMENTATION)

namespace execution {

/// A property that is used to obtain the execution context that is associated
/// with an executor.
template <typename U>
struct context_as_t
{
  /// The context_as_t property applies to executors.
  template <typename T>
  static constexpr bool is_applicable_property_v = is_executor_v<T>;

  /// The context_t property cannot be required.
  static constexpr bool is_requirable = false;

  /// The context_t property cannot be preferred.
  static constexpr bool is_preferable = false;

  /// The type returned by queries against an @c any_executor.
  typedef T polymorphic_query_result_type;
};

/// A special value used for accessing the context_as_t property.
template <typename U>
constexpr context_as_t context_as;

} // namespace execution

#else // defined(GENERATING_DOCUMENTATION)

namespace execution {

template <typename T>
struct context_as_t
{
#if defined(ASIO_HAS_VARIABLE_TEMPLATES)
  template <typename U>
  static constexpr bool is_applicable_property_v = is_executor<U>::value;
#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

  static constexpr bool is_requirable = false;
  static constexpr bool is_preferable = false;

  typedef T polymorphic_query_result_type;

  constexpr context_as_t()
  {
  }

  constexpr context_as_t(context_t)
  {
  }

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
  template <typename E>
  static constexpr
  typename context_t::query_static_constexpr_member<E>::result_type
  static_query()
    noexcept(context_t::query_static_constexpr_member<E>::is_noexcept)
  {
    return context_t::query_static_constexpr_member<E>::value();
  }

  template <typename E, typename U = decltype(context_as_t::static_query<E>())>
  static constexpr const U static_query_v
    = context_as_t::static_query<E>();
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

  template <typename Executor, typename U>
  friend constexpr U query(
      const Executor& ex, const context_as_t<U>&,
      enable_if_t<
        is_same<T, U>::value
      >* = 0,
      enable_if_t<
        can_query<const Executor&, const context_t&>::value
      >* = 0)
#if !defined(__clang__) // Clang crashes if noexcept is used here.
#if defined(ASIO_MSVC) // Visual C++ wants the type to be qualified.
    noexcept(is_nothrow_query<const Executor&, const context_t&>::value)
#else // defined(ASIO_MSVC)
    noexcept(is_nothrow_query<const Executor&, const context_t&>::value)
#endif // defined(ASIO_MSVC)
#endif // !defined(__clang__)
  {
    return asio::query(ex, context);
  }
};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
template <typename T> template <typename E, typename U>
const U context_as_t<T>::static_query_v;
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

#if defined(ASIO_HAS_VARIABLE_TEMPLATES) \
  || defined(GENERATING_DOCUMENTATION)
template <typename T>
constexpr context_as_t<T> context_as{};
#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)
       //   || defined(GENERATING_DOCUMENTATION)

} // namespace execution

#if !defined(ASIO_HAS_VARIABLE_TEMPLATES)

template <typename T, typename U>
struct is_applicable_property<T, execution::context_as_t<U>>
  : integral_constant<bool, execution::is_executor<T>::value>
{
};

#endif // !defined(ASIO_HAS_VARIABLE_TEMPLATES)

namespace traits {

#if !defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  || !defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

template <typename T, typename U>
struct static_query<T, execution::context_as_t<U>,
  enable_if_t<
    static_query<T, execution::context_t>::is_valid
  >> : static_query<T, execution::context_t>
{
};

#endif // !defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   || !defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

#if !defined(ASIO_HAS_DEDUCED_QUERY_FREE_TRAIT)

template <typename T, typename U>
struct query_free<T, execution::context_as_t<U>,
  enable_if_t<
    can_query<const T&, const execution::context_t&>::value
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept =
    is_nothrow_query<const T&, const execution::context_t&>::value;

  typedef U result_type;
};

#endif // !defined(ASIO_HAS_DEDUCED_QUERY_FREE_TRAIT)

} // namespace traits

#endif // defined(GENERATING_DOCUMENTATION)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_EXECUTION_CONTEXT_AS_HPP
