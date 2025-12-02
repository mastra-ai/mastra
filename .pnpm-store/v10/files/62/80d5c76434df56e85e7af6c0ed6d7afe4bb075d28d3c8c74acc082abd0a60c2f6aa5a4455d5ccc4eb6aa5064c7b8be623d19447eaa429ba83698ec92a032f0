// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_PAD_HPP
#define TAO_PEGTL_INTERNAL_PAD_HPP

#include "../config.hpp"

#include "seq.hpp"
#include "star.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename Rule, typename Pad1, typename Pad2 = Pad1 >
   using pad = seq< star< Pad1 >, Rule, star< Pad2 > >;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
