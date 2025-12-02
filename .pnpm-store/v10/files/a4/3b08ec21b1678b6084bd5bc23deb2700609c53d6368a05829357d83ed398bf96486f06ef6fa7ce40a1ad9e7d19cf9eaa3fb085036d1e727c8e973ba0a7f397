// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_BINARY_TO_BASE64URL_HPP
#define TAO_JSON_EVENTS_BINARY_TO_BASE64URL_HPP

#include <vector>

#include "../binary_view.hpp"
#include "../internal/base64url.hpp"

namespace tao::json::events
{
   template< typename Consumer >
   struct binary_to_base64url
      : Consumer
   {
      using Consumer::Consumer;

      void binary( const tao::binary_view v )
      {
         Consumer::string( internal::base64url( v ) );
      }
   };

}  // namespace tao::json::events

#endif
