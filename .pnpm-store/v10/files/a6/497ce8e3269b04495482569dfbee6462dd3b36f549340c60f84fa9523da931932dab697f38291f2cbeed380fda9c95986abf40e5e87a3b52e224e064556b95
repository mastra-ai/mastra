//
// detail/io_object_impl.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_IO_OBJECT_IMPL_HPP
#define ASIO_DETAIL_IO_OBJECT_IMPL_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include <new>
#include "asio/detail/config.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/execution/executor.hpp"
#include "asio/execution/context.hpp"
#include "asio/io_context.hpp"
#include "asio/query.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

template <typename IoObjectService,
    typename Executor = io_context::executor_type>
class io_object_impl
{
public:
  // The type of the service that will be used to provide I/O operations.
  typedef IoObjectService service_type;

  // The underlying implementation type of I/O object.
  typedef typename service_type::implementation_type implementation_type;

  // The type of the executor associated with the object.
  typedef Executor executor_type;

  // Construct an I/O object using an executor.
  explicit io_object_impl(int, const executor_type& ex)
    : service_(&asio::use_service<IoObjectService>(
          io_object_impl::get_context(ex))),
      executor_(ex)
  {
    service_->construct(implementation_);
  }

  // Construct an I/O object using an execution context.
  template <typename ExecutionContext>
  explicit io_object_impl(int, int, ExecutionContext& context)
    : service_(&asio::use_service<IoObjectService>(context)),
      executor_(context.get_executor())
  {
    service_->construct(implementation_);
  }

  // Move-construct an I/O object.
  io_object_impl(io_object_impl&& other)
    : service_(&other.get_service()),
      executor_(other.get_executor())
  {
    service_->move_construct(implementation_, other.implementation_);
  }

  // Perform converting move-construction of an I/O object on the same service.
  template <typename Executor1>
  io_object_impl(io_object_impl<IoObjectService, Executor1>&& other)
    : service_(&other.get_service()),
      executor_(other.get_executor())
  {
    service_->move_construct(implementation_, other.get_implementation());
  }

  // Perform converting move-construction of an I/O object on another service.
  template <typename IoObjectService1, typename Executor1>
  io_object_impl(io_object_impl<IoObjectService1, Executor1>&& other)
    : service_(&asio::use_service<IoObjectService>(
            io_object_impl::get_context(other.get_executor()))),
      executor_(other.get_executor())
  {
    service_->converting_move_construct(implementation_,
        other.get_service(), other.get_implementation());
  }

  // Destructor.
  ~io_object_impl()
  {
    service_->destroy(implementation_);
  }

  // Move-assign an I/O object.
  io_object_impl& operator=(io_object_impl&& other)
  {
    if (this != &other)
    {
      service_->move_assign(implementation_,
          *other.service_, other.implementation_);
      executor_.~executor_type();
      new (&executor_) executor_type(other.executor_);
      service_ = other.service_;
    }
    return *this;
  }

  // Get the executor associated with the object.
  const executor_type& get_executor() noexcept
  {
    return executor_;
  }

  // Get the service associated with the I/O object.
  service_type& get_service()
  {
    return *service_;
  }

  // Get the service associated with the I/O object.
  const service_type& get_service() const
  {
    return *service_;
  }

  // Get the underlying implementation of the I/O object.
  implementation_type& get_implementation()
  {
    return implementation_;
  }

  // Get the underlying implementation of the I/O object.
  const implementation_type& get_implementation() const
  {
    return implementation_;
  }

private:
  // Helper function to get an executor's context.
  template <typename T>
  static execution_context& get_context(const T& t,
      enable_if_t<execution::is_executor<T>::value>* = 0)
  {
    return asio::query(t, execution::context);
  }

  // Helper function to get an executor's context.
  template <typename T>
  static execution_context& get_context(const T& t,
      enable_if_t<!execution::is_executor<T>::value>* = 0)
  {
    return t.context();
  }

  // Disallow copying and copy assignment.
  io_object_impl(const io_object_impl&);
  io_object_impl& operator=(const io_object_impl&);

  // The service associated with the I/O object.
  service_type* service_;

  // The underlying implementation of the I/O object.
  implementation_type implementation_;

  // The associated executor.
  executor_type executor_;
};

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DETAIL_IO_OBJECT_IMPL_HPP
