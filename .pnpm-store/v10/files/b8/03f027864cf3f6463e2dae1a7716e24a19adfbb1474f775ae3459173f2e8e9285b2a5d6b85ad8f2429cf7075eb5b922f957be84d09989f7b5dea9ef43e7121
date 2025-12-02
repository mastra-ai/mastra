// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_LIST_TAIL_HPP
#define TAO_PEGTL_INTERNAL_LIST_TAIL_HPP

#include "../config.hpp"

#include "opt.hpp"
#include "seq.hpp"
#include "star.hpp"

#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename Rule, typename Sep >
   using list_tail = seq< Rule, star< Sep, Rule >, opt< Sep > >;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
