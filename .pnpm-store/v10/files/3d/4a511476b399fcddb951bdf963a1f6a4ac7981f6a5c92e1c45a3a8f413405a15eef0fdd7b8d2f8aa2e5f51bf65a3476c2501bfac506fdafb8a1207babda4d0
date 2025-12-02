// Copyright (c) 2015-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_FROM_STRING_HPP
#define TAO_JSON_FROM_STRING_HPP

#include <cstddef>
#include <utility>

#include "events/from_string.hpp"
#include "events/to_value.hpp"
#include "events/transformer.hpp"

namespace tao::json
{
   template< template< typename... > class Traits, template< typename... > class... Transformers, typename... Ts >
   [[nodiscard]] basic_value< Traits > basic_from_string( Ts&&... ts )
   {
      events::transformer< events::to_basic_value< Traits >, Transformers... > consumer;
      events::from_string( consumer, std::forward< Ts >( ts )... );
      return std::move( consumer.value );
   }

   template< template< typename... > class... Transformers, typename... Ts >
   [[nodiscard]] value from_string( Ts&&... ts )
   {
      return basic_from_string< traits, Transformers... >( std::forward< Ts >( ts )... );
   }

   inline namespace literals
   {
      [[nodiscard]] inline value operator"" _json( const char* data, const std::size_t size )
      {
         return json::from_string( data, size, "literal" );
      }

   }  // namespace literals

}  // namespace tao::json

#endif
