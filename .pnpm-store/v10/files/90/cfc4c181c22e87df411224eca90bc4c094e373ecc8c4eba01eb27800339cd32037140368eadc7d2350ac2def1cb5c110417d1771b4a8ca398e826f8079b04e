// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_REP_MIN_HPP
#define TAO_PEGTL_INTERNAL_REP_MIN_HPP

#include "../config.hpp"

#include "rep.hpp"
#include "seq.hpp"
#include "star.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< unsigned Min, typename Rule, typename... Rules >
   using rep_min = seq< rep< Min, Rule, Rules... >, star< Rule, Rules... > >;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
