//
// execution/relationship.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXECUTION_RELATIONSHIP_HPP
#define ASIO_EXECUTION_RELATIONSHIP_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/execution/executor.hpp"
#include "asio/is_applicable_property.hpp"
#include "asio/query.hpp"
#include "asio/traits/query_free.hpp"
#include "asio/traits/query_member.hpp"
#include "asio/traits/query_static_constexpr_member.hpp"
#include "asio/traits/static_query.hpp"
#include "asio/traits/static_require.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

#if defined(GENERATING_DOCUMENTATION)

namespace execution {

/// A property to describe whether submitted tasks represent continuations of
/// the calling context.
struct relationship_t
{
  /// The relationship_t property applies to executors.
  template <typename T>
  static constexpr bool is_applicable_property_v = is_executor_v<T>;

  /// The top-level relationship_t property cannot be required.
  static constexpr bool is_requirable = false;

  /// The top-level relationship_t property cannot be preferred.
  static constexpr bool is_preferable = false;

  /// The type returned by queries against an @c any_executor.
  typedef relationship_t polymorphic_query_result_type;

  /// A sub-property that indicates that the executor does not represent a
  /// continuation of the calling context.
  struct fork_t
  {
    /// The relationship_t::fork_t property applies to executors.
    template <typename T>
    static constexpr bool is_applicable_property_v = is_executor_v<T>;

    /// The relationship_t::fork_t property can be required.
    static constexpr bool is_requirable = true;

    /// The relationship_t::fork_t property can be preferred.
    static constexpr bool is_preferable = true;

    /// The type returned by queries against an @c any_executor.
    typedef relationship_t polymorphic_query_result_type;

    /// Default constructor.
    constexpr fork_t();

    /// Get the value associated with a property object.
    /**
     * @returns fork_t();
     */
    static constexpr relationship_t value();
  };

  /// A sub-property that indicates that the executor represents a continuation
  /// of the calling context.
  struct continuation_t
  {
    /// The relationship_t::continuation_t property applies to executors.
    template <typename T>
    static constexpr bool is_applicable_property_v = is_executor_v<T>;

    /// The relationship_t::continuation_t property can be required.
    static constexpr bool is_requirable = true;

    /// The relationship_t::continuation_t property can be preferred.
    static constexpr bool is_preferable = true;

    /// The type returned by queries against an @c any_executor.
    typedef relationship_t polymorphic_query_result_type;

    /// Default constructor.
    constexpr continuation_t();

    /// Get the value associated with a property object.
    /**
     * @returns continuation_t();
     */
    static constexpr relationship_t value();
  };

  /// A special value used for accessing the relationship_t::fork_t property.
  static constexpr fork_t fork;

  /// A special value used for accessing the relationship_t::continuation_t
  /// property.
  static constexpr continuation_t continuation;

  /// Default constructor.
  constexpr relationship_t();

  /// Construct from a sub-property value.
  constexpr relationship_t(fork_t);

  /// Construct from a sub-property value.
  constexpr relationship_t(continuation_t);

  /// Compare property values for equality.
  friend constexpr bool operator==(
      const relationship_t& a, const relationship_t& b) noexcept;

  /// Compare property values for inequality.
  friend constexpr bool operator!=(
      const relationship_t& a, const relationship_t& b) noexcept;
};

/// A special value used for accessing the relationship_t property.
constexpr relationship_t relationship;

} // namespace execution

#else // defined(GENERATING_DOCUMENTATION)

namespace execution {
namespace detail {
namespace relationship {

template <int I> struct fork_t;
template <int I> struct continuation_t;

} // namespace relationship

template <int I = 0>
struct relationship_t
{
#if defined(ASIO_HAS_VARIABLE_TEMPLATES)
  template <typename T>
  static constexpr bool is_applicable_property_v = is_executor<T>::value;
#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

  static constexpr bool is_requirable = false;
  static constexpr bool is_preferable = false;
  typedef relationship_t polymorphic_query_result_type;

  typedef detail::relationship::fork_t<I> fork_t;
  typedef detail::relationship::continuation_t<I> continuation_t;

  constexpr relationship_t()
    : value_(-1)
  {
  }

  constexpr relationship_t(fork_t)
    : value_(0)
  {
  }

  constexpr relationship_t(continuation_t)
    : value_(1)
  {
  }

  template <typename T>
  struct proxy
  {
#if defined(ASIO_HAS_DEDUCED_QUERY_MEMBER_TRAIT)
    struct type
    {
      template <typename P>
      auto query(P&& p) const
        noexcept(
          noexcept(
            declval<conditional_t<true, T, P>>().query(static_cast<P&&>(p))
          )
        )
        -> decltype(
          declval<conditional_t<true, T, P>>().query(static_cast<P&&>(p))
        );
    };
#else // defined(ASIO_HAS_DEDUCED_QUERY_MEMBER_TRAIT)
    typedef T type;
#endif // defined(ASIO_HAS_DEDUCED_QUERY_MEMBER_TRAIT)
  };

  template <typename T>
  struct static_proxy
  {
#if defined(ASIO_HAS_DEDUCED_QUERY_STATIC_CONSTEXPR_MEMBER_TRAIT)
    struct type
    {
      template <typename P>
      static constexpr auto query(P&& p)
        noexcept(
          noexcept(
            conditional_t<true, T, P>::query(static_cast<P&&>(p))
          )
        )
        -> decltype(
          conditional_t<true, T, P>::query(static_cast<P&&>(p))
        )
      {
        return T::query(static_cast<P&&>(p));
      }
    };
#else // defined(ASIO_HAS_DEDUCED_QUERY_STATIC_CONSTEXPR_MEMBER_TRAIT)
    typedef T type;
#endif // defined(ASIO_HAS_DEDUCED_QUERY_STATIC_CONSTEXPR_MEMBER_TRAIT)
  };

  template <typename T>
  struct query_member :
    traits::query_member<typename proxy<T>::type, relationship_t> {};

  template <typename T>
  struct query_static_constexpr_member :
    traits::query_static_constexpr_member<
      typename static_proxy<T>::type, relationship_t> {};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
  template <typename T>
  static constexpr
  typename query_static_constexpr_member<T>::result_type
  static_query()
    noexcept(query_static_constexpr_member<T>::is_noexcept)
  {
    return query_static_constexpr_member<T>::value();
  }

  template <typename T>
  static constexpr
  typename traits::static_query<T, fork_t>::result_type
  static_query(
      enable_if_t<
        !query_static_constexpr_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !query_member<T>::is_valid
      >* = 0,
      enable_if_t<
        traits::static_query<T, fork_t>::is_valid
      >* = 0) noexcept
  {
    return traits::static_query<T, fork_t>::value();
  }

  template <typename T>
  static constexpr
  typename traits::static_query<T, continuation_t>::result_type
  static_query(
      enable_if_t<
        !query_static_constexpr_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !query_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !traits::static_query<T, fork_t>::is_valid
      >* = 0,
      enable_if_t<
        traits::static_query<T, continuation_t>::is_valid
      >* = 0) noexcept
  {
    return traits::static_query<T, continuation_t>::value();
  }

  template <typename E,
      typename T = decltype(relationship_t::static_query<E>())>
  static constexpr const T static_query_v
    = relationship_t::static_query<E>();
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

  friend constexpr bool operator==(
      const relationship_t& a, const relationship_t& b)
  {
    return a.value_ == b.value_;
  }

  friend constexpr bool operator!=(
      const relationship_t& a, const relationship_t& b)
  {
    return a.value_ != b.value_;
  }

  struct convertible_from_relationship_t
  {
    constexpr convertible_from_relationship_t(relationship_t)
    {
    }
  };

  template <typename Executor>
  friend constexpr relationship_t query(
      const Executor& ex, convertible_from_relationship_t,
      enable_if_t<
        can_query<const Executor&, fork_t>::value
      >* = 0)
#if !defined(__clang__) // Clang crashes if noexcept is used here.
#if defined(ASIO_MSVC) // Visual C++ wants the type to be qualified.
    noexcept(is_nothrow_query<const Executor&, relationship_t<>::fork_t>::value)
#else // defined(ASIO_MSVC)
    noexcept(is_nothrow_query<const Executor&, fork_t>::value)
#endif // defined(ASIO_MSVC)
#endif // !defined(__clang__)
  {
    return asio::query(ex, fork_t());
  }

  template <typename Executor>
  friend constexpr relationship_t query(
      const Executor& ex, convertible_from_relationship_t,
      enable_if_t<
        !can_query<const Executor&, fork_t>::value
      >* = 0,
      enable_if_t<
        can_query<const Executor&, continuation_t>::value
      >* = 0)
#if !defined(__clang__) // Clang crashes if noexcept is used here.
#if defined(ASIO_MSVC) // Visual C++ wants the type to be qualified.
    noexcept(is_nothrow_query<const Executor&,
        relationship_t<>::continuation_t>::value)
#else // defined(ASIO_MSVC)
    noexcept(is_nothrow_query<const Executor&, continuation_t>::value)
#endif // defined(ASIO_MSVC)
#endif // !defined(__clang__)
  {
    return asio::query(ex, continuation_t());
  }

  ASIO_STATIC_CONSTEXPR_DEFAULT_INIT(fork_t, fork);
  ASIO_STATIC_CONSTEXPR_DEFAULT_INIT(continuation_t, continuation);

private:
  int value_;
};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
template <int I> template <typename E, typename T>
const T relationship_t<I>::static_query_v;
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

template <int I>
const typename relationship_t<I>::fork_t relationship_t<I>::fork;

template <int I>
const typename relationship_t<I>::continuation_t
relationship_t<I>::continuation;

namespace relationship {

template <int I = 0>
struct fork_t
{
#if defined(ASIO_HAS_VARIABLE_TEMPLATES)
  template <typename T>
  static constexpr bool is_applicable_property_v = is_executor<T>::value;
#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

  static constexpr bool is_requirable = true;
  static constexpr bool is_preferable = true;
  typedef relationship_t<I> polymorphic_query_result_type;

  constexpr fork_t()
  {
  }

  template <typename T>
  struct query_member :
    traits::query_member<
      typename relationship_t<I>::template proxy<T>::type, fork_t> {};

  template <typename T>
  struct query_static_constexpr_member :
    traits::query_static_constexpr_member<
      typename relationship_t<I>::template static_proxy<T>::type, fork_t> {};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
  template <typename T>
  static constexpr typename query_static_constexpr_member<T>::result_type
  static_query()
    noexcept(query_static_constexpr_member<T>::is_noexcept)
  {
    return query_static_constexpr_member<T>::value();
  }

  template <typename T>
  static constexpr fork_t static_query(
      enable_if_t<
        !query_static_constexpr_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !query_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !traits::query_free<T, fork_t>::is_valid
      >* = 0,
      enable_if_t<
        !can_query<T, continuation_t<I>>::value
      >* = 0) noexcept
  {
    return fork_t();
  }

  template <typename E, typename T = decltype(fork_t::static_query<E>())>
  static constexpr const T static_query_v
    = fork_t::static_query<E>();
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

  static constexpr relationship_t<I> value()
  {
    return fork_t();
  }

  friend constexpr bool operator==(const fork_t&, const fork_t&)
  {
    return true;
  }

  friend constexpr bool operator!=(const fork_t&, const fork_t&)
  {
    return false;
  }

  friend constexpr bool operator==(const fork_t&, const continuation_t<I>&)
  {
    return false;
  }

  friend constexpr bool operator!=(const fork_t&, const continuation_t<I>&)
  {
    return true;
  }
};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
template <int I> template <typename E, typename T>
const T fork_t<I>::static_query_v;
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

template <int I = 0>
struct continuation_t
{
#if defined(ASIO_HAS_VARIABLE_TEMPLATES)
  template <typename T>
  static constexpr bool is_applicable_property_v = is_executor<T>::value;
#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

  static constexpr bool is_requirable = true;
  static constexpr bool is_preferable = true;
  typedef relationship_t<I> polymorphic_query_result_type;

  constexpr continuation_t()
  {
  }

  template <typename T>
  struct query_member :
    traits::query_member<
      typename relationship_t<I>::template proxy<T>::type, continuation_t> {};

  template <typename T>
  struct query_static_constexpr_member :
    traits::query_static_constexpr_member<
      typename relationship_t<I>::template static_proxy<T>::type,
        continuation_t> {};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
  template <typename T>
  static constexpr typename query_static_constexpr_member<T>::result_type
  static_query()
    noexcept(query_static_constexpr_member<T>::is_noexcept)
  {
    return query_static_constexpr_member<T>::value();
  }

  template <typename E,
      typename T = decltype(continuation_t::static_query<E>())>
  static constexpr const T static_query_v
    = continuation_t::static_query<E>();
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

  static constexpr relationship_t<I> value()
  {
    return continuation_t();
  }

  friend constexpr bool operator==(const continuation_t&, const continuation_t&)
  {
    return true;
  }

  friend constexpr bool operator!=(const continuation_t&, const continuation_t&)
  {
    return false;
  }

  friend constexpr bool operator==(const continuation_t&, const fork_t<I>&)
  {
    return false;
  }

  friend constexpr bool operator!=(const continuation_t&, const fork_t<I>&)
  {
    return true;
  }
};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
template <int I> template <typename E, typename T>
const T continuation_t<I>::static_query_v;
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

} // namespace relationship
} // namespace detail

typedef detail::relationship_t<> relationship_t;

ASIO_INLINE_VARIABLE constexpr relationship_t relationship;

} // namespace execution

#if !defined(ASIO_HAS_VARIABLE_TEMPLATES)

template <typename T>
struct is_applicable_property<T, execution::relationship_t>
  : integral_constant<bool, execution::is_executor<T>::value>
{
};

template <typename T>
struct is_applicable_property<T, execution::relationship_t::fork_t>
  : integral_constant<bool, execution::is_executor<T>::value>
{
};

template <typename T>
struct is_applicable_property<T, execution::relationship_t::continuation_t>
  : integral_constant<bool, execution::is_executor<T>::value>
{
};

#endif // !defined(ASIO_HAS_VARIABLE_TEMPLATES)

namespace traits {

#if !defined(ASIO_HAS_DEDUCED_QUERY_FREE_TRAIT)

template <typename T>
struct query_free_default<T, execution::relationship_t,
  enable_if_t<
    can_query<T, execution::relationship_t::fork_t>::value
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept =
    is_nothrow_query<T, execution::relationship_t::fork_t>::value;

  typedef execution::relationship_t result_type;
};

template <typename T>
struct query_free_default<T, execution::relationship_t,
  enable_if_t<
    !can_query<T, execution::relationship_t::fork_t>::value
      && can_query<T, execution::relationship_t::continuation_t>::value
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept =
    is_nothrow_query<T, execution::relationship_t::continuation_t>::value;

  typedef execution::relationship_t result_type;
};

#endif // !defined(ASIO_HAS_DEDUCED_QUERY_FREE_TRAIT)

#if !defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  || !defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

template <typename T>
struct static_query<T, execution::relationship_t,
  enable_if_t<
    execution::detail::relationship_t<0>::
      query_static_constexpr_member<T>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename execution::detail::relationship_t<0>::
    query_static_constexpr_member<T>::result_type result_type;

  static constexpr result_type value()
  {
    return execution::detail::relationship_t<0>::
      query_static_constexpr_member<T>::value();
  }
};

template <typename T>
struct static_query<T, execution::relationship_t,
  enable_if_t<
    !execution::detail::relationship_t<0>::
        query_static_constexpr_member<T>::is_valid
      && !execution::detail::relationship_t<0>::
        query_member<T>::is_valid
      && traits::static_query<T,
        execution::relationship_t::fork_t>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename traits::static_query<T,
    execution::relationship_t::fork_t>::result_type result_type;

  static constexpr result_type value()
  {
    return traits::static_query<T,
        execution::relationship_t::fork_t>::value();
  }
};

template <typename T>
struct static_query<T, execution::relationship_t,
  enable_if_t<
    !execution::detail::relationship_t<0>::
        query_static_constexpr_member<T>::is_valid
      && !execution::detail::relationship_t<0>::
        query_member<T>::is_valid
      && !traits::static_query<T,
        execution::relationship_t::fork_t>::is_valid
      && traits::static_query<T,
        execution::relationship_t::continuation_t>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename traits::static_query<T,
    execution::relationship_t::continuation_t>::result_type result_type;

  static constexpr result_type value()
  {
    return traits::static_query<T,
        execution::relationship_t::continuation_t>::value();
  }
};

template <typename T>
struct static_query<T, execution::relationship_t::fork_t,
  enable_if_t<
    execution::detail::relationship::fork_t<0>::
      query_static_constexpr_member<T>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename execution::detail::relationship::fork_t<0>::
    query_static_constexpr_member<T>::result_type result_type;

  static constexpr result_type value()
  {
    return execution::detail::relationship::fork_t<0>::
      query_static_constexpr_member<T>::value();
  }
};

template <typename T>
struct static_query<T, execution::relationship_t::fork_t,
  enable_if_t<
    !execution::detail::relationship::fork_t<0>::
        query_static_constexpr_member<T>::is_valid
      && !execution::detail::relationship::fork_t<0>::
        query_member<T>::is_valid
      && !traits::query_free<T,
        execution::relationship_t::fork_t>::is_valid
      && !can_query<T, execution::relationship_t::continuation_t>::value
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef execution::relationship_t::fork_t result_type;

  static constexpr result_type value()
  {
    return result_type();
  }
};

template <typename T>
struct static_query<T, execution::relationship_t::continuation_t,
  enable_if_t<
    execution::detail::relationship::continuation_t<0>::
      query_static_constexpr_member<T>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename execution::detail::relationship::continuation_t<0>::
    query_static_constexpr_member<T>::result_type result_type;

  static constexpr result_type value()
  {
    return execution::detail::relationship::continuation_t<0>::
      query_static_constexpr_member<T>::value();
  }
};

#endif // !defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   || !defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

} // namespace traits

#endif // defined(GENERATING_DOCUMENTATION)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_EXECUTION_RELATIONSHIP_HPP
