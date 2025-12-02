//
// async_result.hpp
// ~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_ASYNC_RESULT_HPP
#define ASIO_ASYNC_RESULT_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/type_traits.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

template <typename T>
struct is_completion_signature : false_type
{
};

template <typename R, typename... Args>
struct is_completion_signature<R(Args...)> : true_type
{
};

template <typename R, typename... Args>
struct is_completion_signature<R(Args...) &> : true_type
{
};

template <typename R, typename... Args>
struct is_completion_signature<R(Args...) &&> : true_type
{
};

# if defined(ASIO_HAS_NOEXCEPT_FUNCTION_TYPE)

template <typename R, typename... Args>
struct is_completion_signature<R(Args...) noexcept> : true_type
{
};

template <typename R, typename... Args>
struct is_completion_signature<R(Args...) & noexcept> : true_type
{
};

template <typename R, typename... Args>
struct is_completion_signature<R(Args...) && noexcept> : true_type
{
};

# endif // defined(ASIO_HAS_NOEXCEPT_FUNCTION_TYPE)

template <typename... T>
struct are_completion_signatures : false_type
{
};

template <>
struct are_completion_signatures<>
  : true_type
{
};

template <typename T0>
struct are_completion_signatures<T0>
  : is_completion_signature<T0>
{
};

template <typename T0, typename... TN>
struct are_completion_signatures<T0, TN...>
  : integral_constant<bool, (
      is_completion_signature<T0>::value
        && are_completion_signatures<TN...>::value)>
{
};

} // namespace detail

#if defined(ASIO_HAS_CONCEPTS)

namespace detail {

template <typename T, typename... Args>
ASIO_CONCEPT callable_with = requires(T&& t, Args&&... args)
{
  static_cast<T&&>(t)(static_cast<Args&&>(args)...);
};

template <typename T, typename... Signatures>
struct is_completion_handler_for : false_type
{
};

template <typename T, typename R, typename... Args>
struct is_completion_handler_for<T, R(Args...)>
  : integral_constant<bool, (callable_with<decay_t<T>, Args...>)>
{
};

template <typename T, typename R, typename... Args>
struct is_completion_handler_for<T, R(Args...) &>
  : integral_constant<bool, (callable_with<decay_t<T>&, Args...>)>
{
};

template <typename T, typename R, typename... Args>
struct is_completion_handler_for<T, R(Args...) &&>
  : integral_constant<bool, (callable_with<decay_t<T>&&, Args...>)>
{
};

# if defined(ASIO_HAS_NOEXCEPT_FUNCTION_TYPE)

template <typename T, typename R, typename... Args>
struct is_completion_handler_for<T, R(Args...) noexcept>
  : integral_constant<bool, (callable_with<decay_t<T>, Args...>)>
{
};

template <typename T, typename R, typename... Args>
struct is_completion_handler_for<T, R(Args...) & noexcept>
  : integral_constant<bool, (callable_with<decay_t<T>&, Args...>)>
{
};

template <typename T, typename R, typename... Args>
struct is_completion_handler_for<T, R(Args...) && noexcept>
  : integral_constant<bool, (callable_with<decay_t<T>&&, Args...>)>
{
};

# endif // defined(ASIO_HAS_NOEXCEPT_FUNCTION_TYPE)

template <typename T, typename Signature0, typename... SignatureN>
struct is_completion_handler_for<T, Signature0, SignatureN...>
  : integral_constant<bool, (
      is_completion_handler_for<T, Signature0>::value
        && is_completion_handler_for<T, SignatureN...>::value)>
{
};

} // namespace detail

template <typename T>
ASIO_CONCEPT completion_signature =
  detail::is_completion_signature<T>::value;

#define ASIO_COMPLETION_SIGNATURE \
  ::asio::completion_signature

template <typename T, typename... Signatures>
ASIO_CONCEPT completion_handler_for =
  detail::are_completion_signatures<Signatures...>::value
    && detail::is_completion_handler_for<T, Signatures...>::value;

#define ASIO_COMPLETION_HANDLER_FOR(sig) \
  ::asio::completion_handler_for<sig>
#define ASIO_COMPLETION_HANDLER_FOR2(sig0, sig1) \
  ::asio::completion_handler_for<sig0, sig1>
#define ASIO_COMPLETION_HANDLER_FOR3(sig0, sig1, sig2) \
  ::asio::completion_handler_for<sig0, sig1, sig2>

#else // defined(ASIO_HAS_CONCEPTS)

#define ASIO_COMPLETION_SIGNATURE typename
#define ASIO_COMPLETION_HANDLER_FOR(sig) typename
#define ASIO_COMPLETION_HANDLER_FOR2(sig0, sig1) typename
#define ASIO_COMPLETION_HANDLER_FOR3(sig0, sig1, sig2) typename

#endif // defined(ASIO_HAS_CONCEPTS)

namespace detail {

template <typename T>
struct is_lvalue_completion_signature : false_type
{
};

template <typename R, typename... Args>
struct is_lvalue_completion_signature<R(Args...) &> : true_type
{
};

# if defined(ASIO_HAS_NOEXCEPT_FUNCTION_TYPE)

template <typename R, typename... Args>
struct is_lvalue_completion_signature<R(Args...) & noexcept> : true_type
{
};

# endif // defined(ASIO_HAS_NOEXCEPT_FUNCTION_TYPE)

template <typename... Signatures>
struct are_any_lvalue_completion_signatures : false_type
{
};

template <typename Sig0>
struct are_any_lvalue_completion_signatures<Sig0>
  : is_lvalue_completion_signature<Sig0>
{
};

template <typename Sig0, typename... SigN>
struct are_any_lvalue_completion_signatures<Sig0, SigN...>
  : integral_constant<bool, (
      is_lvalue_completion_signature<Sig0>::value
        || are_any_lvalue_completion_signatures<SigN...>::value)>
{
};

template <typename T>
struct is_rvalue_completion_signature : false_type
{
};

template <typename R, typename... Args>
struct is_rvalue_completion_signature<R(Args...) &&> : true_type
{
};

# if defined(ASIO_HAS_NOEXCEPT_FUNCTION_TYPE)

template <typename R, typename... Args>
struct is_rvalue_completion_signature<R(Args...) && noexcept> : true_type
{
};

# endif // defined(ASIO_HAS_NOEXCEPT_FUNCTION_TYPE)

template <typename... Signatures>
struct are_any_rvalue_completion_signatures : false_type
{
};

template <typename Sig0>
struct are_any_rvalue_completion_signatures<Sig0>
  : is_rvalue_completion_signature<Sig0>
{
};

template <typename Sig0, typename... SigN>
struct are_any_rvalue_completion_signatures<Sig0, SigN...>
  : integral_constant<bool, (
      is_rvalue_completion_signature<Sig0>::value
        || are_any_rvalue_completion_signatures<SigN...>::value)>
{
};

template <typename T>
struct simple_completion_signature;

template <typename R, typename... Args>
struct simple_completion_signature<R(Args...)>
{
  typedef R type(Args...);
};

template <typename R, typename... Args>
struct simple_completion_signature<R(Args...) &>
{
  typedef R type(Args...);
};

template <typename R, typename... Args>
struct simple_completion_signature<R(Args...) &&>
{
  typedef R type(Args...);
};

# if defined(ASIO_HAS_NOEXCEPT_FUNCTION_TYPE)

template <typename R, typename... Args>
struct simple_completion_signature<R(Args...) noexcept>
{
  typedef R type(Args...);
};

template <typename R, typename... Args>
struct simple_completion_signature<R(Args...) & noexcept>
{
  typedef R type(Args...);
};

template <typename R, typename... Args>
struct simple_completion_signature<R(Args...) && noexcept>
{
  typedef R type(Args...);
};

# endif // defined(ASIO_HAS_NOEXCEPT_FUNCTION_TYPE)

template <typename CompletionToken,
    ASIO_COMPLETION_SIGNATURE... Signatures>
class completion_handler_async_result
{
public:
  typedef CompletionToken completion_handler_type;
  typedef void return_type;

  explicit completion_handler_async_result(completion_handler_type&)
  {
  }

  return_type get()
  {
  }

  template <typename Initiation,
      ASIO_COMPLETION_HANDLER_FOR(Signatures...) RawCompletionToken,
      typename... Args>
  static return_type initiate(Initiation&& initiation,
      RawCompletionToken&& token, Args&&... args)
  {
    static_cast<Initiation&&>(initiation)(
        static_cast<RawCompletionToken&&>(token),
        static_cast<Args&&>(args)...);
  }

private:
  completion_handler_async_result(
      const completion_handler_async_result&) = delete;
  completion_handler_async_result& operator=(
      const completion_handler_async_result&) = delete;
};

} // namespace detail

#if defined(GENERATING_DOCUMENTATION)

/// An interface for customising the behaviour of an initiating function.
/**
 * The async_result trait is a customisation point that is used within the
 * initiating function for an @ref asynchronous_operation. The trait combines:
 *
 * @li the completion signature (or signatures) that describe the arguments that
 * an asynchronous operation will pass to a completion handler;
 *
 * @li the @ref completion_token type supplied by the caller; and
 *
 * @li the operation's internal implementation.
 *
 * Specialisations of the trait must satisfy the @ref async_result_requirements,
 * and are reponsible for determining:
 *
 * @li the concrete completion handler type to be called at the end of the
 * asynchronous operation;
 *
 * @li the initiating function return type;
 *
 * @li how the return value of the initiating function is obtained; and
 *
 * @li how and when to launch the operation by invoking the supplied initiation
 * function object.
 *
 * This template may be specialised for user-defined completion token types.
 * The primary template assumes that the CompletionToken is the already a
 * concrete completion handler.
 *
 * @note For backwards compatibility, the primary template implements member
 * types and functions that are associated with legacy forms of the async_result
 * trait. These are annotated as "Legacy" in the documentation below. User
 * specialisations of this trait do not need to implement these in order to
 * satisfy the @ref async_result_requirements.
 *
 * In general, implementers of asynchronous operations should use the
 * async_initiate function rather than using the async_result trait directly.
 */
template <typename CompletionToken,
    ASIO_COMPLETION_SIGNATURE... Signatures>
class async_result
{
public:
  /// (Legacy.) The concrete completion handler type for the specific signature.
  typedef CompletionToken completion_handler_type;

  /// (Legacy.) The return type of the initiating function.
  typedef void return_type;

  /// (Legacy.) Construct an async result from a given handler.
  /**
   * When using a specalised async_result, the constructor has an opportunity
   * to initialise some state associated with the completion handler, which is
   * then returned from the initiating function.
   */
  explicit async_result(completion_handler_type& h);

  /// (Legacy.) Obtain the value to be returned from the initiating function.
  return_type get();

  /// Initiate the asynchronous operation that will produce the result, and
  /// obtain the value to be returned from the initiating function.
  template <typename Initiation, typename RawCompletionToken, typename... Args>
  static return_type initiate(
      Initiation&& initiation,
      RawCompletionToken&& token,
      Args&&... args);

private:
  async_result(const async_result&) = delete;
  async_result& operator=(const async_result&) = delete;
};

#else // defined(GENERATING_DOCUMENTATION)

template <typename CompletionToken,
    ASIO_COMPLETION_SIGNATURE... Signatures>
class async_result :
  public conditional_t<
      detail::are_any_lvalue_completion_signatures<Signatures...>::value
        || !detail::are_any_rvalue_completion_signatures<Signatures...>::value,
      detail::completion_handler_async_result<CompletionToken, Signatures...>,
      async_result<CompletionToken,
        typename detail::simple_completion_signature<Signatures>::type...>
    >
{
public:
  typedef conditional_t<
      detail::are_any_lvalue_completion_signatures<Signatures...>::value
        || !detail::are_any_rvalue_completion_signatures<Signatures...>::value,
      detail::completion_handler_async_result<CompletionToken, Signatures...>,
      async_result<CompletionToken,
        typename detail::simple_completion_signature<Signatures>::type...>
    > base_type;

  using base_type::base_type;

private:
  async_result(const async_result&) = delete;
  async_result& operator=(const async_result&) = delete;
};

template <ASIO_COMPLETION_SIGNATURE... Signatures>
class async_result<void, Signatures...>
{
  // Empty.
};

#endif // defined(GENERATING_DOCUMENTATION)

/// Helper template to deduce the handler type from a CompletionToken, capture
/// a local copy of the handler, and then create an async_result for the
/// handler.
template <typename CompletionToken,
    ASIO_COMPLETION_SIGNATURE... Signatures>
struct async_completion
{
  /// The real handler type to be used for the asynchronous operation.
  typedef typename asio::async_result<
    decay_t<CompletionToken>, Signatures...>::completion_handler_type
      completion_handler_type;

  /// Constructor.
  /**
   * The constructor creates the concrete completion handler and makes the link
   * between the handler and the asynchronous result.
   */
  explicit async_completion(CompletionToken& token)
    : completion_handler(static_cast<conditional_t<
        is_same<CompletionToken, completion_handler_type>::value,
        completion_handler_type&, CompletionToken&&>>(token)),
      result(completion_handler)
  {
  }

  /// A copy of, or reference to, a real handler object.
  conditional_t<
    is_same<CompletionToken, completion_handler_type>::value,
    completion_handler_type&, completion_handler_type> completion_handler;

  /// The result of the asynchronous operation's initiating function.
  async_result<decay_t<CompletionToken>, Signatures...> result;
};

namespace detail {

struct async_result_memfns_base
{
  void initiate();
};

template <typename T>
struct async_result_memfns_derived
  : T, async_result_memfns_base
{
};

template <typename T, T>
struct async_result_memfns_check
{
};

template <typename>
char (&async_result_initiate_memfn_helper(...))[2];

template <typename T>
char async_result_initiate_memfn_helper(
    async_result_memfns_check<
      void (async_result_memfns_base::*)(),
      &async_result_memfns_derived<T>::initiate>*);

template <typename CompletionToken,
    ASIO_COMPLETION_SIGNATURE... Signatures>
struct async_result_has_initiate_memfn
  : integral_constant<bool, sizeof(async_result_initiate_memfn_helper<
      async_result<decay_t<CompletionToken>, Signatures...>
    >(0)) != 1>
{
};

} // namespace detail

#if defined(GENERATING_DOCUMENTATION)
# define ASIO_INITFN_RESULT_TYPE(ct, sig) \
  void_or_deduced
# define ASIO_INITFN_RESULT_TYPE2(ct, sig0, sig1) \
  void_or_deduced
# define ASIO_INITFN_RESULT_TYPE3(ct, sig0, sig1, sig2) \
  void_or_deduced
#else
# define ASIO_INITFN_RESULT_TYPE(ct, sig) \
  typename ::asio::async_result< \
    typename ::asio::decay<ct>::type, sig>::return_type
# define ASIO_INITFN_RESULT_TYPE2(ct, sig0, sig1) \
  typename ::asio::async_result< \
    typename ::asio::decay<ct>::type, sig0, sig1>::return_type
# define ASIO_INITFN_RESULT_TYPE3(ct, sig0, sig1, sig2) \
  typename ::asio::async_result< \
    typename ::asio::decay<ct>::type, sig0, sig1, sig2>::return_type
#define ASIO_HANDLER_TYPE(ct, sig) \
  typename ::asio::async_result< \
    typename ::asio::decay<ct>::type, sig>::completion_handler_type
#define ASIO_HANDLER_TYPE2(ct, sig0, sig1) \
  typename ::asio::async_result< \
    typename ::asio::decay<ct>::type, \
      sig0, sig1>::completion_handler_type
#define ASIO_HANDLER_TYPE3(ct, sig0, sig1, sig2) \
  typename ::asio::async_result< \
    typename ::asio::decay<ct>::type, \
      sig0, sig1, sig2>::completion_handler_type
#endif

#if defined(GENERATING_DOCUMENTATION)
# define ASIO_INITFN_AUTO_RESULT_TYPE(ct, sig) \
  auto
# define ASIO_INITFN_AUTO_RESULT_TYPE2(ct, sig0, sig1) \
  auto
# define ASIO_INITFN_AUTO_RESULT_TYPE3(ct, sig0, sig1, sig2) \
  auto
#elif defined(ASIO_HAS_RETURN_TYPE_DEDUCTION)
# define ASIO_INITFN_AUTO_RESULT_TYPE(ct, sig) \
  auto
# define ASIO_INITFN_AUTO_RESULT_TYPE2(ct, sig0, sig1) \
  auto
# define ASIO_INITFN_AUTO_RESULT_TYPE3(ct, sig0, sig1, sig2) \
  auto
#else
# define ASIO_INITFN_AUTO_RESULT_TYPE(ct, sig) \
  ASIO_INITFN_RESULT_TYPE(ct, sig)
# define ASIO_INITFN_AUTO_RESULT_TYPE2(ct, sig0, sig1) \
  ASIO_INITFN_RESULT_TYPE2(ct, sig0, sig1)
# define ASIO_INITFN_AUTO_RESULT_TYPE3(ct, sig0, sig1, sig2) \
  ASIO_INITFN_RESULT_TYPE3(ct, sig0, sig1, sig2)
#endif

#if defined(GENERATING_DOCUMENTATION)
# define ASIO_INITFN_AUTO_RESULT_TYPE_PREFIX(ct, sig) \
  auto
# define ASIO_INITFN_AUTO_RESULT_TYPE_PREFIX2(ct, sig0, sig1) \
  auto
# define ASIO_INITFN_AUTO_RESULT_TYPE_PREFIX3(ct, sig0, sig1, sig2) \
  auto
# define ASIO_INITFN_AUTO_RESULT_TYPE_SUFFIX(expr)
#elif defined(ASIO_HAS_RETURN_TYPE_DEDUCTION)
# define ASIO_INITFN_AUTO_RESULT_TYPE_PREFIX(ct, sig) \
  auto
# define ASIO_INITFN_AUTO_RESULT_TYPE_PREFIX2(ct, sig0, sig1) \
  auto
# define ASIO_INITFN_AUTO_RESULT_TYPE_PREFIX3(ct, sig0, sig1, sig2) \
  auto
# define ASIO_INITFN_AUTO_RESULT_TYPE_SUFFIX(expr)
#else
# define ASIO_INITFN_AUTO_RESULT_TYPE_PREFIX(ct, sig) \
  auto
# define ASIO_INITFN_AUTO_RESULT_TYPE_PREFIX2(ct, sig0, sig1) \
  auto
# define ASIO_INITFN_AUTO_RESULT_TYPE_PREFIX3(ct, sig0, sig1, sig2) \
  auto
# define ASIO_INITFN_AUTO_RESULT_TYPE_SUFFIX(expr) -> decltype expr
#endif

#if defined(GENERATING_DOCUMENTATION)
# define ASIO_INITFN_DEDUCED_RESULT_TYPE(ct, sig, expr) \
  void_or_deduced
# define ASIO_INITFN_DEDUCED_RESULT_TYPE2(ct, sig0, sig1, expr) \
  void_or_deduced
# define ASIO_INITFN_DEDUCED_RESULT_TYPE3(ct, sig0, sig1, sig2, expr) \
  void_or_deduced
#else
# define ASIO_INITFN_DEDUCED_RESULT_TYPE(ct, sig, expr) \
  decltype expr
# define ASIO_INITFN_DEDUCED_RESULT_TYPE2(ct, sig0, sig1, expr) \
  decltype expr
# define ASIO_INITFN_DEDUCED_RESULT_TYPE3(ct, sig0, sig1, sig2, expr) \
  decltype expr
#endif

#if defined(GENERATING_DOCUMENTATION)

template <typename CompletionToken,
    completion_signature... Signatures,
    typename Initiation, typename... Args>
void_or_deduced async_initiate(
    Initiation&& initiation,
    type_identity_t<CompletionToken>& token,
    Args&&... args);

#else // defined(GENERATING_DOCUMENTATION)

template <typename CompletionToken,
    ASIO_COMPLETION_SIGNATURE... Signatures,
    typename Initiation, typename... Args>
inline auto async_initiate(Initiation&& initiation,
    type_identity_t<CompletionToken>& token, Args&&... args)
  -> decltype(enable_if_t<
    enable_if_t<
      detail::are_completion_signatures<Signatures...>::value,
      detail::async_result_has_initiate_memfn<
        CompletionToken, Signatures...>>::value,
    async_result<decay_t<CompletionToken>, Signatures...>>::initiate(
      static_cast<Initiation&&>(initiation),
      static_cast<CompletionToken&&>(token),
      static_cast<Args&&>(args)...))
{
  return async_result<decay_t<CompletionToken>, Signatures...>::initiate(
      static_cast<Initiation&&>(initiation),
      static_cast<CompletionToken&&>(token),
      static_cast<Args&&>(args)...);
}

template <
    ASIO_COMPLETION_SIGNATURE... Signatures,
    typename CompletionToken, typename Initiation, typename... Args>
inline auto async_initiate(Initiation&& initiation,
    CompletionToken&& token, Args&&... args)
  -> decltype(enable_if_t<
    enable_if_t<
      detail::are_completion_signatures<Signatures...>::value,
      detail::async_result_has_initiate_memfn<
        CompletionToken, Signatures...>>::value,
    async_result<decay_t<CompletionToken>, Signatures...>>::initiate(
      static_cast<Initiation&&>(initiation),
      static_cast<CompletionToken&&>(token),
      static_cast<Args&&>(args)...))
{
  return async_result<decay_t<CompletionToken>, Signatures...>::initiate(
      static_cast<Initiation&&>(initiation),
      static_cast<CompletionToken&&>(token),
      static_cast<Args&&>(args)...);
}

template <typename CompletionToken,
    ASIO_COMPLETION_SIGNATURE... Signatures,
    typename Initiation, typename... Args>
inline typename enable_if_t<
    !enable_if_t<
      detail::are_completion_signatures<Signatures...>::value,
      detail::async_result_has_initiate_memfn<
        CompletionToken, Signatures...>>::value,
    async_result<decay_t<CompletionToken>, Signatures...>
  >::return_type
async_initiate(Initiation&& initiation,
    type_identity_t<CompletionToken>& token, Args&&... args)
{
  async_completion<CompletionToken, Signatures...> completion(token);

  static_cast<Initiation&&>(initiation)(
      static_cast<
        typename async_result<decay_t<CompletionToken>,
          Signatures...>::completion_handler_type&&>(
            completion.completion_handler),
      static_cast<Args&&>(args)...);

  return completion.result.get();
}

template <ASIO_COMPLETION_SIGNATURE... Signatures,
    typename CompletionToken, typename Initiation, typename... Args>
inline typename enable_if_t<
    !enable_if_t<
      detail::are_completion_signatures<Signatures...>::value,
      detail::async_result_has_initiate_memfn<
        CompletionToken, Signatures...>>::value,
    async_result<decay_t<CompletionToken>, Signatures...>
  >::return_type
async_initiate(Initiation&& initiation, CompletionToken&& token, Args&&... args)
{
  async_completion<CompletionToken, Signatures...> completion(token);

  static_cast<Initiation&&>(initiation)(
      static_cast<
        typename async_result<decay_t<CompletionToken>,
          Signatures...>::completion_handler_type&&>(
            completion.completion_handler),
      static_cast<Args&&>(args)...);

  return completion.result.get();
}

#endif // defined(GENERATING_DOCUMENTATION)

#if defined(ASIO_HAS_CONCEPTS)

namespace detail {

template <typename... Signatures>
struct initiation_archetype
{
  template <completion_handler_for<Signatures...> CompletionHandler>
  void operator()(CompletionHandler&&) const
  {
  }
};

} // namespace detail

template <typename T, typename... Signatures>
ASIO_CONCEPT completion_token_for =
  detail::are_completion_signatures<Signatures...>::value
  &&
  requires(T&& t)
  {
    async_initiate<T, Signatures...>(
        detail::initiation_archetype<Signatures...>{}, t);
  };

#define ASIO_COMPLETION_TOKEN_FOR(sig) \
  ::asio::completion_token_for<sig>
#define ASIO_COMPLETION_TOKEN_FOR2(sig0, sig1) \
  ::asio::completion_token_for<sig0, sig1>
#define ASIO_COMPLETION_TOKEN_FOR3(sig0, sig1, sig2) \
  ::asio::completion_token_for<sig0, sig1, sig2>

#else // defined(ASIO_HAS_CONCEPTS)

#define ASIO_COMPLETION_TOKEN_FOR(sig) typename
#define ASIO_COMPLETION_TOKEN_FOR2(sig0, sig1) typename
#define ASIO_COMPLETION_TOKEN_FOR3(sig0, sig1, sig2) typename

#endif // defined(ASIO_HAS_CONCEPTS)

namespace detail {

struct async_operation_probe {};
struct async_operation_probe_result {};

template <typename Call, typename = void>
struct is_async_operation_call : false_type
{
};

template <typename Call>
struct is_async_operation_call<Call,
    void_t<
      enable_if_t<
        is_same<
          result_of_t<Call>,
          async_operation_probe_result
        >::value
      >
    >
  > : true_type
{
};

} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <typename... Signatures>
class async_result<detail::async_operation_probe, Signatures...>
{
public:
  typedef detail::async_operation_probe_result return_type;

  template <typename Initiation, typename... InitArgs>
  static return_type initiate(Initiation&&,
      detail::async_operation_probe, InitArgs&&...)
  {
    return return_type();
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

#if defined(GENERATING_DOCUMENTATION)

/// The is_async_operation trait detects whether a type @c T and arguments
/// @c Args... may be used to initiate an asynchronous operation.
/**
 * Class template @c is_async_operation is a trait is derived from @c true_type
 * if the expression <tt>T(Args..., token)</tt> initiates an asynchronous
 * operation, where @c token is an unspecified completion token type. Otherwise,
 * @c is_async_operation is derived from @c false_type.
 */
template <typename T, typename... Args>
struct is_async_operation : integral_constant<bool, automatically_determined>
{
};

#else // defined(GENERATING_DOCUMENTATION)

template <typename T, typename... Args>
struct is_async_operation :
  detail::is_async_operation_call<
    T(Args..., detail::async_operation_probe)>
{
};

#endif // defined(GENERATING_DOCUMENTATION)

#if defined(ASIO_HAS_CONCEPTS)

template <typename T, typename... Args>
ASIO_CONCEPT async_operation = is_async_operation<T, Args...>::value;

#define ASIO_ASYNC_OPERATION \
  ::asio::async_operation
#define ASIO_ASYNC_OPERATION1(a0) \
  ::asio::async_operation<a0>
#define ASIO_ASYNC_OPERATION2(a0, a1) \
  ::asio::async_operation<a0, a1>
#define ASIO_ASYNC_OPERATION3(a0, a1, a2) \
  ::asio::async_operation<a0, a1, a2>

#else // defined(ASIO_HAS_CONCEPTS)

#define ASIO_ASYNC_OPERATION typename
#define ASIO_ASYNC_OPERATION1(a0) typename
#define ASIO_ASYNC_OPERATION2(a0, a1) typename
#define ASIO_ASYNC_OPERATION3(a0, a1, a2) typename

#endif // defined(ASIO_HAS_CONCEPTS)

namespace detail {

struct completion_signature_probe {};

template <typename... T>
struct completion_signature_probe_result
{
  template <template <typename...> class Op>
  struct apply
  {
    typedef Op<T...> type;
  };
};

template <typename T>
struct completion_signature_probe_result<T>
{
  typedef T type;

  template <template <typename...> class Op>
  struct apply
  {
    typedef Op<T> type;
  };
};

template <>
struct completion_signature_probe_result<void>
{
  template <template <typename...> class Op>
  struct apply
  {
    typedef Op<> type;
  };
};

} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <typename... Signatures>
class async_result<detail::completion_signature_probe, Signatures...>
{
public:
  typedef detail::completion_signature_probe_result<Signatures...> return_type;

  template <typename Initiation, typename... InitArgs>
  static return_type initiate(Initiation&&,
      detail::completion_signature_probe, InitArgs&&...)
  {
    return return_type();
  }
};

template <typename Signature>
class async_result<detail::completion_signature_probe, Signature>
{
public:
  typedef detail::completion_signature_probe_result<Signature> return_type;

  template <typename Initiation, typename... InitArgs>
  static return_type initiate(Initiation&&,
      detail::completion_signature_probe, InitArgs&&...)
  {
    return return_type();
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

#if defined(GENERATING_DOCUMENTATION)

/// The completion_signature_of trait determines the completion signature
/// of an asynchronous operation.
/**
 * Class template @c completion_signature_of is a trait with a member type
 * alias @c type that denotes the completion signature of the asynchronous
 * operation initiated by the expression <tt>T(Args..., token)</tt> operation,
 * where @c token is an unspecified completion token type. If the asynchronous
 * operation does not have exactly one completion signature, the instantion of
 * the trait is well-formed but the member type alias @c type is omitted. If
 * the expression <tt>T(Args..., token)</tt> is not an asynchronous operation
 * then use of the trait is ill-formed.
 */
template <typename T, typename... Args>
struct completion_signature_of
{
  typedef automatically_determined type;
};

#else // defined(GENERATING_DOCUMENTATION)

template <typename T, typename... Args>
struct completion_signature_of :
  result_of_t<T(Args..., detail::completion_signature_probe)>
{
};

#endif // defined(GENERATING_DOCUMENTATION)

template <typename T, typename... Args>
using completion_signature_of_t =
  typename completion_signature_of<T, Args...>::type;

} // namespace asio

#include "asio/detail/pop_options.hpp"

#include "asio/default_completion_token.hpp"

#endif // ASIO_ASYNC_RESULT_HPP
