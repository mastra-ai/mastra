//
// strand.hpp
// ~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_STRAND_HPP
#define ASIO_STRAND_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/strand_executor_service.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/execution/blocking.hpp"
#include "asio/execution/executor.hpp"
#include "asio/is_executor.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

/// Provides serialised function invocation for any executor type.
template <typename Executor>
class strand
{
public:
  /// The type of the underlying executor.
  typedef Executor inner_executor_type;

  /// Default constructor.
  /**
   * This constructor is only valid if the underlying executor type is default
   * constructible.
   */
  strand()
    : executor_(),
      impl_(strand::create_implementation(executor_))
  {
  }

  /// Construct a strand for the specified executor.
  template <typename Executor1>
  explicit strand(const Executor1& e,
      constraint_t<
        conditional_t<
          !is_same<Executor1, strand>::value,
          is_convertible<Executor1, Executor>,
          false_type
        >::value
      > = 0)
    : executor_(e),
      impl_(strand::create_implementation(executor_))
  {
  }

  /// Copy constructor.
  strand(const strand& other) noexcept
    : executor_(other.executor_),
      impl_(other.impl_)
  {
  }

  /// Converting constructor.
  /**
   * This constructor is only valid if the @c OtherExecutor type is convertible
   * to @c Executor.
   */
  template <class OtherExecutor>
  strand(
      const strand<OtherExecutor>& other) noexcept
    : executor_(other.executor_),
      impl_(other.impl_)
  {
  }

  /// Assignment operator.
  strand& operator=(const strand& other) noexcept
  {
    executor_ = other.executor_;
    impl_ = other.impl_;
    return *this;
  }

  /// Converting assignment operator.
  /**
   * This assignment operator is only valid if the @c OtherExecutor type is
   * convertible to @c Executor.
   */
  template <class OtherExecutor>
  strand& operator=(
      const strand<OtherExecutor>& other) noexcept
  {
    executor_ = other.executor_;
    impl_ = other.impl_;
    return *this;
  }

  /// Move constructor.
  strand(strand&& other) noexcept
    : executor_(static_cast<Executor&&>(other.executor_)),
      impl_(static_cast<implementation_type&&>(other.impl_))
  {
  }

  /// Converting move constructor.
  /**
   * This constructor is only valid if the @c OtherExecutor type is convertible
   * to @c Executor.
   */
  template <class OtherExecutor>
  strand(strand<OtherExecutor>&& other) noexcept
    : executor_(static_cast<OtherExecutor&&>(other.executor_)),
      impl_(static_cast<implementation_type&&>(other.impl_))
  {
  }

  /// Move assignment operator.
  strand& operator=(strand&& other) noexcept
  {
    executor_ = static_cast<Executor&&>(other.executor_);
    impl_ = static_cast<implementation_type&&>(other.impl_);
    return *this;
  }

  /// Converting move assignment operator.
  /**
   * This assignment operator is only valid if the @c OtherExecutor type is
   * convertible to @c Executor.
   */
  template <class OtherExecutor>
  strand& operator=(strand<OtherExecutor>&& other) noexcept
  {
    executor_ = static_cast<OtherExecutor&&>(other.executor_);
    impl_ = static_cast<implementation_type&&>(other.impl_);
    return *this;
  }

  /// Destructor.
  ~strand() noexcept
  {
  }

  /// Obtain the underlying executor.
  inner_executor_type get_inner_executor() const noexcept
  {
    return executor_;
  }

  /// Forward a query to the underlying executor.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::query customisation point.
   *
   * For example:
   * @code asio::strand<my_executor_type> ex = ...;
   * if (asio::query(ex, asio::execution::blocking)
   *       == asio::execution::blocking.never)
   *   ... @endcode
   */
  template <typename Property>
  constraint_t<
    can_query<const Executor&, Property>::value,
    conditional_t<
      is_convertible<Property, execution::blocking_t>::value,
      execution::blocking_t,
      query_result_t<const Executor&, Property>
    >
  > query(const Property& p) const
    noexcept(is_nothrow_query<const Executor&, Property>::value)
  {
    return this->query_helper(
        is_convertible<Property, execution::blocking_t>(), p);
  }

  /// Forward a requirement to the underlying executor.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::require customisation point.
   *
   * For example:
   * @code asio::strand<my_executor_type> ex1 = ...;
   * auto ex2 = asio::require(ex1,
   *     asio::execution::blocking.never); @endcode
   */
  template <typename Property>
  constraint_t<
    can_require<const Executor&, Property>::value
      && !is_convertible<Property, execution::blocking_t::always_t>::value,
    strand<decay_t<require_result_t<const Executor&, Property>>>
  > require(const Property& p) const
    noexcept(is_nothrow_require<const Executor&, Property>::value)
  {
    return strand<decay_t<require_result_t<const Executor&, Property>>>(
        asio::require(executor_, p), impl_);
  }

  /// Forward a preference to the underlying executor.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::prefer customisation point.
   *
   * For example:
   * @code asio::strand<my_executor_type> ex1 = ...;
   * auto ex2 = asio::prefer(ex1,
   *     asio::execution::blocking.never); @endcode
   */
  template <typename Property>
  constraint_t<
    can_prefer<const Executor&, Property>::value
      && !is_convertible<Property, execution::blocking_t::always_t>::value,
    strand<decay_t<prefer_result_t<const Executor&, Property>>>
  > prefer(const Property& p) const
    noexcept(is_nothrow_prefer<const Executor&, Property>::value)
  {
    return strand<decay_t<prefer_result_t<const Executor&, Property>>>(
        asio::prefer(executor_, p), impl_);
  }

#if !defined(ASIO_NO_TS_EXECUTORS)
  /// Obtain the underlying execution context.
  execution_context& context() const noexcept
  {
    return executor_.context();
  }

  /// Inform the strand that it has some outstanding work to do.
  /**
   * The strand delegates this call to its underlying executor.
   */
  void on_work_started() const noexcept
  {
    executor_.on_work_started();
  }

  /// Inform the strand that some work is no longer outstanding.
  /**
   * The strand delegates this call to its underlying executor.
   */
  void on_work_finished() const noexcept
  {
    executor_.on_work_finished();
  }
#endif // !defined(ASIO_NO_TS_EXECUTORS)

  /// Request the strand to invoke the given function object.
  /**
   * This function is used to ask the strand to execute the given function
   * object on its underlying executor. The function object will be executed
   * according to the properties of the underlying executor.
   *
   * @param f The function object to be called. The executor will make
   * a copy of the handler object as required. The function signature of the
   * function object must be: @code void function(); @endcode
   */
  template <typename Function>
  constraint_t<
    traits::execute_member<const Executor&, Function>::is_valid,
    void
  > execute(Function&& f) const
  {
    detail::strand_executor_service::execute(impl_,
        executor_, static_cast<Function&&>(f));
  }

#if !defined(ASIO_NO_TS_EXECUTORS)
  /// Request the strand to invoke the given function object.
  /**
   * This function is used to ask the strand to execute the given function
   * object on its underlying executor. The function object will be executed
   * inside this function if the strand is not otherwise busy and if the
   * underlying executor's @c dispatch() function is also able to execute the
   * function before returning.
   *
   * @param f The function object to be called. The executor will make
   * a copy of the handler object as required. The function signature of the
   * function object must be: @code void function(); @endcode
   *
   * @param a An allocator that may be used by the executor to allocate the
   * internal storage needed for function invocation.
   */
  template <typename Function, typename Allocator>
  void dispatch(Function&& f, const Allocator& a) const
  {
    detail::strand_executor_service::dispatch(impl_,
        executor_, static_cast<Function&&>(f), a);
  }

  /// Request the strand to invoke the given function object.
  /**
   * This function is used to ask the executor to execute the given function
   * object. The function object will never be executed inside this function.
   * Instead, it will be scheduled by the underlying executor's defer function.
   *
   * @param f The function object to be called. The executor will make
   * a copy of the handler object as required. The function signature of the
   * function object must be: @code void function(); @endcode
   *
   * @param a An allocator that may be used by the executor to allocate the
   * internal storage needed for function invocation.
   */
  template <typename Function, typename Allocator>
  void post(Function&& f, const Allocator& a) const
  {
    detail::strand_executor_service::post(impl_,
        executor_, static_cast<Function&&>(f), a);
  }

  /// Request the strand to invoke the given function object.
  /**
   * This function is used to ask the executor to execute the given function
   * object. The function object will never be executed inside this function.
   * Instead, it will be scheduled by the underlying executor's defer function.
   *
   * @param f The function object to be called. The executor will make
   * a copy of the handler object as required. The function signature of the
   * function object must be: @code void function(); @endcode
   *
   * @param a An allocator that may be used by the executor to allocate the
   * internal storage needed for function invocation.
   */
  template <typename Function, typename Allocator>
  void defer(Function&& f, const Allocator& a) const
  {
    detail::strand_executor_service::defer(impl_,
        executor_, static_cast<Function&&>(f), a);
  }
#endif // !defined(ASIO_NO_TS_EXECUTORS)

  /// Determine whether the strand is running in the current thread.
  /**
   * @return @c true if the current thread is executing a function that was
   * submitted to the strand using post(), dispatch() or defer(). Otherwise
   * returns @c false.
   */
  bool running_in_this_thread() const noexcept
  {
    return detail::strand_executor_service::running_in_this_thread(impl_);
  }

  /// Compare two strands for equality.
  /**
   * Two strands are equal if they refer to the same ordered, non-concurrent
   * state.
   */
  friend bool operator==(const strand& a, const strand& b) noexcept
  {
    return a.impl_ == b.impl_;
  }

  /// Compare two strands for inequality.
  /**
   * Two strands are equal if they refer to the same ordered, non-concurrent
   * state.
   */
  friend bool operator!=(const strand& a, const strand& b) noexcept
  {
    return a.impl_ != b.impl_;
  }

#if defined(GENERATING_DOCUMENTATION)
private:
#endif // defined(GENERATING_DOCUMENTATION)
  typedef detail::strand_executor_service::implementation_type
    implementation_type;

  template <typename InnerExecutor>
  static implementation_type create_implementation(const InnerExecutor& ex,
      constraint_t<
        can_query<InnerExecutor, execution::context_t>::value
      > = 0)
  {
    return use_service<detail::strand_executor_service>(
        asio::query(ex, execution::context)).create_implementation();
  }

  template <typename InnerExecutor>
  static implementation_type create_implementation(const InnerExecutor& ex,
      constraint_t<
        !can_query<InnerExecutor, execution::context_t>::value
      > = 0)
  {
    return use_service<detail::strand_executor_service>(
        ex.context()).create_implementation();
  }

  strand(const Executor& ex, const implementation_type& impl)
    : executor_(ex),
      impl_(impl)
  {
  }

  template <typename Property>
  query_result_t<const Executor&, Property> query_helper(
      false_type, const Property& property) const
  {
    return asio::query(executor_, property);
  }

  template <typename Property>
  execution::blocking_t query_helper(true_type, const Property& property) const
  {
    execution::blocking_t result = asio::query(executor_, property);
    return result == execution::blocking.always
      ? execution::blocking.possibly : result;
  }

  Executor executor_;
  implementation_type impl_;
};

/** @defgroup make_strand asio::make_strand
 *
 * @brief The asio::make_strand function creates a @ref strand object for
 * an executor or execution context.
 */
/*@{*/

/// Create a @ref strand object for an executor.
/**
 * @param ex An executor.
 *
 * @returns A strand constructed with the specified executor.
 */
template <typename Executor>
inline strand<Executor> make_strand(const Executor& ex,
    constraint_t<
      is_executor<Executor>::value || execution::is_executor<Executor>::value
    > = 0)
{
  return strand<Executor>(ex);
}

/// Create a @ref strand object for an execution context.
/**
 * @param ctx An execution context, from which an executor will be obtained.
 *
 * @returns A strand constructed with the execution context's executor, obtained
 * by performing <tt>ctx.get_executor()</tt>.
 */
template <typename ExecutionContext>
inline strand<typename ExecutionContext::executor_type>
make_strand(ExecutionContext& ctx,
    constraint_t<
      is_convertible<ExecutionContext&, execution_context&>::value
    > = 0)
{
  return strand<typename ExecutionContext::executor_type>(ctx.get_executor());
}

/*@}*/

#if !defined(GENERATING_DOCUMENTATION)

namespace traits {

#if !defined(ASIO_HAS_DEDUCED_EQUALITY_COMPARABLE_TRAIT)

template <typename Executor>
struct equality_comparable<strand<Executor>>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;
};

#endif // !defined(ASIO_HAS_DEDUCED_EQUALITY_COMPARABLE_TRAIT)

#if !defined(ASIO_HAS_DEDUCED_EXECUTE_MEMBER_TRAIT)

template <typename Executor, typename Function>
struct execute_member<strand<Executor>, Function,
    enable_if_t<
      traits::execute_member<const Executor&, Function>::is_valid
    >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = false;
  typedef void result_type;
};

#endif // !defined(ASIO_HAS_DEDUCED_EXECUTE_MEMBER_TRAIT)

#if !defined(ASIO_HAS_DEDUCED_QUERY_MEMBER_TRAIT)

template <typename Executor, typename Property>
struct query_member<strand<Executor>, Property,
    enable_if_t<
      can_query<const Executor&, Property>::value
    >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept =
    is_nothrow_query<Executor, Property>::value;
  typedef conditional_t<
    is_convertible<Property, execution::blocking_t>::value,
      execution::blocking_t, query_result_t<Executor, Property>> result_type;
};

#endif // !defined(ASIO_HAS_DEDUCED_QUERY_MEMBER_TRAIT)

#if !defined(ASIO_HAS_DEDUCED_REQUIRE_MEMBER_TRAIT)

template <typename Executor, typename Property>
struct require_member<strand<Executor>, Property,
    enable_if_t<
      can_require<const Executor&, Property>::value
        && !is_convertible<Property, execution::blocking_t::always_t>::value
    >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept =
    is_nothrow_require<Executor, Property>::value;
  typedef strand<decay_t<require_result_t<Executor, Property>>> result_type;
};

#endif // !defined(ASIO_HAS_DEDUCED_REQUIRE_MEMBER_TRAIT)

#if !defined(ASIO_HAS_DEDUCED_PREFER_MEMBER_TRAIT)

template <typename Executor, typename Property>
struct prefer_member<strand<Executor>, Property,
    enable_if_t<
      can_prefer<const Executor&, Property>::value
        && !is_convertible<Property, execution::blocking_t::always_t>::value
    >>
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept =
    is_nothrow_prefer<Executor, Property>::value;
  typedef strand<decay_t<prefer_result_t<Executor, Property>>> result_type;
};

#endif // !defined(ASIO_HAS_DEDUCED_PREFER_MEMBER_TRAIT)

} // namespace traits

#endif // !defined(GENERATING_DOCUMENTATION)

} // namespace asio

#include "asio/detail/pop_options.hpp"

// If both io_context.hpp and strand.hpp have been included, automatically
// include the header file needed for the io_context::strand class.
#if !defined(ASIO_NO_EXTENSIONS)
# if defined(ASIO_IO_CONTEXT_HPP)
#  include "asio/io_context_strand.hpp"
# endif // defined(ASIO_IO_CONTEXT_HPP)
#endif // !defined(ASIO_NO_EXTENSIONS)

#endif // ASIO_STRAND_HPP
