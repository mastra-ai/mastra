// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_VALIDATE_KEYS_HPP
#define TAO_JSON_EVENTS_VALIDATE_KEYS_HPP

#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>

#include <tao/pegtl/memory_input.hpp>
#include <tao/pegtl/parse.hpp>

namespace tao::json::events
{
   template< typename Consumer, typename Rule >
   struct validate_keys
      : Consumer
   {
      using Consumer::Consumer;

      void validate_key( const std::string_view v )
      {
         pegtl::memory_input< pegtl::tracking_mode::lazy > in( v.data(), v.size(), "validate_key" );
         if( !pegtl::parse< Rule >( in ) ) {
            throw std::runtime_error( "invalid key: " + std::string( v ) );
         }
      }

      void key( const std::string_view v )
      {
         validate_key( v );
         Consumer::key( v );
      }

      void key( const char* v )
      {
         validate_key( v );
         Consumer::key( v );
      }

      void key( std::string&& v )
      {
         validate_key( v );
         Consumer::key( std::move( v ) );
      }
   };

}  // namespace tao::json::events

#endif
