//
// execution/mapping.hpp
// ~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXECUTION_MAPPING_HPP
#define ASIO_EXECUTION_MAPPING_HPP

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

/// A property to describe what guarantees an executor makes about the mapping
/// of execution agents on to threads of execution.
struct mapping_t
{
  /// The mapping_t property applies to executors.
  template <typename T>
  static constexpr bool is_applicable_property_v = is_executor_v<T>;

  /// The top-level mapping_t property cannot be required.
  static constexpr bool is_requirable = false;

  /// The top-level mapping_t property cannot be preferred.
  static constexpr bool is_preferable = false;

  /// The type returned by queries against an @c any_executor.
  typedef mapping_t polymorphic_query_result_type;

  /// A sub-property that indicates that execution agents are mapped on to
  /// threads of execution.
  struct thread_t
  {
    /// The mapping_t::thread_t property applies to executors.
    template <typename T>
    static constexpr bool is_applicable_property_v = is_executor_v<T>;

    /// The mapping_t::thread_t property can be required.
    static constexpr bool is_requirable = true;

    /// The mapping_t::thread_t property can be preferred.
    static constexpr bool is_preferable = true;

    /// The type returned by queries against an @c any_executor.
    typedef mapping_t polymorphic_query_result_type;

    /// Default constructor.
    constexpr thread_t();

    /// Get the value associated with a property object.
    /**
     * @returns thread_t();
     */
    static constexpr mapping_t value();
  };

  /// A sub-property that indicates that execution agents are mapped on to
  /// new threads of execution.
  struct new_thread_t
  {
    /// The mapping_t::new_thread_t property applies to executors.
    template <typename T>
    static constexpr bool is_applicable_property_v = is_executor_v<T>;

    /// The mapping_t::new_thread_t property can be required.
    static constexpr bool is_requirable = true;

    /// The mapping_t::new_thread_t property can be preferred.
    static constexpr bool is_preferable = true;

    /// The type returned by queries against an @c any_executor.
    typedef mapping_t polymorphic_query_result_type;

    /// Default constructor.
    constexpr new_thread_t();

    /// Get the value associated with a property object.
    /**
     * @returns new_thread_t();
     */
    static constexpr mapping_t value();
  };

  /// A sub-property that indicates that the mapping of execution agents is
  /// implementation-defined.
  struct other_t
  {
    /// The mapping_t::other_t property applies to executors.
    template <typename T>
    static constexpr bool is_applicable_property_v = is_executor_v<T>;

    /// The mapping_t::other_t property can be required.
    static constexpr bool is_requirable = true;

    /// The mapping_t::other_t property can be preferred.
    static constexpr bool is_preferable = true;

    /// The type returned by queries against an @c any_executor.
    typedef mapping_t polymorphic_query_result_type;

    /// Default constructor.
    constexpr other_t();

    /// Get the value associated with a property object.
    /**
     * @returns other_t();
     */
    static constexpr mapping_t value();
  };

  /// A special value used for accessing the mapping_t::thread_t property.
  static constexpr thread_t thread;

  /// A special value used for accessing the mapping_t::new_thread_t property.
  static constexpr new_thread_t new_thread;

  /// A special value used for accessing the mapping_t::other_t property.
  static constexpr other_t other;

  /// Default constructor.
  constexpr mapping_t();

  /// Construct from a sub-property value.
  constexpr mapping_t(thread_t);

  /// Construct from a sub-property value.
  constexpr mapping_t(new_thread_t);

  /// Construct from a sub-property value.
  constexpr mapping_t(other_t);

  /// Compare property values for equality.
  friend constexpr bool operator==(
      const mapping_t& a, const mapping_t& b) noexcept;

  /// Compare property values for inequality.
  friend constexpr bool operator!=(
      const mapping_t& a, const mapping_t& b) noexcept;
};

/// A special value used for accessing the mapping_t property.
constexpr mapping_t mapping;

} // namespace execution

#else // defined(GENERATING_DOCUMENTATION)

namespace execution {
namespace detail {
namespace mapping {

template <int I> struct thread_t;
template <int I> struct new_thread_t;
template <int I> struct other_t;

} // namespace mapping

template <int I = 0>
struct mapping_t
{
#if defined(ASIO_HAS_VARIABLE_TEMPLATES)
  template <typename T>
  static constexpr bool is_applicable_property_v = is_executor<T>::value;
#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

  static constexpr bool is_requirable = false;
  static constexpr bool is_preferable = false;
  typedef mapping_t polymorphic_query_result_type;

  typedef detail::mapping::thread_t<I> thread_t;
  typedef detail::mapping::new_thread_t<I> new_thread_t;
  typedef detail::mapping::other_t<I> other_t;

  constexpr mapping_t()
    : value_(-1)
  {
  }

  constexpr mapping_t(thread_t)
    : value_(0)
  {
  }

  constexpr mapping_t(new_thread_t)
    : value_(1)
  {
  }

  constexpr mapping_t(other_t)
    : value_(2)
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
    traits::query_member<typename proxy<T>::type, mapping_t> {};

  template <typename T>
  struct query_static_constexpr_member :
    traits::query_static_constexpr_member<
      typename static_proxy<T>::type, mapping_t> {};

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
  typename traits::static_query<T, thread_t>::result_type
  static_query(
      enable_if_t<
        !query_static_constexpr_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !query_member<T>::is_valid
      >* = 0,
      enable_if_t<
        traits::static_query<T, thread_t>::is_valid
      >* = 0) noexcept
  {
    return traits::static_query<T, thread_t>::value();
  }

  template <typename T>
  static constexpr
  typename traits::static_query<T, new_thread_t>::result_type
  static_query(
      enable_if_t<
        !query_static_constexpr_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !query_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !traits::static_query<T, thread_t>::is_valid
      >* = 0,
      enable_if_t<
        traits::static_query<T, new_thread_t>::is_valid
      >* = 0) noexcept
  {
    return traits::static_query<T, new_thread_t>::value();
  }

  template <typename T>
  static constexpr
  typename traits::static_query<T, other_t>::result_type
  static_query(
      enable_if_t<
        !query_static_constexpr_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !query_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !traits::static_query<T, thread_t>::is_valid
      >* = 0,
      enable_if_t<
        !traits::static_query<T, new_thread_t>::is_valid
      >* = 0,
      enable_if_t<
        traits::static_query<T, other_t>::is_valid
      >* = 0) noexcept
  {
    return traits::static_query<T, other_t>::value();
  }

  template <typename E, typename T = decltype(mapping_t::static_query<E>())>
  static constexpr const T static_query_v
    = mapping_t::static_query<E>();
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

  friend constexpr bool operator==(
      const mapping_t& a, const mapping_t& b)
  {
    return a.value_ == b.value_;
  }

  friend constexpr bool operator!=(
      const mapping_t& a, const mapping_t& b)
  {
    return a.value_ != b.value_;
  }

  struct convertible_from_mapping_t
  {
    constexpr convertible_from_mapping_t(mapping_t) {}
  };

  template <typename Executor>
  friend constexpr mapping_t query(
      const Executor& ex, convertible_from_mapping_t,
      enable_if_t<
        can_query<const Executor&, thread_t>::value
      >* = 0)
#if !defined(__clang__) // Clang crashes if noexcept is used here.
#if defined(ASIO_MSVC) // Visual C++ wants the type to be qualified.
    noexcept(is_nothrow_query<const Executor&, mapping_t<>::thread_t>::value)
#else // defined(ASIO_MSVC)
    noexcept(is_nothrow_query<const Executor&, thread_t>::value)
#endif // defined(ASIO_MSVC)
#endif // !defined(__clang__)
  {
    return asio::query(ex, thread_t());
  }

  template <typename Executor>
  friend constexpr mapping_t query(
      const Executor& ex, convertible_from_mapping_t,
      enable_if_t<
        !can_query<const Executor&, thread_t>::value
      >* = 0,
      enable_if_t<
        can_query<const Executor&, new_thread_t>::value
      >* = 0)
#if !defined(__clang__) // Clang crashes if noexcept is used here.
#if defined(ASIO_MSVC) // Visual C++ wants the type to be qualified.
    noexcept(
      is_nothrow_query<const Executor&, mapping_t<>::new_thread_t>::value)
#else // defined(ASIO_MSVC)
    noexcept(is_nothrow_query<const Executor&, new_thread_t>::value)
#endif // defined(ASIO_MSVC)
#endif // !defined(__clang__)
  {
    return asio::query(ex, new_thread_t());
  }

  template <typename Executor>
  friend constexpr mapping_t query(
      const Executor& ex, convertible_from_mapping_t,
      enable_if_t<
        !can_query<const Executor&, thread_t>::value
      >* = 0,
      enable_if_t<
        !can_query<const Executor&, new_thread_t>::value
      >* = 0,
      enable_if_t<
        can_query<const Executor&, other_t>::value
      >* = 0)
#if !defined(__clang__) // Clang crashes if noexcept is used here.
#if defined(ASIO_MSVC) // Visual C++ wants the type to be qualified.
    noexcept(is_nothrow_query<const Executor&, mapping_t<>::other_t>::value)
#else // defined(ASIO_MSVC)
    noexcept(is_nothrow_query<const Executor&, other_t>::value)
#endif // defined(ASIO_MSVC)
#endif // !defined(__clang__)
  {
    return asio::query(ex, other_t());
  }

  ASIO_STATIC_CONSTEXPR_DEFAULT_INIT(thread_t, thread);
  ASIO_STATIC_CONSTEXPR_DEFAULT_INIT(new_thread_t, new_thread);
  ASIO_STATIC_CONSTEXPR_DEFAULT_INIT(other_t, other);

private:
  int value_;
};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
template <int I> template <typename E, typename T>
const T mapping_t<I>::static_query_v;
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

template <int I>
const typename mapping_t<I>::thread_t mapping_t<I>::thread;

template <int I>
const typename mapping_t<I>::new_thread_t mapping_t<I>::new_thread;

template <int I>
const typename mapping_t<I>::other_t mapping_t<I>::other;

namespace mapping {

template <int I = 0>
struct thread_t
{
#if defined(ASIO_HAS_VARIABLE_TEMPLATES)
  template <typename T>
  static constexpr bool is_applicable_property_v = is_executor<T>::value;
#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

  static constexpr bool is_requirable = true;
  static constexpr bool is_preferable = true;
  typedef mapping_t<I> polymorphic_query_result_type;

  constexpr thread_t()
  {
  }

  template <typename T>
  struct query_member :
    traits::query_member<
      typename mapping_t<I>::template proxy<T>::type, thread_t> {};

  template <typename T>
  struct query_static_constexpr_member :
    traits::query_static_constexpr_member<
      typename mapping_t<I>::template static_proxy<T>::type, thread_t> {};

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
  static constexpr thread_t static_query(
      enable_if_t<
        !query_static_constexpr_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !query_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !traits::query_free<T, thread_t>::is_valid
      >* = 0,
      enable_if_t<
        !can_query<T, new_thread_t<I>>::value
      >* = 0,
      enable_if_t<
        !can_query<T, other_t<I>>::value
      >* = 0) noexcept
  {
    return thread_t();
  }

  template <typename E, typename T = decltype(thread_t::static_query<E>())>
  static constexpr const T static_query_v
    = thread_t::static_query<E>();
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

  static constexpr mapping_t<I> value()
  {
    return thread_t();
  }

  friend constexpr bool operator==(const thread_t&, const thread_t&)
  {
    return true;
  }

  friend constexpr bool operator!=(const thread_t&, const thread_t&)
  {
    return false;
  }

  friend constexpr bool operator==(const thread_t&, const new_thread_t<I>&)
  {
    return false;
  }

  friend constexpr bool operator!=(const thread_t&, const new_thread_t<I>&)
  {
    return true;
  }

  friend constexpr bool operator==(const thread_t&, const other_t<I>&)
  {
    return false;
  }

  friend constexpr bool operator!=(const thread_t&, const other_t<I>&)
  {
    return true;
  }
};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
template <int I> template <typename E, typename T>
const T thread_t<I>::static_query_v;
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

template <int I = 0>
struct new_thread_t
{
#if defined(ASIO_HAS_VARIABLE_TEMPLATES)
  template <typename T>
  static constexpr bool is_applicable_property_v = is_executor<T>::value;
#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

  static constexpr bool is_requirable = true;
  static constexpr bool is_preferable = true;
  typedef mapping_t<I> polymorphic_query_result_type;

  constexpr new_thread_t()
  {
  }

  template <typename T>
  struct query_member :
    traits::query_member<
      typename mapping_t<I>::template proxy<T>::type, new_thread_t> {};

  template <typename T>
  struct query_static_constexpr_member :
    traits::query_static_constexpr_member<
      typename mapping_t<I>::template static_proxy<T>::type, new_thread_t> {};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
  template <typename T>
  static constexpr typename query_static_constexpr_member<T>::result_type
  static_query()
    noexcept(query_static_constexpr_member<T>::is_noexcept)
  {
    return query_static_constexpr_member<T>::value();
  }

  template <typename E, typename T = decltype(new_thread_t::static_query<E>())>
  static constexpr const T static_query_v = new_thread_t::static_query<E>();
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

  static constexpr mapping_t<I> value()
  {
    return new_thread_t();
  }

  friend constexpr bool operator==(const new_thread_t&, const new_thread_t&)
  {
    return true;
  }

  friend constexpr bool operator!=(const new_thread_t&, const new_thread_t&)
  {
    return false;
  }

  friend constexpr bool operator==(const new_thread_t&, const thread_t<I>&)
  {
    return false;
  }

  friend constexpr bool operator!=(const new_thread_t&, const thread_t<I>&)
  {
    return true;
  }

  friend constexpr bool operator==(const new_thread_t&, const other_t<I>&)
  {
    return false;
  }

  friend constexpr bool operator!=(const new_thread_t&, const other_t<I>&)
  {
    return true;
  }
};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
template <int I> template <typename E, typename T>
const T new_thread_t<I>::static_query_v;
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

template <int I>
struct other_t
{
#if defined(ASIO_HAS_VARIABLE_TEMPLATES)
  template <typename T>
  static constexpr bool is_applicable_property_v = is_executor<T>::value;
#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

  static constexpr bool is_requirable = true;
  static constexpr bool is_preferable = true;
  typedef mapping_t<I> polymorphic_query_result_type;

  constexpr other_t()
  {
  }

  template <typename T>
  struct query_member :
    traits::query_member<
      typename mapping_t<I>::template proxy<T>::type, other_t> {};

  template <typename T>
  struct query_static_constexpr_member :
    traits::query_static_constexpr_member<
      typename mapping_t<I>::template static_proxy<T>::type, other_t> {};

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

  template <typename E, typename T = decltype(other_t::static_query<E>())>
  static constexpr const T static_query_v = other_t::static_query<E>();
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

  static constexpr mapping_t<I> value()
  {
    return other_t();
  }

  friend constexpr bool operator==(const other_t&, const other_t&)
  {
    return true;
  }

  friend constexpr bool operator!=(const other_t&, const other_t&)
  {
    return false;
  }

  friend constexpr bool operator==(const other_t&, const thread_t<I>&)
  {
    return false;
  }

  friend constexpr bool operator!=(const other_t&, const thread_t<I>&)
  {
    return true;
  }

  friend constexpr bool operator==(const other_t&, const new_thread_t<I>&)
  {
    return false;
  }

  friend constexpr bool operator!=(const other_t&, const new_thread_t<I>&)
  {
    return true;
  }
};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
template <int I> template <typename E, typename T>
const T other_t<I>::static_query_v;
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

} // namespace mapping
} // namespace detail

typedef detail::mapping_t<> mapping_t;

ASIO_INLINE_VARIABLE constexpr mapping_t mapping;

} // namespace execution

#if !defined(ASIO_HAS_VARIABLE_TEMPLATES)

template <typename T>
struct is_applicable_property<T, execution::mapping_t>
  : integral_constant<bool, execution::is_executor<T>::value>
{
};

template <typename T>
struct is_applicable_property<T, execution::mapping_t::thread_t>
  : integral_constant<bool, execution::is_executor<T>::value>
{
};

template <typename T>
struct is_applicable_property<T, execution::mapping_t::new_thread_t>
  : integral_constant<bool, execution::is_executor<T>::value>
{
};

template <typename T>
struct is_applicable_property<T, execution::mapping_t::other_t>
  : integral_constant<bool, execution::is_executor<T>::value>
{
};

#endif // !defined(ASIO_HAS_VARIABLE_TEMPLATES)

namespace traits {

#if !defined(ASIO_HAS_DEDUCED_QUERY_FREE_TRAIT)

template <typename T>
struct query_free_default<T, execution::mapping_t,
  enable_if_t<
    can_query<T, execution::mapping_t::thread_t>::value
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept =
    is_nothrow_query<T, execution::mapping_t::thread_t>::value;

  typedef execution::mapping_t result_type;
};

template <typename T>
struct query_free_default<T, execution::mapping_t,
  enable_if_t<
    !can_query<T, execution::mapping_t::thread_t>::value
      && can_query<T, execution::mapping_t::new_thread_t>::value
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept =
    is_nothrow_query<T, execution::mapping_t::new_thread_t>::value;

  typedef execution::mapping_t result_type;
};

template <typename T>
struct query_free_default<T, execution::mapping_t,
  enable_if_t<
    !can_query<T, execution::mapping_t::thread_t>::value
      && !can_query<T, execution::mapping_t::new_thread_t>::value
      && can_query<T, execution::mapping_t::other_t>::value
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept =
    is_nothrow_query<T, execution::mapping_t::other_t>::value;

  typedef execution::mapping_t result_type;
};

#endif // !defined(ASIO_HAS_DEDUCED_QUERY_FREE_TRAIT)

#if !defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  || !defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

template <typename T>
struct static_query<T, execution::mapping_t,
  enable_if_t<
    execution::detail::mapping_t<0>::
      query_static_constexpr_member<T>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename execution::detail::mapping_t<0>::
    query_static_constexpr_member<T>::result_type result_type;

  static constexpr result_type value()
  {
    return execution::detail::mapping_t<0>::
      query_static_constexpr_member<T>::value();
  }
};

template <typename T>
struct static_query<T, execution::mapping_t,
  enable_if_t<
    !execution::detail::mapping_t<0>::
        query_static_constexpr_member<T>::is_valid
      && !execution::detail::mapping_t<0>::
        query_member<T>::is_valid
      && traits::static_query<T, execution::mapping_t::thread_t>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename traits::static_query<T,
    execution::mapping_t::thread_t>::result_type result_type;

  static constexpr result_type value()
  {
    return traits::static_query<T, execution::mapping_t::thread_t>::value();
  }
};

template <typename T>
struct static_query<T, execution::mapping_t,
  enable_if_t<
    !execution::detail::mapping_t<0>::
        query_static_constexpr_member<T>::is_valid
      && !execution::detail::mapping_t<0>::
        query_member<T>::is_valid
      && !traits::static_query<T, execution::mapping_t::thread_t>::is_valid
      && traits::static_query<T, execution::mapping_t::new_thread_t>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename traits::static_query<T,
    execution::mapping_t::new_thread_t>::result_type result_type;

  static constexpr result_type value()
  {
    return traits::static_query<T, execution::mapping_t::new_thread_t>::value();
  }
};

template <typename T>
struct static_query<T, execution::mapping_t,
  enable_if_t<
    !execution::detail::mapping_t<0>::
        query_static_constexpr_member<T>::is_valid
      && !execution::detail::mapping_t<0>::
        query_member<T>::is_valid
      && !traits::static_query<T, execution::mapping_t::thread_t>::is_valid
      && !traits::static_query<T, execution::mapping_t::new_thread_t>::is_valid
      && traits::static_query<T, execution::mapping_t::other_t>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename traits::static_query<T,
    execution::mapping_t::other_t>::result_type result_type;

  static constexpr result_type value()
  {
    return traits::static_query<T, execution::mapping_t::other_t>::value();
  }
};

template <typename T>
struct static_query<T, execution::mapping_t::thread_t,
  enable_if_t<
    execution::detail::mapping::thread_t<0>::
      query_static_constexpr_member<T>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename execution::detail::mapping::thread_t<0>::
    query_static_constexpr_member<T>::result_type result_type;

  static constexpr result_type value()
  {
    return execution::detail::mapping::thread_t<0>::
      query_static_constexpr_member<T>::value();
  }
};

template <typename T>
struct static_query<T, execution::mapping_t::thread_t,
  enable_if_t<
    !execution::detail::mapping::thread_t<0>::
        query_static_constexpr_member<T>::is_valid
      && !execution::detail::mapping::thread_t<0>::
        query_member<T>::is_valid
      && !traits::query_free<T, execution::mapping_t::thread_t>::is_valid
      && !can_query<T, execution::mapping_t::new_thread_t>::value
      && !can_query<T, execution::mapping_t::other_t>::value
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef execution::mapping_t::thread_t result_type;

  static constexpr result_type value()
  {
    return result_type();
  }
};

template <typename T>
struct static_query<T, execution::mapping_t::new_thread_t,
  enable_if_t<
    execution::detail::mapping::new_thread_t<0>::
      query_static_constexpr_member<T>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename execution::detail::mapping::new_thread_t<0>::
    query_static_constexpr_member<T>::result_type result_type;

  static constexpr result_type value()
  {
    return execution::detail::mapping::new_thread_t<0>::
      query_static_constexpr_member<T>::value();
  }
};

template <typename T>
struct static_query<T, execution::mapping_t::other_t,
  enable_if_t<
    execution::detail::mapping::other_t<0>::
      query_static_constexpr_member<T>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename execution::detail::mapping::other_t<0>::
    query_static_constexpr_member<T>::result_type result_type;

  static constexpr result_type value()
  {
    return execution::detail::mapping::other_t<0>::
      query_static_constexpr_member<T>::value();
  }
};

#endif // !defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   || !defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

} // namespace traits

#endif // defined(GENERATING_DOCUMENTATION)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_EXECUTION_MAPPING_HPP
