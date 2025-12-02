// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_PREFER_SIGNED_HPP
#define TAO_JSON_EVENTS_PREFER_SIGNED_HPP

#include <cstdint>

namespace tao::json::events
{
   template< typename Consumer >
   struct prefer_signed
      : Consumer
   {
      using Consumer::Consumer;

      using Consumer::number;

      void number( const std::uint64_t v )
      {
         if( v <= 9223372036854775807ULL ) {
            Consumer::number( static_cast< std::int64_t >( v ) );
         }
         else {
            Consumer::number( v );
         }
      }
   };

}  // namespace tao::json::events

#endif
