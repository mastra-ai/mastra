// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_BINARY_TO_EXCEPTION_HPP
#define TAO_JSON_EVENTS_BINARY_TO_EXCEPTION_HPP

#include <stdexcept>

#include "../binary_view.hpp"

namespace tao::json::events
{
   template< typename Consumer >
   struct binary_to_exception
      : Consumer
   {
      using Consumer::Consumer;

      void binary( const tao::binary_view /*unused*/ )
      {
         throw std::runtime_error( "invalid binary data" );
      }
   };

}  // namespace tao::json::events

#endif
