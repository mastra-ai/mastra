//
// experimental/channel_traits.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXPERIMENTAL_CHANNEL_TRAITS_HPP
#define ASIO_EXPERIMENTAL_CHANNEL_TRAITS_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <deque>
#include "asio/detail/type_traits.hpp"
#include "asio/error.hpp"
#include "asio/experimental/channel_error.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace experimental {

#if defined(GENERATING_DOCUMENTATION)

template <typename... Signatures>
struct channel_traits
{
  /// Rebind the traits to a new set of signatures.
  /**
   * This nested structure must have a single nested type @c other that
   * aliases a traits type with the specified set of signatures.
   */
  template <typename... NewSignatures>
  struct rebind
  {
    typedef user_defined other;
  };

  /// Determine the container for the specified elements.
  /**
   * This nested structure must have a single nested type @c other that
   * aliases a container type for the specified element type.
   */
  template <typename Element>
  struct container
  {
    typedef user_defined type;
  };

  /// The signature of a channel cancellation notification.
  typedef void receive_cancelled_signature(...);

  /// Invoke the specified handler with a cancellation notification.
  template <typename F>
  static void invoke_receive_cancelled(F f);

  /// The signature of a channel closed notification.
  typedef void receive_closed_signature(...);

  /// Invoke the specified handler with a closed notification.
  template <typename F>
  static void invoke_receive_closed(F f);
};

#else // defined(GENERATING_DOCUMENTATION)

/// Traits used for customising channel behaviour.
template <typename... Signatures>
struct channel_traits
{
  template <typename... NewSignatures>
  struct rebind
  {
    typedef channel_traits<NewSignatures...> other;
  };
};

template <typename R>
struct channel_traits<R(asio::error_code)>
{
  template <typename... NewSignatures>
  struct rebind
  {
    typedef channel_traits<NewSignatures...> other;
  };

  template <typename Element>
  struct container
  {
    typedef std::deque<Element> type;
  };

  typedef R receive_cancelled_signature(asio::error_code);

  template <typename F>
  static void invoke_receive_cancelled(F f)
  {
    const asio::error_code e = error::channel_cancelled;
    static_cast<F&&>(f)(e);
  }

  typedef R receive_closed_signature(asio::error_code);

  template <typename F>
  static void invoke_receive_closed(F f)
  {
    const asio::error_code e = error::channel_closed;
    static_cast<F&&>(f)(e);
  }
};

template <typename R, typename... Args, typename... Signatures>
struct channel_traits<R(asio::error_code, Args...), Signatures...>
{
  template <typename... NewSignatures>
  struct rebind
  {
    typedef channel_traits<NewSignatures...> other;
  };

  template <typename Element>
  struct container
  {
    typedef std::deque<Element> type;
  };

  typedef R receive_cancelled_signature(asio::error_code, Args...);

  template <typename F>
  static void invoke_receive_cancelled(F f)
  {
    const asio::error_code e = error::channel_cancelled;
    static_cast<F&&>(f)(e, decay_t<Args>()...);
  }

  typedef R receive_closed_signature(asio::error_code, Args...);

  template <typename F>
  static void invoke_receive_closed(F f)
  {
    const asio::error_code e = error::channel_closed;
    static_cast<F&&>(f)(e, decay_t<Args>()...);
  }
};

template <typename R>
struct channel_traits<R(std::exception_ptr)>
{
  template <typename... NewSignatures>
  struct rebind
  {
    typedef channel_traits<NewSignatures...> other;
  };

  template <typename Element>
  struct container
  {
    typedef std::deque<Element> type;
  };

  typedef R receive_cancelled_signature(std::exception_ptr);

  template <typename F>
  static void invoke_receive_cancelled(F f)
  {
    const asio::error_code e = error::channel_cancelled;
    static_cast<F&&>(f)(
        std::make_exception_ptr(asio::system_error(e)));
  }

  typedef R receive_closed_signature(std::exception_ptr);

  template <typename F>
  static void invoke_receive_closed(F f)
  {
    const asio::error_code e = error::channel_closed;
    static_cast<F&&>(f)(
        std::make_exception_ptr(asio::system_error(e)));
  }
};

template <typename R, typename... Args, typename... Signatures>
struct channel_traits<R(std::exception_ptr, Args...), Signatures...>
{
  template <typename... NewSignatures>
  struct rebind
  {
    typedef channel_traits<NewSignatures...> other;
  };

  template <typename Element>
  struct container
  {
    typedef std::deque<Element> type;
  };

  typedef R receive_cancelled_signature(std::exception_ptr, Args...);

  template <typename F>
  static void invoke_receive_cancelled(F f)
  {
    const asio::error_code e = error::channel_cancelled;
    static_cast<F&&>(f)(
        std::make_exception_ptr(asio::system_error(e)),
        decay_t<Args>()...);
  }

  typedef R receive_closed_signature(std::exception_ptr, Args...);

  template <typename F>
  static void invoke_receive_closed(F f)
  {
    const asio::error_code e = error::channel_closed;
    static_cast<F&&>(f)(
        std::make_exception_ptr(asio::system_error(e)),
        decay_t<Args>()...);
  }
};

template <typename R>
struct channel_traits<R()>
{
  template <typename... NewSignatures>
  struct rebind
  {
    typedef channel_traits<NewSignatures...> other;
  };

  template <typename Element>
  struct container
  {
    typedef std::deque<Element> type;
  };

  typedef R receive_cancelled_signature(asio::error_code);

  template <typename F>
  static void invoke_receive_cancelled(F f)
  {
    const asio::error_code e = error::channel_cancelled;
    static_cast<F&&>(f)(e);
  }

  typedef R receive_closed_signature(asio::error_code);

  template <typename F>
  static void invoke_receive_closed(F f)
  {
    const asio::error_code e = error::channel_closed;
    static_cast<F&&>(f)(e);
  }
};

template <typename R, typename T>
struct channel_traits<R(T)>
{
  template <typename... NewSignatures>
  struct rebind
  {
    typedef channel_traits<NewSignatures...> other;
  };

  template <typename Element>
  struct container
  {
    typedef std::deque<Element> type;
  };

  typedef R receive_cancelled_signature(asio::error_code);

  template <typename F>
  static void invoke_receive_cancelled(F f)
  {
    const asio::error_code e = error::channel_cancelled;
    static_cast<F&&>(f)(e);
  }

  typedef R receive_closed_signature(asio::error_code);

  template <typename F>
  static void invoke_receive_closed(F f)
  {
    const asio::error_code e = error::channel_closed;
    static_cast<F&&>(f)(e);
  }
};

#endif // defined(GENERATING_DOCUMENTATION)

} // namespace experimental
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_EXPERIMENTAL_CHANNEL_TRAITS_HPP
