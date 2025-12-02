// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_BINDING_ELEMENT_HPP
#define TAO_JSON_BINDING_ELEMENT_HPP

#include <type_traits>

#include "../consume.hpp"
#include "../forward.hpp"

#include "../events/produce.hpp"

#include "internal/elementr.hpp"

namespace tao::json::binding
{
   namespace internal
   {
      template< typename T, T F, typename = void >
      struct element
         : elementr< T, F >  // TODO: Do we want to keep the fall-back to elementr?
      {
         using class_t = typename elementr< T, F >::read_class_t;
         using value_t = typename elementr< T, F >::read_value_t;
      };

      template< typename C, typename T, T C::*P >
      struct element< T C::*, P, std::enable_if_t< std::is_member_object_pointer_v< T C::* > > >
      {
         using class_t = C;
         using value_t = std::decay_t< T >;

         [[nodiscard]] static const auto& read( const C& v ) noexcept
         {
            return v.*P;
         }

         template< typename W >
         static void write( C& v, W&& w ) noexcept( std::is_nothrow_assignable_v< value_t, decltype( std::forward< W > ) > )
         {
            v.*P = std::forward< W >( w );
         }

         template< template< typename... > class Traits >
         static void to( const basic_value< Traits >& v, C& x )
         {
            v.to( x.*P );
         }

         template< template< typename... > class Traits = traits, typename Producer >
         static void consume( Producer& parser, C& v )
         {
            json::consume< Traits >( parser, v.*P );
         }

         template< template< typename... > class Traits = traits, typename Consumer >
         static void produce( Consumer& consumer, const C& v )
         {
            events::produce< Traits >( consumer, v.*P );
         }
      };

   }  // namespace internal

   template< auto P >
   using element = internal::element< decltype( P ), P >;

}  // namespace tao::json::binding

#endif
