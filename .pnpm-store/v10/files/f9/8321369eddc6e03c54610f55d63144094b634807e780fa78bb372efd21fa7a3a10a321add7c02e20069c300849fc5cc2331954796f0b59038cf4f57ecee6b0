//
// any_completion_handler.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_ANY_COMPLETION_HANDLER_HPP
#define ASIO_ANY_COMPLETION_HANDLER_HPP

#include "asio/detail/config.hpp"
#include <cstring>
#include <functional>
#include <memory>
#include <utility>
#include "asio/any_completion_executor.hpp"
#include "asio/any_io_executor.hpp"
#include "asio/associated_allocator.hpp"
#include "asio/associated_cancellation_slot.hpp"
#include "asio/associated_executor.hpp"
#include "asio/associated_immediate_executor.hpp"
#include "asio/cancellation_state.hpp"
#include "asio/recycling_allocator.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

class any_completion_handler_impl_base
{
public:
  template <typename S>
  explicit any_completion_handler_impl_base(S&& slot)
    : cancel_state_(static_cast<S&&>(slot), enable_total_cancellation())
  {
  }

  cancellation_slot get_cancellation_slot() const noexcept
  {
    return cancel_state_.slot();
  }

private:
  cancellation_state cancel_state_;
};

template <typename Handler>
class any_completion_handler_impl :
  public any_completion_handler_impl_base
{
public:
  template <typename S, typename H>
  any_completion_handler_impl(S&& slot, H&& h)
    : any_completion_handler_impl_base(static_cast<S&&>(slot)),
      handler_(static_cast<H&&>(h))
  {
  }

  struct uninit_deleter
  {
    typename std::allocator_traits<
      associated_allocator_t<Handler,
        asio::recycling_allocator<void>>>::template
          rebind_alloc<any_completion_handler_impl> alloc;

    void operator()(any_completion_handler_impl* ptr)
    {
      std::allocator_traits<decltype(alloc)>::deallocate(alloc, ptr, 1);
    }
  };

  struct deleter
  {
    typename std::allocator_traits<
      associated_allocator_t<Handler,
        asio::recycling_allocator<void>>>::template
          rebind_alloc<any_completion_handler_impl> alloc;

    void operator()(any_completion_handler_impl* ptr)
    {
      std::allocator_traits<decltype(alloc)>::destroy(alloc, ptr);
      std::allocator_traits<decltype(alloc)>::deallocate(alloc, ptr, 1);
    }
  };

  template <typename S, typename H>
  static any_completion_handler_impl* create(S&& slot, H&& h)
  {
    uninit_deleter d{
        (get_associated_allocator)(h,
          asio::recycling_allocator<void>())};

    std::unique_ptr<any_completion_handler_impl, uninit_deleter> uninit_ptr(
        std::allocator_traits<decltype(d.alloc)>::allocate(d.alloc, 1), d);

    any_completion_handler_impl* ptr =
      new (uninit_ptr.get()) any_completion_handler_impl(
        static_cast<S&&>(slot), static_cast<H&&>(h));

    uninit_ptr.release();
    return ptr;
  }

  void destroy()
  {
    deleter d{
        (get_associated_allocator)(handler_,
          asio::recycling_allocator<void>())};

    d(this);
  }

  any_completion_executor executor(
      const any_completion_executor& candidate) const noexcept
  {
    return any_completion_executor(std::nothrow,
        (get_associated_executor)(handler_, candidate));
  }

  any_completion_executor immediate_executor(
      const any_io_executor& candidate) const noexcept
  {
    return any_completion_executor(std::nothrow,
        (get_associated_immediate_executor)(handler_, candidate));
  }

  void* allocate(std::size_t size, std::size_t align) const
  {
    typename std::allocator_traits<
      associated_allocator_t<Handler,
        asio::recycling_allocator<void>>>::template
          rebind_alloc<unsigned char> alloc(
            (get_associated_allocator)(handler_,
              asio::recycling_allocator<void>()));

    std::size_t space = size + align - 1;
    unsigned char* base =
      std::allocator_traits<decltype(alloc)>::allocate(
        alloc, space + sizeof(std::ptrdiff_t));

    void* p = base;
    if (detail::align(align, size, p, space))
    {
      std::ptrdiff_t off = static_cast<unsigned char*>(p) - base;
      std::memcpy(static_cast<unsigned char*>(p) + size, &off, sizeof(off));
      return p;
    }

    std::bad_alloc ex;
    asio::detail::throw_exception(ex);
    return nullptr;
  }

  void deallocate(void* p, std::size_t size, std::size_t align) const
  {
    if (p)
    {
      typename std::allocator_traits<
        associated_allocator_t<Handler,
          asio::recycling_allocator<void>>>::template
            rebind_alloc<unsigned char> alloc(
              (get_associated_allocator)(handler_,
                asio::recycling_allocator<void>()));

      std::ptrdiff_t off;
      std::memcpy(&off, static_cast<unsigned char*>(p) + size, sizeof(off));
      unsigned char* base = static_cast<unsigned char*>(p) - off;

      std::allocator_traits<decltype(alloc)>::deallocate(
          alloc, base, size + align -1 + sizeof(std::ptrdiff_t));
    }
  }

  template <typename... Args>
  void call(Args&&... args)
  {
    deleter d{
        (get_associated_allocator)(handler_,
          asio::recycling_allocator<void>())};

    std::unique_ptr<any_completion_handler_impl, deleter> ptr(this, d);
    Handler handler(static_cast<Handler&&>(handler_));
    ptr.reset();

    static_cast<Handler&&>(handler)(
        static_cast<Args&&>(args)...);
  }

private:
  Handler handler_;
};

template <typename Signature>
class any_completion_handler_call_fn;

template <typename R, typename... Args>
class any_completion_handler_call_fn<R(Args...)>
{
public:
  using type = void(*)(any_completion_handler_impl_base*, Args...);

  constexpr any_completion_handler_call_fn(type fn)
    : call_fn_(fn)
  {
  }

  void call(any_completion_handler_impl_base* impl, Args... args) const
  {
    call_fn_(impl, static_cast<Args&&>(args)...);
  }

  template <typename Handler>
  static void impl(any_completion_handler_impl_base* impl, Args... args)
  {
    static_cast<any_completion_handler_impl<Handler>*>(impl)->call(
        static_cast<Args&&>(args)...);
  }

private:
  type call_fn_;
};

template <typename... Signatures>
class any_completion_handler_call_fns;

template <typename Signature>
class any_completion_handler_call_fns<Signature> :
  public any_completion_handler_call_fn<Signature>
{
public:
  using any_completion_handler_call_fn<
    Signature>::any_completion_handler_call_fn;
  using any_completion_handler_call_fn<Signature>::call;
};

template <typename Signature, typename... Signatures>
class any_completion_handler_call_fns<Signature, Signatures...> :
  public any_completion_handler_call_fn<Signature>,
  public any_completion_handler_call_fns<Signatures...>
{
public:
  template <typename CallFn, typename... CallFns>
  constexpr any_completion_handler_call_fns(CallFn fn, CallFns... fns)
    : any_completion_handler_call_fn<Signature>(fn),
      any_completion_handler_call_fns<Signatures...>(fns...)
  {
  }

  using any_completion_handler_call_fn<Signature>::call;
  using any_completion_handler_call_fns<Signatures...>::call;
};

class any_completion_handler_destroy_fn
{
public:
  using type = void(*)(any_completion_handler_impl_base*);

  constexpr any_completion_handler_destroy_fn(type fn)
    : destroy_fn_(fn)
  {
  }

  void destroy(any_completion_handler_impl_base* impl) const
  {
    destroy_fn_(impl);
  }

  template <typename Handler>
  static void impl(any_completion_handler_impl_base* impl)
  {
    static_cast<any_completion_handler_impl<Handler>*>(impl)->destroy();
  }

private:
  type destroy_fn_;
};

class any_completion_handler_executor_fn
{
public:
  using type = any_completion_executor(*)(
      any_completion_handler_impl_base*, const any_completion_executor&);

  constexpr any_completion_handler_executor_fn(type fn)
    : executor_fn_(fn)
  {
  }

  any_completion_executor executor(any_completion_handler_impl_base* impl,
      const any_completion_executor& candidate) const
  {
    return executor_fn_(impl, candidate);
  }

  template <typename Handler>
  static any_completion_executor impl(any_completion_handler_impl_base* impl,
      const any_completion_executor& candidate)
  {
    return static_cast<any_completion_handler_impl<Handler>*>(impl)->executor(
        candidate);
  }

private:
  type executor_fn_;
};

class any_completion_handler_immediate_executor_fn
{
public:
  using type = any_completion_executor(*)(
      any_completion_handler_impl_base*, const any_io_executor&);

  constexpr any_completion_handler_immediate_executor_fn(type fn)
    : immediate_executor_fn_(fn)
  {
  }

  any_completion_executor immediate_executor(
      any_completion_handler_impl_base* impl,
      const any_io_executor& candidate) const
  {
    return immediate_executor_fn_(impl, candidate);
  }

  template <typename Handler>
  static any_completion_executor impl(any_completion_handler_impl_base* impl,
      const any_io_executor& candidate)
  {
    return static_cast<any_completion_handler_impl<Handler>*>(
        impl)->immediate_executor(candidate);
  }

private:
  type immediate_executor_fn_;
};

class any_completion_handler_allocate_fn
{
public:
  using type = void*(*)(any_completion_handler_impl_base*,
      std::size_t, std::size_t);

  constexpr any_completion_handler_allocate_fn(type fn)
    : allocate_fn_(fn)
  {
  }

  void* allocate(any_completion_handler_impl_base* impl,
      std::size_t size, std::size_t align) const
  {
    return allocate_fn_(impl, size, align);
  }

  template <typename Handler>
  static void* impl(any_completion_handler_impl_base* impl,
      std::size_t size, std::size_t align)
  {
    return static_cast<any_completion_handler_impl<Handler>*>(impl)->allocate(
        size, align);
  }

private:
  type allocate_fn_;
};

class any_completion_handler_deallocate_fn
{
public:
  using type = void(*)(any_completion_handler_impl_base*,
      void*, std::size_t, std::size_t);

  constexpr any_completion_handler_deallocate_fn(type fn)
    : deallocate_fn_(fn)
  {
  }

  void deallocate(any_completion_handler_impl_base* impl,
      void* p, std::size_t size, std::size_t align) const
  {
    deallocate_fn_(impl, p, size, align);
  }

  template <typename Handler>
  static void impl(any_completion_handler_impl_base* impl,
      void* p, std::size_t size, std::size_t align)
  {
    static_cast<any_completion_handler_impl<Handler>*>(impl)->deallocate(
        p, size, align);
  }

private:
  type deallocate_fn_;
};

template <typename... Signatures>
class any_completion_handler_fn_table
  : private any_completion_handler_destroy_fn,
    private any_completion_handler_executor_fn,
    private any_completion_handler_immediate_executor_fn,
    private any_completion_handler_allocate_fn,
    private any_completion_handler_deallocate_fn,
    private any_completion_handler_call_fns<Signatures...>
{
public:
  template <typename... CallFns>
  constexpr any_completion_handler_fn_table(
      any_completion_handler_destroy_fn::type destroy_fn,
      any_completion_handler_executor_fn::type executor_fn,
      any_completion_handler_immediate_executor_fn::type immediate_executor_fn,
      any_completion_handler_allocate_fn::type allocate_fn,
      any_completion_handler_deallocate_fn::type deallocate_fn,
      CallFns... call_fns)
    : any_completion_handler_destroy_fn(destroy_fn),
      any_completion_handler_executor_fn(executor_fn),
      any_completion_handler_immediate_executor_fn(immediate_executor_fn),
      any_completion_handler_allocate_fn(allocate_fn),
      any_completion_handler_deallocate_fn(deallocate_fn),
      any_completion_handler_call_fns<Signatures...>(call_fns...)
  {
  }

  using any_completion_handler_destroy_fn::destroy;
  using any_completion_handler_executor_fn::executor;
  using any_completion_handler_immediate_executor_fn::immediate_executor;
  using any_completion_handler_allocate_fn::allocate;
  using any_completion_handler_deallocate_fn::deallocate;
  using any_completion_handler_call_fns<Signatures...>::call;
};

template <typename Handler, typename... Signatures>
struct any_completion_handler_fn_table_instance
{
  static constexpr any_completion_handler_fn_table<Signatures...>
    value = any_completion_handler_fn_table<Signatures...>(
        &any_completion_handler_destroy_fn::impl<Handler>,
        &any_completion_handler_executor_fn::impl<Handler>,
        &any_completion_handler_immediate_executor_fn::impl<Handler>,
        &any_completion_handler_allocate_fn::impl<Handler>,
        &any_completion_handler_deallocate_fn::impl<Handler>,
        &any_completion_handler_call_fn<Signatures>::template impl<Handler>...);
};

template <typename Handler, typename... Signatures>
constexpr any_completion_handler_fn_table<Signatures...>
any_completion_handler_fn_table_instance<Handler, Signatures...>::value;

} // namespace detail

template <typename... Signatures>
class any_completion_handler;

/// An allocator type that forwards memory allocation operations through an
/// instance of @c any_completion_handler.
template <typename T, typename... Signatures>
class any_completion_handler_allocator
{
private:
  template <typename...>
  friend class any_completion_handler;

  template <typename, typename...>
  friend class any_completion_handler_allocator;

  const detail::any_completion_handler_fn_table<Signatures...>* fn_table_;
  detail::any_completion_handler_impl_base* impl_;

  constexpr any_completion_handler_allocator(int,
      const any_completion_handler<Signatures...>& h) noexcept
    : fn_table_(h.fn_table_),
      impl_(h.impl_)
  {
  }

public:
  /// The type of objects that may be allocated by the allocator.
  typedef T value_type;

  /// Rebinds an allocator to another value type.
  template <typename U>
  struct rebind
  {
    /// Specifies the type of the rebound allocator.
    typedef any_completion_handler_allocator<U, Signatures...> other;
  };

  /// Construct from another @c any_completion_handler_allocator.
  template <typename U>
  constexpr any_completion_handler_allocator(
      const any_completion_handler_allocator<U, Signatures...>& a)
    noexcept
    : fn_table_(a.fn_table_),
      impl_(a.impl_)
  {
  }

  /// Equality operator.
  constexpr bool operator==(
      const any_completion_handler_allocator& other) const noexcept
  {
    return fn_table_ == other.fn_table_ && impl_ == other.impl_;
  }

  /// Inequality operator.
  constexpr bool operator!=(
      const any_completion_handler_allocator& other) const noexcept
  {
    return fn_table_ != other.fn_table_ || impl_ != other.impl_;
  }

  /// Allocate space for @c n objects of the allocator's value type.
  T* allocate(std::size_t n) const
  {
    if (fn_table_)
    {
      return static_cast<T*>(
          fn_table_->allocate(
            impl_, sizeof(T) * n, alignof(T)));
    }
    std::bad_alloc ex;
    asio::detail::throw_exception(ex);
    return nullptr;
  }

  /// Deallocate space for @c n objects of the allocator's value type.
  void deallocate(T* p, std::size_t n) const
  {
    fn_table_->deallocate(impl_, p, sizeof(T) * n, alignof(T));
  }
};

/// A protoco-allocator type that may be rebound to obtain an allocator that
/// forwards memory allocation operations through an instance of
/// @c any_completion_handler.
template <typename... Signatures>
class any_completion_handler_allocator<void, Signatures...>
{
private:
  template <typename...>
  friend class any_completion_handler;

  template <typename, typename...>
  friend class any_completion_handler_allocator;

  const detail::any_completion_handler_fn_table<Signatures...>* fn_table_;
  detail::any_completion_handler_impl_base* impl_;

  constexpr any_completion_handler_allocator(int,
      const any_completion_handler<Signatures...>& h) noexcept
    : fn_table_(h.fn_table_),
      impl_(h.impl_)
  {
  }

public:
  /// @c void as no objects can be allocated through a proto-allocator.
  typedef void value_type;

  /// Rebinds an allocator to another value type.
  template <typename U>
  struct rebind
  {
    /// Specifies the type of the rebound allocator.
    typedef any_completion_handler_allocator<U, Signatures...> other;
  };

  /// Construct from another @c any_completion_handler_allocator.
  template <typename U>
  constexpr any_completion_handler_allocator(
      const any_completion_handler_allocator<U, Signatures...>& a)
    noexcept
    : fn_table_(a.fn_table_),
      impl_(a.impl_)
  {
  }

  /// Equality operator.
  constexpr bool operator==(
      const any_completion_handler_allocator& other) const noexcept
  {
    return fn_table_ == other.fn_table_ && impl_ == other.impl_;
  }

  /// Inequality operator.
  constexpr bool operator!=(
      const any_completion_handler_allocator& other) const noexcept
  {
    return fn_table_ != other.fn_table_ || impl_ != other.impl_;
  }
};

/// Polymorphic wrapper for completion handlers.
/**
 * The @c any_completion_handler class template is a polymorphic wrapper for
 * completion handlers that propagates the associated executor, associated
 * allocator, and associated cancellation slot through a type-erasing interface.
 *
 * When using @c any_completion_handler, specify one or more completion
 * signatures as template parameters. These will dictate the arguments that may
 * be passed to the handler through the polymorphic interface.
 *
 * Typical uses for @c any_completion_handler include:
 *
 * @li Separate compilation of asynchronous operation implementations.
 *
 * @li Enabling interoperability between asynchronous operations and virtual
 *     functions.
 */
template <typename... Signatures>
class any_completion_handler
{
#if !defined(GENERATING_DOCUMENTATION)
private:
  template <typename, typename...>
  friend class any_completion_handler_allocator;

  template <typename, typename>
  friend struct associated_executor;

  template <typename, typename>
  friend struct associated_immediate_executor;

  const detail::any_completion_handler_fn_table<Signatures...>* fn_table_;
  detail::any_completion_handler_impl_base* impl_;
#endif // !defined(GENERATING_DOCUMENTATION)

public:
  /// The associated allocator type.
  using allocator_type = any_completion_handler_allocator<void, Signatures...>;

  /// The associated cancellation slot type.
  using cancellation_slot_type = cancellation_slot;

  /// Construct an @c any_completion_handler in an empty state, without a target
  /// object.
  constexpr any_completion_handler()
    : fn_table_(nullptr),
      impl_(nullptr)
  {
  }

  /// Construct an @c any_completion_handler in an empty state, without a target
  /// object.
  constexpr any_completion_handler(nullptr_t)
    : fn_table_(nullptr),
      impl_(nullptr)
  {
  }

  /// Construct an @c any_completion_handler to contain the specified target.
  template <typename H, typename Handler = decay_t<H>>
  any_completion_handler(H&& h,
      constraint_t<
        !is_same<decay_t<H>, any_completion_handler>::value
      > = 0)
    : fn_table_(
        &detail::any_completion_handler_fn_table_instance<
          Handler, Signatures...>::value),
      impl_(detail::any_completion_handler_impl<Handler>::create(
            (get_associated_cancellation_slot)(h), static_cast<H&&>(h)))
  {
  }

  /// Move-construct an @c any_completion_handler from another.
  /**
   * After the operation, the moved-from object @c other has no target.
   */
  any_completion_handler(any_completion_handler&& other) noexcept
    : fn_table_(other.fn_table_),
      impl_(other.impl_)
  {
    other.fn_table_ = nullptr;
    other.impl_ = nullptr;
  }

  /// Move-assign an @c any_completion_handler from another.
  /**
   * After the operation, the moved-from object @c other has no target.
   */
  any_completion_handler& operator=(
      any_completion_handler&& other) noexcept
  {
    any_completion_handler(
        static_cast<any_completion_handler&&>(other)).swap(*this);
    return *this;
  }

  /// Assignment operator that sets the polymorphic wrapper to the empty state.
  any_completion_handler& operator=(nullptr_t) noexcept
  {
    any_completion_handler().swap(*this);
    return *this;
  }

  /// Destructor.
  ~any_completion_handler()
  {
    if (impl_)
      fn_table_->destroy(impl_);
  }

  /// Test if the polymorphic wrapper is empty.
  constexpr explicit operator bool() const noexcept
  {
    return impl_ != nullptr;
  }

  /// Test if the polymorphic wrapper is non-empty.
  constexpr bool operator!() const noexcept
  {
    return impl_ == nullptr;
  }

  /// Swap the content of an @c any_completion_handler with another.
  void swap(any_completion_handler& other) noexcept
  {
    std::swap(fn_table_, other.fn_table_);
    std::swap(impl_, other.impl_);
  }

  /// Get the associated allocator.
  allocator_type get_allocator() const noexcept
  {
    return allocator_type(0, *this);
  }

  /// Get the associated cancellation slot.
  cancellation_slot_type get_cancellation_slot() const noexcept
  {
    return impl_ ? impl_->get_cancellation_slot() : cancellation_slot_type();
  }

  /// Function call operator.
  /**
   * Invokes target completion handler with the supplied arguments.
   *
   * This function may only be called once, as the target handler is moved from.
   * The polymorphic wrapper is left in an empty state.
   *
   * Throws @c std::bad_function_call if the polymorphic wrapper is empty.
   */
  template <typename... Args>
  auto operator()(Args&&... args)
    -> decltype(fn_table_->call(impl_, static_cast<Args&&>(args)...))
  {
    if (detail::any_completion_handler_impl_base* impl = impl_)
    {
      impl_ = nullptr;
      return fn_table_->call(impl, static_cast<Args&&>(args)...);
    }
    std::bad_function_call ex;
    asio::detail::throw_exception(ex);
  }

  /// Equality operator.
  friend constexpr bool operator==(
      const any_completion_handler& a, nullptr_t) noexcept
  {
    return a.impl_ == nullptr;
  }

  /// Equality operator.
  friend constexpr bool operator==(
      nullptr_t, const any_completion_handler& b) noexcept
  {
    return nullptr == b.impl_;
  }

  /// Inequality operator.
  friend constexpr bool operator!=(
      const any_completion_handler& a, nullptr_t) noexcept
  {
    return a.impl_ != nullptr;
  }

  /// Inequality operator.
  friend constexpr bool operator!=(
      nullptr_t, const any_completion_handler& b) noexcept
  {
    return nullptr != b.impl_;
  }
};

template <typename... Signatures, typename Candidate>
struct associated_executor<any_completion_handler<Signatures...>, Candidate>
{
  using type = any_completion_executor;

  static type get(const any_completion_handler<Signatures...>& handler,
      const Candidate& candidate = Candidate()) noexcept
  {
    any_completion_executor any_candidate(std::nothrow, candidate);
    return handler.fn_table_
      ? handler.fn_table_->executor(handler.impl_, any_candidate)
      : any_candidate;
  }
};

template <typename... Signatures, typename Candidate>
struct associated_immediate_executor<
    any_completion_handler<Signatures...>, Candidate>
{
  using type = any_completion_executor;

  static type get(const any_completion_handler<Signatures...>& handler,
      const Candidate& candidate = Candidate()) noexcept
  {
    any_io_executor any_candidate(std::nothrow, candidate);
    return handler.fn_table_
      ? handler.fn_table_->immediate_executor(handler.impl_, any_candidate)
      : any_candidate;
  }
};

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_ANY_COMPLETION_HANDLER_HPP
