//
// experimental/parallel_group.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXPERIMENTAL_PARALLEL_GROUP_HPP
#define ASIO_EXPERIMENTAL_PARALLEL_GROUP_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <vector>
#include "asio/async_result.hpp"
#include "asio/detail/array.hpp"
#include "asio/detail/memory.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/detail/utility.hpp"
#include "asio/experimental/cancellation_condition.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace experimental {
namespace detail {

// Helper trait for getting a tuple from a completion signature.

template <typename Signature>
struct parallel_op_signature_as_tuple;

template <typename R, typename... Args>
struct parallel_op_signature_as_tuple<R(Args...)>
{
  typedef std::tuple<decay_t<Args>...> type;
};

// Helper trait for concatenating completion signatures.

template <std::size_t N, typename Offsets, typename... Signatures>
struct parallel_group_signature;

template <std::size_t N, typename R0, typename... Args0>
struct parallel_group_signature<N, R0(Args0...)>
{
  typedef asio::detail::array<std::size_t, N> order_type;
  typedef R0 raw_type(Args0...);
  typedef R0 type(order_type, Args0...);
};

template <std::size_t N,
    typename R0, typename... Args0,
    typename R1, typename... Args1>
struct parallel_group_signature<N, R0(Args0...), R1(Args1...)>
{
  typedef asio::detail::array<std::size_t, N> order_type;
  typedef R0 raw_type(Args0..., Args1...);
  typedef R0 type(order_type, Args0..., Args1...);
};

template <std::size_t N, typename Sig0,
    typename Sig1, typename... SigN>
struct parallel_group_signature<N, Sig0, Sig1, SigN...>
{
  typedef asio::detail::array<std::size_t, N> order_type;
  typedef typename parallel_group_signature<N,
    typename parallel_group_signature<N, Sig0, Sig1>::raw_type,
      SigN...>::raw_type raw_type;
  typedef typename parallel_group_signature<N,
    typename parallel_group_signature<N, Sig0, Sig1>::raw_type,
      SigN...>::type type;
};

template <typename Condition, typename Handler,
    typename... Ops, std::size_t... I>
void parallel_group_launch(Condition cancellation_condition, Handler handler,
    std::tuple<Ops...>& ops, asio::detail::index_sequence<I...>);

// Helper trait for determining ranged parallel group completion signatures.

template <typename Signature, typename Allocator>
struct ranged_parallel_group_signature;

template <typename R, typename... Args, typename Allocator>
struct ranged_parallel_group_signature<R(Args...), Allocator>
{
  typedef std::vector<std::size_t,
    ASIO_REBIND_ALLOC(Allocator, std::size_t)> order_type;
  typedef R raw_type(
      std::vector<Args, ASIO_REBIND_ALLOC(Allocator, Args)>...);
  typedef R type(order_type,
      std::vector<Args, ASIO_REBIND_ALLOC(Allocator, Args)>...);
};

template <typename Condition, typename Handler,
    typename Range, typename Allocator>
void ranged_parallel_group_launch(Condition cancellation_condition,
    Handler handler, Range&& range, const Allocator& allocator);

char (&parallel_group_has_iterator_helper(...))[2];

template <typename T>
char parallel_group_has_iterator_helper(T*, typename T::iterator* = 0);

template <typename T>
struct parallel_group_has_iterator_typedef
{
  enum { value = (sizeof((parallel_group_has_iterator_helper)((T*)(0))) == 1) };
};

} // namespace detail

/// Type trait used to determine whether a type is a range of asynchronous
/// operations that can be used with with @c make_parallel_group.
template <typename T>
struct is_async_operation_range
{
#if defined(GENERATING_DOCUMENTATION)
  /// The value member is true if the type may be used as a range of
  /// asynchronous operations.
  static const bool value;
#else
  enum
  {
    value = detail::parallel_group_has_iterator_typedef<T>::value
  };
#endif
};

/// A group of asynchronous operations that may be launched in parallel.
/**
 * See the documentation for asio::experimental::make_parallel_group for
 * a usage example.
 */
template <typename... Ops>
class parallel_group
{
private:
  struct initiate_async_wait
  {
    template <typename Handler, typename Condition>
    void operator()(Handler&& h, Condition&& c, std::tuple<Ops...>&& ops) const
    {
      detail::parallel_group_launch(
          std::forward<Condition>(c), std::forward<Handler>(h),
          ops, asio::detail::index_sequence_for<Ops...>());
    }
  };

  std::tuple<Ops...> ops_;

public:
  /// Constructor.
  explicit parallel_group(Ops... ops)
    : ops_(std::move(ops)...)
  {
  }

  /// The completion signature for the group of operations.
  typedef typename detail::parallel_group_signature<sizeof...(Ops),
      completion_signature_of_t<Ops>...>::type signature;

  /// Initiate an asynchronous wait for the group of operations.
  /**
   * Launches the group and asynchronously waits for completion.
   *
   * @param cancellation_condition A function object, called on completion of
   * an operation within the group, that is used to determine whether to cancel
   * the remaining operations. The function object is passed the arguments of
   * the completed operation's handler. To trigger cancellation of the remaining
   * operations, it must return a asio::cancellation_type value other
   * than <tt>asio::cancellation_type::none</tt>.
   *
   * @param token A @ref completion_token whose signature is comprised of
   * a @c std::array<std::size_t, N> indicating the completion order of the
   * operations, followed by all operations' completion handler arguments.
   *
   * The library provides the following @c cancellation_condition types:
   *
   * @li asio::experimental::wait_for_all
   * @li asio::experimental::wait_for_one
   * @li asio::experimental::wait_for_one_error
   * @li asio::experimental::wait_for_one_success
   */
  template <typename CancellationCondition,
      ASIO_COMPLETION_TOKEN_FOR(signature) CompletionToken>
  auto async_wait(CancellationCondition cancellation_condition,
      CompletionToken&& token)
    -> decltype(
      asio::async_initiate<CompletionToken, signature>(
        declval<initiate_async_wait>(), token,
        std::move(cancellation_condition), std::move(ops_)))
  {
    return asio::async_initiate<CompletionToken, signature>(
        initiate_async_wait(), token,
        std::move(cancellation_condition), std::move(ops_));
  }
};

/// Create a group of operations that may be launched in parallel.
/**
 * For example:
 * @code asio::experimental::make_parallel_group(
 *    in.async_read_some(asio::buffer(data)),
 *    timer.async_wait()
 *  ).async_wait(
 *    asio::experimental::wait_for_all(),
 *    [](
 *        std::array<std::size_t, 2> completion_order,
 *        std::error_code ec1, std::size_t n1,
 *        std::error_code ec2
 *    )
 *    {
 *      switch (completion_order[0])
 *      {
 *      case 0:
 *        {
 *          std::cout << "descriptor finished: " << ec1 << ", " << n1 << "\n";
 *        }
 *        break;
 *      case 1:
 *        {
 *          std::cout << "timer finished: " << ec2 << "\n";
 *        }
 *        break;
 *      }
 *    }
 *  );
 * @endcode
 *
 * If preferred, the asynchronous operations may be explicitly packaged as
 * function objects:
 * @code asio::experimental::make_parallel_group(
 *    [&](auto token)
 *    {
 *      return in.async_read_some(asio::buffer(data), token);
 *    },
 *    [&](auto token)
 *    {
 *      return timer.async_wait(token);
 *    }
 *  ).async_wait(
 *    asio::experimental::wait_for_all(),
 *    [](
 *        std::array<std::size_t, 2> completion_order,
 *        std::error_code ec1, std::size_t n1,
 *        std::error_code ec2
 *    )
 *    {
 *      switch (completion_order[0])
 *      {
 *      case 0:
 *        {
 *          std::cout << "descriptor finished: " << ec1 << ", " << n1 << "\n";
 *        }
 *        break;
 *      case 1:
 *        {
 *          std::cout << "timer finished: " << ec2 << "\n";
 *        }
 *        break;
 *      }
 *    }
 *  );
 * @endcode
 */
template <typename... Ops>
ASIO_NODISCARD inline parallel_group<Ops...>
make_parallel_group(Ops... ops)
{
  return parallel_group<Ops...>(std::move(ops)...);
}

/// A range-based group of asynchronous operations that may be launched in
/// parallel.
/**
 * See the documentation for asio::experimental::make_parallel_group for
 * a usage example.
 */
template <typename Range, typename Allocator = std::allocator<void>>
class ranged_parallel_group
{
private:
  struct initiate_async_wait
  {
    template <typename Handler, typename Condition>
    void operator()(Handler&& h, Condition&& c,
        Range&& range, const Allocator& allocator) const
    {
      detail::ranged_parallel_group_launch(std::move(c),
          std::move(h), std::forward<Range>(range), allocator);
    }
  };

  Range range_;
  Allocator allocator_;

public:
  /// Constructor.
  explicit ranged_parallel_group(Range range,
      const Allocator& allocator = Allocator())
    : range_(std::move(range)),
      allocator_(allocator)
  {
  }

  /// The completion signature for the group of operations.
  typedef typename detail::ranged_parallel_group_signature<
      completion_signature_of_t<
        decay_t<decltype(*std::declval<typename Range::iterator>())>>,
      Allocator>::type signature;

  /// Initiate an asynchronous wait for the group of operations.
  /**
   * Launches the group and asynchronously waits for completion.
   *
   * @param cancellation_condition A function object, called on completion of
   * an operation within the group, that is used to determine whether to cancel
   * the remaining operations. The function object is passed the arguments of
   * the completed operation's handler. To trigger cancellation of the remaining
   * operations, it must return a asio::cancellation_type value other
   * than <tt>asio::cancellation_type::none</tt>.
   *
   * @param token A @ref completion_token whose signature is comprised of
   * a @c std::vector<std::size_t, Allocator> indicating the completion order of
   * the operations, followed by a vector for each of the completion signature's
   * arguments.
   *
   * The library provides the following @c cancellation_condition types:
   *
   * @li asio::experimental::wait_for_all
   * @li asio::experimental::wait_for_one
   * @li asio::experimental::wait_for_one_error
   * @li asio::experimental::wait_for_one_success
   */
  template <typename CancellationCondition,
      ASIO_COMPLETION_TOKEN_FOR(signature) CompletionToken>
  auto async_wait(CancellationCondition cancellation_condition,
      CompletionToken&& token)
    -> decltype(
      asio::async_initiate<CompletionToken, signature>(
        declval<initiate_async_wait>(), token,
        std::move(cancellation_condition),
        std::move(range_), allocator_))
  {
    return asio::async_initiate<CompletionToken, signature>(
        initiate_async_wait(), token,
        std::move(cancellation_condition),
        std::move(range_), allocator_);
  }
};

/// Create a group of operations that may be launched in parallel.
/**
 * @param range A range containing the operations to be launched.
 *
 * For example:
 * @code
 * using op_type =
 *   decltype(socket1.async_read_some(asio::buffer(data1)));
 *
 * std::vector<op_type> ops;
 * ops.push_back(socket1.async_read_some(asio::buffer(data1)));
 * ops.push_back(socket2.async_read_some(asio::buffer(data2)));
 *
 * asio::experimental::make_parallel_group(ops).async_wait(
 *     asio::experimental::wait_for_all(),
 *     [](
 *         std::vector<std::size_t> completion_order,
 *         std::vector<std::error_code> e,
 *         std::vector<std::size_t> n
 *       )
 *     {
 *       for (std::size_t i = 0; i < completion_order.size(); ++i)
 *       {
 *         std::size_t idx = completion_order[i];
 *         std::cout << "socket " << idx << " finished: ";
 *         std::cout << e[idx] << ", " << n[idx] << "\n";
 *       }
 *     }
 *   );
 * @endcode
 */
template <typename Range>
ASIO_NODISCARD inline ranged_parallel_group<decay_t<Range>>
make_parallel_group(Range&& range,
    constraint_t<
      is_async_operation_range<decay_t<Range>>::value
    > = 0)
{
  return ranged_parallel_group<decay_t<Range>>(std::forward<Range>(range));
}

/// Create a group of operations that may be launched in parallel.
/**
 * @param allocator Specifies the allocator to be used with the result vectors.
 *
 * @param range A range containing the operations to be launched.
 *
 * For example:
 * @code
 * using op_type =
 *   decltype(socket1.async_read_some(asio::buffer(data1)));
 *
 * std::vector<op_type> ops;
 * ops.push_back(socket1.async_read_some(asio::buffer(data1)));
 * ops.push_back(socket2.async_read_some(asio::buffer(data2)));
 *
 * asio::experimental::make_parallel_group(
 *     std::allocator_arg_t,
 *     my_allocator,
 *     ops
 *   ).async_wait(
 *     asio::experimental::wait_for_all(),
 *     [](
 *         std::vector<std::size_t> completion_order,
 *         std::vector<std::error_code> e,
 *         std::vector<std::size_t> n
 *       )
 *     {
 *       for (std::size_t i = 0; i < completion_order.size(); ++i)
 *       {
 *         std::size_t idx = completion_order[i];
 *         std::cout << "socket " << idx << " finished: ";
 *         std::cout << e[idx] << ", " << n[idx] << "\n";
 *       }
 *     }
 *   );
 * @endcode
 */
template <typename Allocator, typename Range>
ASIO_NODISCARD inline ranged_parallel_group<decay_t<Range>, Allocator>
make_parallel_group(allocator_arg_t, const Allocator& allocator, Range&& range,
    constraint_t<
      is_async_operation_range<decay_t<Range>>::value
    > = 0)
{
  return ranged_parallel_group<decay_t<Range>, Allocator>(
      std::forward<Range>(range), allocator);
}

} // namespace experimental
} // namespace asio

#include "asio/detail/pop_options.hpp"

#include "asio/experimental/impl/parallel_group.hpp"

#endif // ASIO_EXPERIMENTAL_PARALLEL_GROUP_HPP
