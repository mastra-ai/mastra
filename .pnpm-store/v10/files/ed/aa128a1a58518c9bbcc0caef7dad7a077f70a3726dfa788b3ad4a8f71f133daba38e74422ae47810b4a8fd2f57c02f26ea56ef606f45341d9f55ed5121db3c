// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_BINDING_MEMBER_HPP
#define TAO_JSON_BINDING_MEMBER_HPP

#include <string>

#include "element.hpp"
#include "element2.hpp"
#include "member_kind.hpp"

#include "internal/type_key.hpp"

namespace tao::json::binding
{
   template< member_kind R, typename K, auto P >
   struct member
      : element< P >,
        internal::type_key< K, typename binding::element< P >::value_t >
   {
      static constexpr member_kind kind = R;

      template< template< typename... > class Traits, typename C >
      [[nodiscard]] static bool is_nothing( const C& x )
      {
         return json::internal::is_nothing< Traits >( binding::element< P >::read( x ) );
      }
   };

   template< member_kind R, typename K, auto G, auto S >
   struct member2
      : element2< G, S >,
        internal::type_key< K, typename binding::element2< G, S >::value_t >
   {
      static constexpr member_kind kind = R;

      template< template< typename... > class Traits, typename C >
      [[nodiscard]] static bool is_nothing( const C& x )
      {
         return json::internal::is_nothing< Traits >( binding::element2< G, S >::read( x ) );
      }
   };

}  // namespace tao::json::binding

#endif
