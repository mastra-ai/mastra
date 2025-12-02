// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_KEY_CAMEL_CASE_TO_SNAKE_CASE_HPP
#define TAO_JSON_EVENTS_KEY_CAMEL_CASE_TO_SNAKE_CASE_HPP

#include <cctype>
#include <string>
#include <string_view>

namespace tao::json::events
{
   template< typename Consumer >
   struct key_camel_case_to_snake_case
      : Consumer
   {
      using Consumer::Consumer;

      void key( const std::string_view v )
      {
         std::string t;
         bool last_upper = false;
         for( const auto c : v ) {
            if( std::isupper( c ) != 0 ) {
               last_upper = true;
               t += c;
            }
            else {
               if( last_upper ) {
                  const char o = t.back();
                  t.pop_back();
                  if( !t.empty() && t.back() != '_' ) {
                     t += '_';
                  }
                  t += o;
               }
               last_upper = false;
               t += c;
            }
         }
         std::string r;
         bool last_lower = false;
         for( const auto c : t ) {
            if( std::isupper( c ) != 0 ) {
               if( last_lower ) {
                  r += '_';
               }
               last_lower = false;
               r += static_cast< char >( std::tolower( c ) );
            }
            else {
               last_lower = ( std::islower( c ) != 0 );
               r += c;
            }
         }
         Consumer::key( std::move( r ) );
      }
   };

}  // namespace tao::json::events

#endif
