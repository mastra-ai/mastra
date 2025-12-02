// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_JAXN_FROM_STRING_HPP
#define TAO_JSON_JAXN_FROM_STRING_HPP

#include <cstddef>
#include <utility>

#include "../events/to_value.hpp"
#include "../events/transformer.hpp"

#include "events/from_string.hpp"

namespace tao::json::jaxn
{
   template< template< typename... > class Traits, template< typename... > class... Transformers, typename... Ts >
   [[nodiscard]] basic_value< Traits > basic_from_string( Ts&&... ts )
   {
      json::events::transformer< json::events::to_basic_value< Traits >, Transformers... > consumer;
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
      [[nodiscard]] inline value operator"" _jaxn( const char* data, const std::size_t size )
      {
         return jaxn::from_string( data, size, "literal" );
      }

   }  // namespace literals

}  // namespace tao::json::jaxn

#endif
