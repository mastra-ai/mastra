// Copyright (c) 2016-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_TO_VALUE_HPP
#define TAO_JSON_EVENTS_TO_VALUE_HPP

#include "set_value.hpp"

#include "../value.hpp"

namespace tao::json::events
{
   // Events consumer to build a JSON Value.

   template< template< typename... > class Traits >
   struct to_basic_value
      : set_basic_value< Traits >
   {
      basic_value< Traits > value;

      to_basic_value() noexcept
         : set_basic_value< Traits >( value )
      {}
   };

   using to_value = to_basic_value< traits >;

}  // namespace tao::json::events

#endif
