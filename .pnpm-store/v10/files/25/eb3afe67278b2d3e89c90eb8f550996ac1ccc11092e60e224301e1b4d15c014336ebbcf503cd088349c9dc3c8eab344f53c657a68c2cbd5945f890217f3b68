//
// impl/cancellation_signal.ipp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_CANCELLATION_SIGNAL_IPP
#define ASIO_IMPL_CANCELLATION_SIGNAL_IPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/cancellation_signal.hpp"
#include "asio/detail/thread_context.hpp"
#include "asio/detail/thread_info_base.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

cancellation_signal::~cancellation_signal()
{
  if (handler_)
  {
    std::pair<void*, std::size_t> mem = handler_->destroy();
    detail::thread_info_base::deallocate(
        detail::thread_info_base::cancellation_signal_tag(),
        detail::thread_context::top_of_thread_call_stack(),
        mem.first, mem.second);
  }
}

void cancellation_slot::clear()
{
  if (handler_ != 0 && *handler_ != 0)
  {
    std::pair<void*, std::size_t> mem = (*handler_)->destroy();
    detail::thread_info_base::deallocate(
        detail::thread_info_base::cancellation_signal_tag(),
        detail::thread_context::top_of_thread_call_stack(),
        mem.first, mem.second);
    *handler_ = 0;
  }
}

std::pair<void*, std::size_t> cancellation_slot::prepare_memory(
    std::size_t size, std::size_t align)
{
  assert(handler_);
  std::pair<void*, std::size_t> mem;
  if (*handler_)
  {
    mem = (*handler_)->destroy();
    *handler_ = 0;
  }
  if (size > mem.second
      || reinterpret_cast<std::size_t>(mem.first) % align != 0)
  {
    if (mem.first)
    {
      detail::thread_info_base::deallocate(
          detail::thread_info_base::cancellation_signal_tag(),
          detail::thread_context::top_of_thread_call_stack(),
          mem.first, mem.second);
    }
    mem.first = detail::thread_info_base::allocate(
        detail::thread_info_base::cancellation_signal_tag(),
        detail::thread_context::top_of_thread_call_stack(),
        size, align);
    mem.second = size;
  }
  return mem;
}

cancellation_slot::auto_delete_helper::~auto_delete_helper()
{
  if (mem.first)
  {
    detail::thread_info_base::deallocate(
        detail::thread_info_base::cancellation_signal_tag(),
        detail::thread_context::top_of_thread_call_stack(),
        mem.first, mem.second);
  }
}

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IMPL_CANCELLATION_SIGNAL_IPP
