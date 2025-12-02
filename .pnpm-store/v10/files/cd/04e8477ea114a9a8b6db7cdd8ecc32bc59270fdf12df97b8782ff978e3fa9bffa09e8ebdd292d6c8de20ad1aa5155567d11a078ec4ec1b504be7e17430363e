// Copyright (c) 2020-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CONTRIB_VARIANT_TRAITS_HPP
#define TAO_JSON_CONTRIB_VARIANT_TRAITS_HPP

#include <array>
#include <utility>
#include <variant>

#include <tao/pegtl/demangle.hpp>

#include "../events/produce.hpp"

namespace tao::json
{
   template< std::size_t I, typename... Ts >
   struct variant_index_traits
   {
      using value_t = typename std::variant_alternative_t< I, std::variant< Ts... > >;

      static std::string_view demangle() noexcept
      {
         return pegtl::demangle< value_t >();
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const std::variant< Ts... >& v )
      {
         events::produce< Traits >( c, std::get< I >( v ) );
      }
   };

   namespace internal
   {
      template< typename Consumer, typename... Ts >
      using variant_produce_t = void ( * )( Consumer&, const std::variant< Ts... >& );

      template< typename Consumer, template< typename... > class Traits, typename... Ts, std::size_t... Is >
      constexpr std::array< variant_produce_t< Consumer, Ts... >, sizeof...( Ts ) > make_variant_produce_array( const std::index_sequence< Is... > /*unused*/ )
      {
         constexpr std::array< variant_produce_t< Consumer, Ts... >, sizeof...( Ts ) > result{ &variant_index_traits< Is, Ts... >::template produce< Traits, Consumer >... };
         return result;
      }

   }  // namespace internal

   template< typename... Ts >
   struct variant_traits
   {
      // TODO: as() and/or to()
      // TODO: assign()
      // TODO: consume()

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const std::variant< Ts... >& v )
      {
         static constexpr std::array< internal::variant_produce_t< Consumer, Ts... >, sizeof...( Ts ) > a = internal::make_variant_produce_array< Consumer, Traits, Ts... >( std::index_sequence_for< Ts... >() );

         c.begin_object( 2 );
         c.key( "index" );
         c.number( std::uint64_t( v.index() ) );
         c.member();
         c.key( "value" );
         a[ v.index() ]( c, v );
         c.member();
         c.end_object( 2 );
      }
   };

}  // namespace tao::json

#endif
