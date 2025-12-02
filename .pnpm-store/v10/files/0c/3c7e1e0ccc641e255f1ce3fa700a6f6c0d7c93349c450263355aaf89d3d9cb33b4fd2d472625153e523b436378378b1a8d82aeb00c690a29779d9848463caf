//
// require.hpp
// ~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_REQUIRE_HPP
#define ASIO_REQUIRE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/is_applicable_property.hpp"
#include "asio/traits/require_member.hpp"
#include "asio/traits/require_free.hpp"
#include "asio/traits/static_require.hpp"

#include "asio/detail/push_options.hpp"

#if defined(GENERATING_DOCUMENTATION)

namespace asio {

/// A customisation point that applies a concept-preserving property to an
/// object.
/**
 * The name <tt>require</tt> denotes a customisation point object. The
 * expression <tt>asio::require(E, P0, Pn...)</tt> for some
 * subexpressions <tt>E</tt> and <tt>P0</tt>, and where <tt>Pn...</tt>
 * represents <tt>N</tt> subexpressions (where <tt>N</tt> is 0 or more, and with
 * types <tt>T = decay_t<decltype(E)></tt> and <tt>Prop0 =
 * decay_t<decltype(P0)></tt>) is expression-equivalent to:
 *
 * @li If <tt>is_applicable_property_v<T, Prop0> && Prop0::is_requirable</tt> is
 *   not a well-formed constant expression with value <tt>true</tt>,
 *   <tt>asio::require(E, P0, Pn...)</tt> is ill-formed.
 *
 * @li Otherwise, <tt>E</tt> if <tt>N == 0</tt> and the expression
 *   <tt>Prop0::template static_query_v<T> == Prop0::value()</tt> is a
 *   well-formed constant expression with value <tt>true</tt>.
 *
 * @li Otherwise, <tt>(E).require(P0)</tt> if <tt>N == 0</tt> and the expression
 *   <tt>(E).require(P0)</tt> is a valid expression.
 *
 * @li Otherwise, <tt>require(E, P0)</tt> if <tt>N == 0</tt> and the expression
 *   <tt>require(E, P0)</tt> is a valid expression with overload resolution
 *   performed in a context that does not include the declaration of the
 *   <tt>require</tt> customization point object.
 *
 * @li Otherwise,
 *   <tt>asio::require(asio::require(E, P0), Pn...)</tt>
 *   if <tt>N > 0</tt> and the expression
 *   <tt>asio::require(asio::require(E, P0), Pn...)</tt>
 *   is a valid expression.
 *
 * @li Otherwise, <tt>asio::require(E, P0, Pn...)</tt> is ill-formed.
 */
inline constexpr unspecified require = unspecified;

/// A type trait that determines whether a @c require expression is well-formed.
/**
 * Class template @c can_require is a trait that is derived from
 * @c true_type if the expression <tt>asio::require(std::declval<T>(),
 * std::declval<Properties>()...)</tt> is well formed; otherwise @c false_type.
 */
template <typename T, typename... Properties>
struct can_require :
  integral_constant<bool, automatically_determined>
{
};

/// A type trait that determines whether a @c require expression will not throw.
/**
 * Class template @c is_nothrow_require is a trait that is derived from
 * @c true_type if the expression <tt>asio::require(std::declval<T>(),
 * std::declval<Properties>()...)</tt> is @c noexcept; otherwise @c false_type.
 */
template <typename T, typename... Properties>
struct is_nothrow_require :
  integral_constant<bool, automatically_determined>
{
};

/// A type trait that determines the result type of a @c require expression.
/**
 * Class template @c require_result is a trait that determines the result
 * type of the expression <tt>asio::require(std::declval<T>(),
 * std::declval<Properties>()...)</tt>.
 */
template <typename T, typename... Properties>
struct require_result
{
  /// The result of the @c require expression.
  typedef automatically_determined type;
};

} // namespace asio

#else // defined(GENERATING_DOCUMENTATION)

namespace asio_require_fn {

using asio::conditional_t;
using asio::decay_t;
using asio::declval;
using asio::enable_if_t;
using asio::is_applicable_property;
using asio::traits::require_free;
using asio::traits::require_member;
using asio::traits::static_require;

void require();

enum overload_type
{
  identity,
  call_member,
  call_free,
  two_props,
  n_props,
  ill_formed
};

template <typename Impl, typename T, typename Properties, typename = void,
    typename = void, typename = void, typename = void, typename = void>
struct call_traits
{
  static constexpr overload_type overload = ill_formed;
  static constexpr bool is_noexcept = false;
  typedef void result_type;
};

template <typename Impl, typename T, typename Property>
struct call_traits<Impl, T, void(Property),
  enable_if_t<
    is_applicable_property<
      decay_t<T>,
      decay_t<Property>
    >::value
  >,
  enable_if_t<
    decay_t<Property>::is_requirable
  >,
  enable_if_t<
    static_require<T, Property>::is_valid
  >>
{
  static constexpr overload_type overload = identity;
  static constexpr bool is_noexcept = true;

  typedef T&& result_type;
};

template <typename Impl, typename T, typename Property>
struct call_traits<Impl, T, void(Property),
  enable_if_t<
    is_applicable_property<
      decay_t<T>,
      decay_t<Property>
    >::value
  >,
  enable_if_t<
    decay_t<Property>::is_requirable
  >,
  enable_if_t<
    !static_require<T, Property>::is_valid
  >,
  enable_if_t<
    require_member<typename Impl::template proxy<T>::type, Property>::is_valid
  >> :
  require_member<typename Impl::template proxy<T>::type, Property>
{
  static constexpr overload_type overload = call_member;
};

template <typename Impl, typename T, typename Property>
struct call_traits<Impl, T, void(Property),
  enable_if_t<
    is_applicable_property<
      decay_t<T>,
      decay_t<Property>
    >::value
  >,
  enable_if_t<
    decay_t<Property>::is_requirable
  >,
  enable_if_t<
    !static_require<T, Property>::is_valid
  >,
  enable_if_t<
    !require_member<typename Impl::template proxy<T>::type, Property>::is_valid
  >,
  enable_if_t<
    require_free<T, Property>::is_valid
  >> :
  require_free<T, Property>
{
  static constexpr overload_type overload = call_free;
};

template <typename Impl, typename T, typename P0, typename P1>
struct call_traits<Impl, T, void(P0, P1),
  enable_if_t<
    call_traits<Impl, T, void(P0)>::overload != ill_formed
  >,
  enable_if_t<
    call_traits<
      Impl,
      typename call_traits<Impl, T, void(P0)>::result_type,
      void(P1)
    >::overload != ill_formed
  >>
{
  static constexpr overload_type overload = two_props;

  static constexpr bool is_noexcept =
    (
      call_traits<Impl, T, void(P0)>::is_noexcept
      &&
      call_traits<
        Impl,
        typename call_traits<Impl, T, void(P0)>::result_type,
        void(P1)
      >::is_noexcept
    );

  typedef decay_t<
    typename call_traits<
      Impl,
      typename call_traits<Impl, T, void(P0)>::result_type,
      void(P1)
    >::result_type
  > result_type;
};

template <typename Impl, typename T, typename P0,
    typename P1, typename... PN>
struct call_traits<Impl, T, void(P0, P1, PN...),
  enable_if_t<
    call_traits<Impl, T, void(P0)>::overload != ill_formed
  >,
  enable_if_t<
    call_traits<
      Impl,
      typename call_traits<Impl, T, void(P0)>::result_type,
      void(P1, PN...)
    >::overload != ill_formed
  >>
{
  static constexpr overload_type overload = n_props;

  static constexpr bool is_noexcept =
    (
      call_traits<Impl, T, void(P0)>::is_noexcept
      &&
      call_traits<
        Impl,
        typename call_traits<Impl, T, void(P0)>::result_type,
        void(P1, PN...)
      >::is_noexcept
    );

  typedef decay_t<
    typename call_traits<
      Impl,
      typename call_traits<Impl, T, void(P0)>::result_type,
      void(P1, PN...)
    >::result_type
  > result_type;
};

struct impl
{
  template <typename T>
  struct proxy
  {
#if defined(ASIO_HAS_DEDUCED_REQUIRE_MEMBER_TRAIT)
    struct type
    {
      template <typename P>
      auto require(P&& p)
        noexcept(
          noexcept(
            declval<conditional_t<true, T, P>>().require(static_cast<P&&>(p))
          )
        )
        -> decltype(
          declval<conditional_t<true, T, P>>().require(static_cast<P&&>(p))
        );
    };
#else // defined(ASIO_HAS_DEDUCED_REQUIRE_MEMBER_TRAIT)
    typedef T type;
#endif // defined(ASIO_HAS_DEDUCED_REQUIRE_MEMBER_TRAIT)
  };

  template <typename T, typename Property>
  ASIO_NODISCARD constexpr enable_if_t<
    call_traits<impl, T, void(Property)>::overload == identity,
    typename call_traits<impl, T, void(Property)>::result_type
  >
  operator()(T&& t, Property&&) const
    noexcept(call_traits<impl, T, void(Property)>::is_noexcept)
  {
    return static_cast<T&&>(t);
  }

  template <typename T, typename Property>
  ASIO_NODISCARD constexpr enable_if_t<
    call_traits<impl, T, void(Property)>::overload == call_member,
    typename call_traits<impl, T, void(Property)>::result_type
  >
  operator()(T&& t, Property&& p) const
    noexcept(call_traits<impl, T, void(Property)>::is_noexcept)
  {
    return static_cast<T&&>(t).require(static_cast<Property&&>(p));
  }

  template <typename T, typename Property>
  ASIO_NODISCARD constexpr enable_if_t<
    call_traits<impl, T, void(Property)>::overload == call_free,
    typename call_traits<impl, T, void(Property)>::result_type
  >
  operator()(T&& t, Property&& p) const
    noexcept(call_traits<impl, T, void(Property)>::is_noexcept)
  {
    return require(static_cast<T&&>(t), static_cast<Property&&>(p));
  }

  template <typename T, typename P0, typename P1>
  ASIO_NODISCARD constexpr enable_if_t<
    call_traits<impl, T, void(P0, P1)>::overload == two_props,
    typename call_traits<impl, T, void(P0, P1)>::result_type
  >
  operator()(T&& t, P0&& p0, P1&& p1) const
    noexcept(call_traits<impl, T, void(P0, P1)>::is_noexcept)
  {
    return (*this)(
        (*this)(static_cast<T&&>(t), static_cast<P0&&>(p0)),
        static_cast<P1&&>(p1));
  }

  template <typename T, typename P0, typename P1,
    typename... PN>
  ASIO_NODISCARD constexpr enable_if_t<
    call_traits<impl, T, void(P0, P1, PN...)>::overload == n_props,
    typename call_traits<impl, T, void(P0, P1, PN...)>::result_type
  >
  operator()(T&& t, P0&& p0, P1&& p1, PN&&... pn) const
    noexcept(call_traits<impl, T, void(P0, P1, PN...)>::is_noexcept)
  {
    return (*this)(
        (*this)(static_cast<T&&>(t), static_cast<P0&&>(p0)),
        static_cast<P1&&>(p1), static_cast<PN&&>(pn)...);
  }
};

template <typename T = impl>
struct static_instance
{
  static const T instance;
};

template <typename T>
const T static_instance<T>::instance = {};

} // namespace asio_require_fn
namespace asio {
namespace {

static constexpr const asio_require_fn::impl&
  require = asio_require_fn::static_instance<>::instance;

} // namespace

typedef asio_require_fn::impl require_t;

template <typename T, typename... Properties>
struct can_require :
  integral_constant<bool,
    asio_require_fn::call_traits<
      require_t, T, void(Properties...)>::overload
        != asio_require_fn::ill_formed>
{
};

#if defined(ASIO_HAS_VARIABLE_TEMPLATES)

template <typename T, typename... Properties>
constexpr bool can_require_v
  = can_require<T, Properties...>::value;

#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

template <typename T, typename... Properties>
struct is_nothrow_require :
  integral_constant<bool,
    asio_require_fn::call_traits<
      require_t, T, void(Properties...)>::is_noexcept>
{
};

#if defined(ASIO_HAS_VARIABLE_TEMPLATES)

template <typename T, typename... Properties>
constexpr bool is_nothrow_require_v
  = is_nothrow_require<T, Properties...>::value;

#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

template <typename T, typename... Properties>
struct require_result
{
  typedef typename asio_require_fn::call_traits<
      require_t, T, void(Properties...)>::result_type type;
};

template <typename T, typename... Properties>
using require_result_t = typename require_result<T, Properties...>::type;

} // namespace asio

#endif // defined(GENERATING_DOCUMENTATION)

#include "asio/detail/pop_options.hpp"

#endif // ASIO_REQUIRE_HPP
