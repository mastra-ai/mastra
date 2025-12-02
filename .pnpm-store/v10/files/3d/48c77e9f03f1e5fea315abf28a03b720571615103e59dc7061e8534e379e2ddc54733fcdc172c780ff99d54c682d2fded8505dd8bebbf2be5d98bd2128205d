//
// impl/execution_context.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_EXECUTION_CONTEXT_HPP
#define ASIO_IMPL_EXECUTION_CONTEXT_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/handler_type_requirements.hpp"
#include "asio/detail/scoped_ptr.hpp"
#include "asio/detail/service_registry.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

#if !defined(GENERATING_DOCUMENTATION)

template <typename Service>
inline Service& use_service(execution_context& e)
{
  // Check that Service meets the necessary type requirements.
  (void)static_cast<execution_context::service*>(static_cast<Service*>(0));

  return e.service_registry_->template use_service<Service>();
}

template <typename Service, typename... Args>
Service& make_service(execution_context& e, Args&&... args)
{
  detail::scoped_ptr<Service> svc(
      new Service(e, static_cast<Args&&>(args)...));
  e.service_registry_->template add_service<Service>(svc.get());
  Service& result = *svc;
  svc.release();
  return result;
}

template <typename Service>
inline void add_service(execution_context& e, Service* svc)
{
  // Check that Service meets the necessary type requirements.
  (void)static_cast<execution_context::service*>(static_cast<Service*>(0));

  e.service_registry_->template add_service<Service>(svc);
}

template <typename Service>
inline bool has_service(execution_context& e)
{
  // Check that Service meets the necessary type requirements.
  (void)static_cast<execution_context::service*>(static_cast<Service*>(0));

  return e.service_registry_->template has_service<Service>();
}

#endif // !defined(GENERATING_DOCUMENTATION)

inline execution_context& execution_context::service::context()
{
  return owner_;
}

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IMPL_EXECUTION_CONTEXT_HPP
