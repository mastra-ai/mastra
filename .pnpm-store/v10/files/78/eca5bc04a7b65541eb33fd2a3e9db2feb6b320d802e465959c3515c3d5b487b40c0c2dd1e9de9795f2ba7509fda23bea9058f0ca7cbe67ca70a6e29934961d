// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CONSUME_HPP
#define TAO_JSON_CONSUME_HPP

#include <type_traits>

#include "forward.hpp"

#include "internal/type_traits.hpp"

namespace tao::json
{
   template< typename T, template< typename... > class Traits = traits, typename Producer >
   [[nodiscard]] std::enable_if_t< internal::has_consume_one< Traits, Producer, T >, T > consume( Producer& parser )
   {
      return Traits< T >::template consume< Traits >( parser );
   }

   template< typename T, template< typename... > class Traits = traits, typename Producer >
   [[nodiscard]] std::enable_if_t< !internal::has_consume_one< Traits, Producer, T >, T > consume( Producer& parser )
   {
      T t;
      Traits< T >::template consume< Traits >( parser, t );
      return t;
   }

   template< template< typename... > class Traits = traits, typename Producer, typename T >
   std::enable_if_t< internal::has_consume_two< Traits, Producer, T >, void > consume( Producer& parser, T& t )
   {
      Traits< T >::template consume< Traits >( parser, t );
   }

   template< template< typename... > class Traits = traits, typename Producer, typename T >
   std::enable_if_t< !internal::has_consume_two< Traits, Producer, T >, void > consume( Producer& parser, T& t )
   {
      t = Traits< T >::template consume< Traits >( parser );
   }

}  // namespace tao::json

#endif
