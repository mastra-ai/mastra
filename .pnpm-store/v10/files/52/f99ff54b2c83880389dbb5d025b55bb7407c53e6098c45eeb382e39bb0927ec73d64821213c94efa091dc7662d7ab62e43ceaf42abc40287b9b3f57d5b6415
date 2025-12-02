// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_BINDING_VERSIONS_HPP
#define TAO_JSON_BINDING_VERSIONS_HPP

#include <exception>
#include <stdexcept>

#include <tao/pegtl/demangle.hpp>

#include "../forward.hpp"

#include "../internal/format.hpp"
#include "../internal/type_traits.hpp"

namespace tao::json::binding
{
   template< typename... Vs >
   struct versions;

   template< typename V >
   struct versions< V >
      : V
   {};

   template< typename V, typename... Vs >
   struct versions< V, Vs... >
      : V
   {
      template< typename C >
      static void throw_on_error( const bool ok, const std::exception_ptr& e )
      {
         if( !ok ) {
            try {
               std::rethrow_exception( e );  // TODO: Did I miss a way to avoid the throw?
            }
            catch( ... ) {
               std::throw_with_nested( std::runtime_error( json::internal::format( "all versions failed for type ", pegtl::demangle< C >(), " -- see nested for first error" ) ) );
            }
         }
      }

      template< template< typename... > class Traits, typename C >
      [[nodiscard]] static std::exception_ptr first_to( const basic_value< Traits >& v, C& x ) noexcept
      {
         try {
            if constexpr( json::internal::has_to< V, basic_value< Traits >, C > ) {
               V::to( v, x );
            }
            else if constexpr( json::internal::has_as< V, basic_value< Traits > > ) {
               x = V::as( v );
            }
            else {
               static_assert( std::is_void_v< V >, "neither V::to() nor V::as() found" );
            }
            return {};
         }
         catch( ... ) {
            return std::current_exception();
         }
      }

      template< typename A, template< typename... > class Traits, typename C >
      [[nodiscard]] static bool later_to( const basic_value< Traits >& v, C& x ) noexcept
      {
         try {
            if constexpr( json::internal::has_to< A, basic_value< Traits >, C > ) {
               A::to( v, x );
            }
            else if constexpr( json::internal::has_as< A, basic_value< Traits > > ) {
               x = A::as( v );
            }
            else {
               static_assert( std::is_void_v< A >, "neither A::to() nor A::as() found" );
            }
            return true;
         }
         catch( ... ) {
            return false;
         }
      }

      template< template< typename... > class Traits, typename C >
      static void to( const basic_value< Traits >& v, C& x )
      {
         const std::exception_ptr e = first_to( v, x );
         const bool ok = ( ( e == std::exception_ptr() ) || ... || later_to< Vs >( v, x ) );
         throw_on_error< C >( ok, e );
      }

      template< template< typename... > class Traits, typename Producer, typename C >
      [[nodiscard]] static std::exception_ptr first_consume( Producer& parser, C& x )
      {
         try {
            auto m = parser.mark();
            V::template consume< Traits >( parser, x );
            (void)m( true );
            return {};
         }
         catch( ... ) {
            return std::current_exception();
         }
      }

      template< typename A, template< typename... > class Traits, typename Producer, typename C >
      [[nodiscard]] static bool later_consume( Producer& parser, C& x )
      {
         try {
            auto m = parser.mark();
            A::template consume< Traits >( parser, x );
            return m( true );
         }
         catch( ... ) {
            return false;
         }
      }

      template< template< typename... > class Traits, typename Producer, typename C >
      static void consume( Producer& parser, C& x )
      {
         const std::exception_ptr e = first_consume< Traits >( parser, x );
         const bool ok = ( ( e == std::exception_ptr() ) || ... || later_consume< Vs, Traits >( parser, x ) );
         throw_on_error< C >( ok, e );
      }
   };

}  // namespace tao::json::binding

#endif
