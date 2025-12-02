//
// execution/blocking_adaptation.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXECUTION_BLOCKING_ADAPTATION_HPP
#define ASIO_EXECUTION_BLOCKING_ADAPTATION_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/event.hpp"
#include "asio/detail/mutex.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/execution/executor.hpp"
#include "asio/is_applicable_property.hpp"
#include "asio/prefer.hpp"
#include "asio/query.hpp"
#include "asio/require.hpp"
#include "asio/traits/prefer_member.hpp"
#include "asio/traits/query_free.hpp"
#include "asio/traits/query_member.hpp"
#include "asio/traits/query_static_constexpr_member.hpp"
#include "asio/traits/require_member.hpp"
#include "asio/traits/static_query.hpp"
#include "asio/traits/static_require.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

#if defined(GENERATING_DOCUMENTATION)

namespace execution {

/// A property to describe whether automatic adaptation of an executor is
/// allowed in order to apply the blocking_adaptation_t::allowed_t property.
struct blocking_adaptation_t
{
  /// The blocking_adaptation_t property applies to executors.
  template <typename T>
  static constexpr bool is_applicable_property_v = is_executor_v<T>;

  /// The top-level blocking_adaptation_t property cannot be required.
  static constexpr bool is_requirable = false;

  /// The top-level blocking_adaptation_t property cannot be preferred.
  static constexpr bool is_preferable = false;

  /// The type returned by queries against an @c any_executor.
  typedef blocking_adaptation_t polymorphic_query_result_type;

  /// A sub-property that indicates that automatic adaptation is not allowed.
  struct disallowed_t
  {
    /// The blocking_adaptation_t::disallowed_t property applies to executors.
    template <typename T>
    static constexpr bool is_applicable_property_v = is_executor_v<T>;

    /// The blocking_adaptation_t::disallowed_t property can be required.
    static constexpr bool is_requirable = true;

    /// The blocking_adaptation_t::disallowed_t property can be preferred.
    static constexpr bool is_preferable = true;

    /// The type returned by queries against an @c any_executor.
    typedef blocking_adaptation_t polymorphic_query_result_type;

    /// Default constructor.
    constexpr disallowed_t();

    /// Get the value associated with a property object.
    /**
     * @returns disallowed_t();
     */
    static constexpr blocking_adaptation_t value();
  };

  /// A sub-property that indicates that automatic adaptation is allowed.
  struct allowed_t
  {
    /// The blocking_adaptation_t::allowed_t property applies to executors.
    template <typename T>
    static constexpr bool is_applicable_property_v = is_executor_v<T>;

    /// The blocking_adaptation_t::allowed_t property can be required.
    static constexpr bool is_requirable = true;

    /// The blocking_adaptation_t::allowed_t property can be preferred.
    static constexpr bool is_preferable = false;

    /// The type returned by queries against an @c any_executor.
    typedef blocking_adaptation_t polymorphic_query_result_type;

    /// Default constructor.
    constexpr allowed_t();

    /// Get the value associated with a property object.
    /**
     * @returns allowed_t();
     */
    static constexpr blocking_adaptation_t value();
  };

  /// A special value used for accessing the blocking_adaptation_t::disallowed_t
  /// property.
  static constexpr disallowed_t disallowed;

  /// A special value used for accessing the blocking_adaptation_t::allowed_t
  /// property.
  static constexpr allowed_t allowed;

  /// Default constructor.
  constexpr blocking_adaptation_t();

  /// Construct from a sub-property value.
  constexpr blocking_adaptation_t(disallowed_t);

  /// Construct from a sub-property value.
  constexpr blocking_adaptation_t(allowed_t);

  /// Compare property values for equality.
  friend constexpr bool operator==(
      const blocking_adaptation_t& a, const blocking_adaptation_t& b) noexcept;

  /// Compare property values for inequality.
  friend constexpr bool operator!=(
      const blocking_adaptation_t& a, const blocking_adaptation_t& b) noexcept;
};

/// A special value used for accessing the blocking_adaptation_t property.
constexpr blocking_adaptation_t blocking_adaptation;

} // namespace execution

#else // defined(GENERATING_DOCUMENTATION)

namespace execution {
namespace detail {
namespace blocking_adaptation {

template <int I> struct disallowed_t;
template <int I> struct allowed_t;

} // namespace blocking_adaptation

template <int I = 0>
struct blocking_adaptation_t
{
#if defined(ASIO_HAS_VARIABLE_TEMPLATES)
  template <typename T>
  static constexpr bool is_applicable_property_v = is_executor<T>::value;
#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

  static constexpr bool is_requirable = false;
  static constexpr bool is_preferable = false;
  typedef blocking_adaptation_t polymorphic_query_result_type;

  typedef detail::blocking_adaptation::disallowed_t<I> disallowed_t;
  typedef detail::blocking_adaptation::allowed_t<I> allowed_t;

  constexpr blocking_adaptation_t()
    : value_(-1)
  {
  }

  constexpr blocking_adaptation_t(disallowed_t)
    : value_(0)
  {
  }

  constexpr blocking_adaptation_t(allowed_t)
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
    traits::query_member<typename proxy<T>::type, blocking_adaptation_t> {};

  template <typename T>
  struct query_static_constexpr_member :
    traits::query_static_constexpr_member<
      typename static_proxy<T>::type, blocking_adaptation_t> {};

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
  static constexpr
  typename traits::static_query<T, disallowed_t>::result_type
  static_query(
      enable_if_t<
        !query_static_constexpr_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !query_member<T>::is_valid
      >* = 0,
      enable_if_t<
        traits::static_query<T, disallowed_t>::is_valid
      >* = 0) noexcept
  {
    return traits::static_query<T, disallowed_t>::value();
  }

  template <typename T>
  static constexpr
  typename traits::static_query<T, allowed_t>::result_type
  static_query(
      enable_if_t<
        !query_static_constexpr_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !query_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !traits::static_query<T, disallowed_t>::is_valid
      >* = 0,
      enable_if_t<
        traits::static_query<T, allowed_t>::is_valid
      >* = 0) noexcept
  {
    return traits::static_query<T, allowed_t>::value();
  }

  template <typename E,
      typename T = decltype(blocking_adaptation_t::static_query<E>())>
  static constexpr const T static_query_v
    = blocking_adaptation_t::static_query<E>();
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

  friend constexpr bool operator==(
      const blocking_adaptation_t& a, const blocking_adaptation_t& b)
  {
    return a.value_ == b.value_;
  }

  friend constexpr bool operator!=(
      const blocking_adaptation_t& a, const blocking_adaptation_t& b)
  {
    return a.value_ != b.value_;
  }

  struct convertible_from_blocking_adaptation_t
  {
    constexpr convertible_from_blocking_adaptation_t(
        blocking_adaptation_t)
    {
    }
  };

  template <typename Executor>
  friend constexpr blocking_adaptation_t query(
      const Executor& ex, convertible_from_blocking_adaptation_t,
      enable_if_t<
        can_query<const Executor&, disallowed_t>::value
      >* = 0)
#if !defined(__clang__) // Clang crashes if noexcept is used here.
#if defined(ASIO_MSVC) // Visual C++ wants the type to be qualified.
    noexcept(is_nothrow_query<const Executor&,
        blocking_adaptation_t<>::disallowed_t>::value)
#else // defined(ASIO_MSVC)
    noexcept(is_nothrow_query<const Executor&, disallowed_t>::value)
#endif // defined(ASIO_MSVC)
#endif // !defined(__clang__)
  {
    return asio::query(ex, disallowed_t());
  }

  template <typename Executor>
  friend constexpr blocking_adaptation_t query(
      const Executor& ex, convertible_from_blocking_adaptation_t,
      enable_if_t<
        !can_query<const Executor&, disallowed_t>::value
      >* = 0,
      enable_if_t<
        can_query<const Executor&, allowed_t>::value
      >* = 0)
#if !defined(__clang__) // Clang crashes if noexcept is used here.
#if defined(ASIO_MSVC) // Visual C++ wants the type to be qualified.
    noexcept(is_nothrow_query<const Executor&,
        blocking_adaptation_t<>::allowed_t>::value)
#else // defined(ASIO_MSVC)
    noexcept(is_nothrow_query<const Executor&, allowed_t>::value)
#endif // defined(ASIO_MSVC)
#endif // !defined(__clang__)
  {
    return asio::query(ex, allowed_t());
  }

  ASIO_STATIC_CONSTEXPR_DEFAULT_INIT(disallowed_t, disallowed);
  ASIO_STATIC_CONSTEXPR_DEFAULT_INIT(allowed_t, allowed);

private:
  int value_;
};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
template <int I> template <typename E, typename T>
const T blocking_adaptation_t<I>::static_query_v;
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

template <int I>
const typename blocking_adaptation_t<I>::disallowed_t
blocking_adaptation_t<I>::disallowed;

template <int I>
const typename blocking_adaptation_t<I>::allowed_t
blocking_adaptation_t<I>::allowed;

namespace blocking_adaptation {

template <int I = 0>
struct disallowed_t
{
#if defined(ASIO_HAS_VARIABLE_TEMPLATES)
  template <typename T>
  static constexpr bool is_applicable_property_v = is_executor<T>::value;
#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

  static constexpr bool is_requirable = true;
  static constexpr bool is_preferable = true;
  typedef blocking_adaptation_t<I> polymorphic_query_result_type;

  constexpr disallowed_t()
  {
  }

  template <typename T>
  struct query_member :
    traits::query_member<
      typename blocking_adaptation_t<I>::template proxy<T>::type,
        disallowed_t> {};

  template <typename T>
  struct query_static_constexpr_member :
    traits::query_static_constexpr_member<
      typename blocking_adaptation_t<I>::template static_proxy<T>::type,
        disallowed_t> {};

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
  static constexpr disallowed_t static_query(
      enable_if_t<
        !query_static_constexpr_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !query_member<T>::is_valid
      >* = 0,
      enable_if_t<
        !traits::query_free<T, disallowed_t>::is_valid
      >* = 0,
      enable_if_t<
        !can_query<T, allowed_t<I>>::value
      >* = 0) noexcept
  {
    return disallowed_t();
  }

  template <typename E, typename T = decltype(disallowed_t::static_query<E>())>
  static constexpr const T static_query_v
    = disallowed_t::static_query<E>();
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

  static constexpr blocking_adaptation_t<I> value()
  {
    return disallowed_t();
  }

  friend constexpr bool operator==(const disallowed_t&, const disallowed_t&)
  {
    return true;
  }

  friend constexpr bool operator!=(const disallowed_t&, const disallowed_t&)
  {
    return false;
  }

  friend constexpr bool operator==(const disallowed_t&, const allowed_t<I>&)
  {
    return false;
  }

  friend constexpr bool operator!=(const disallowed_t&, const allowed_t<I>&)
  {
    return true;
  }
};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
template <int I> template <typename E, typename T>
const T disallowed_t<I>::static_query_v;
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

template <typename>
struct is_blocking_adaptation_t : false_type
{
};

template <int I>
struct is_blocking_adaptation_t<blocking_adaptation_t<I>> : true_type
{
};

template <typename>
struct is_allowed_t : false_type
{
};

template <int I>
struct is_allowed_t<allowed_t<I>> : true_type
{
};

template <typename>
struct is_disallowed_t : false_type
{
};

template <int I>
struct is_disallowed_t<disallowed_t<I>> : true_type
{
};

template <typename Executor>
class adapter
{
public:
  adapter(int, const Executor& e) noexcept
    : executor_(e)
  {
  }

  adapter(const adapter& other) noexcept
    : executor_(other.executor_)
  {
  }

  adapter(adapter&& other) noexcept
    : executor_(static_cast<Executor&&>(other.executor_))
  {
  }

  template <int I>
  static constexpr allowed_t<I> query(blocking_adaptation_t<I>) noexcept
  {
    return allowed_t<I>();
  }

  template <int I>
  static constexpr allowed_t<I> query(allowed_t<I>) noexcept
  {
    return allowed_t<I>();
  }

  template <int I>
  static constexpr allowed_t<I> query(disallowed_t<I>) noexcept
  {
    return allowed_t<I>();
  }

  template <typename Property>
  enable_if_t<
    can_query<const Executor&, Property>::value
      && !is_blocking_adaptation_t<Property>::value
      && !is_allowed_t<Property>::value
      && !is_disallowed_t<Property>::value,
    query_result_t<const Executor&, Property>
  > query(const Property& p) const
    noexcept(is_nothrow_query<const Executor&, Property>::value)
  {
    return asio::query(executor_, p);
  }

  template <int I>
  Executor require(disallowed_t<I>) const noexcept
  {
    return executor_;
  }

  template <typename Property>
  enable_if_t<
    can_require<const Executor&, Property>::value
      && !is_blocking_adaptation_t<Property>::value
      && !is_allowed_t<Property>::value
      && !is_disallowed_t<Property>::value,
    adapter<decay_t<require_result_t<const Executor&, Property>>>
  > require(const Property& p) const
    noexcept(is_nothrow_require<const Executor&, Property>::value)
  {
    return adapter<decay_t<require_result_t<const Executor&, Property>>>(
        0, asio::require(executor_, p));
  }

  template <typename Property>
  enable_if_t<
    can_prefer<const Executor&, Property>::value
      && !is_blocking_adaptation_t<Property>::value
      && !is_allowed_t<Property>::value
      && !is_disallowed_t<Property>::value,
    adapter<decay_t<prefer_result_t<const Executor&, Property>>>
  > prefer(const Property& p) const
    noexcept(is_nothrow_prefer<const Executor&, Property>::value)
  {
    return adapter<decay_t<prefer_result_t<const Executor&, Property>>>(
        0, asio::prefer(executor_, p));
  }

  template <typename Function>
  enable_if_t<
    traits::execute_member<const Executor&, Function>::is_valid
  > execute(Function&& f) const
  {
    executor_.execute(static_cast<Function&&>(f));
  }

  friend bool operator==(const adapter& a, const adapter& b) noexcept
  {
    return a.executor_ == b.executor_;
  }

  friend bool operator!=(const adapter& a, const adapter& b) noexcept
  {
    return a.executor_ != b.executor_;
  }

private:
  Executor executor_;
};

template <int I = 0>
struct allowed_t
{
#if defined(ASIO_HAS_VARIABLE_TEMPLATES)
  template <typename T>
  static constexpr bool is_applicable_property_v = is_executor<T>::value;
#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

  static constexpr bool is_requirable = true;
  static constexpr bool is_preferable = false;
  typedef blocking_adaptation_t<I> polymorphic_query_result_type;

  constexpr allowed_t()
  {
  }

  template <typename T>
  struct query_member :
    traits::query_member<
      typename blocking_adaptation_t<I>::template proxy<T>::type,
        allowed_t> {};

  template <typename T>
  struct query_static_constexpr_member :
    traits::query_static_constexpr_member<
      typename blocking_adaptation_t<I>::template static_proxy<T>::type,
        allowed_t> {};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
  template <typename T>
  static constexpr typename query_static_constexpr_member<T>::result_type
  static_query()
    noexcept(query_static_constexpr_member<T>::is_noexcept)
  {
    return query_static_constexpr_member<T>::value();
  }

  template <typename E, typename T = decltype(allowed_t::static_query<E>())>
  static constexpr const T static_query_v = allowed_t::static_query<E>();
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

  static constexpr blocking_adaptation_t<I> value()
  {
    return allowed_t();
  }

  friend constexpr bool operator==(const allowed_t&, const allowed_t&)
  {
    return true;
  }

  friend constexpr bool operator!=(const allowed_t&, const allowed_t&)
  {
    return false;
  }

  friend constexpr bool operator==(const allowed_t&, const disallowed_t<I>&)
  {
    return false;
  }

  friend constexpr bool operator!=(const allowed_t&, const disallowed_t<I>&)
  {
    return true;
  }

  template <typename Executor>
  friend adapter<Executor> require(
      const Executor& e, const allowed_t&,
      enable_if_t<
        is_executor<Executor>::value
      >* = 0)
  {
    return adapter<Executor>(0, e);
  }
};

#if defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)
template <int I> template <typename E, typename T>
const T allowed_t<I>::static_query_v;
#endif // defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   && defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

template <typename Function>
class blocking_execute_state
{
public:
  template <typename F>
  blocking_execute_state(F&& f)
    : func_(static_cast<F&&>(f)),
      is_complete_(false)
  {
  }

  template <typename Executor>
  void execute_and_wait(Executor&& ex)
  {
    handler h = { this };
    ex.execute(h);
    asio::detail::mutex::scoped_lock lock(mutex_);
    while (!is_complete_)
      event_.wait(lock);
  }

  struct cleanup
  {
    ~cleanup()
    {
      asio::detail::mutex::scoped_lock lock(state_->mutex_);
      state_->is_complete_ = true;
      state_->event_.unlock_and_signal_one_for_destruction(lock);
    }

    blocking_execute_state* state_;
  };

  struct handler
  {
    void operator()()
    {
      cleanup c = { state_ };
      state_->func_();
    }

    blocking_execute_state* state_;
  };

  Function func_;
  asio::detail::mutex mutex_;
  asio::detail::event event_;
  bool is_complete_;
};

template <typename Executor, typename Function>
void blocking_execute(
    Executor&& ex,
    Function&& func)
{
  typedef decay_t<Function> func_t;
  blocking_execute_state<func_t> state(static_cast<Function&&>(func));
  state.execute_and_wait(ex);
}

} // namespace blocking_adaptation
} // namespace detail

typedef detail::blocking_adaptation_t<> blocking_adaptation_t;

ASIO_INLINE_VARIABLE constexpr blocking_adaptation_t blocking_adaptation;

} // namespace execution

#if !defined(ASIO_HAS_VARIABLE_TEMPLATES)

template <typename T>
struct is_applicable_property<T, execution::blocking_adaptation_t>
  : integral_constant<bool, execution::is_executor<T>::value>
{
};

template <typename T>
struct is_applicable_property<T, execution::blocking_adaptation_t::disallowed_t>
  : integral_constant<bool, execution::is_executor<T>::value>
{
};

template <typename T>
struct is_applicable_property<T, execution::blocking_adaptation_t::allowed_t>
  : integral_constant<bool, execution::is_executor<T>::value>
{
};

#endif // !defined(ASIO_HAS_VARIABLE_TEMPLATES)

namespace traits {

#if !defined(ASIO_HAS_DEDUCED_QUERY_FREE_TRAIT)

template <typename T>
struct query_free_default<T, execution::blocking_adaptation_t,
  enable_if_t<
    can_query<T, execution::blocking_adaptation_t::disallowed_t>::value
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept =
    is_nothrow_query<T, execution::blocking_adaptation_t::disallowed_t>::value;

  typedef execution::blocking_adaptation_t result_type;
};

template <typename T>
struct query_free_default<T, execution::blocking_adaptation_t,
  enable_if_t<
    !can_query<T, execution::blocking_adaptation_t::disallowed_t>::value
      && can_query<T, execution::blocking_adaptation_t::allowed_t>::value
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept =
    is_nothrow_query<T, execution::blocking_adaptation_t::allowed_t>::value;

  typedef execution::blocking_adaptation_t result_type;
};

#endif // !defined(ASIO_HAS_DEDUCED_QUERY_FREE_TRAIT)

#if !defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT) \
  || !defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

template <typename T>
struct static_query<T, execution::blocking_adaptation_t,
  enable_if_t<
    execution::detail::blocking_adaptation_t<0>::
      query_static_constexpr_member<T>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename execution::detail::blocking_adaptation_t<0>::
    query_static_constexpr_member<T>::result_type result_type;

  static constexpr result_type value()
  {
    return execution::detail::blocking_adaptation_t<0>::
      query_static_constexpr_member<T>::value();
  }
};

template <typename T>
struct static_query<T, execution::blocking_adaptation_t,
  enable_if_t<
    !execution::detail::blocking_adaptation_t<0>::
        query_static_constexpr_member<T>::is_valid
      && !execution::detail::blocking_adaptation_t<0>::
        query_member<T>::is_valid
      && traits::static_query<T,
        execution::blocking_adaptation_t::disallowed_t>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename traits::static_query<T,
    execution::blocking_adaptation_t::disallowed_t>::result_type result_type;

  static constexpr result_type value()
  {
    return traits::static_query<T,
        execution::blocking_adaptation_t::disallowed_t>::value();
  }
};

template <typename T>
struct static_query<T, execution::blocking_adaptation_t,
  enable_if_t<
    !execution::detail::blocking_adaptation_t<0>::
        query_static_constexpr_member<T>::is_valid
      && !execution::detail::blocking_adaptation_t<0>::
        query_member<T>::is_valid
      && !traits::static_query<T,
        execution::blocking_adaptation_t::disallowed_t>::is_valid
      && traits::static_query<T,
        execution::blocking_adaptation_t::allowed_t>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename traits::static_query<T,
    execution::blocking_adaptation_t::allowed_t>::result_type result_type;

  static constexpr result_type value()
  {
    return traits::static_query<T,
        execution::blocking_adaptation_t::allowed_t>::value();
  }
};

template <typename T>
struct static_query<T, execution::blocking_adaptation_t::disallowed_t,
  enable_if_t<
    execution::detail::blocking_adaptation::disallowed_t<0>::
      query_static_constexpr_member<T>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename execution::detail::blocking_adaptation::disallowed_t<0>::
    query_static_constexpr_member<T>::result_type result_type;

  static constexpr result_type value()
  {
    return execution::detail::blocking_adaptation::disallowed_t<0>::
      query_static_constexpr_member<T>::value();
  }
};

template <typename T>
struct static_query<T, execution::blocking_adaptation_t::disallowed_t,
  enable_if_t<
    !execution::detail::blocking_adaptation::disallowed_t<0>::
        query_static_constexpr_member<T>::is_valid
      && !execution::detail::blocking_adaptation::disallowed_t<0>::
        query_member<T>::is_valid
      && !traits::query_free<T,
        execution::blocking_adaptation_t::disallowed_t>::is_valid
      && !can_query<T, execution::blocking_adaptation_t::allowed_t>::value
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef execution::blocking_adaptation_t::disallowed_t result_type;

  static constexpr result_type value()
  {
    return result_type();
  }
};

template <typename T>
struct static_query<T, execution::blocking_adaptation_t::allowed_t,
  enable_if_t<
    execution::detail::blocking_adaptation::allowed_t<0>::
      query_static_constexpr_member<T>::is_valid
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;

  typedef typename execution::detail::blocking_adaptation::allowed_t<0>::
    query_static_constexpr_member<T>::result_type result_type;

  static constexpr result_type value()
  {
    return execution::detail::blocking_adaptation::allowed_t<0>::
      query_static_constexpr_member<T>::value();
  }
};

#endif // !defined(ASIO_HAS_DEDUCED_STATIC_QUERY_TRAIT)
       //   || !defined(ASIO_HAS_SFINAE_VARIABLE_TEMPLATES)

#if !defined(ASIO_HAS_DEDUCED_REQUIRE_FREE_TRAIT)

template <typename T>
struct require_free_default<T, execution::blocking_adaptation_t::allowed_t,
  enable_if_t<
    is_same<T, decay_t<T>>::value
      && execution::is_executor<T>::value
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = false;
  typedef execution::detail::blocking_adaptation::adapter<T> result_type;
};

#endif // !defined(ASIO_HAS_DEDUCED_REQUIRE_FREE_TRAIT)

#if !defined(ASIO_HAS_DEDUCED_EQUALITY_COMPARABLE_TRAIT)

template <typename Executor>
struct equality_comparable<
  execution::detail::blocking_adaptation::adapter<Executor>>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;
};

#endif // !defined(ASIO_HAS_DEDUCED_EQUALITY_COMPARABLE_TRAIT)

#if !defined(ASIO_HAS_DEDUCED_EXECUTE_MEMBER_TRAIT)

template <typename Executor, typename Function>
struct execute_member<
  execution::detail::blocking_adaptation::adapter<Executor>, Function>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = false;
  typedef void result_type;
};

#endif // !defined(ASIO_HAS_DEDUCED_EXECUTE_MEMBER_TRAIT)

#if !defined(ASIO_HAS_DEDUCED_QUERY_STATIC_CONSTEXPR_MEMBER_TRAIT)

template <typename Executor, int I>
struct query_static_constexpr_member<
  execution::detail::blocking_adaptation::adapter<Executor>,
  execution::detail::blocking_adaptation_t<I>>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;
  typedef execution::blocking_adaptation_t::allowed_t result_type;

  static constexpr result_type value() noexcept
  {
    return result_type();
  }
};

template <typename Executor, int I>
struct query_static_constexpr_member<
  execution::detail::blocking_adaptation::adapter<Executor>,
  execution::detail::blocking_adaptation::allowed_t<I>>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;
  typedef execution::blocking_adaptation_t::allowed_t result_type;

  static constexpr result_type value() noexcept
  {
    return result_type();
  }
};

template <typename Executor, int I>
struct query_static_constexpr_member<
  execution::detail::blocking_adaptation::adapter<Executor>,
  execution::detail::blocking_adaptation::disallowed_t<I>>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;
  typedef execution::blocking_adaptation_t::allowed_t result_type;

  static constexpr result_type value() noexcept
  {
    return result_type();
  }
};

#endif // !defined(ASIO_HAS_DEDUCED_QUERY_STATIC_CONSTEXPR_MEMBER_TRAIT)

#if !defined(ASIO_HAS_DEDUCED_QUERY_MEMBER_TRAIT)

template <typename Executor, typename Property>
struct query_member<
  execution::detail::blocking_adaptation::adapter<Executor>, Property,
  enable_if_t<
    can_query<const Executor&, Property>::value
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept =
    is_nothrow_query<Executor, Property>::value;
  typedef query_result_t<Executor, Property> result_type;
};

#endif // !defined(ASIO_HAS_DEDUCED_QUERY_MEMBER_TRAIT)

#if !defined(ASIO_HAS_DEDUCED_REQUIRE_MEMBER_TRAIT)

template <typename Executor, int I>
struct require_member<
  execution::detail::blocking_adaptation::adapter<Executor>,
  execution::detail::blocking_adaptation::disallowed_t<I>>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;
  typedef Executor result_type;
};

template <typename Executor, typename Property>
struct require_member<
  execution::detail::blocking_adaptation::adapter<Executor>, Property,
  enable_if_t<
    can_require<const Executor&, Property>::value
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept =
    is_nothrow_require<Executor, Property>::value;
  typedef execution::detail::blocking_adaptation::adapter<
    decay_t<require_result_t<Executor, Property>>> result_type;
};

#endif // !defined(ASIO_HAS_DEDUCED_REQUIRE_MEMBER_TRAIT)

#if !defined(ASIO_HAS_DEDUCED_PREFER_MEMBER_TRAIT)

template <typename Executor, typename Property>
struct prefer_member<
  execution::detail::blocking_adaptation::adapter<Executor>, Property,
  enable_if_t<
    can_prefer<const Executor&, Property>::value
  >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept =
    is_nothrow_prefer<Executor, Property>::value;
  typedef execution::detail::blocking_adaptation::adapter<
    decay_t<prefer_result_t<Executor, Property>>> result_type;
};

#endif // !defined(ASIO_HAS_DEDUCED_PREFER_MEMBER_TRAIT)

} // namespace traits

#endif // defined(GENERATING_DOCUMENTATION)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_EXECUTION_BLOCKING_ADAPTATION_HPP
