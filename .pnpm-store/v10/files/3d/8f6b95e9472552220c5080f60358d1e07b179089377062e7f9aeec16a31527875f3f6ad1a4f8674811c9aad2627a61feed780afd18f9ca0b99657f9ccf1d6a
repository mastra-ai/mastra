//
// deferred.hpp
// ~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DEFERRED_HPP
#define ASIO_DEFERRED_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <tuple>
#include "asio/associator.hpp"
#include "asio/async_result.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/detail/utility.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

/// Trait for detecting objects that are usable as deferred operations.
template <typename T>
struct is_deferred : false_type
{
};

/// Helper type to wrap multiple completion signatures.
template <typename... Signatures>
struct deferred_signatures
{
};

namespace detail {

// Helper trait for getting the completion signatures of the tail in a sequence
// when invoked with the specified arguments.

template <typename Tail, typename... Signatures>
struct deferred_sequence_signatures;

template <typename Tail, typename R, typename... Args, typename... Signatures>
struct deferred_sequence_signatures<Tail, R(Args...), Signatures...>
  : completion_signature_of<decltype(declval<Tail>()(declval<Args>()...))>
{
  static_assert(
      !is_same<decltype(declval<Tail>()(declval<Args>()...)), void>::value,
      "deferred functions must produce a deferred return type");
};

// Completion handler for the head component of a deferred sequence.
template <typename Handler, typename Tail>
class deferred_sequence_handler
{
public:
  template <typename H, typename T>
  explicit deferred_sequence_handler(H&& handler, T&& tail)
    : handler_(static_cast<H&&>(handler)),
      tail_(static_cast<T&&>(tail))
  {
  }

  template <typename... Args>
  void operator()(Args&&... args)
  {
    static_cast<Tail&&>(tail_)(
        static_cast<Args&&>(args)...)(
          static_cast<Handler&&>(handler_));
  }

//private:
  Handler handler_;
  Tail tail_;
};

template <typename Head, typename Tail, typename... Signatures>
class deferred_sequence_base
{
private:
  struct initiate
  {
    template <typename Handler>
    void operator()(Handler&& handler, Head head, Tail&& tail)
    {
      static_cast<Head&&>(head)(
          deferred_sequence_handler<decay_t<Handler>, decay_t<Tail>>(
            static_cast<Handler&&>(handler), static_cast<Tail&&>(tail)));
    }
  };

  Head head_;
  Tail tail_;

public:
  template <typename H, typename T>
  constexpr explicit deferred_sequence_base(H&& head, T&& tail)
    : head_(static_cast<H&&>(head)),
      tail_(static_cast<T&&>(tail))
  {
  }

  template <ASIO_COMPLETION_TOKEN_FOR(Signatures...) CompletionToken>
  auto operator()(CompletionToken&& token) &&
    -> decltype(
      async_initiate<CompletionToken, Signatures...>(
        initiate(), token, static_cast<Head&&>(this->head_),
        static_cast<Tail&&>(this->tail_)))
  {
    return async_initiate<CompletionToken, Signatures...>(initiate(),
        token, static_cast<Head&&>(head_), static_cast<Tail&&>(tail_));
  }

  template <ASIO_COMPLETION_TOKEN_FOR(Signatures...) CompletionToken>
  auto operator()(CompletionToken&& token) const &
    -> decltype(
      async_initiate<CompletionToken, Signatures...>(
        initiate(), token, this->head_, this->tail_))
  {
    return async_initiate<CompletionToken, Signatures...>(
        initiate(), token, head_, tail_);
  }
};

// Two-step application of variadic Signatures to determine correct base type.

template <typename Head, typename Tail>
struct deferred_sequence_types
{
  template <typename... Signatures>
  struct op1
  {
    typedef deferred_sequence_base<Head, Tail, Signatures...> type;
  };

  template <typename... Signatures>
  struct op2
  {
    typedef typename deferred_sequence_signatures<Tail, Signatures...>::template
      apply<op1>::type::type type;
  };

  typedef typename completion_signature_of<Head>::template
    apply<op2>::type::type base;
};

} // namespace detail

/// Used to represent an empty deferred action.
struct deferred_noop
{
  /// No effect.
  template <typename... Args>
  void operator()(Args&&...) &&
  {
  }

  /// No effect.
  template <typename... Args>
  void operator()(Args&&...) const &
  {
  }
};

#if !defined(GENERATING_DOCUMENTATION)
template <>
struct is_deferred<deferred_noop> : true_type
{
};
#endif // !defined(GENERATING_DOCUMENTATION)

/// Tag type to disambiguate deferred constructors.
struct deferred_init_tag {};

/// Wraps a function object so that it may be used as an element in a deferred
/// composition.
template <typename Function>
class deferred_function
{
public:
  /// Constructor.
  template <typename F>
  constexpr explicit deferred_function(deferred_init_tag, F&& function)
    : function_(static_cast<F&&>(function))
  {
  }

//private:
  Function function_;

public:
  template <typename... Args>
  auto operator()(Args&&... args) &&
    -> decltype(
      static_cast<Function&&>(this->function_)(static_cast<Args&&>(args)...))
  {
    return static_cast<Function&&>(function_)(static_cast<Args&&>(args)...);
  }

  template <typename... Args>
  auto operator()(Args&&... args) const &
    -> decltype(Function(function_)(static_cast<Args&&>(args)...))
  {
    return Function(function_)(static_cast<Args&&>(args)...);
  }
};

#if !defined(GENERATING_DOCUMENTATION)
template <typename Function>
struct is_deferred<deferred_function<Function>> : true_type
{
};
#endif // !defined(GENERATING_DOCUMENTATION)

/// Encapsulates deferred values.
template <typename... Values>
class ASIO_NODISCARD deferred_values
{
private:
  std::tuple<Values...> values_;

  struct initiate
  {
    template <typename Handler, typename... V>
    void operator()(Handler handler, V&&... values)
    {
      static_cast<Handler&&>(handler)(static_cast<V&&>(values)...);
    }
  };

  template <typename CompletionToken, std::size_t... I>
  auto invoke_helper(CompletionToken&& token, detail::index_sequence<I...>)
    -> decltype(
      async_initiate<CompletionToken, void(Values...)>(initiate(), token,
        std::get<I>(static_cast<std::tuple<Values...>&&>(this->values_))...))
  {
    return async_initiate<CompletionToken, void(Values...)>(initiate(), token,
        std::get<I>(static_cast<std::tuple<Values...>&&>(values_))...);
  }

  template <typename CompletionToken, std::size_t... I>
  auto const_invoke_helper(CompletionToken&& token,
      detail::index_sequence<I...>)
    -> decltype(
      async_initiate<CompletionToken, void(Values...)>(
        initiate(), token, std::get<I>(values_)...))
  {
    return async_initiate<CompletionToken, void(Values...)>(
        initiate(), token, std::get<I>(values_)...);
  }

public:
  /// Construct a deferred asynchronous operation from the arguments to an
  /// initiation function object.
  template <typename... V>
  constexpr explicit deferred_values(
      deferred_init_tag, V&&... values)
    : values_(static_cast<V&&>(values)...)
  {
  }

  /// Initiate the deferred operation using the supplied completion token.
  template <ASIO_COMPLETION_TOKEN_FOR(void(Values...)) CompletionToken>
  auto operator()(CompletionToken&& token) &&
    -> decltype(
      this->invoke_helper(
        static_cast<CompletionToken&&>(token),
        detail::index_sequence_for<Values...>()))
  {
    return this->invoke_helper(
        static_cast<CompletionToken&&>(token),
        detail::index_sequence_for<Values...>());
  }

  template <ASIO_COMPLETION_TOKEN_FOR(void(Values...)) CompletionToken>
  auto operator()(CompletionToken&& token) const &
    -> decltype(
      this->const_invoke_helper(
        static_cast<CompletionToken&&>(token),
        detail::index_sequence_for<Values...>()))
  {
    return this->const_invoke_helper(
        static_cast<CompletionToken&&>(token),
        detail::index_sequence_for<Values...>());
  }
};

#if !defined(GENERATING_DOCUMENTATION)
template <typename... Values>
struct is_deferred<deferred_values<Values...>> : true_type
{
};
#endif // !defined(GENERATING_DOCUMENTATION)

/// Encapsulates a deferred asynchronous operation.
template <typename Signature, typename Initiation, typename... InitArgs>
class ASIO_NODISCARD deferred_async_operation
{
private:
  typedef decay_t<Initiation> initiation_t;
  initiation_t initiation_;
  typedef std::tuple<decay_t<InitArgs>...> init_args_t;
  init_args_t init_args_;

  template <typename CompletionToken, std::size_t... I>
  auto invoke_helper(CompletionToken&& token, detail::index_sequence<I...>)
    -> decltype(
      async_initiate<CompletionToken, Signature>(
        static_cast<initiation_t&&>(initiation_), token,
        std::get<I>(static_cast<init_args_t&&>(init_args_))...))
  {
    return async_initiate<CompletionToken, Signature>(
        static_cast<initiation_t&&>(initiation_), token,
        std::get<I>(static_cast<init_args_t&&>(init_args_))...);
  }

  template <typename CompletionToken, std::size_t... I>
  auto const_invoke_helper(CompletionToken&& token,
      detail::index_sequence<I...>) const &
    -> decltype(
      async_initiate<CompletionToken, Signature>(
        conditional_t<true, initiation_t, CompletionToken>(initiation_),
        token, std::get<I>(init_args_)...))
  {
    return async_initiate<CompletionToken, Signature>(
        initiation_t(initiation_), token, std::get<I>(init_args_)...);
  }

public:
  /// Construct a deferred asynchronous operation from the arguments to an
  /// initiation function object.
  template <typename I, typename... A>
  constexpr explicit deferred_async_operation(
      deferred_init_tag, I&& initiation, A&&... init_args)
    : initiation_(static_cast<I&&>(initiation)),
      init_args_(static_cast<A&&>(init_args)...)
  {
  }

  /// Initiate the asynchronous operation using the supplied completion token.
  template <ASIO_COMPLETION_TOKEN_FOR(Signature) CompletionToken>
  auto operator()(CompletionToken&& token) &&
    -> decltype(
      this->invoke_helper(
        static_cast<CompletionToken&&>(token),
        detail::index_sequence_for<InitArgs...>()))
  {
    return this->invoke_helper(
        static_cast<CompletionToken&&>(token),
        detail::index_sequence_for<InitArgs...>());
  }

  template <ASIO_COMPLETION_TOKEN_FOR(Signature) CompletionToken>
  auto operator()(CompletionToken&& token) const &
    -> decltype(
      this->const_invoke_helper(
        static_cast<CompletionToken&&>(token),
        detail::index_sequence_for<InitArgs...>()))
  {
    return this->const_invoke_helper(
        static_cast<CompletionToken&&>(token),
        detail::index_sequence_for<InitArgs...>());
  }
};

/// Encapsulates a deferred asynchronous operation thas has multiple completion
/// signatures.
template <typename... Signatures, typename Initiation, typename... InitArgs>
class ASIO_NODISCARD deferred_async_operation<
    deferred_signatures<Signatures...>, Initiation, InitArgs...>
{
private:
  typedef decay_t<Initiation> initiation_t;
  initiation_t initiation_;
  typedef std::tuple<decay_t<InitArgs>...> init_args_t;
  init_args_t init_args_;

  template <typename CompletionToken, std::size_t... I>
  auto invoke_helper(CompletionToken&& token, detail::index_sequence<I...>)
    -> decltype(
      async_initiate<CompletionToken, Signatures...>(
        static_cast<initiation_t&&>(initiation_), token,
        std::get<I>(static_cast<init_args_t&&>(init_args_))...))
  {
    return async_initiate<CompletionToken, Signatures...>(
        static_cast<initiation_t&&>(initiation_), token,
        std::get<I>(static_cast<init_args_t&&>(init_args_))...);
  }

  template <typename CompletionToken, std::size_t... I>
  auto const_invoke_helper(CompletionToken&& token,
      detail::index_sequence<I...>) const &
    -> decltype(
      async_initiate<CompletionToken, Signatures...>(
        initiation_t(initiation_), token, std::get<I>(init_args_)...))
  {
    return async_initiate<CompletionToken, Signatures...>(
        initiation_t(initiation_), token, std::get<I>(init_args_)...);
  }

public:
  /// Construct a deferred asynchronous operation from the arguments to an
  /// initiation function object.
  template <typename I, typename... A>
  constexpr explicit deferred_async_operation(
      deferred_init_tag, I&& initiation, A&&... init_args)
    : initiation_(static_cast<I&&>(initiation)),
      init_args_(static_cast<A&&>(init_args)...)
  {
  }

  /// Initiate the asynchronous operation using the supplied completion token.
  template <ASIO_COMPLETION_TOKEN_FOR(Signatures...) CompletionToken>
  auto operator()(CompletionToken&& token) &&
    -> decltype(
      this->invoke_helper(
        static_cast<CompletionToken&&>(token),
        detail::index_sequence_for<InitArgs...>()))
  {
    return this->invoke_helper(
        static_cast<CompletionToken&&>(token),
        detail::index_sequence_for<InitArgs...>());
  }

  template <ASIO_COMPLETION_TOKEN_FOR(Signatures...) CompletionToken>
  auto operator()(CompletionToken&& token) const &
    -> decltype(
      this->const_invoke_helper(
        static_cast<CompletionToken&&>(token),
        detail::index_sequence_for<InitArgs...>()))
  {
    return this->const_invoke_helper(
        static_cast<CompletionToken&&>(token),
        detail::index_sequence_for<InitArgs...>());
  }
};

#if !defined(GENERATING_DOCUMENTATION)
template <typename Signature, typename Initiation, typename... InitArgs>
struct is_deferred<
    deferred_async_operation<Signature, Initiation, InitArgs...>> : true_type
{
};
#endif // !defined(GENERATING_DOCUMENTATION)

/// Defines a link between two consecutive operations in a sequence.
template <typename Head, typename Tail>
class ASIO_NODISCARD deferred_sequence :
  public detail::deferred_sequence_types<Head, Tail>::base
{
public:
  template <typename H, typename T>
  constexpr explicit deferred_sequence(deferred_init_tag, H&& head, T&& tail)
    : detail::deferred_sequence_types<Head, Tail>::base(
        static_cast<H&&>(head), static_cast<T&&>(tail))
  {
  }

#if defined(GENERATING_DOCUMENTATION)
  template <typename CompletionToken>
  auto operator()(CompletionToken&& token) &&;

  template <typename CompletionToken>
  auto operator()(CompletionToken&& token) const &;
#endif // defined(GENERATING_DOCUMENTATION)
};

#if !defined(GENERATING_DOCUMENTATION)
template <typename Head, typename Tail>
struct is_deferred<deferred_sequence<Head, Tail>> : true_type
{
};
#endif // !defined(GENERATING_DOCUMENTATION)

/// Used to represent a deferred conditional branch.
template <typename OnTrue = deferred_noop, typename OnFalse = deferred_noop>
class ASIO_NODISCARD deferred_conditional
{
private:
  template <typename T, typename F> friend class deferred_conditional;

  // Helper constructor.
  template <typename T, typename F>
  explicit deferred_conditional(bool b, T&& on_true, F&& on_false)
    : on_true_(static_cast<T&&>(on_true)),
      on_false_(static_cast<F&&>(on_false)),
      bool_(b)
  {
  }

  OnTrue on_true_;
  OnFalse on_false_;
  bool bool_;

public:
  /// Construct a deferred conditional with the value to determine which branch
  /// will be executed.
  constexpr explicit deferred_conditional(bool b)
    : on_true_(),
      on_false_(),
      bool_(b)
  {
  }

  /// Invoke the conditional branch bsaed on the stored value.
  template <typename... Args>
  auto operator()(Args&&... args) &&
    -> decltype(static_cast<OnTrue&&>(on_true_)(static_cast<Args&&>(args)...))
  {
    if (bool_)
    {
      return static_cast<OnTrue&&>(on_true_)(static_cast<Args&&>(args)...);
    }
    else
    {
      return static_cast<OnFalse&&>(on_false_)(static_cast<Args&&>(args)...);
    }
  }

  template <typename... Args>
  auto operator()(Args&&... args) const &
    -> decltype(on_true_(static_cast<Args&&>(args)...))
  {
    if (bool_)
    {
      return on_true_(static_cast<Args&&>(args)...);
    }
    else
    {
      return on_false_(static_cast<Args&&>(args)...);
    }
  }

  /// Set the true branch of the conditional.
  template <typename T>
  deferred_conditional<T, OnFalse> then(T on_true,
      constraint_t<
        is_deferred<T>::value
      >* = 0,
      constraint_t<
        is_same<
          conditional_t<true, OnTrue, T>,
          deferred_noop
        >::value
      >* = 0) &&
  {
    return deferred_conditional<T, OnFalse>(
        bool_, static_cast<T&&>(on_true),
        static_cast<OnFalse&&>(on_false_));
  }

  /// Set the false branch of the conditional.
  template <typename T>
  deferred_conditional<OnTrue, T> otherwise(T on_false,
      constraint_t<
        is_deferred<T>::value
      >* = 0,
      constraint_t<
        !is_same<
          conditional_t<true, OnTrue, T>,
          deferred_noop
        >::value
      >* = 0,
      constraint_t<
        is_same<
          conditional_t<true, OnFalse, T>,
          deferred_noop
        >::value
      >* = 0) &&
  {
    return deferred_conditional<OnTrue, T>(
        bool_, static_cast<OnTrue&&>(on_true_),
        static_cast<T&&>(on_false));
  }
};

#if !defined(GENERATING_DOCUMENTATION)
template <typename OnTrue, typename OnFalse>
struct is_deferred<deferred_conditional<OnTrue, OnFalse>> : true_type
{
};
#endif // !defined(GENERATING_DOCUMENTATION)

/// Class used to specify that an asynchronous operation should return a
/// function object to lazily launch the operation.
/**
 * The deferred_t class is used to indicate that an asynchronous operation
 * should return a function object which is itself an initiation function. A
 * deferred_t object may be passed as a completion token to an asynchronous
 * operation, typically as the default completion token:
 *
 * @code auto my_deferred_op = my_socket.async_read_some(my_buffer); @endcode
 *
 * or by explicitly passing the special value @c asio::deferred:
 *
 * @code auto my_deferred_op
 *   = my_socket.async_read_some(my_buffer,
 *       asio::deferred); @endcode
 *
 * The initiating function (async_read_some in the above example) returns a
 * function object that will lazily initiate the operation.
 */
class deferred_t
{
public:
  /// Default constructor.
  constexpr deferred_t()
  {
  }

  /// Adapts an executor to add the @c deferred_t completion token as the
  /// default.
  template <typename InnerExecutor>
  struct executor_with_default : InnerExecutor
  {
    /// Specify @c deferred_t as the default completion token type.
    typedef deferred_t default_completion_token_type;

    /// Construct the adapted executor from the inner executor type.
    template <typename InnerExecutor1>
    executor_with_default(const InnerExecutor1& ex,
        constraint_t<
          conditional_t<
            !is_same<InnerExecutor1, executor_with_default>::value,
            is_convertible<InnerExecutor1, InnerExecutor>,
            false_type
          >::value
        > = 0) noexcept
      : InnerExecutor(ex)
    {
    }
  };

  /// Type alias to adapt an I/O object to use @c deferred_t as its
  /// default completion token type.
  template <typename T>
  using as_default_on_t = typename T::template rebind_executor<
      executor_with_default<typename T::executor_type>>::other;

  /// Function helper to adapt an I/O object to use @c deferred_t as its
  /// default completion token type.
  template <typename T>
  static typename decay_t<T>::template rebind_executor<
      executor_with_default<typename decay_t<T>::executor_type>
    >::other
  as_default_on(T&& object)
  {
    return typename decay_t<T>::template rebind_executor<
        executor_with_default<typename decay_t<T>::executor_type>
      >::other(static_cast<T&&>(object));
  }

  /// Creates a new deferred from a function.
  template <typename Function>
  constraint_t<
    !is_deferred<decay_t<Function>>::value,
    deferred_function<decay_t<Function>>
  > operator()(Function&& function) const
  {
    return deferred_function<decay_t<Function>>(
        deferred_init_tag{}, static_cast<Function&&>(function));
  }

  /// Passes through anything that is already deferred.
  template <typename T>
  constraint_t<
    is_deferred<decay_t<T>>::value,
    decay_t<T>
  > operator()(T&& t) const
  {
    return static_cast<T&&>(t);
  }

  /// Returns a deferred operation that returns the provided values.
  template <typename... Args>
  static constexpr deferred_values<decay_t<Args>...> values(Args&&... args)
  {
    return deferred_values<decay_t<Args>...>(
        deferred_init_tag{}, static_cast<Args&&>(args)...);
  }

  /// Creates a conditional object for branching deferred operations.
  static constexpr deferred_conditional<> when(bool b)
  {
    return deferred_conditional<>(b);
  }
};

/// Pipe operator used to chain deferred operations.
template <typename Head, typename Tail>
inline auto operator|(Head head, Tail&& tail)
  -> constraint_t<
      is_deferred<Head>::value,
      decltype(static_cast<Head&&>(head)(static_cast<Tail&&>(tail)))
    >
{
  return static_cast<Head&&>(head)(static_cast<Tail&&>(tail));
}

/// A @ref completion_token object used to specify that an asynchronous
/// operation should return a function object to lazily launch the operation.
/**
 * See the documentation for asio::deferred_t for a usage example.
 */
ASIO_INLINE_VARIABLE constexpr deferred_t deferred;

} // namespace asio

#include "asio/detail/pop_options.hpp"

#include "asio/impl/deferred.hpp"

#endif // ASIO_DEFERRED_HPP
