// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_NON_FINITE_TO_EXCEPTION_HPP
#define TAO_JSON_EVENTS_NON_FINITE_TO_EXCEPTION_HPP

#include <cmath>
#include <stdexcept>

namespace tao::json::events
{
   template< typename Consumer >
   struct non_finite_to_exception
      : Consumer
   {
      using Consumer::Consumer;

      using Consumer::number;

      void number( const double v )
      {
         if( !std::isfinite( v ) ) {
            throw std::runtime_error( "invalid non-finite double value" );
         }
         Consumer::number( v );
      }
   };

}  // namespace tao::json::events

#endif
