//
// bind_allocator.hpp
// ~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_BIND_ALLOCATOR_HPP
#define ASIO_BIND_ALLOCATOR_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/associated_allocator.hpp"
#include "asio/associated_executor.hpp"
#include "asio/associator.hpp"
#include "asio/async_result.hpp"
#include "asio/detail/initiation_base.hpp"
#include "asio/detail/type_traits.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

// Helper to automatically define nested typedef result_type.

template <typename T, typename = void>
struct allocator_binder_result_type
{
protected:
  typedef void result_type_or_void;
};

template <typename T>
struct allocator_binder_result_type<T, void_t<typename T::result_type>>
{
  typedef typename T::result_type result_type;
protected:
  typedef result_type result_type_or_void;
};

template <typename R>
struct allocator_binder_result_type<R(*)()>
{
  typedef R result_type;
protected:
  typedef result_type result_type_or_void;
};

template <typename R>
struct allocator_binder_result_type<R(&)()>
{
  typedef R result_type;
protected:
  typedef result_type result_type_or_void;
};

template <typename R, typename A1>
struct allocator_binder_result_type<R(*)(A1)>
{
  typedef R result_type;
protected:
  typedef result_type result_type_or_void;
};

template <typename R, typename A1>
struct allocator_binder_result_type<R(&)(A1)>
{
  typedef R result_type;
protected:
  typedef result_type result_type_or_void;
};

template <typename R, typename A1, typename A2>
struct allocator_binder_result_type<R(*)(A1, A2)>
{
  typedef R result_type;
protected:
  typedef result_type result_type_or_void;
};

template <typename R, typename A1, typename A2>
struct allocator_binder_result_type<R(&)(A1, A2)>
{
  typedef R result_type;
protected:
  typedef result_type result_type_or_void;
};

// Helper to automatically define nested typedef argument_type.

template <typename T, typename = void>
struct allocator_binder_argument_type {};

template <typename T>
struct allocator_binder_argument_type<T, void_t<typename T::argument_type>>
{
  typedef typename T::argument_type argument_type;
};

template <typename R, typename A1>
struct allocator_binder_argument_type<R(*)(A1)>
{
  typedef A1 argument_type;
};

template <typename R, typename A1>
struct allocator_binder_argument_type<R(&)(A1)>
{
  typedef A1 argument_type;
};

// Helper to automatically define nested typedefs first_argument_type and
// second_argument_type.

template <typename T, typename = void>
struct allocator_binder_argument_types {};

template <typename T>
struct allocator_binder_argument_types<T,
    void_t<typename T::first_argument_type>>
{
  typedef typename T::first_argument_type first_argument_type;
  typedef typename T::second_argument_type second_argument_type;
};

template <typename R, typename A1, typename A2>
struct allocator_binder_argument_type<R(*)(A1, A2)>
{
  typedef A1 first_argument_type;
  typedef A2 second_argument_type;
};

template <typename R, typename A1, typename A2>
struct allocator_binder_argument_type<R(&)(A1, A2)>
{
  typedef A1 first_argument_type;
  typedef A2 second_argument_type;
};

} // namespace detail

/// A call wrapper type to bind an allocator of type @c Allocator
/// to an object of type @c T.
template <typename T, typename Allocator>
class allocator_binder
#if !defined(GENERATING_DOCUMENTATION)
  : public detail::allocator_binder_result_type<T>,
    public detail::allocator_binder_argument_type<T>,
    public detail::allocator_binder_argument_types<T>
#endif // !defined(GENERATING_DOCUMENTATION)
{
public:
  /// The type of the target object.
  typedef T target_type;

  /// The type of the associated allocator.
  typedef Allocator allocator_type;

#if defined(GENERATING_DOCUMENTATION)
  /// The return type if a function.
  /**
   * The type of @c result_type is based on the type @c T of the wrapper's
   * target object:
   *
   * @li if @c T is a pointer to function type, @c result_type is a synonym for
   * the return type of @c T;
   *
   * @li if @c T is a class type with a member type @c result_type, then @c
   * result_type is a synonym for @c T::result_type;
   *
   * @li otherwise @c result_type is not defined.
   */
  typedef see_below result_type;

  /// The type of the function's argument.
  /**
   * The type of @c argument_type is based on the type @c T of the wrapper's
   * target object:
   *
   * @li if @c T is a pointer to a function type accepting a single argument,
   * @c argument_type is a synonym for the return type of @c T;
   *
   * @li if @c T is a class type with a member type @c argument_type, then @c
   * argument_type is a synonym for @c T::argument_type;
   *
   * @li otherwise @c argument_type is not defined.
   */
  typedef see_below argument_type;

  /// The type of the function's first argument.
  /**
   * The type of @c first_argument_type is based on the type @c T of the
   * wrapper's target object:
   *
   * @li if @c T is a pointer to a function type accepting two arguments, @c
   * first_argument_type is a synonym for the return type of @c T;
   *
   * @li if @c T is a class type with a member type @c first_argument_type,
   * then @c first_argument_type is a synonym for @c T::first_argument_type;
   *
   * @li otherwise @c first_argument_type is not defined.
   */
  typedef see_below first_argument_type;

  /// The type of the function's second argument.
  /**
   * The type of @c second_argument_type is based on the type @c T of the
   * wrapper's target object:
   *
   * @li if @c T is a pointer to a function type accepting two arguments, @c
   * second_argument_type is a synonym for the return type of @c T;
   *
   * @li if @c T is a class type with a member type @c first_argument_type,
   * then @c second_argument_type is a synonym for @c T::second_argument_type;
   *
   * @li otherwise @c second_argument_type is not defined.
   */
  typedef see_below second_argument_type;
#endif // defined(GENERATING_DOCUMENTATION)

  /// Construct an allocator wrapper for the specified object.
  /**
   * This constructor is only valid if the type @c T is constructible from type
   * @c U.
   */
  template <typename U>
  allocator_binder(const allocator_type& s, U&& u)
    : allocator_(s),
      target_(static_cast<U&&>(u))
  {
  }

  /// Copy constructor.
  allocator_binder(const allocator_binder& other)
    : allocator_(other.get_allocator()),
      target_(other.get())
  {
  }

  /// Construct a copy, but specify a different allocator.
  allocator_binder(const allocator_type& s, const allocator_binder& other)
    : allocator_(s),
      target_(other.get())
  {
  }

  /// Construct a copy of a different allocator wrapper type.
  /**
   * This constructor is only valid if the @c Allocator type is
   * constructible from type @c OtherAllocator, and the type @c T is
   * constructible from type @c U.
   */
  template <typename U, typename OtherAllocator>
  allocator_binder(const allocator_binder<U, OtherAllocator>& other,
      constraint_t<is_constructible<Allocator, OtherAllocator>::value> = 0,
      constraint_t<is_constructible<T, U>::value> = 0)
    : allocator_(other.get_allocator()),
      target_(other.get())
  {
  }

  /// Construct a copy of a different allocator wrapper type, but
  /// specify a different allocator.
  /**
   * This constructor is only valid if the type @c T is constructible from type
   * @c U.
   */
  template <typename U, typename OtherAllocator>
  allocator_binder(const allocator_type& s,
      const allocator_binder<U, OtherAllocator>& other,
      constraint_t<is_constructible<T, U>::value> = 0)
    : allocator_(s),
      target_(other.get())
  {
  }

  /// Move constructor.
  allocator_binder(allocator_binder&& other)
    : allocator_(static_cast<allocator_type&&>(
          other.get_allocator())),
      target_(static_cast<T&&>(other.get()))
  {
  }

  /// Move construct the target object, but specify a different allocator.
  allocator_binder(const allocator_type& s,
      allocator_binder&& other)
    : allocator_(s),
      target_(static_cast<T&&>(other.get()))
  {
  }

  /// Move construct from a different allocator wrapper type.
  template <typename U, typename OtherAllocator>
  allocator_binder(
      allocator_binder<U, OtherAllocator>&& other,
      constraint_t<is_constructible<Allocator, OtherAllocator>::value> = 0,
      constraint_t<is_constructible<T, U>::value> = 0)
    : allocator_(static_cast<OtherAllocator&&>(
          other.get_allocator())),
      target_(static_cast<U&&>(other.get()))
  {
  }

  /// Move construct from a different allocator wrapper type, but
  /// specify a different allocator.
  template <typename U, typename OtherAllocator>
  allocator_binder(const allocator_type& s,
      allocator_binder<U, OtherAllocator>&& other,
      constraint_t<is_constructible<T, U>::value> = 0)
    : allocator_(s),
      target_(static_cast<U&&>(other.get()))
  {
  }

  /// Destructor.
  ~allocator_binder()
  {
  }

  /// Obtain a reference to the target object.
  target_type& get() noexcept
  {
    return target_;
  }

  /// Obtain a reference to the target object.
  const target_type& get() const noexcept
  {
    return target_;
  }

  /// Obtain the associated allocator.
  allocator_type get_allocator() const noexcept
  {
    return allocator_;
  }

  /// Forwarding function call operator.
  template <typename... Args>
  result_of_t<T(Args...)> operator()(Args&&... args) &
  {
    return target_(static_cast<Args&&>(args)...);
  }

  /// Forwarding function call operator.
  template <typename... Args>
  result_of_t<T(Args...)> operator()(Args&&... args) &&
  {
    return static_cast<T&&>(target_)(static_cast<Args&&>(args)...);
  }

  /// Forwarding function call operator.
  template <typename... Args>
  result_of_t<T(Args...)> operator()(Args&&... args) const&
  {
    return target_(static_cast<Args&&>(args)...);
  }

private:
  Allocator allocator_;
  T target_;
};

/// A function object type that adapts a @ref completion_token to specify that
/// the completion handler should have the supplied allocator as its associated
/// allocator.
/**
 * May also be used directly as a completion token, in which case it adapts the
 * asynchronous operation's default completion token (or asio::deferred
 * if no default is available).
 */
template <typename Allocator>
struct partial_allocator_binder
{
  /// Constructor that specifies associated allocator.
  explicit partial_allocator_binder(const Allocator& ex)
    : allocator_(ex)
  {
  }

  /// Adapt a @ref completion_token to specify that the completion handler
  /// should have the allocator as its associated allocator.
  template <typename CompletionToken>
  ASIO_NODISCARD inline
  constexpr allocator_binder<decay_t<CompletionToken>, Allocator>
  operator()(CompletionToken&& completion_token) const
  {
    return allocator_binder<decay_t<CompletionToken>, Allocator>(
        allocator_, static_cast<CompletionToken&&>(completion_token));
  }

//private:
  Allocator allocator_;
};

/// Create a partial completion token that associates an allocator.
template <typename Allocator>
ASIO_NODISCARD inline partial_allocator_binder<Allocator>
bind_allocator(const Allocator& ex)
{
  return partial_allocator_binder<Allocator>(ex);
}

/// Associate an object of type @c T with an allocator of type
/// @c Allocator.
template <typename Allocator, typename T>
ASIO_NODISCARD inline allocator_binder<decay_t<T>, Allocator>
bind_allocator(const Allocator& s, T&& t)
{
  return allocator_binder<decay_t<T>, Allocator>(s, static_cast<T&&>(t));
}

#if !defined(GENERATING_DOCUMENTATION)

namespace detail {

template <typename TargetAsyncResult, typename Allocator, typename = void>
class allocator_binder_completion_handler_async_result
{
public:
  template <typename T>
  explicit allocator_binder_completion_handler_async_result(T&)
  {
  }
};

template <typename TargetAsyncResult, typename Allocator>
class allocator_binder_completion_handler_async_result<
    TargetAsyncResult, Allocator,
    void_t<typename TargetAsyncResult::completion_handler_type>>
{
private:
  TargetAsyncResult target_;

public:
  typedef allocator_binder<
    typename TargetAsyncResult::completion_handler_type, Allocator>
      completion_handler_type;

  explicit allocator_binder_completion_handler_async_result(
      typename TargetAsyncResult::completion_handler_type& handler)
    : target_(handler)
  {
  }

  auto get() -> decltype(target_.get())
  {
    return target_.get();
  }
};

template <typename TargetAsyncResult, typename = void>
struct allocator_binder_async_result_return_type
{
};

template <typename TargetAsyncResult>
struct allocator_binder_async_result_return_type<
    TargetAsyncResult, void_type<typename TargetAsyncResult::return_type>>
{
  typedef typename TargetAsyncResult::return_type return_type;
};

} // namespace detail

template <typename T, typename Allocator, typename Signature>
class async_result<allocator_binder<T, Allocator>, Signature> :
  public detail::allocator_binder_completion_handler_async_result<
      async_result<T, Signature>, Allocator>,
  public detail::allocator_binder_async_result_return_type<
      async_result<T, Signature>>
{
public:
  explicit async_result(allocator_binder<T, Allocator>& b)
    : detail::allocator_binder_completion_handler_async_result<
        async_result<T, Signature>, Allocator>(b.get())
  {
  }

  template <typename Initiation>
  struct init_wrapper : detail::initiation_base<Initiation>
  {
    using detail::initiation_base<Initiation>::initiation_base;

    template <typename Handler, typename... Args>
    void operator()(Handler&& handler, const Allocator& a, Args&&... args) &&
    {
      static_cast<Initiation&&>(*this)(
          allocator_binder<decay_t<Handler>, Allocator>(
              a, static_cast<Handler&&>(handler)),
          static_cast<Args&&>(args)...);
    }

    template <typename Handler, typename... Args>
    void operator()(Handler&& handler,
        const Allocator& a, Args&&... args) const &
    {
      static_cast<const Initiation&>(*this)(
          allocator_binder<decay_t<Handler>, Allocator>(
              a, static_cast<Handler&&>(handler)),
          static_cast<Args&&>(args)...);
    }
  };

  template <typename Initiation, typename RawCompletionToken, typename... Args>
  static auto initiate(Initiation&& initiation,
      RawCompletionToken&& token, Args&&... args)
    -> decltype(
      async_initiate<
        conditional_t<
          is_const<remove_reference_t<RawCompletionToken>>::value, const T, T>,
        Signature>(
        declval<init_wrapper<decay_t<Initiation>>>(),
        token.get(), token.get_allocator(), static_cast<Args&&>(args)...))
  {
    return async_initiate<
      conditional_t<
        is_const<remove_reference_t<RawCompletionToken>>::value, const T, T>,
      Signature>(
        init_wrapper<decay_t<Initiation>>(
          static_cast<Initiation&&>(initiation)),
        token.get(), token.get_allocator(), static_cast<Args&&>(args)...);
  }

private:
  async_result(const async_result&) = delete;
  async_result& operator=(const async_result&) = delete;

  async_result<T, Signature> target_;
};

template <typename Allocator, typename... Signatures>
struct async_result<partial_allocator_binder<Allocator>, Signatures...>
{
  template <typename Initiation, typename RawCompletionToken, typename... Args>
  static auto initiate(Initiation&& initiation,
      RawCompletionToken&& token, Args&&... args)
    -> decltype(
      async_initiate<Signatures...>(
        static_cast<Initiation&&>(initiation),
        allocator_binder<
          default_completion_token_t<associated_executor_t<Initiation>>,
          Allocator>(token.allocator_,
            default_completion_token_t<associated_executor_t<Initiation>>{}),
        static_cast<Args&&>(args)...))
  {
    return async_initiate<Signatures...>(
        static_cast<Initiation&&>(initiation),
        allocator_binder<
          default_completion_token_t<associated_executor_t<Initiation>>,
          Allocator>(token.allocator_,
            default_completion_token_t<associated_executor_t<Initiation>>{}),
        static_cast<Args&&>(args)...);
  }
};

template <template <typename, typename> class Associator,
    typename T, typename Allocator, typename DefaultCandidate>
struct associator<Associator, allocator_binder<T, Allocator>, DefaultCandidate>
  : Associator<T, DefaultCandidate>
{
  static typename Associator<T, DefaultCandidate>::type get(
      const allocator_binder<T, Allocator>& b) noexcept
  {
    return Associator<T, DefaultCandidate>::get(b.get());
  }

  static auto get(const allocator_binder<T, Allocator>& b,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<T, DefaultCandidate>::get(b.get(), c))
  {
    return Associator<T, DefaultCandidate>::get(b.get(), c);
  }
};

template <typename T, typename Allocator, typename Allocator1>
struct associated_allocator<allocator_binder<T, Allocator>, Allocator1>
{
  typedef Allocator type;

  static auto get(const allocator_binder<T, Allocator>& b,
      const Allocator1& = Allocator1()) noexcept
    -> decltype(b.get_allocator())
  {
    return b.get_allocator();
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_BIND_ALLOCATOR_HPP
