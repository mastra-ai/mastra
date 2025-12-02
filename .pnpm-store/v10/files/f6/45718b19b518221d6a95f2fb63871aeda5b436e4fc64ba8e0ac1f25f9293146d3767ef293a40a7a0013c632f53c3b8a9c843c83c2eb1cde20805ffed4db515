//
// execution/bad_executor.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXECUTION_BAD_EXECUTOR_HPP
#define ASIO_EXECUTION_BAD_EXECUTOR_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <exception>
#include "asio/detail/push_options.hpp"

namespace asio {
namespace execution {

/// Exception thrown when trying to access an empty polymorphic executor.
class bad_executor
  : public std::exception
{
public:
  /// Constructor.
  ASIO_DECL bad_executor() noexcept;

  /// Obtain message associated with exception.
  ASIO_DECL virtual const char* what() const noexcept;
};

} // namespace execution
} // namespace asio

#include "asio/detail/pop_options.hpp"

#if defined(ASIO_HEADER_ONLY)
# include "asio/execution/impl/bad_executor.ipp"
#endif // defined(ASIO_HEADER_ONLY)

#endif // ASIO_EXECUTION_BAD_EXECUTOR_HPP
