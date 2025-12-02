//
// impl/connect_pipe.hpp
// ~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_CONNECT_PIPE_HPP
#define ASIO_IMPL_CONNECT_PIPE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if defined(ASIO_HAS_PIPE)

#include "asio/connect_pipe.hpp"
#include "asio/detail/throw_error.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

template <typename Executor1, typename Executor2>
void connect_pipe(basic_readable_pipe<Executor1>& read_end,
    basic_writable_pipe<Executor2>& write_end)
{
  asio::error_code ec;
  asio::connect_pipe(read_end, write_end, ec);
  asio::detail::throw_error(ec, "connect_pipe");
}

template <typename Executor1, typename Executor2>
ASIO_SYNC_OP_VOID connect_pipe(basic_readable_pipe<Executor1>& read_end,
    basic_writable_pipe<Executor2>& write_end, asio::error_code& ec)
{
  detail::native_pipe_handle p[2];
  detail::create_pipe(p, ec);
  if (ec)
    ASIO_SYNC_OP_VOID_RETURN(ec);

  read_end.assign(p[0], ec);
  if (ec)
  {
    detail::close_pipe(p[0]);
    detail::close_pipe(p[1]);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  write_end.assign(p[1], ec);
  if (ec)
  {
    asio::error_code temp_ec;
    read_end.close(temp_ec);
    detail::close_pipe(p[1]);
    ASIO_SYNC_OP_VOID_RETURN(ec);
  }

  ASIO_SYNC_OP_VOID_RETURN(ec);
}

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // defined(ASIO_HAS_PIPE)

#endif // ASIO_IMPL_CONNECT_PIPE_HPP
