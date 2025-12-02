// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_LIST_MUST_HPP
#define TAO_PEGTL_INTERNAL_LIST_MUST_HPP

#if !defined( __cpp_exceptions )
#error "Exception support required for tao/pegtl/internal/list_must.hpp"
#else

#include "../config.hpp"

#include "must.hpp"
#include "seq.hpp"
#include "star.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename Rule, typename Sep >
   using list_must = seq< Rule, star< Sep, must< Rule > > >;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
#endif
