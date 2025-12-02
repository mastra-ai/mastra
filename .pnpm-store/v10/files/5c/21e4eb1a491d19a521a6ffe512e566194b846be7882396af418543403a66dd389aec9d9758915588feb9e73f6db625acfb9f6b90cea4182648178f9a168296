//
// bind_executor.hpp
// ~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_BIND_EXECUTOR_HPP
#define ASIO_BIND_EXECUTOR_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/associated_executor.hpp"
#include "asio/associator.hpp"
#include "asio/async_result.hpp"
#include "asio/detail/initiation_base.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/execution/executor.hpp"
#include "asio/execution_context.hpp"
#include "asio/is_executor.hpp"
#include "asio/uses_executor.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

// Helper to automatically define nested typedef result_type.

template <typename T, typename = void>
struct executor_binder_result_type
{
protected:
  typedef void result_type_or_void;
};

template <typename T>
struct executor_binder_result_type<T, void_t<typename T::result_type>>
{
  typedef typename T::result_type result_type;
protected:
  typedef result_type result_type_or_void;
};

template <typename R>
struct executor_binder_result_type<R(*)()>
{
  typedef R result_type;
protected:
  typedef result_type result_type_or_void;
};

template <typename R>
struct executor_binder_result_type<R(&)()>
{
  typedef R result_type;
protected:
  typedef result_type result_type_or_void;
};

template <typename R, typename A1>
struct executor_binder_result_type<R(*)(A1)>
{
  typedef R result_type;
protected:
  typedef result_type result_type_or_void;
};

template <typename R, typename A1>
struct executor_binder_result_type<R(&)(A1)>
{
  typedef R result_type;
protected:
  typedef result_type result_type_or_void;
};

template <typename R, typename A1, typename A2>
struct executor_binder_result_type<R(*)(A1, A2)>
{
  typedef R result_type;
protected:
  typedef result_type result_type_or_void;
};

template <typename R, typename A1, typename A2>
struct executor_binder_result_type<R(&)(A1, A2)>
{
  typedef R result_type;
protected:
  typedef result_type result_type_or_void;
};

// Helper to automatically define nested typedef argument_type.

template <typename T, typename = void>
struct executor_binder_argument_type {};

template <typename T>
struct executor_binder_argument_type<T, void_t<typename T::argument_type>>
{
  typedef typename T::argument_type argument_type;
};

template <typename R, typename A1>
struct executor_binder_argument_type<R(*)(A1)>
{
  typedef A1 argument_type;
};

template <typename R, typename A1>
struct executor_binder_argument_type<R(&)(A1)>
{
  typedef A1 argument_type;
};

// Helper to automatically define nested typedefs first_argument_type and
// second_argument_type.

template <typename T, typename = void>
struct executor_binder_argument_types {};

template <typename T>
struct executor_binder_argument_types<T,
    void_t<typename T::first_argument_type>>
{
  typedef typename T::first_argument_type first_argument_type;
  typedef typename T::second_argument_type second_argument_type;
};

template <typename R, typename A1, typename A2>
struct executor_binder_argument_type<R(*)(A1, A2)>
{
  typedef A1 first_argument_type;
  typedef A2 second_argument_type;
};

template <typename R, typename A1, typename A2>
struct executor_binder_argument_type<R(&)(A1, A2)>
{
  typedef A1 first_argument_type;
  typedef A2 second_argument_type;
};

// Helper to perform uses_executor construction of the target type, if
// required.

template <typename T, typename Executor, bool UsesExecutor>
class executor_binder_base;

template <typename T, typename Executor>
class executor_binder_base<T, Executor, true>
{
protected:
  template <typename E, typename U>
  executor_binder_base(E&& e, U&& u)
    : executor_(static_cast<E&&>(e)),
      target_(executor_arg_t(), executor_, static_cast<U&&>(u))
  {
  }

  Executor executor_;
  T target_;
};

template <typename T, typename Executor>
class executor_binder_base<T, Executor, false>
{
protected:
  template <typename E, typename U>
  executor_binder_base(E&& e, U&& u)
    : executor_(static_cast<E&&>(e)),
      target_(static_cast<U&&>(u))
  {
  }

  Executor executor_;
  T target_;
};

} // namespace detail

/// A call wrapper type to bind an executor of type @c Executor to an object of
/// type @c T.
template <typename T, typename Executor>
class executor_binder
#if !defined(GENERATING_DOCUMENTATION)
  : public detail::executor_binder_result_type<T>,
    public detail::executor_binder_argument_type<T>,
    public detail::executor_binder_argument_types<T>,
    private detail::executor_binder_base<
      T, Executor, uses_executor<T, Executor>::value>
#endif // !defined(GENERATING_DOCUMENTATION)
{
public:
  /// The type of the target object.
  typedef T target_type;

  /// The type of the associated executor.
  typedef Executor executor_type;

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

  /// Construct an executor wrapper for the specified object.
  /**
   * This constructor is only valid if the type @c T is constructible from type
   * @c U.
   */
  template <typename U>
  executor_binder(executor_arg_t, const executor_type& e,
      U&& u)
    : base_type(e, static_cast<U&&>(u))
  {
  }

  /// Copy constructor.
  executor_binder(const executor_binder& other)
    : base_type(other.get_executor(), other.get())
  {
  }

  /// Construct a copy, but specify a different executor.
  executor_binder(executor_arg_t, const executor_type& e,
      const executor_binder& other)
    : base_type(e, other.get())
  {
  }

  /// Construct a copy of a different executor wrapper type.
  /**
   * This constructor is only valid if the @c Executor type is constructible
   * from type @c OtherExecutor, and the type @c T is constructible from type
   * @c U.
   */
  template <typename U, typename OtherExecutor>
  executor_binder(const executor_binder<U, OtherExecutor>& other,
      constraint_t<is_constructible<Executor, OtherExecutor>::value> = 0,
      constraint_t<is_constructible<T, U>::value> = 0)
    : base_type(other.get_executor(), other.get())
  {
  }

  /// Construct a copy of a different executor wrapper type, but specify a
  /// different executor.
  /**
   * This constructor is only valid if the type @c T is constructible from type
   * @c U.
   */
  template <typename U, typename OtherExecutor>
  executor_binder(executor_arg_t, const executor_type& e,
      const executor_binder<U, OtherExecutor>& other,
      constraint_t<is_constructible<T, U>::value> = 0)
    : base_type(e, other.get())
  {
  }

  /// Move constructor.
  executor_binder(executor_binder&& other)
    : base_type(static_cast<executor_type&&>(other.get_executor()),
        static_cast<T&&>(other.get()))
  {
  }

  /// Move construct the target object, but specify a different executor.
  executor_binder(executor_arg_t, const executor_type& e,
      executor_binder&& other)
    : base_type(e, static_cast<T&&>(other.get()))
  {
  }

  /// Move construct from a different executor wrapper type.
  template <typename U, typename OtherExecutor>
  executor_binder(executor_binder<U, OtherExecutor>&& other,
      constraint_t<is_constructible<Executor, OtherExecutor>::value> = 0,
      constraint_t<is_constructible<T, U>::value> = 0)
    : base_type(static_cast<OtherExecutor&&>(other.get_executor()),
        static_cast<U&&>(other.get()))
  {
  }

  /// Move construct from a different executor wrapper type, but specify a
  /// different executor.
  template <typename U, typename OtherExecutor>
  executor_binder(executor_arg_t, const executor_type& e,
      executor_binder<U, OtherExecutor>&& other,
      constraint_t<is_constructible<T, U>::value> = 0)
    : base_type(e, static_cast<U&&>(other.get()))
  {
  }

  /// Destructor.
  ~executor_binder()
  {
  }

  /// Obtain a reference to the target object.
  target_type& get() noexcept
  {
    return this->target_;
  }

  /// Obtain a reference to the target object.
  const target_type& get() const noexcept
  {
    return this->target_;
  }

  /// Obtain the associated executor.
  executor_type get_executor() const noexcept
  {
    return this->executor_;
  }

  /// Forwarding function call operator.
  template <typename... Args>
  result_of_t<T(Args...)> operator()(Args&&... args) &
  {
    return this->target_(static_cast<Args&&>(args)...);
  }

  /// Forwarding function call operator.
  template <typename... Args>
  result_of_t<T(Args...)> operator()(Args&&... args) &&
  {
    return static_cast<T&&>(this->target_)(static_cast<Args&&>(args)...);
  }

  /// Forwarding function call operator.
  template <typename... Args>
  result_of_t<T(Args...)> operator()(Args&&... args) const&
  {
    return this->target_(static_cast<Args&&>(args)...);
  }

private:
  typedef detail::executor_binder_base<T, Executor,
    uses_executor<T, Executor>::value> base_type;
};

/// A function object type that adapts a @ref completion_token to specify that
/// the completion handler should have the supplied executor as its associated
/// executor.
/**
 * May also be used directly as a completion token, in which case it adapts the
 * asynchronous operation's default completion token (or asio::deferred
 * if no default is available).
 */
template <typename Executor>
struct partial_executor_binder
{
  /// Constructor that specifies associated executor.
  explicit partial_executor_binder(const Executor& ex)
    : executor_(ex)
  {
  }

  /// Adapt a @ref completion_token to specify that the completion handler
  /// should have the executor as its associated executor.
  template <typename CompletionToken>
  ASIO_NODISCARD inline
  constexpr executor_binder<decay_t<CompletionToken>, Executor>
  operator()(CompletionToken&& completion_token) const
  {
    return executor_binder<decay_t<CompletionToken>, Executor>(executor_arg_t(),
        static_cast<CompletionToken&&>(completion_token), executor_);
  }

//private:
  Executor executor_;
};

/// Create a partial completion token that associates an executor.
template <typename Executor>
ASIO_NODISCARD inline partial_executor_binder<Executor>
bind_executor(const Executor& ex,
    constraint_t<
      is_executor<Executor>::value || execution::is_executor<Executor>::value
    > = 0)
{
  return partial_executor_binder<Executor>(ex);
}

/// Associate an object of type @c T with an executor of type @c Executor.
template <typename Executor, typename T>
ASIO_NODISCARD inline executor_binder<decay_t<T>, Executor>
bind_executor(const Executor& ex, T&& t,
    constraint_t<
      is_executor<Executor>::value || execution::is_executor<Executor>::value
    > = 0)
{
  return executor_binder<decay_t<T>, Executor>(
      executor_arg_t(), ex, static_cast<T&&>(t));
}

/// Create a partial completion token that associates an execution context's
/// executor.
template <typename ExecutionContext>
ASIO_NODISCARD inline partial_executor_binder<
    typename ExecutionContext::executor_type>
bind_executor(ExecutionContext& ctx,
    constraint_t<
      is_convertible<ExecutionContext&, execution_context&>::value
    > = 0)
{
  return partial_executor_binder<typename ExecutionContext::executor_type>(
      ctx.get_executor());
}

/// Associate an object of type @c T with an execution context's executor.
template <typename ExecutionContext, typename T>
ASIO_NODISCARD inline executor_binder<decay_t<T>,
    typename ExecutionContext::executor_type>
bind_executor(ExecutionContext& ctx, T&& t,
    constraint_t<
      is_convertible<ExecutionContext&, execution_context&>::value
    > = 0)
{
  return executor_binder<decay_t<T>, typename ExecutionContext::executor_type>(
      executor_arg_t(), ctx.get_executor(), static_cast<T&&>(t));
}

#if !defined(GENERATING_DOCUMENTATION)

template <typename T, typename Executor>
struct uses_executor<executor_binder<T, Executor>, Executor>
  : true_type {};

namespace detail {

template <typename TargetAsyncResult, typename Executor, typename = void>
class executor_binder_completion_handler_async_result
{
public:
  template <typename T>
  explicit executor_binder_completion_handler_async_result(T&)
  {
  }
};

template <typename TargetAsyncResult, typename Executor>
class executor_binder_completion_handler_async_result<
    TargetAsyncResult, Executor,
    void_t<typename TargetAsyncResult::completion_handler_type >>
{
private:
  TargetAsyncResult target_;

public:
  typedef executor_binder<
    typename TargetAsyncResult::completion_handler_type, Executor>
      completion_handler_type;

  explicit executor_binder_completion_handler_async_result(
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
struct executor_binder_async_result_return_type
{
};

template <typename TargetAsyncResult>
struct executor_binder_async_result_return_type<TargetAsyncResult,
    void_t<typename TargetAsyncResult::return_type>>
{
  typedef typename TargetAsyncResult::return_type return_type;
};

} // namespace detail

template <typename T, typename Executor, typename Signature>
class async_result<executor_binder<T, Executor>, Signature> :
  public detail::executor_binder_completion_handler_async_result<
      async_result<T, Signature>, Executor>,
  public detail::executor_binder_async_result_return_type<
      async_result<T, Signature>>
{
public:
  explicit async_result(executor_binder<T, Executor>& b)
    : detail::executor_binder_completion_handler_async_result<
        async_result<T, Signature>, Executor>(b.get())
  {
  }

  template <typename Initiation>
  struct init_wrapper : detail::initiation_base<Initiation>
  {
    using detail::initiation_base<Initiation>::initiation_base;

    template <typename Handler, typename... Args>
    void operator()(Handler&& handler, const Executor& e, Args&&... args) &&
    {
      static_cast<Initiation&&>(*this)(
          executor_binder<decay_t<Handler>, Executor>(
            executor_arg_t(), e, static_cast<Handler&&>(handler)),
          static_cast<Args&&>(args)...);
    }

    template <typename Handler, typename... Args>
    void operator()(Handler&& handler,
        const Executor& e, Args&&... args) const &
    {
      static_cast<const Initiation&>(*this)(
          executor_binder<decay_t<Handler>, Executor>(
            executor_arg_t(), e, static_cast<Handler&&>(handler)),
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
          token.get(), token.get_executor(), static_cast<Args&&>(args)...))
  {
    return async_initiate<
      conditional_t<
        is_const<remove_reference_t<RawCompletionToken>>::value, const T, T>,
      Signature>(
        init_wrapper<decay_t<Initiation>>(
          static_cast<Initiation&&>(initiation)),
        token.get(), token.get_executor(), static_cast<Args&&>(args)...);
  }

private:
  async_result(const async_result&) = delete;
  async_result& operator=(const async_result&) = delete;
};

template <typename Executor, typename... Signatures>
struct async_result<partial_executor_binder<Executor>, Signatures...>
{
  template <typename Initiation, typename RawCompletionToken, typename... Args>
  static auto initiate(Initiation&& initiation,
      RawCompletionToken&& token, Args&&... args)
    -> decltype(
      async_initiate<Signatures...>(
        static_cast<Initiation&&>(initiation),
        executor_binder<
          default_completion_token_t<associated_executor_t<Initiation>>,
          Executor>(executor_arg_t(), token.executor_,
            default_completion_token_t<associated_executor_t<Initiation>>{}),
        static_cast<Args&&>(args)...))
  {
    return async_initiate<Signatures...>(
        static_cast<Initiation&&>(initiation),
        executor_binder<
          default_completion_token_t<associated_executor_t<Initiation>>,
          Executor>(executor_arg_t(), token.executor_,
            default_completion_token_t<associated_executor_t<Initiation>>{}),
        static_cast<Args&&>(args)...);
  }
};

template <template <typename, typename> class Associator,
    typename T, typename Executor, typename DefaultCandidate>
struct associator<Associator, executor_binder<T, Executor>, DefaultCandidate>
  : Associator<T, DefaultCandidate>
{
  static typename Associator<T, DefaultCandidate>::type get(
      const executor_binder<T, Executor>& b) noexcept
  {
    return Associator<T, DefaultCandidate>::get(b.get());
  }

  static auto get(const executor_binder<T, Executor>& b,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<T, DefaultCandidate>::get(b.get(), c))
  {
    return Associator<T, DefaultCandidate>::get(b.get(), c);
  }
};

template <typename T, typename Executor, typename Executor1>
struct associated_executor<executor_binder<T, Executor>, Executor1>
{
  typedef Executor type;

  static auto get(const executor_binder<T, Executor>& b,
      const Executor1& = Executor1()) noexcept
    -> decltype(b.get_executor())
  {
    return b.get_executor();
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_BIND_EXECUTOR_HPP
