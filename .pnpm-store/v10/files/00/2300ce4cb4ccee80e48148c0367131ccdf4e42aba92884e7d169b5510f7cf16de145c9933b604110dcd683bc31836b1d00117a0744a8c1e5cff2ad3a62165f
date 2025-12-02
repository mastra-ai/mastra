// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_JAXN_FROM_INPUT_HPP
#define TAO_JSON_JAXN_FROM_INPUT_HPP

#include <cstddef>
#include <utility>

#include "../events/to_value.hpp"
#include "../events/transformer.hpp"

#include "events/from_input.hpp"

namespace tao::json::jaxn
{
   template< template< typename... > class Traits, template< typename... > class... Transformers, typename... Ts >
   [[nodiscard]] basic_value< Traits > basic_from_input( Ts&&... ts )
   {
      json::events::transformer< json::events::to_basic_value< Traits >, Transformers... > consumer;
      jaxn::events::from_input( consumer, std::forward< Ts >( ts )... );
      return std::move( consumer.value );
   }

   template< template< typename... > class... Transformers, typename... Ts >
   [[nodiscard]] value from_input( Ts&&... ts )
   {
      return basic_from_input< traits, Transformers... >( std::forward< Ts >( ts )... );
   }

}  // namespace tao::json::jaxn

#endif
