// Copyright (c) 2019-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_INVALID_STRING_TO_EXCEPTION_HPP
#define TAO_JSON_EVENTS_INVALID_STRING_TO_EXCEPTION_HPP

#include <stdexcept>
#include <utility>

#include "../internal/hexdump.hpp"
#include "../utf8.hpp"

namespace tao::json::events
{
   template< typename Consumer >
   struct invalid_string_to_exception
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
            throw std::runtime_error( "invalid UTF8 string: $" + internal::hexdump( v ) );
         }
      }

      void string( const std::string_view v )
      {
         if( internal::validate_utf8_nothrow( v ) ) {
            Consumer::string( v );
         }
         else {
            throw std::runtime_error( "invalid UTF8 string: $" + internal::hexdump( v ) );
         }
      }
   };

}  // namespace tao::json::events

#endif
