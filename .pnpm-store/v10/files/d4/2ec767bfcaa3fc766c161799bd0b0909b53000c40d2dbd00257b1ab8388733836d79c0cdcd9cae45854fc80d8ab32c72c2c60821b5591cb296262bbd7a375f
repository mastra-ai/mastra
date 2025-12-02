//
// detail/io_uring_operation.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_IO_URING_OPERATION_HPP
#define ASIO_DETAIL_IO_URING_OPERATION_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_IO_URING)

#include <liburing.h>
#include "asio/detail/cstdint.hpp"
#include "asio/detail/operation.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

class io_uring_operation
  : public operation
{
public:
  // The error code to be passed to the completion handler.
  asio::error_code ec_;

  // The number of bytes transferred, to be passed to the completion handler.
  std::size_t bytes_transferred_;

  // The operation key used for targeted cancellation.
  void* cancellation_key_;

  // Prepare the operation.
  void prepare(::io_uring_sqe* sqe)
  {
    return prepare_func_(this, sqe);
  }

  // Perform actions associated with the operation. Returns true when complete.
  bool perform(bool after_completion)
  {
    return perform_func_(this, after_completion);
  }

protected:
  typedef void (*prepare_func_type)(io_uring_operation*, ::io_uring_sqe*);
  typedef bool (*perform_func_type)(io_uring_operation*, bool);

  io_uring_operation(const asio::error_code& success_ec,
      prepare_func_type prepare_func, perform_func_type perform_func,
      func_type complete_func)
    : operation(complete_func),
      ec_(success_ec),
      bytes_transferred_(0),
      cancellation_key_(0),
      prepare_func_(prepare_func),
      perform_func_(perform_func)
  {
  }

private:
  prepare_func_type prepare_func_;
  perform_func_type perform_func_;
};

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // defined(ASIO_HAS_IO_URING)

#endif // ASIO_DETAIL_IO_URING_OPERATION_HPP
