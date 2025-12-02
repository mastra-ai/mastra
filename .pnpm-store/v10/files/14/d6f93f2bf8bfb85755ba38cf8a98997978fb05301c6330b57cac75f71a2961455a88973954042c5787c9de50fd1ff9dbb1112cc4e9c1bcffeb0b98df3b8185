//
// detail/handler_alloc_helpers.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_HANDLER_ALLOC_HELPERS_HPP
#define ASIO_DETAIL_HANDLER_ALLOC_HELPERS_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/memory.hpp"
#include "asio/detail/recycling_allocator.hpp"
#include "asio/associated_allocator.hpp"

#include "asio/detail/push_options.hpp"

#define ASIO_DEFINE_TAGGED_HANDLER_PTR(purpose, op) \
  struct ptr \
  { \
    Handler* h; \
    op* v; \
    op* p; \
    ~ptr() \
    { \
      reset(); \
    } \
    static op* allocate(Handler& handler) \
    { \
      typedef typename ::asio::associated_allocator< \
        Handler>::type associated_allocator_type; \
      typedef typename ::asio::detail::get_recycling_allocator< \
        associated_allocator_type, purpose>::type default_allocator_type; \
      ASIO_REBIND_ALLOC(default_allocator_type, op) a( \
            ::asio::detail::get_recycling_allocator< \
              associated_allocator_type, purpose>::get( \
                ::asio::get_associated_allocator(handler))); \
      return a.allocate(1); \
    } \
    void reset() \
    { \
      if (p) \
      { \
        p->~op(); \
        p = 0; \
      } \
      if (v) \
      { \
        typedef typename ::asio::associated_allocator< \
          Handler>::type associated_allocator_type; \
        typedef typename ::asio::detail::get_recycling_allocator< \
          associated_allocator_type, purpose>::type default_allocator_type; \
        ASIO_REBIND_ALLOC(default_allocator_type, op) a( \
              ::asio::detail::get_recycling_allocator< \
                associated_allocator_type, purpose>::get( \
                  ::asio::get_associated_allocator(*h))); \
        a.deallocate(static_cast<op*>(v), 1); \
        v = 0; \
      } \
    } \
  } \
  /**/

#define ASIO_DEFINE_HANDLER_PTR(op) \
  ASIO_DEFINE_TAGGED_HANDLER_PTR( \
      ::asio::detail::thread_info_base::default_tag, op ) \
  /**/

#define ASIO_DEFINE_TAGGED_HANDLER_ALLOCATOR_PTR(purpose, op) \
  struct ptr \
  { \
    const Alloc* a; \
    void* v; \
    op* p; \
    ~ptr() \
    { \
      reset(); \
    } \
    static op* allocate(const Alloc& a) \
    { \
      typedef typename ::asio::detail::get_recycling_allocator< \
        Alloc, purpose>::type recycling_allocator_type; \
      ASIO_REBIND_ALLOC(recycling_allocator_type, op) a1( \
            ::asio::detail::get_recycling_allocator< \
              Alloc, purpose>::get(a)); \
      return a1.allocate(1); \
    } \
    void reset() \
    { \
      if (p) \
      { \
        p->~op(); \
        p = 0; \
      } \
      if (v) \
      { \
        typedef typename ::asio::detail::get_recycling_allocator< \
          Alloc, purpose>::type recycling_allocator_type; \
        ASIO_REBIND_ALLOC(recycling_allocator_type, op) a1( \
              ::asio::detail::get_recycling_allocator< \
                Alloc, purpose>::get(*a)); \
        a1.deallocate(static_cast<op*>(v), 1); \
        v = 0; \
      } \
    } \
  } \
  /**/

#define ASIO_DEFINE_HANDLER_ALLOCATOR_PTR(op) \
  ASIO_DEFINE_TAGGED_HANDLER_ALLOCATOR_PTR( \
      ::asio::detail::thread_info_base::default_tag, op ) \
  /**/

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DETAIL_HANDLER_ALLOC_HELPERS_HPP
