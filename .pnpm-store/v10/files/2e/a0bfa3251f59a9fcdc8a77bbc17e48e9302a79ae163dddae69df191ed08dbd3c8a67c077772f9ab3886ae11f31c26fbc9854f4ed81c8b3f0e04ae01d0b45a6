// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CONTRIB_TUPLE_TRAITS_HPP
#define TAO_JSON_CONTRIB_TUPLE_TRAITS_HPP

#include <tuple>
#include <utility>

#include "../binding.hpp"

namespace tao::json
{
   namespace internal
   {
      template< std::size_t I, typename... Ts >
      struct getter
      {
         [[nodiscard]] static decltype( auto ) get( std::tuple< Ts... >& t ) noexcept
         {
            return std::get< I >( t );
         }

         [[nodiscard]] static decltype( auto ) cget( const std::tuple< Ts... >& t ) noexcept
         {
            return std::get< I >( t );
         }
      };

      template< typename Indices, typename... Ts >
      struct tuple_traits;

      template< std::size_t... Is, typename... Ts >
      struct tuple_traits< std::index_sequence< Is... >, Ts... >
      {
         template< std::size_t I >
         using helper_t = binding::element2< &getter< I, Ts... >::cget, &getter< I, Ts... >::get >;

         using type = binding::array< helper_t< Is >... >;
      };

   }  // namespace internal

   template< typename... Ts >
   struct tuple_traits
      : internal::tuple_traits< std::index_sequence_for< Ts... >, Ts... >::type
   {};

}  // namespace tao::json

#endif
