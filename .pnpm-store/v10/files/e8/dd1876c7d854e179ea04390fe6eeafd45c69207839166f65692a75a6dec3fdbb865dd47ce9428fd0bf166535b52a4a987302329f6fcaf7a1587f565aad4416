// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CONTRIB_UNIQUE_PTR_TRAITS_HPP
#define TAO_JSON_CONTRIB_UNIQUE_PTR_TRAITS_HPP

#include <cassert>
#include <memory>

#include "../forward.hpp"

#include "internal/indirect_traits.hpp"
#include "internal/type_traits.hpp"

namespace tao::json
{
   namespace internal
   {
      template< typename T, typename U >
      struct unique_ptr_traits
      {
         template< template< typename... > class Traits, typename... With >
         [[nodiscard]] static auto as( const basic_value< Traits >& v, With&... with ) -> std::enable_if_t< use_first_ptr_as< T, Traits, With... >, std::unique_ptr< U > >
         {
            return std::unique_ptr< U >( new T( v, with... ) );
         }

         template< template< typename... > class Traits, typename... With >
         [[nodiscard]] static auto as( const basic_value< Traits >& v, With&... with ) -> std::enable_if_t< use_second_ptr_as< T, Traits, With... > || use_fourth_ptr_as< T, Traits, With... >, std::unique_ptr< U > >
         {
            return std::unique_ptr< U >( new T( Traits< T >::as( v, with... ) ) );
         }

         template< template< typename... > class Traits, typename... With >
         [[nodiscard]] static auto as( const basic_value< Traits >& v, With&... with ) -> std::enable_if_t< use_third_ptr_as< T, Traits, With... >, std::unique_ptr< U > >
         {
            std::unique_ptr< U > t( new T() );
            Traits< T >::to( v, static_cast< T& >( *t ), with... );
            return t;
         }

         template< template< typename... > class Traits, typename Producer >
         [[nodiscard]] static auto consume( Producer& parser ) -> std::enable_if_t< use_first_ptr_consume< T, Traits, Producer > || use_third_ptr_consume< T, Traits, Producer >, std::unique_ptr< U > >
         {
            return Traits< T >::template consume< Traits >( parser );
         }

         template< template< typename... > class Traits, typename Producer >
         [[nodiscard]] static auto consume( Producer& parser ) -> std::enable_if_t< use_second_ptr_consume< T, Traits, Producer >, std::unique_ptr< U > >
         {
            std::unique_ptr< U > t( new T() );
            Traits< T >::template consume< Traits >( parser, static_cast< T& >( *t ) );
            return t;
         }
      };

   }  // namespace internal

   template< typename T, typename U = T >
   struct unique_ptr_traits
      : internal::unique_ptr_traits< T, U >
   {
      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, const std::unique_ptr< U >& o )
      {
         if( o ) {
            v = static_cast< const T& >( *o );
         }
         else {
            v = null;
         }
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const std::unique_ptr< U >& o )
      {
         if( o ) {
            json::events::produce< Traits >( c, static_cast< const T& >( *o ) );
         }
         else {
            c.null();
         }
      }
   };

   template< typename T >
   struct unique_ptr_traits< T, T >
      : internal::unique_ptr_traits< T, T >,
        internal::indirect_traits< std::unique_ptr< T > >
   {
      template< typename V >
      using with_base = unique_ptr_traits< T, V >;
   };

}  // namespace tao::json

#endif
