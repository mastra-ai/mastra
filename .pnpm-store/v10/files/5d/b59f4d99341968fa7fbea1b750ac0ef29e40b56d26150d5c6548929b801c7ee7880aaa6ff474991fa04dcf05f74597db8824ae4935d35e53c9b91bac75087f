// Copyright (c) 2019-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_INVALID_STRING_TO_BINARY_HPP
#define TAO_JSON_EVENTS_INVALID_STRING_TO_BINARY_HPP

#include <utility>
#include <vector>

#include "../binary_view.hpp"
#include "../utf8.hpp"

namespace tao::json::events
{
   template< typename Consumer >
   struct invalid_string_to_binary
      : Consumer
   {
      using Consumer::Consumer;

      void string( const char* v )
      {
         string( std::string_view( v ) );
      }

      void string( std::string&& v )
      {
         if( internal::validate_utf8_nothrow( v ) ) {
            Consumer::string( std::move( v ) );
         }
         else {
            const auto* const data = reinterpret_cast< const std::byte* >( v.data() );
            Consumer::binary( std::vector< std::byte >( data, data + v.size() ) );
         }
      }

      void string( const std::string_view v )
      {
         if( internal::validate_utf8_nothrow( v ) ) {
            Consumer::string( v );
         }
         else {
            Consumer::binary( tao::binary_view( reinterpret_cast< const std::byte* >( v.data() ), v.size() ) );
         }
      }
   };

}  // namespace tao::json::events

#endif
