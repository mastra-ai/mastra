// Copyright (c) 2022-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_VIRTUALIZE_HPP
#define TAO_JSON_EVENTS_VIRTUALIZE_HPP

#include <type_traits>

#include "virtual_base.hpp"
#include "virtual_ref.hpp"

namespace tao::json::events
{
   template< typename Consumer >
   [[nodiscard]] decltype( auto ) virtualize( Consumer& c ) noexcept
   {
      if constexpr( std::is_base_of_v< virtual_base, Consumer > ) {
         return c;
      }
      else {
         return events::virtual_ref( c );
      }
   }

}  // namespace tao::json::events

#endif
