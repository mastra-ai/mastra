// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_NON_FINITE_TO_NULL_HPP
#define TAO_JSON_EVENTS_NON_FINITE_TO_NULL_HPP

#include <cmath>

namespace tao::json::events
{
   template< typename Consumer >
   struct non_finite_to_null
      : Consumer
   {
      using Consumer::Consumer;

      using Consumer::number;

      void number( const double v )
      {
         if( !std::isfinite( v ) ) {
            Consumer::null();
         }
         else {
            Consumer::number( v );
         }
      }
   };

}  // namespace tao::json::events

#endif
