//
// associated_immediate_executor.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_ASSOCIATED_IMMEDIATE_EXECUTOR_HPP
#define ASIO_ASSOCIATED_IMMEDIATE_EXECUTOR_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/associator.hpp"
#include "asio/detail/functional.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/execution/blocking.hpp"
#include "asio/execution/executor.hpp"
#include "asio/execution_context.hpp"
#include "asio/is_executor.hpp"
#include "asio/require.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

template <typename T, typename Executor>
struct associated_immediate_executor;

namespace detail {

template <typename T, typename = void>
struct has_immediate_executor_type : false_type
{
};

template <typename T>
struct has_immediate_executor_type<T,
  void_t<typename T::immediate_executor_type>>
    : true_type
{
};

template <typename E, typename = void, typename = void>
struct default_immediate_executor
{
  typedef decay_t<require_result_t<E, execution::blocking_t::never_t>> type;

  static auto get(const E& e) noexcept
    -> decltype(asio::require(e, execution::blocking.never))
  {
    return asio::require(e, execution::blocking.never);
  }
};

template <typename E>
struct default_immediate_executor<E,
  enable_if_t<
    !execution::is_executor<E>::value
  >,
  enable_if_t<
    is_executor<E>::value
  >>
{
  class type : public E
  {
  public:
    template <typename Executor1>
    explicit type(const Executor1& e,
        constraint_t<
          conditional_t<
            !is_same<Executor1, type>::value,
            is_convertible<Executor1, E>,
            false_type
          >::value
        > = 0) noexcept
      : E(e)
    {
    }

    type(const type& other) noexcept
      : E(static_cast<const E&>(other))
    {
    }

    type(type&& other) noexcept
      : E(static_cast<E&&>(other))
    {
    }

    template <typename Function, typename Allocator>
    void dispatch(Function&& f, const Allocator& a) const
    {
      this->post(static_cast<Function&&>(f), a);
    }

    friend bool operator==(const type& a, const type& b) noexcept
    {
      return static_cast<const E&>(a) == static_cast<const E&>(b);
    }

    friend bool operator!=(const type& a, const type& b) noexcept
    {
      return static_cast<const E&>(a) != static_cast<const E&>(b);
    }
  };

  static type get(const E& e) noexcept
  {
    return type(e);
  }
};

template <typename T, typename E, typename = void, typename = void>
struct associated_immediate_executor_impl
{
  typedef void asio_associated_immediate_executor_is_unspecialised;

  typedef typename default_immediate_executor<E>::type type;

  static auto get(const T&, const E& e) noexcept
    -> decltype(default_immediate_executor<E>::get(e))
  {
    return default_immediate_executor<E>::get(e);
  }
};

template <typename T, typename E>
struct associated_immediate_executor_impl<T, E,
  void_t<typename T::immediate_executor_type>>
{
  typedef typename T::immediate_executor_type type;

  static auto get(const T& t, const E&) noexcept
    -> decltype(t.get_immediate_executor())
  {
    return t.get_immediate_executor();
  }
};

template <typename T, typename E>
struct associated_immediate_executor_impl<T, E,
  enable_if_t<
    !has_immediate_executor_type<T>::value
  >,
  void_t<
    typename associator<associated_immediate_executor, T, E>::type
  >> : associator<associated_immediate_executor, T, E>
{
};

} // namespace detail

/// Traits type used to obtain the immediate executor associated with an object.
/**
 * A program may specialise this traits type if the @c T template parameter in
 * the specialisation is a user-defined type. The template parameter @c
 * Executor shall be a type meeting the Executor requirements.
 *
 * Specialisations shall meet the following requirements, where @c t is a const
 * reference to an object of type @c T, and @c e is an object of type @c
 * Executor.
 *
 * @li Provide a nested typedef @c type that identifies a type meeting the
 * Executor requirements.
 *
 * @li Provide a noexcept static member function named @c get, callable as @c
 * get(t) and with return type @c type or a (possibly const) reference to @c
 * type.
 *
 * @li Provide a noexcept static member function named @c get, callable as @c
 * get(t,e) and with return type @c type or a (possibly const) reference to @c
 * type.
 */
template <typename T, typename Executor>
struct associated_immediate_executor
#if !defined(GENERATING_DOCUMENTATION)
  : detail::associated_immediate_executor_impl<T, Executor>
#endif // !defined(GENERATING_DOCUMENTATION)
{
#if defined(GENERATING_DOCUMENTATION)
  /// If @c T has a nested type @c immediate_executor_type,
  // <tt>T::immediate_executor_type</tt>. Otherwise @c Executor.
  typedef see_below type;

  /// If @c T has a nested type @c immediate_executor_type, returns
  /// <tt>t.get_immediate_executor()</tt>. Otherwise returns
  /// <tt>asio::require(ex, asio::execution::blocking.never)</tt>.
  static decltype(auto) get(const T& t, const Executor& ex) noexcept;
#endif // defined(GENERATING_DOCUMENTATION)
};

/// Helper function to obtain an object's associated executor.
/**
 * @returns <tt>associated_immediate_executor<T, Executor>::get(t, ex)</tt>
 */
template <typename T, typename Executor>
ASIO_NODISCARD inline auto get_associated_immediate_executor(
    const T& t, const Executor& ex,
    constraint_t<
      is_executor<Executor>::value || execution::is_executor<Executor>::value
    > = 0) noexcept
  -> decltype(associated_immediate_executor<T, Executor>::get(t, ex))
{
  return associated_immediate_executor<T, Executor>::get(t, ex);
}

/// Helper function to obtain an object's associated executor.
/**
 * @returns <tt>associated_immediate_executor<T, typename
 * ExecutionContext::executor_type>::get(t, ctx.get_executor())</tt>
 */
template <typename T, typename ExecutionContext>
ASIO_NODISCARD inline typename associated_immediate_executor<T,
    typename ExecutionContext::executor_type>::type
get_associated_immediate_executor(const T& t, ExecutionContext& ctx,
    constraint_t<
      is_convertible<ExecutionContext&, execution_context&>::value
    > = 0) noexcept
{
  return associated_immediate_executor<T,
    typename ExecutionContext::executor_type>::get(t, ctx.get_executor());
}

template <typename T, typename Executor>
using associated_immediate_executor_t =
  typename associated_immediate_executor<T, Executor>::type;

namespace detail {

template <typename T, typename E, typename = void>
struct associated_immediate_executor_forwarding_base
{
};

template <typename T, typename E>
struct associated_immediate_executor_forwarding_base<T, E,
    enable_if_t<
      is_same<
        typename associated_immediate_executor<T,
          E>::asio_associated_immediate_executor_is_unspecialised,
        void
      >::value
    >>
{
  typedef void asio_associated_immediate_executor_is_unspecialised;
};

} // namespace detail

/// Specialisation of associated_immediate_executor for
/// @c std::reference_wrapper.
template <typename T, typename Executor>
struct associated_immediate_executor<reference_wrapper<T>, Executor>
#if !defined(GENERATING_DOCUMENTATION)
  : detail::associated_immediate_executor_forwarding_base<T, Executor>
#endif // !defined(GENERATING_DOCUMENTATION)
{
  /// Forwards @c type to the associator specialisation for the unwrapped type
  /// @c T.
  typedef typename associated_immediate_executor<T, Executor>::type type;

  /// Forwards the request to get the executor to the associator specialisation
  /// for the unwrapped type @c T.
  static auto get(reference_wrapper<T> t, const Executor& ex) noexcept
    -> decltype(associated_immediate_executor<T, Executor>::get(t.get(), ex))
  {
    return associated_immediate_executor<T, Executor>::get(t.get(), ex);
  }
};

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_ASSOCIATED_IMMEDIATE_EXECUTOR_HPP
