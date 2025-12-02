// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_PAD_OPT_HPP
#define TAO_PEGTL_INTERNAL_PAD_OPT_HPP

#include "../config.hpp"

#include "opt.hpp"
#include "seq.hpp"
#include "star.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename Rule, typename Pad >
   using pad_opt = seq< star< Pad >, opt< Rule, star< Pad > > >;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
