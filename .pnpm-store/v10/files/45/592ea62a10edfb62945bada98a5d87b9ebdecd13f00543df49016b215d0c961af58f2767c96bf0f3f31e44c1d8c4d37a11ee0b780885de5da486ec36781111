//
// executor.hpp
// ~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXECUTOR_HPP
#define ASIO_EXECUTOR_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if !defined(ASIO_NO_TS_EXECUTORS)

#include <new>
#include <typeinfo>
#include "asio/detail/cstddef.hpp"
#include "asio/detail/executor_function.hpp"
#include "asio/detail/memory.hpp"
#include "asio/detail/throw_exception.hpp"
#include "asio/execution_context.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

/// Exception thrown when trying to access an empty polymorphic executor.
class bad_executor
  : public std::exception
{
public:
  /// Constructor.
  ASIO_DECL bad_executor() noexcept;

  /// Obtain message associated with exception.
  ASIO_DECL virtual const char* what() const
    noexcept;
};

/// Polymorphic wrapper for executors.
class executor
{
public:
  /// Default constructor.
  executor() noexcept
    : impl_(0)
  {
  }

  /// Construct from nullptr.
  executor(nullptr_t) noexcept
    : impl_(0)
  {
  }

  /// Copy constructor.
  executor(const executor& other) noexcept
    : impl_(other.clone())
  {
  }

  /// Move constructor.
  executor(executor&& other) noexcept
    : impl_(other.impl_)
  {
    other.impl_ = 0;
  }

  /// Construct a polymorphic wrapper for the specified executor.
  template <typename Executor>
  executor(Executor e);

  /// Construct a polymorphic executor that points to the same target as
  /// another polymorphic executor.
  executor(std::nothrow_t, const executor& other) noexcept
    : impl_(other.clone())
  {
  }

  /// Construct a polymorphic executor that moves the target from another
  /// polymorphic executor.
  executor(std::nothrow_t, executor&& other) noexcept
    : impl_(other.impl_)
  {
    other.impl_ = 0;
  }

  /// Construct a polymorphic wrapper for the specified executor.
  template <typename Executor>
  executor(std::nothrow_t, Executor e) noexcept;

  /// Allocator-aware constructor to create a polymorphic wrapper for the
  /// specified executor.
  template <typename Executor, typename Allocator>
  executor(allocator_arg_t, const Allocator& a, Executor e);

  /// Destructor.
  ~executor()
  {
    destroy();
  }

  /// Assignment operator.
  executor& operator=(const executor& other) noexcept
  {
    destroy();
    impl_ = other.clone();
    return *this;
  }

  // Move assignment operator.
  executor& operator=(executor&& other) noexcept
  {
    destroy();
    impl_ = other.impl_;
    other.impl_ = 0;
    return *this;
  }

  /// Assignment operator for nullptr_t.
  executor& operator=(nullptr_t) noexcept
  {
    destroy();
    impl_ = 0;
    return *this;
  }

  /// Assignment operator to create a polymorphic wrapper for the specified
  /// executor.
  template <typename Executor>
  executor& operator=(Executor&& e) noexcept
  {
    executor tmp(static_cast<Executor&&>(e));
    destroy();
    impl_ = tmp.impl_;
    tmp.impl_ = 0;
    return *this;
  }

  /// Obtain the underlying execution context.
  execution_context& context() const noexcept
  {
    return get_impl()->context();
  }

  /// Inform the executor that it has some outstanding work to do.
  void on_work_started() const noexcept
  {
    get_impl()->on_work_started();
  }

  /// Inform the executor that some work is no longer outstanding.
  void on_work_finished() const noexcept
  {
    get_impl()->on_work_finished();
  }

  /// Request the executor to invoke the given function object.
  /**
   * This function is used to ask the executor to execute the given function
   * object. The function object is executed according to the rules of the
   * target executor object.
   *
   * @param f The function object to be called. The executor will make a copy
   * of the handler object as required. The function signature of the function
   * object must be: @code void function(); @endcode
   *
   * @param a An allocator that may be used by the executor to allocate the
   * internal storage needed for function invocation.
   */
  template <typename Function, typename Allocator>
  void dispatch(Function&& f, const Allocator& a) const;

  /// Request the executor to invoke the given function object.
  /**
   * This function is used to ask the executor to execute the given function
   * object. The function object is executed according to the rules of the
   * target executor object.
   *
   * @param f The function object to be called. The executor will make
   * a copy of the handler object as required. The function signature of the
   * function object must be: @code void function(); @endcode
   *
   * @param a An allocator that may be used by the executor to allocate the
   * internal storage needed for function invocation.
   */
  template <typename Function, typename Allocator>
  void post(Function&& f, const Allocator& a) const;

  /// Request the executor to invoke the given function object.
  /**
   * This function is used to ask the executor to execute the given function
   * object. The function object is executed according to the rules of the
   * target executor object.
   *
   * @param f The function object to be called. The executor will make
   * a copy of the handler object as required. The function signature of the
   * function object must be: @code void function(); @endcode
   *
   * @param a An allocator that may be used by the executor to allocate the
   * internal storage needed for function invocation.
   */
  template <typename Function, typename Allocator>
  void defer(Function&& f, const Allocator& a) const;

  struct unspecified_bool_type_t {};
  typedef void (*unspecified_bool_type)(unspecified_bool_type_t);
  static void unspecified_bool_true(unspecified_bool_type_t) {}

  /// Operator to test if the executor contains a valid target.
  operator unspecified_bool_type() const noexcept
  {
    return impl_ ? &executor::unspecified_bool_true : 0;
  }

  /// Obtain type information for the target executor object.
  /**
   * @returns If @c *this has a target type of type @c T, <tt>typeid(T)</tt>;
   * otherwise, <tt>typeid(void)</tt>.
   */
#if !defined(ASIO_NO_TYPEID) || defined(GENERATING_DOCUMENTATION)
  const std::type_info& target_type() const noexcept
  {
    return impl_ ? impl_->target_type() : typeid(void);
  }
#else // !defined(ASIO_NO_TYPEID) || defined(GENERATING_DOCUMENTATION)
  const void* target_type() const noexcept
  {
    return impl_ ? impl_->target_type() : 0;
  }
#endif // !defined(ASIO_NO_TYPEID) || defined(GENERATING_DOCUMENTATION)

  /// Obtain a pointer to the target executor object.
  /**
   * @returns If <tt>target_type() == typeid(T)</tt>, a pointer to the stored
   * executor target; otherwise, a null pointer.
   */
  template <typename Executor>
  Executor* target() noexcept;

  /// Obtain a pointer to the target executor object.
  /**
   * @returns If <tt>target_type() == typeid(T)</tt>, a pointer to the stored
   * executor target; otherwise, a null pointer.
   */
  template <typename Executor>
  const Executor* target() const noexcept;

  /// Compare two executors for equality.
  friend bool operator==(const executor& a,
      const executor& b) noexcept
  {
    if (a.impl_ == b.impl_)
      return true;
    if (!a.impl_ || !b.impl_)
      return false;
    return a.impl_->equals(b.impl_);
  }

  /// Compare two executors for inequality.
  friend bool operator!=(const executor& a,
      const executor& b) noexcept
  {
    return !(a == b);
  }

private:
#if !defined(GENERATING_DOCUMENTATION)
  typedef detail::executor_function function;
  template <typename, typename> class impl;

#if !defined(ASIO_NO_TYPEID)
  typedef const std::type_info& type_id_result_type;
#else // !defined(ASIO_NO_TYPEID)
  typedef const void* type_id_result_type;
#endif // !defined(ASIO_NO_TYPEID)

  template <typename T>
  static type_id_result_type type_id()
  {
#if !defined(ASIO_NO_TYPEID)
    return typeid(T);
#else // !defined(ASIO_NO_TYPEID)
    static int unique_id;
    return &unique_id;
#endif // !defined(ASIO_NO_TYPEID)
  }

  // Base class for all polymorphic executor implementations.
  class impl_base
  {
  public:
    virtual impl_base* clone() const noexcept = 0;
    virtual void destroy() noexcept = 0;
    virtual execution_context& context() noexcept = 0;
    virtual void on_work_started() noexcept = 0;
    virtual void on_work_finished() noexcept = 0;
    virtual void dispatch(function&&) = 0;
    virtual void post(function&&) = 0;
    virtual void defer(function&&) = 0;
    virtual type_id_result_type target_type() const noexcept = 0;
    virtual void* target() noexcept = 0;
    virtual const void* target() const noexcept = 0;
    virtual bool equals(const impl_base* e) const noexcept = 0;

  protected:
    impl_base(bool fast_dispatch) : fast_dispatch_(fast_dispatch) {}
    virtual ~impl_base() {}

  private:
    friend class executor;
    const bool fast_dispatch_;
  };

  // Helper function to check and return the implementation pointer.
  impl_base* get_impl() const
  {
    if (!impl_)
    {
      bad_executor ex;
      asio::detail::throw_exception(ex);
    }
    return impl_;
  }

  // Helper function to clone another implementation.
  impl_base* clone() const noexcept
  {
    return impl_ ? impl_->clone() : 0;
  }

  // Helper function to destroy an implementation.
  void destroy() noexcept
  {
    if (impl_)
      impl_->destroy();
  }

  impl_base* impl_;
#endif // !defined(GENERATING_DOCUMENTATION)
};

} // namespace asio

ASIO_USES_ALLOCATOR(asio::executor)

#include "asio/detail/pop_options.hpp"

#include "asio/impl/executor.hpp"
#if defined(ASIO_HEADER_ONLY)
# include "asio/impl/executor.ipp"
#endif // defined(ASIO_HEADER_ONLY)

#endif // !defined(ASIO_NO_TS_EXECUTORS)

#endif // ASIO_EXECUTOR_HPP
