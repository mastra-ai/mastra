//
// thread_pool.hpp
// ~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_THREAD_POOL_HPP
#define ASIO_THREAD_POOL_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/atomic_count.hpp"
#include "asio/detail/scheduler.hpp"
#include "asio/detail/thread_group.hpp"
#include "asio/execution.hpp"
#include "asio/execution_context.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {
  struct thread_pool_bits
  {
    static constexpr unsigned int blocking_never = 1;
    static constexpr unsigned int blocking_always = 2;
    static constexpr unsigned int blocking_mask = 3;
    static constexpr unsigned int relationship_continuation = 4;
    static constexpr unsigned int outstanding_work_tracked = 8;
  };
} // namespace detail

/// A simple fixed-size thread pool.
/**
 * The thread pool class is an execution context where functions are permitted
 * to run on one of a fixed number of threads.
 *
 * @par Thread Safety
 * @e Distinct @e objects: Safe.@n
 * @e Shared @e objects: Safe, with the specific exceptions of the join()
 * wait() and notify_fork() functions. The join() and wait() functions must not
 * be called at the same time as other calls to join() or wait() on the same
 * pool. The notify_fork() function should not be called while any thread_pool
 * function, or any function on an I/O object that is associated with the
 * thread_pool, is being called in another thread. (In effect, this means that
 * notify_fork() is safe only on a thread pool that has no internal or attached
 * threads at the time.)
 *
 * @par Submitting tasks to the pool
 *
 * To submit functions to the thread pool, use the @ref asio::dispatch,
 * @ref asio::post or @ref asio::defer free functions.
 *
 * For example:
 *
 * @code void my_task()
 * {
 *   ...
 * }
 *
 * ...
 *
 * // Launch the pool with four threads.
 * asio::thread_pool pool(4);
 *
 * // Submit a function to the pool.
 * asio::post(pool, my_task);
 *
 * // Submit a lambda object to the pool.
 * asio::post(pool,
 *     []()
 *     {
 *       ...
 *     });
 *
 * // Wait for all tasks in the pool to complete.
 * pool.join(); @endcode
 */
class thread_pool
  : public execution_context
{
public:
  template <typename Allocator, unsigned int Bits>
  class basic_executor_type;

  template <typename Allocator, unsigned int Bits>
  friend class basic_executor_type;

  /// Executor used to submit functions to a thread pool.
  typedef basic_executor_type<std::allocator<void>, 0> executor_type;

#if !defined(ASIO_NO_TS_EXECUTORS)
  /// Constructs a pool with an automatically determined number of threads.
  ASIO_DECL thread_pool();
#endif // !defined(ASIO_NO_TS_EXECUTORS)

  /// Constructs a pool with a specified number of threads.
  ASIO_DECL thread_pool(std::size_t num_threads);

  /// Constructs a pool with a specified number of threads.
  /**
   * Construct with a service maker, to create an initial set of services that
   * will be installed into the execution context at construction time.
   *
   * @param num_threads The number of threads required.
   *
   * @param initial_services Used to create the initial services. The @c make
   * function will be called once at the end of execution_context construction.
   */
  ASIO_DECL thread_pool(std::size_t num_threads,
      const execution_context::service_maker& initial_services);

  /// Destructor.
  /**
   * Automatically stops and joins the pool, if not explicitly done beforehand.
   */
  ASIO_DECL ~thread_pool();

  /// Obtains the executor associated with the pool.
  executor_type get_executor() noexcept;

  /// Obtains the executor associated with the pool.
  executor_type executor() noexcept;

  /// Stops the threads.
  /**
   * This function stops the threads as soon as possible. As a result of calling
   * @c stop(), pending function objects may be never be invoked.
   */
  ASIO_DECL void stop();

  /// Attaches the current thread to the pool.
  /**
   * This function attaches the current thread to the pool so that it may be
   * used for executing submitted function objects. Blocks the calling thread
   * until the pool is stopped or joined and has no outstanding work.
   */
  ASIO_DECL void attach();

  /// Joins the threads.
  /**
   * This function blocks until the threads in the pool have completed. If @c
   * stop() is not called prior to @c join(), the @c join() call will wait
   * until the pool has no more outstanding work.
   */
  ASIO_DECL void join();

  /// Waits for threads to complete.
  /**
   * This function blocks until the threads in the pool have completed. If @c
   * stop() is not called prior to @c wait(), the @c wait() call will wait
   * until the pool has no more outstanding work.
   *
   * @note @c wait() is synonymous with @c join().
   */
  ASIO_DECL void wait();

private:
  thread_pool(const thread_pool&) = delete;
  thread_pool& operator=(const thread_pool&) = delete;

  struct thread_function;

  // Helper function to create the underlying scheduler.
  ASIO_DECL detail::scheduler& add_scheduler(detail::scheduler* s);

  // The underlying scheduler.
  detail::scheduler& scheduler_;

  // The threads in the pool.
  detail::thread_group threads_;

  // The current number of threads in the pool.
  detail::atomic_count num_threads_;

  // Whether a join call will have any effect.
  bool joinable_;
};

/// Executor implementation type used to submit functions to a thread pool.
template <typename Allocator, unsigned int Bits>
class thread_pool::basic_executor_type : detail::thread_pool_bits
{
public:
  /// Copy constructor.
  basic_executor_type(const basic_executor_type& other) noexcept
    : pool_(other.pool_),
      allocator_(other.allocator_),
      bits_(other.bits_)
  {
    if (Bits & outstanding_work_tracked)
      if (pool_)
        pool_->scheduler_.work_started();
  }

  /// Move constructor.
  basic_executor_type(basic_executor_type&& other) noexcept
    : pool_(other.pool_),
      allocator_(static_cast<Allocator&&>(other.allocator_)),
      bits_(other.bits_)
  {
    if (Bits & outstanding_work_tracked)
      other.pool_ = 0;
  }

  /// Destructor.
  ~basic_executor_type() noexcept
  {
    if (Bits & outstanding_work_tracked)
      if (pool_)
        pool_->scheduler_.work_finished();
  }

  /// Assignment operator.
  basic_executor_type& operator=(const basic_executor_type& other) noexcept;

  /// Move assignment operator.
  basic_executor_type& operator=(basic_executor_type&& other) noexcept;

#if !defined(GENERATING_DOCUMENTATION)
private:
  friend struct asio_require_fn::impl;
  friend struct asio_prefer_fn::impl;
#endif // !defined(GENERATING_DOCUMENTATION)

  /// Obtain an executor with the @c blocking.possibly property.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::require customisation point.
   *
   * For example:
   * @code auto ex1 = my_thread_pool.executor();
   * auto ex2 = asio::require(ex1,
   *     asio::execution::blocking.possibly); @endcode
   */
  constexpr basic_executor_type<Allocator,
      ASIO_UNSPECIFIED(Bits & ~blocking_mask)>
  require(execution::blocking_t::possibly_t) const
  {
    return basic_executor_type<Allocator, Bits & ~blocking_mask>(
        pool_, allocator_, bits_ & ~blocking_mask);
  }

  /// Obtain an executor with the @c blocking.always property.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::require customisation point.
   *
   * For example:
   * @code auto ex1 = my_thread_pool.executor();
   * auto ex2 = asio::require(ex1,
   *     asio::execution::blocking.always); @endcode
   */
  constexpr basic_executor_type<Allocator,
      ASIO_UNSPECIFIED((Bits & ~blocking_mask) | blocking_always)>
  require(execution::blocking_t::always_t) const
  {
    return basic_executor_type<Allocator,
        ASIO_UNSPECIFIED((Bits & ~blocking_mask) | blocking_always)>(
          pool_, allocator_, bits_ & ~blocking_mask);
  }

  /// Obtain an executor with the @c blocking.never property.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::require customisation point.
   *
   * For example:
   * @code auto ex1 = my_thread_pool.executor();
   * auto ex2 = asio::require(ex1,
   *     asio::execution::blocking.never); @endcode
   */
  constexpr basic_executor_type<Allocator,
      ASIO_UNSPECIFIED(Bits & ~blocking_mask)>
  require(execution::blocking_t::never_t) const
  {
    return basic_executor_type<Allocator, Bits & ~blocking_mask>(
        pool_, allocator_, (bits_ & ~blocking_mask) | blocking_never);
  }

  /// Obtain an executor with the @c relationship.fork property.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::require customisation point.
   *
   * For example:
   * @code auto ex1 = my_thread_pool.executor();
   * auto ex2 = asio::require(ex1,
   *     asio::execution::relationship.fork); @endcode
   */
  constexpr basic_executor_type require(execution::relationship_t::fork_t) const
  {
    return basic_executor_type(pool_,
        allocator_, bits_ & ~relationship_continuation);
  }

  /// Obtain an executor with the @c relationship.continuation property.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::require customisation point.
   *
   * For example:
   * @code auto ex1 = my_thread_pool.executor();
   * auto ex2 = asio::require(ex1,
   *     asio::execution::relationship.continuation); @endcode
   */
  constexpr basic_executor_type require(
      execution::relationship_t::continuation_t) const
  {
    return basic_executor_type(pool_,
        allocator_, bits_ | relationship_continuation);
  }

  /// Obtain an executor with the @c outstanding_work.tracked property.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::require customisation point.
   *
   * For example:
   * @code auto ex1 = my_thread_pool.executor();
   * auto ex2 = asio::require(ex1,
   *     asio::execution::outstanding_work.tracked); @endcode
   */
  constexpr basic_executor_type<Allocator,
      ASIO_UNSPECIFIED(Bits | outstanding_work_tracked)>
  require(execution::outstanding_work_t::tracked_t) const
  {
    return basic_executor_type<Allocator, Bits | outstanding_work_tracked>(
        pool_, allocator_, bits_);
  }

  /// Obtain an executor with the @c outstanding_work.untracked property.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::require customisation point.
   *
   * For example:
   * @code auto ex1 = my_thread_pool.executor();
   * auto ex2 = asio::require(ex1,
   *     asio::execution::outstanding_work.untracked); @endcode
   */
  constexpr basic_executor_type<Allocator,
      ASIO_UNSPECIFIED(Bits & ~outstanding_work_tracked)>
  require(execution::outstanding_work_t::untracked_t) const
  {
    return basic_executor_type<Allocator, Bits & ~outstanding_work_tracked>(
        pool_, allocator_, bits_);
  }

  /// Obtain an executor with the specified @c allocator property.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::require customisation point.
   *
   * For example:
   * @code auto ex1 = my_thread_pool.executor();
   * auto ex2 = asio::require(ex1,
   *     asio::execution::allocator(my_allocator)); @endcode
   */
  template <typename OtherAllocator>
  constexpr basic_executor_type<OtherAllocator, Bits>
  require(execution::allocator_t<OtherAllocator> a) const
  {
    return basic_executor_type<OtherAllocator, Bits>(
        pool_, a.value(), bits_);
  }

  /// Obtain an executor with the default @c allocator property.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::require customisation point.
   *
   * For example:
   * @code auto ex1 = my_thread_pool.executor();
   * auto ex2 = asio::require(ex1,
   *     asio::execution::allocator); @endcode
   */
  constexpr basic_executor_type<std::allocator<void>, Bits>
  require(execution::allocator_t<void>) const
  {
    return basic_executor_type<std::allocator<void>, Bits>(
        pool_, std::allocator<void>(), bits_);
  }

#if !defined(GENERATING_DOCUMENTATION)
private:
  friend struct asio_query_fn::impl;
  friend struct asio::execution::detail::mapping_t<0>;
  friend struct asio::execution::detail::outstanding_work_t<0>;
#endif // !defined(GENERATING_DOCUMENTATION)

  /// Query the current value of the @c mapping property.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::query customisation point.
   *
   * For example:
   * @code auto ex = my_thread_pool.executor();
   * if (asio::query(ex, asio::execution::mapping)
   *       == asio::execution::mapping.thread)
   *   ... @endcode
   */
  static constexpr execution::mapping_t query(execution::mapping_t) noexcept
  {
    return execution::mapping.thread;
  }

  /// Query the current value of the @c context property.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::query customisation point.
   *
   * For example:
   * @code auto ex = my_thread_pool.executor();
   * asio::thread_pool& pool = asio::query(
   *     ex, asio::execution::context); @endcode
   */
  thread_pool& query(execution::context_t) const noexcept
  {
    return *pool_;
  }

  /// Query the current value of the @c blocking property.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::query customisation point.
   *
   * For example:
   * @code auto ex = my_thread_pool.executor();
   * if (asio::query(ex, asio::execution::blocking)
   *       == asio::execution::blocking.always)
   *   ... @endcode
   */
  constexpr execution::blocking_t query(execution::blocking_t) const noexcept
  {
    return (bits_ & blocking_never)
      ? execution::blocking_t(execution::blocking.never)
      : ((Bits & blocking_always)
          ? execution::blocking_t(execution::blocking.always)
          : execution::blocking_t(execution::blocking.possibly));
  }

  /// Query the current value of the @c relationship property.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::query customisation point.
   *
   * For example:
   * @code auto ex = my_thread_pool.executor();
   * if (asio::query(ex, asio::execution::relationship)
   *       == asio::execution::relationship.continuation)
   *   ... @endcode
   */
  constexpr execution::relationship_t query(
      execution::relationship_t) const noexcept
  {
    return (bits_ & relationship_continuation)
      ? execution::relationship_t(execution::relationship.continuation)
      : execution::relationship_t(execution::relationship.fork);
  }

  /// Query the current value of the @c outstanding_work property.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::query customisation point.
   *
   * For example:
   * @code auto ex = my_thread_pool.executor();
   * if (asio::query(ex, asio::execution::outstanding_work)
   *       == asio::execution::outstanding_work.tracked)
   *   ... @endcode
   */
  static constexpr execution::outstanding_work_t query(
      execution::outstanding_work_t) noexcept
  {
    return (Bits & outstanding_work_tracked)
      ? execution::outstanding_work_t(execution::outstanding_work.tracked)
      : execution::outstanding_work_t(execution::outstanding_work.untracked);
  }

  /// Query the current value of the @c allocator property.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::query customisation point.
   *
   * For example:
   * @code auto ex = my_thread_pool.executor();
   * auto alloc = asio::query(ex,
   *     asio::execution::allocator); @endcode
   */
  template <typename OtherAllocator>
  constexpr Allocator query(
      execution::allocator_t<OtherAllocator>) const noexcept
  {
    return allocator_;
  }

  /// Query the current value of the @c allocator property.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::query customisation point.
   *
   * For example:
   * @code auto ex = my_thread_pool.executor();
   * auto alloc = asio::query(ex,
   *     asio::execution::allocator); @endcode
   */
  constexpr Allocator query(execution::allocator_t<void>) const noexcept
  {
    return allocator_;
  }

  /// Query the occupancy (recommended number of work items) for the pool.
  /**
   * Do not call this function directly. It is intended for use with the
   * asio::query customisation point.
   *
   * For example:
   * @code auto ex = my_thread_pool.executor();
   * std::size_t occupancy = asio::query(
   *     ex, asio::execution::occupancy); @endcode
   */
  std::size_t query(execution::occupancy_t) const noexcept
  {
    return static_cast<std::size_t>(pool_->num_threads_);
  }

public:
  /// Determine whether the thread pool is running in the current thread.
  /**
   * @return @c true if the current thread is running the thread pool. Otherwise
   * returns @c false.
   */
  bool running_in_this_thread() const noexcept;

  /// Compare two executors for equality.
  /**
   * Two executors are equal if they refer to the same underlying thread pool.
   */
  friend bool operator==(const basic_executor_type& a,
      const basic_executor_type& b) noexcept
  {
    return a.pool_ == b.pool_
      && a.allocator_ == b.allocator_
      && a.bits_ == b.bits_;
  }

  /// Compare two executors for inequality.
  /**
   * Two executors are equal if they refer to the same underlying thread pool.
   */
  friend bool operator!=(const basic_executor_type& a,
      const basic_executor_type& b) noexcept
  {
    return a.pool_ != b.pool_
      || a.allocator_ != b.allocator_
      || a.bits_ != b.bits_;
  }

  /// Execution function.
  template <typename Function>
  void execute(Function&& f) const
  {
    this->do_execute(static_cast<Function&&>(f),
        integral_constant<bool, (Bits & blocking_always) != 0>());
  }

public:
#if !defined(ASIO_NO_TS_EXECUTORS)
  /// Obtain the underlying execution context.
  thread_pool& context() const noexcept;

  /// Inform the thread pool that it has some outstanding work to do.
  /**
   * This function is used to inform the thread pool that some work has begun.
   * This ensures that the thread pool's join() function will not return while
   * the work is underway.
   */
  void on_work_started() const noexcept;

  /// Inform the thread pool that some work is no longer outstanding.
  /**
   * This function is used to inform the thread pool that some work has
   * finished. Once the count of unfinished work reaches zero, the thread
   * pool's join() function is permitted to exit.
   */
  void on_work_finished() const noexcept;

  /// Request the thread pool to invoke the given function object.
  /**
   * This function is used to ask the thread pool to execute the given function
   * object. If the current thread belongs to the pool, @c dispatch() executes
   * the function before returning. Otherwise, the function will be scheduled
   * to run on the thread pool.
   *
   * @param f The function object to be called. The executor will make
   * a copy of the handler object as required. The function signature of the
   * function object must be: @code void function(); @endcode
   *
   * @param a An allocator that may be used by the executor to allocate the
   * internal storage needed for function invocation.
   */
  template <typename Function, typename OtherAllocator>
  void dispatch(Function&& f, const OtherAllocator& a) const;

  /// Request the thread pool to invoke the given function object.
  /**
   * This function is used to ask the thread pool to execute the given function
   * object. The function object will never be executed inside @c post().
   * Instead, it will be scheduled to run on the thread pool.
   *
   * @param f The function object to be called. The executor will make
   * a copy of the handler object as required. The function signature of the
   * function object must be: @code void function(); @endcode
   *
   * @param a An allocator that may be used by the executor to allocate the
   * internal storage needed for function invocation.
   */
  template <typename Function, typename OtherAllocator>
  void post(Function&& f, const OtherAllocator& a) const;

  /// Request the thread pool to invoke the given function object.
  /**
   * This function is used to ask the thread pool to execute the given function
   * object. The function object will never be executed inside @c defer().
   * Instead, it will be scheduled to run on the thread pool.
   *
   * If the current thread belongs to the thread pool, @c defer() will delay
   * scheduling the function object until the current thread returns control to
   * the pool.
   *
   * @param f The function object to be called. The executor will make
   * a copy of the handler object as required. The function signature of the
   * function object must be: @code void function(); @endcode
   *
   * @param a An allocator that may be used by the executor to allocate the
   * internal storage needed for function invocation.
   */
  template <typename Function, typename OtherAllocator>
  void defer(Function&& f, const OtherAllocator& a) const;
#endif // !defined(ASIO_NO_TS_EXECUTORS)

private:
  friend class thread_pool;
  template <typename, unsigned int> friend class basic_executor_type;

  // Constructor used by thread_pool::get_executor().
  explicit basic_executor_type(thread_pool& p) noexcept
    : pool_(&p),
      allocator_(),
      bits_(0)
  {
    if (Bits & outstanding_work_tracked)
      pool_->scheduler_.work_started();
  }

  // Constructor used by require().
  basic_executor_type(thread_pool* p,
      const Allocator& a, unsigned int bits) noexcept
    : pool_(p),
      allocator_(a),
      bits_(bits)
  {
    if (Bits & outstanding_work_tracked)
      if (pool_)
        pool_->scheduler_.work_started();
  }

  /// Execution helper implementation for possibly and never blocking.
  template <typename Function>
  void do_execute(Function&& f, false_type) const;

  /// Execution helper implementation for always blocking.
  template <typename Function>
  void do_execute(Function&& f, true_type) const;

  // The underlying thread pool.
  thread_pool* pool_;

  // The allocator used for execution functions.
  Allocator allocator_;

  // The runtime-switched properties of the thread pool executor.
  unsigned int bits_;
};

#if !defined(GENERATING_DOCUMENTATION)

namespace traits {

#if !defined(ASIO_HAS_DEDUCED_EQUALITY_COMPARABLE_TRAIT)

template <typename Allocator, unsigned int Bits>
struct equality_comparable<
    asio::thread_pool::basic_executor_type<Allocator, Bits>
  >
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;
};

#endif // !defined(ASIO_HAS_DEDUCED_EQUALITY_COMPARABLE_TRAIT)

#if !defined(ASIO_HAS_DEDUCED_EXECUTE_MEMBER_TRAIT)

template <typename Allocator, unsigned int Bits, typename Function>
struct execute_member<
    asio::thread_pool::basic_executor_type<Allocator, Bits>,
    Function
  >
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = false;
  typedef void result_type;
};

#endif // !defined(ASIO_HAS_DEDUCED_EXECUTE_MEMBER_TRAIT)

#if !defined(ASIO_HAS_DEDUCED_REQUIRE_MEMBER_TRAIT)

template <typename Allocator, unsigned int Bits>
struct require_member<
    asio::thread_pool::basic_executor_type<Allocator, Bits>,
    asio::execution::blocking_t::possibly_t
  > : asio::detail::thread_pool_bits
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;
  typedef asio::thread_pool::basic_executor_type<
      Allocator, Bits & ~blocking_mask> result_type;
};

template <typename Allocator, unsigned int Bits>
struct require_member<
    asio::thread_pool::basic_executor_type<Allocator, Bits>,
    asio::execution::blocking_t::always_t
  > : asio::detail::thread_pool_bits
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = false;
  typedef asio::thread_pool::basic_executor_type<Allocator,
      (Bits & ~blocking_mask) | blocking_always> result_type;
};

template <typename Allocator, unsigned int Bits>
struct require_member<
    asio::thread_pool::basic_executor_type<Allocator, Bits>,
    asio::execution::blocking_t::never_t
  > : asio::detail::thread_pool_bits
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = false;
  typedef asio::thread_pool::basic_executor_type<
      Allocator, Bits & ~blocking_mask> result_type;
};

template <typename Allocator, unsigned int Bits>
struct require_member<
    asio::thread_pool::basic_executor_type<Allocator, Bits>,
    asio::execution::relationship_t::fork_t
  >
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = false;
  typedef asio::thread_pool::basic_executor_type<
      Allocator, Bits> result_type;
};

template <typename Allocator, unsigned int Bits>
struct require_member<
    asio::thread_pool::basic_executor_type<Allocator, Bits>,
    asio::execution::relationship_t::continuation_t
  >
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = false;
  typedef asio::thread_pool::basic_executor_type<
      Allocator, Bits> result_type;
};

template <typename Allocator, unsigned int Bits>
struct require_member<
    asio::thread_pool::basic_executor_type<Allocator, Bits>,
    asio::execution::outstanding_work_t::tracked_t
  > : asio::detail::thread_pool_bits
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = false;
  typedef asio::thread_pool::basic_executor_type<
      Allocator, Bits | outstanding_work_tracked> result_type;
};

template <typename Allocator, unsigned int Bits>
struct require_member<
    asio::thread_pool::basic_executor_type<Allocator, Bits>,
    asio::execution::outstanding_work_t::untracked_t
  > : asio::detail::thread_pool_bits
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = false;
  typedef asio::thread_pool::basic_executor_type<
      Allocator, Bits & ~outstanding_work_tracked> result_type;
};

template <typename Allocator, unsigned int Bits>
struct require_member<
    asio::thread_pool::basic_executor_type<Allocator, Bits>,
    asio::execution::allocator_t<void>
  >
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = false;
  typedef asio::thread_pool::basic_executor_type<
      std::allocator<void>, Bits> result_type;
};

template <unsigned int Bits,
    typename Allocator, typename OtherAllocator>
struct require_member<
    asio::thread_pool::basic_executor_type<Allocator, Bits>,
    asio::execution::allocator_t<OtherAllocator>
  >
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = false;
  typedef asio::thread_pool::basic_executor_type<
      OtherAllocator, Bits> result_type;
};

#endif // !defined(ASIO_HAS_DEDUCED_REQUIRE_MEMBER_TRAIT)

#if !defined(ASIO_HAS_DEDUCED_QUERY_STATIC_CONSTEXPR_MEMBER_TRAIT)

template <typename Allocator, unsigned int Bits, typename Property>
struct query_static_constexpr_member<
    asio::thread_pool::basic_executor_type<Allocator, Bits>,
    Property,
    typename asio::enable_if<
      asio::is_convertible<
        Property,
        asio::execution::outstanding_work_t
      >::value
    >::type
  > : asio::detail::thread_pool_bits
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;
  typedef asio::execution::outstanding_work_t result_type;

  static constexpr result_type value() noexcept
  {
    return (Bits & outstanding_work_tracked)
      ? execution::outstanding_work_t(execution::outstanding_work.tracked)
      : execution::outstanding_work_t(execution::outstanding_work.untracked);
  }
};

template <typename Allocator, unsigned int Bits, typename Property>
struct query_static_constexpr_member<
    asio::thread_pool::basic_executor_type<Allocator, Bits>,
    Property,
    typename asio::enable_if<
      asio::is_convertible<
        Property,
        asio::execution::mapping_t
      >::value
    >::type
  >
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;
  typedef asio::execution::mapping_t::thread_t result_type;

  static constexpr result_type value() noexcept
  {
    return result_type();
  }
};

#endif // !defined(ASIO_HAS_DEDUCED_QUERY_STATIC_CONSTEXPR_MEMBER_TRAIT)

#if !defined(ASIO_HAS_DEDUCED_QUERY_MEMBER_TRAIT)

template <typename Allocator, unsigned int Bits, typename Property>
struct query_member<
    asio::thread_pool::basic_executor_type<Allocator, Bits>,
    Property,
    typename asio::enable_if<
      asio::is_convertible<
        Property,
        asio::execution::blocking_t
      >::value
    >::type
  >
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;
  typedef asio::execution::blocking_t result_type;
};

template <typename Allocator, unsigned int Bits, typename Property>
struct query_member<
    asio::thread_pool::basic_executor_type<Allocator, Bits>,
    Property,
    typename asio::enable_if<
      asio::is_convertible<
        Property,
        asio::execution::relationship_t
      >::value
    >::type
  >
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;
  typedef asio::execution::relationship_t result_type;
};

template <typename Allocator, unsigned int Bits>
struct query_member<
    asio::thread_pool::basic_executor_type<Allocator, Bits>,
    asio::execution::occupancy_t
  >
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;
  typedef std::size_t result_type;
};

template <typename Allocator, unsigned int Bits>
struct query_member<
    asio::thread_pool::basic_executor_type<Allocator, Bits>,
    asio::execution::context_t
  >
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;
  typedef asio::thread_pool& result_type;
};

template <typename Allocator, unsigned int Bits>
struct query_member<
    asio::thread_pool::basic_executor_type<Allocator, Bits>,
    asio::execution::allocator_t<void>
  >
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;
  typedef Allocator result_type;
};

template <typename Allocator, unsigned int Bits, typename OtherAllocator>
struct query_member<
    asio::thread_pool::basic_executor_type<Allocator, Bits>,
    asio::execution::allocator_t<OtherAllocator>
  >
{
  static constexpr bool is_valid = true;
  static constexpr bool is_noexcept = true;
  typedef Allocator result_type;
};

#endif // !defined(ASIO_HAS_DEDUCED_QUERY_MEMBER_TRAIT)

} // namespace traits

namespace execution {

template <>
struct is_executor<thread_pool> : false_type
{
};

} // namespace execution

#endif // !defined(GENERATING_DOCUMENTATION)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#include "asio/impl/thread_pool.hpp"
#if defined(ASIO_HEADER_ONLY)
# include "asio/impl/thread_pool.ipp"
#endif // defined(ASIO_HEADER_ONLY)

#endif // ASIO_THREAD_POOL_HPP
