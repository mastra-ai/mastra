//
// detail/completion_payload.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_COMPLETION_PAYLOAD_HPP
#define ASIO_DETAIL_COMPLETION_PAYLOAD_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/error_code.hpp"
#include "asio/detail/completion_message.hpp"

#if defined(ASIO_HAS_STD_VARIANT)
# include <variant>
#else // defined(ASIO_HAS_STD_VARIANT)
# include <new>
#endif // defined(ASIO_HAS_STD_VARIANT)

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

template <typename... Signatures>
class completion_payload;

template <typename R>
class completion_payload<R()>
{
public:
  explicit completion_payload(completion_message<R()>)
  {
  }

  template <typename Handler>
  void receive(Handler& handler)
  {
    static_cast<Handler&&>(handler)();
  }
};

template <typename Signature>
class completion_payload<Signature>
{
public:
  completion_payload(completion_message<Signature>&& m)
    : message_(static_cast<completion_message<Signature>&&>(m))
  {
  }

  template <typename Handler>
  void receive(Handler& handler)
  {
    message_.receive(handler);
  }

private:
  completion_message<Signature> message_;
};

#if defined(ASIO_HAS_STD_VARIANT)

template <typename... Signatures>
class completion_payload
{
public:
  template <typename Signature>
  completion_payload(completion_message<Signature>&& m)
    : message_(static_cast<completion_message<Signature>&&>(m))
  {
  }

  template <typename Handler>
  void receive(Handler& handler)
  {
    std::visit(
        [&](auto& message)
        {
          message.receive(handler);
        }, message_);
  }

private:
  std::variant<completion_message<Signatures>...> message_;
};

#else // defined(ASIO_HAS_STD_VARIANT)

template <typename R1, typename R2>
class completion_payload<R1(), R2(asio::error_code)>
{
public:
  typedef completion_message<R1()> void_message_type;
  typedef completion_message<R2(asio::error_code)> error_message_type;

  completion_payload(void_message_type&&)
    : message_(0, asio::error_code()),
      empty_(true)
  {
  }

  completion_payload(error_message_type&& m)
    : message_(static_cast<error_message_type&&>(m)),
      empty_(false)
  {
  }

  template <typename Handler>
  void receive(Handler& handler)
  {
    if (empty_)
      completion_message<R1()>(0).receive(handler);
    else
      message_.receive(handler);
  }

private:
  error_message_type message_;
  bool empty_;
};

template <typename Sig1, typename Sig2>
class completion_payload<Sig1, Sig2>
{
public:
  typedef completion_message<Sig1> message_1_type;
  typedef completion_message<Sig2> message_2_type;

  completion_payload(message_1_type&& m)
    : index_(1)
  {
    new (&storage_.message_1_) message_1_type(static_cast<message_1_type&&>(m));
  }

  completion_payload(message_2_type&& m)
    : index_(2)
  {
    new (&storage_.message_2_) message_2_type(static_cast<message_2_type&&>(m));
  }

  completion_payload(completion_payload&& other)
    : index_(other.index_)
  {
    switch (index_)
    {
    case 1:
      new (&storage_.message_1_) message_1_type(
          static_cast<message_1_type&&>(other.storage_.message_1_));
      break;
    case 2:
      new (&storage_.message_2_) message_2_type(
          static_cast<message_2_type&&>(other.storage_.message_2_));
      break;
    default:
      break;
    }
  }

  ~completion_payload()
  {
    switch (index_)
    {
    case 1:
      storage_.message_1_.~message_1_type();
      break;
    case 2:
      storage_.message_2_.~message_2_type();
      break;
    default:
      break;
    }
  }

  template <typename Handler>
  void receive(Handler& handler)
  {
    switch (index_)
    {
    case 1:
      storage_.message_1_.receive(handler);
      break;
    case 2:
      storage_.message_2_.receive(handler);
      break;
    default:
      break;
    }
  }

private:
  union storage
  {
    storage() {}
    ~storage() {}

    char dummy_;
    message_1_type message_1_;
    message_2_type message_2_;
  } storage_;
  unsigned char index_;
};

#endif // defined(ASIO_HAS_STD_VARIANT)

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DETAIL_COMPLETION_PAYLOAD_HPP
