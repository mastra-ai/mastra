// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_JAXN_EVENTS_TO_STREAM_HPP
#define TAO_JSON_JAXN_EVENTS_TO_STREAM_HPP

#include "../../events/to_stream.hpp"

#include "../../external/ryu.hpp"

#include "../../internal/hexdump.hpp"

#include "../is_identifier.hpp"

namespace tao::json::jaxn::events
{
   // Events consumer to build a JAXN string representation.

   struct to_stream
      : json::events::to_stream
   {
      using json::events::to_stream::number;
      using json::events::to_stream::to_stream;

      void number( const double v )
      {
         next();
         if( !std::isfinite( v ) ) {
            if( std::isnan( v ) ) {
               os << "NaN";
            }
            else if( v < 0 ) {
               os << "-Infinity";
            }
            else {
               os << "Infinity";
            }
         }
         else {
            ryu::d2s_stream( os, v );
         }
      }

      void key( const std::string_view v )
      {
         if( jaxn::is_identifier( v ) ) {
            next();
            os.write( v.data(), static_cast< std::streamsize >( v.size() ) );
         }
         else {
            string( v );
         }
         os.put( ':' );
         first = true;
      }

      void binary( const tao::binary_view v )
      {
         next();
         os.put( '$' );
         json::internal::hexdump( os, v );
      }
   };

}  // namespace tao::json::jaxn::events

#endif
