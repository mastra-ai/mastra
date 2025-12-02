// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_APPLY_HPP
#define TAO_JSON_EVENTS_APPLY_HPP

#include "ref.hpp"
#include "transformer.hpp"

namespace tao::json::events
{
   template< template< typename... > class... Transformer, typename Consumer >
   [[nodiscard]] transformer< ref< Consumer >, Transformer... > apply( Consumer& c ) noexcept( noexcept( transformer< ref< Consumer >, Transformer... >( c ) ) )
   {
      return transformer< ref< Consumer >, Transformer... >( c );
   }

}  // namespace tao::json::events

#endif
