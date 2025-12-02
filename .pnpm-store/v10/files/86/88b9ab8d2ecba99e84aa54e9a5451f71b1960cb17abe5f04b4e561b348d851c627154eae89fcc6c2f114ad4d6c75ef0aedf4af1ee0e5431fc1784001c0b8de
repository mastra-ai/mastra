// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_STAR_MUST_HPP
#define TAO_PEGTL_INTERNAL_STAR_MUST_HPP

#if !defined( __cpp_exceptions )
#error "Exception support required for tao/pegtl/internal/star_must.hpp"
#else

#include "../config.hpp"

#include "if_must.hpp"
#include "star.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename Cond, typename... Rules >
   using star_must = star< if_must< false, Cond, Rules... > >;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
#endif
