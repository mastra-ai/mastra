// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_BINDING_INTERNAL_TYPE_KEY_HPP
#define TAO_JSON_BINDING_INTERNAL_TYPE_KEY_HPP

#include <string>

#include "../../internal/string_t.hpp"
#include "../../internal/type_traits.hpp"

namespace tao::json::binding::internal
{
   struct use_default_key
   {};

   template< typename K, typename V >
   struct type_key;

   template< char... Cs, typename V >
   struct type_key< json::internal::string_t< Cs... >, V >
   {
      template< template< typename... > class Traits >
      [[nodiscard]] static std::string key()
      {
         return json::internal::string_t< Cs... >::as_string();
      }

      template< template< typename... > class Traits = traits, typename Consumer >
      static void produce_key( Consumer& consumer )
      {
         consumer.key( json::internal::string_t< Cs... >::as_string_view() );
      }
   };

   template< typename V >
   struct type_key< use_default_key, V >
   {
      template< template< typename... > class Traits >
      [[nodiscard]] static std::string key()
      {
         return Traits< V >::template default_key< Traits >::as_string();
      }

      template< template< typename... > class Traits = traits, typename Consumer >
      static void produce_key( Consumer& consumer )
      {
         consumer.key( Traits< V >::template default_key< Traits >::as_string_view() );
      }
   };

}  // namespace tao::json::binding::internal

#endif
