//
// execution/outstanding_work.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXECUTION_OUTSTANDING_WORK_HPP
#define ASIO_EXECUTION_OUTSTANDING_WORK_HPP

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

/// A property to describe whether task submission is likely in the future.
struct outstanding_work_t
{
  /// The outstanding_work_t property applies to executors.
  template <typename T>
  static constexpr bool is_applicable_property_v = is_executor_v<T>;

  /// The top-level outstanding_work_t property cannot be required.
  static constexpr bool is_requirable = false;

  /// The top-level outstanding_work_t property cannot be preferred.
  static constexpr bool is_preferable = false;

  /// The type returned by queries against an @c any_executor.
  typedef outstanding_work_t polymorphic_query_result_type;

  /// A sub-property that indicates that the executor does not represent likely
  /// future submission of a function object.
  struct untracked_t
  {
    /// The outstanding_work_t::untracked_t property applies to executors.
    template <typename T>
    static constexpr bool is_applicable_property_v = is_executor_v<T>;

    /// The outstanding_work_t::untracked_t property can be required.
    static constexpr bool is_requirable = true;

    /// The outstanding_work_t::untracked_t property can be preferred.
    static constexpr bool is_preferable = true;

    /// The type returned by queries against an @c any_executor.
    typedef outstanding_work_t polymorphic_query_result_type;

    /// Default constructor.
    constexpr untracked_t();

    /// Get the value associated with a property object.
    /**
     * @returns untracked_t();
     */
    static constexpr outstanding_work_t value();
  };

  /// A sub-property that indicates that the executor represents likely
  /// future submission of a function object.
  struct tracked_t
  {
    /// The outstanding_work_t::untracked_t property applies to executors.
    template <typename T>
    static constexpr bool is_applicable_property_v = is_executor_v<T>;

    /// The outstanding_work_t::tracked_t property can be required.
    static constexpr bool is_requirable = true;

    /// The outstanding_work_t::tracked_t property can be preferred.
    static constexpr bool is_preferable = true;

    /// The type returned by queries against an @c any_executor.
    typedef outstanding_work_t polymorphic_query_result_type;

    /// Default constructor.
    constexpr tracked_t();

    /// Get the value associated with a property object.
    /**
     * @returns tracked_t();
     */
    static constexpr outstanding_work_t value();
  };

  /// A special value used for accessing the outstanding_work_t::untracked_t
  /// property.
  static constexpr untracked_t untracked;

  /// A special value used for accessing the outstanding_work_t::tracked_t
  /// property.
  static constexpr tracked_t tracked;

  /// Default constructor.
  constexpr outstanding_work_t();

  /// Construct from a sub-property value.
  constexpr outstanding_work_t(untracked_t);

  /// Construct from a sub-property value.
  constexpr outstanding_work_t(tracked_t);

  /// Compare property values for equality.
  friend constexpr bool operator==(
      const outstanding_work_t& a, const outstanding_work_t& b) noexcept;

  /// Compare property values for inequality.
  friend constexpr bool operator!=(
      const outstanding_work_t& a, const outstanding_work_t& b) noexcept;
};

/// A special value used for accessing the outstanding_work_t property.
constexpr outstanding_work_t outstanding_work;

} // namespace execution

#else // defined(GENERATING_DOCUMENTATION)

namespace execution {
namespace detail {
namespace outstanding_work {

template <int I> struct untracked_t;
template <int I> struct tracked_t;

} // namespace outstanding_work

template <int I = 0>
struct outstanding_work_t
{
#if defined(ASIO_HAS_VARIABLE_TEMPLATES)
  template <typename T>
  static constexpr bool is_applicable_property_v = is_executor<T>::value;
#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

  static constexpr bool is_requirable = false;
  static constexpr bool is_preferable = false;
  typedef outstanding_work_t polymorphic_query_result_type;

  typedef detail::outstanding_work::untracked_t<I> untracked_t;
  typedef detail::outstanding_work::tracked_t<I> tracked_t;

  constexpr outstanding_work_t()
    : value_(-1)
  {
  }

  constexpr outstanding_work_t(untracked_t)
    : value_(0)
  {
  }

  constexpr outstanding_work_t(tracked_t)
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
    traits::query_member<typename proxy<T>::type, outstanding_work_t> {};

  template <typename T>
  struct query_static_constexpr_member :
    traits::query_static_constexpr_member<
      typename static_proxy<T>::type, outstanding_work_t> {};

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
  typename traits::static_query<T, untracked_t>::result_type
  static_query(
      enable_if_t<
        !query_static_constexpr_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !query_member<T>::is_valid
      >* = 0,
      enable_if_t<
        traits::static_query<T, untracked_t>::is_valid
      >* = 0) noexcept
  {
    return traits::static_query<T, untracked_t>::value();
  }

  template <typename T>
  static constexpr
  typename traits::static_query<T, tracked_t>::result_type
  static_query(
      enable_if_t<
        !query_static_constexpr_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !query_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !traits::static_query<T, untracked_t>::is_valid
      >* = 0,
      enable_if_t<
        traits::static_query<T, tracked_t>::is_valid
      >* = 0) noexcept
  {
    return traits::static_query<T, tracked_t>::value();
  }

  template <typename E,
      typename T = decltype(outstanding_work_t::static_query<E>())>
  static constexpr const T static_query_v
    = outstanding_work_t::static_query<E>();
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

  friend constexpr bool operator==(
      const outstanding_work_t& a, const outstanding_work_t& b)
  {
    return a.value_ == b.value_;
  }

  friend constexpr bool operator!=(
      const outstanding_work_t& a, const outstanding_work_t& b)
  {
    return a.value_ != b.value_;
  }

  struct convertible_from_outstanding_work_t
  {
    constexpr convertible_from_outstanding_work_t(outstanding_work_t)
    {
    }
  };

  template <typename Executor>
  friend constexpr outstanding_work_t query(
      const Executor& ex, convertible_from_outstanding_work_t,
      enable_if_t<
        can_query<const Executor&, untracked_t>::value
      >* = 0)
#if !defined(__clang__) // Clang crashes if noexcept is used here.
#if defined(ASIO_MSVC) // Visual C++ wants the type to be qualified.
    noexcept(is_nothrow_query<const Executor&,
        outstanding_work_t<>::untracked_t>::value)
#else // defined(ASIO_MSVC)
    noexcept(is_nothrow_query<const Executor&, untracked_t>::value)
#endif // defined(ASIO_MSVC)
#endif // !defined(__clang__)
  {
    return asio::query(ex, untracked_t());
  }

  template <typename Executor>
  friend constexpr outstanding_work_t query(
      const Executor& ex, convertible_from_outstanding_work_t,
      enable_if_t<
        !can_query<const Executor&, untracked_t>::value
      >* = 0,
      enable_if_t<
        can_query<const Executor&, tracked_t>::value
      >* = 0)
#if !defined(__clang__) // Clang crashes if noexcept is used here.
#if defined(ASIO_MSVC) // Visual C++ wants the type to be qualified.
    noexcept(is_nothrow_query<const Executor&,
        outstanding_work_t<>::tracked_t>::value)
#else // defined(ASIO_MSVC)
    noexcept(is_nothrow_query<const Executor&, tracked_t>::value)
#endif // defined(ASIO_MSVC)
#endif // !defined(__clang__)
  {
    return asio::query(ex, tracked_t());
  }

  ASIO_STATIC_CONSTEXPR_DEFAULT_INIT(untracked_t, untracked);
  ASIO_STATIC_CONSTEXPR_DEFAULT_INIT(tracked_t, tracked);

private:
  int value_;
};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
template <int I> template <typename E, typename T>
const T outstanding_work_t<I>::static_query_v;
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

template <int I>
const typename outstanding_work_t<I>::untracked_t
outstanding_work_t<I>::untracked;

template <int I>
const typename outstanding_work_t<I>::tracked_t
outstanding_work_t<I>::tracked;

namespace outstanding_work {

template <int I = 0>
struct untracked_t
{
#if defined(ASIO_HAS_VARIABLE_TEMPLATES)
  template <typename T>
  static constexpr bool is_applicable_property_v = is_executor<T>::value;
#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

  static constexpr bool is_requirable = true;
  static constexpr bool is_preferable = true;
  typedef outstanding_work_t<I> polymorphic_query_result_type;

  constexpr untracked_t()
  {
  }

  template <typename T>
  struct query_member :
    traits::query_member<
      typename outstanding_work_t<I>::template proxy<T>::type, untracked_t> {};

  template <typename T>
  struct query_static_constexpr_member :
    traits::query_static_constexpr_member<
      typename outstanding_work_t<I>::template static_proxy<T>::type,
        untracked_t> {};

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
  static constexpr untracked_t static_query(
      enable_if_t<
        !query_static_constexpr_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !query_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !traits::query_free<T, untracked_t>::is_valid
      >* = 0,
      enable_if_t<
        !can_query<T, tracked_t<I>>::value
      >* = 0) noexcept
  {
    return untracked_t();
  }

  template <typename E, typename T = decltype(untracked_t::static_query<E>())>
  static constexpr const T static_query_v = untracked_t::static_query<E>();
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

  static constexpr outstanding_work_t<I> value()
  {
    return untracked_t();
  }

  friend constexpr bool operator==(const untracked_t&, const untracked_t&)
  {
    return true;
  }

  friend constexpr bool operator!=(const untracked_t&, const untracked_t&)
  {
    return false;
  }

  friend constexpr bool operator==(const untracked_t&, const tracked_t<I>&)
  {
    return false;
  }

  friend constexpr bool operator!=(const untracked_t&, const tracked_t<I>&)
  {
    return true;
  }
};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
template <int I> template <typename E, typename T>
const T untracked_t<I>::static_query_v;
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

template <int I = 0>
struct tracked_t
{
#if defined(ASIO_HAS_VARIABLE_TEMPLATES)
  template <typename T>
  static constexpr bool is_applicable_property_v = is_executor<T>::value;
#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

  static constexpr bool is_requirable = true;
  static constexpr bool is_preferable = true;
  typedef outstanding_work_t<I> polymorphic_query_result_type;

  constexpr tracked_t()
  {
  }

  template <typename T>
  struct query_member :
    traits::query_member<
      typename outstanding_work_t<I>::template proxy<T>::type, tracked_t> {};

  template <typename T>
  struct query_static_constexpr_member :
    traits::query_static_constexpr_member<
      typename outstanding_work_t<I>::template static_proxy<T>::type,
        tracked_t> {};

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

  template <typename E, typename T = decltype(tracked_t::static_query<E>())>
  static constexpr const T static_query_v = tracked_t::static_query<E>();
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

  static constexpr outstanding_work_t<I> value()
  {
    return tracked_t();
  }

  friend constexpr bool operator==(const tracked_t&, const tracked_t&)
  {
    return true;
  }

  friend constexpr bool operator!=(const tracked_t&, const tracked_t&)
  {
    return false;
  }

  friend constexpr bool operator==(const tracked_t&, const untracked_t<I>&)
  {
    return false;
  }

  friend constexpr bool operator!=(const tracked_t&, const untracked_t<I>&)
  {
    return true;
  }
};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
template <int I> template <typename E, typename T>
const T tracked_t<I>::static_query_v;
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

} // namespace outstanding_work
} // namespace detail

typedef detail::outstanding_work_t<> outstanding_work_t;

ASIO_INLINE_VARIABLE constexpr outstanding_work_t outstanding_work;

} // namespace execution

#if !defined(ASIO_HAS_VARIABLE_TEMPLATES)

template <typename T>
struct is_applicable_property<T, execution::outstanding_work_t>
  : integral_constant<bool, execution::is_executor<T>::value>
{
};

template <typename T>
struct is_applicable_property<T, execution::outstanding_work_t::untracked_t>
  : integral_constant<bool, execution::is_executor<T>::value>
{
};

template <typename T>
struct is_applicable_property<T, execution::outstanding_work_t::tracked_t>
  : integral_constant<bool, execution::is_executor<T>::value>
{
};

#endif // !defined(ASIO_HAS_VARIABLE_TEMPLATES)

namespace traits {

#if !defined(ASIO_HAS_DEDUCED_QUERY_FREE_TRAIT)

template <typename T>
struct query_free_default<T, execution::outstanding_work_t,
  enable_if_t<
    can_query<T, execution::outstanding_work_t::untracked_t>::value
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept =
    is_nothrow_query<T, execution::outstanding_work_t::untracked_t>::value;

  typedef execution::outstanding_work_t result_type;
};

template <typename T>
struct query_free_default<T, execution::outstanding_work_t,
  enable_if_t<
    !can_query<T, execution::outstanding_work_t::untracked_t>::value
      && can_query<T, execution::outstanding_work_t::tracked_t>::value
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept =
    is_nothrow_query<T, execution::outstanding_work_t::tracked_t>::value;

  typedef execution::outstanding_work_t result_type;
};

#endif // !defined(ASIO_HAS_DEDUCED_QUERY_FREE_TRAIT)

#if !defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  || !defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

template <typename T>
struct static_query<T, execution::outstanding_work_t,
  enable_if_t<
    execution::detail::outstanding_work_t<0>::
      query_static_constexpr_member<T>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename execution::detail::outstanding_work_t<0>::
    query_static_constexpr_member<T>::result_type result_type;

  static constexpr result_type value()
  {
    return execution::detail::outstanding_work_t<0>::
      query_static_constexpr_member<T>::value();
  }
};

template <typename T>
struct static_query<T, execution::outstanding_work_t,
  enable_if_t<
    !execution::detail::outstanding_work_t<0>::
        query_static_constexpr_member<T>::is_valid
      && !execution::detail::outstanding_work_t<0>::
        query_member<T>::is_valid
      && traits::static_query<T,
        execution::outstanding_work_t::untracked_t>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename traits::static_query<T,
    execution::outstanding_work_t::untracked_t>::result_type result_type;

  static constexpr result_type value()
  {
    return traits::static_query<T,
        execution::outstanding_work_t::untracked_t>::value();
  }
};

template <typename T>
struct static_query<T, execution::outstanding_work_t,
  enable_if_t<
    !execution::detail::outstanding_work_t<0>::
        query_static_constexpr_member<T>::is_valid
      && !execution::detail::outstanding_work_t<0>::
        query_member<T>::is_valid
      && !traits::static_query<T,
        execution::outstanding_work_t::untracked_t>::is_valid
      && traits::static_query<T,
        execution::outstanding_work_t::tracked_t>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename traits::static_query<T,
    execution::outstanding_work_t::tracked_t>::result_type result_type;

  static constexpr result_type value()
  {
    return traits::static_query<T,
        execution::outstanding_work_t::tracked_t>::value();
  }
};

template <typename T>
struct static_query<T, execution::outstanding_work_t::untracked_t,
  enable_if_t<
    execution::detail::outstanding_work::untracked_t<0>::
      query_static_constexpr_member<T>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename execution::detail::outstanding_work::untracked_t<0>::
    query_static_constexpr_member<T>::result_type result_type;

  static constexpr result_type value()
  {
    return execution::detail::outstanding_work::untracked_t<0>::
      query_static_constexpr_member<T>::value();
  }
};

template <typename T>
struct static_query<T, execution::outstanding_work_t::untracked_t,
  enable_if_t<
    !execution::detail::outstanding_work::untracked_t<0>::
        query_static_constexpr_member<T>::is_valid
      && !execution::detail::outstanding_work::untracked_t<0>::
          query_member<T>::is_valid
      && !traits::query_free<T,
        execution::outstanding_work_t::untracked_t>::is_valid
      && !can_query<T, execution::outstanding_work_t::tracked_t>::value
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef execution::outstanding_work_t::untracked_t result_type;

  static constexpr result_type value()
  {
    return result_type();
  }
};

template <typename T>
struct static_query<T, execution::outstanding_work_t::tracked_t,
  enable_if_t<
    execution::detail::outstanding_work::tracked_t<0>::
      query_static_constexpr_member<T>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename execution::detail::outstanding_work::tracked_t<0>::
    query_static_constexpr_member<T>::result_type result_type;

  static constexpr result_type value()
  {
    return execution::detail::outstanding_work::tracked_t<0>::
      query_static_constexpr_member<T>::value();
  }
};

#endif // !defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   || !defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

} // namespace traits

#endif // defined(GENERATING_DOCUMENTATION)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_EXECUTION_OUTSTANDING_WORK_HPP
