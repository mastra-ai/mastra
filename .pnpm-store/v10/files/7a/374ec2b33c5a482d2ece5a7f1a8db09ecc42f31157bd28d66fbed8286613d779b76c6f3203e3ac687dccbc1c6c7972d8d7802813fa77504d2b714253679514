// Copyright (c) 2021-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_BINDING_INTERNAL_ELEMENTW_HPP
#define TAO_JSON_BINDING_INTERNAL_ELEMENTW_HPP

#include <type_traits>
#include <utility>

#include "../../consume.hpp"
#include "../../forward.hpp"

namespace tao::json::binding::internal
{
   template< typename T, T, typename = void >
   struct elementw;

#if defined( __GNUC__ ) || defined( __clang__ )

   template< bool N, typename C, typename T, void ( *P )( C&, T ) noexcept( N ) >
   struct elementw< void ( * )( C&, T ) noexcept( N ), P >
   {
      using write_class_t = C;
      using write_value_t = std::decay_t< T >;

      template< typename W >
      static void write( C& c, W&& w ) noexcept( N )
      {
         P( c, std::forward< W >( w ) );
      }

      template< template< typename... > class Traits >
      static void to( const basic_value< Traits >& v, C& c )
      {
         P( c, v.template as< std::decay_t< T > >() );
      }

      template< template< typename... > class Traits = traits, typename Producer >
      static void consume( Producer& parser, C& c )
      {
         P( c, json::consume< Traits >( parser ) );
      }
   };

   template< bool N, typename C, typename T, T& ( *P )( C& ) noexcept( N ) >
   struct elementw< T& (*)( C& ) noexcept( N ), P >
   {
      using write_class_t = C;
      using write_value_t = std::decay_t< T >;

      template< typename W >
      static void write( C& c, W&& w ) noexcept( N )
      {
         P( c ) = std::forward< W >( w );
      }

      template< template< typename... > class Traits >
      static void to( const basic_value< Traits >& v, C& c )
      {
         v.to( P( c ) );
      }

      template< template< typename... > class Traits = traits, typename Producer >
      static void consume( Producer& parser, C& v )
      {
         json::consume< Traits >( parser, P( v ) );
      }
   };

   template< bool N, typename C, typename T, void ( C::*P )( T ) noexcept( N ) >
   struct elementw< void ( C::* )( T ) noexcept( N ), P >
   {
      using write_class_t = C;
      using write_value_t = std::decay_t< T >;

      template< typename W >
      static void write( C& c, W&& w ) noexcept( N )
      {
         ( c.*P )( std::forward< W >( w ) );
      }

      template< template< typename... > class Traits >
      static void to( const basic_value< Traits >( v ), C& c )
      {
         ( c.*P )( v.template as< std::decay_t< T > >() );
      }

      template< template< typename... > class Traits = traits, typename Producer >
      static void consume( Producer& parser, C& c )
      {
         ( c.*P )( json::consume< Traits >( parser ) );
      }
   };

#else

   template< typename C, typename T, void ( *P )( C&, T ) noexcept( true ) >
   struct elementw< void ( * )( C&, T ) noexcept( true ), P >
   {
      using write_class_t = C;
      using write_value_t = std::decay_t< T >;

      template< typename W >
      static void write( C& c, W&& w ) noexcept( true )
      {
         P( c, std::forward< W >( w ) );
      }

      template< template< typename... > class Traits >
      static void to( const basic_value< Traits >& v, C& c )
      {
         P( c, v.template as< std::decay_t< T > >() );
      }

      template< template< typename... > class Traits = traits, typename Producer >
      static void consume( Producer& parser, C& c )
      {
         P( c, json::consume< Traits >( parser ) );
      }
   };

   template< typename C, typename T, void ( *P )( C&, T ) noexcept( false ) >
   struct elementw< void ( * )( C&, T ) noexcept( false ), P >
   {
      using write_class_t = C;
      using write_value_t = std::decay_t< T >;

      template< typename W >
      static void write( C& c, W&& w ) noexcept( false )
      {
         P( c, std::forward< W >( w ) );
      }

      template< template< typename... > class Traits >
      static void to( const basic_value< Traits >& v, C& c )
      {
         P( c, v.template as< std::decay_t< T > >() );
      }

      template< template< typename... > class Traits = traits, typename Producer >
      static void consume( Producer& parser, C& c )
      {
         P( c, json::consume< Traits >( parser ) );
      }
   };

   template< typename C, typename T, T& ( *P )( C& ) noexcept( true ) >
   struct elementw< T& (*)( C& ) noexcept( true ), P >
   {
      using write_class_t = C;
      using write_value_t = std::decay_t< T >;

      template< typename W >
      static void write( C& c, W&& w ) noexcept( true )
      {
         P( c ) = std::forward< W >( w );
      }

      template< template< typename... > class Traits >
      static void to( const basic_value< Traits >& v, C& c )
      {
         v.to( P( c ) );
      }

      template< template< typename... > class Traits = traits, typename Producer >
      static void consume( Producer& parser, C& v )
      {
         json::consume< Traits >( parser, P( v ) );
      }
   };

   template< typename C, typename T, T& ( *P )( C& ) noexcept( false ) >
   struct elementw< T& (*)( C& ) noexcept( false ), P >
   {
      using write_class_t = C;
      using write_value_t = std::decay_t< T >;

      template< typename W >
      static void write( C& c, W&& w ) noexcept( false )
      {
         P( c ) = std::forward< W >( w );
      }

      template< template< typename... > class Traits >
      static void to( const basic_value< Traits >& v, C& c )
      {
         v.to( P( c ) );
      }

      template< template< typename... > class Traits = traits, typename Producer >
      static void consume( Producer& parser, C& v )
      {
         json::consume< Traits >( parser, P( v ) );
      }
   };

   template< typename C, typename T, void ( C::*P )( T ) noexcept( true ) >
   struct elementw< void ( C::* )( T ) noexcept( true ), P >
   {
      using write_class_t = C;
      using write_value_t = std::decay_t< T >;

      template< typename W >
      static void write( C& c, W&& w ) noexcept( true )
      {
         ( c.*P )( std::forward< W >( w ) );
      }

      template< template< typename... > class Traits >
      static void to( const basic_value< Traits >( v ), C& c )
      {
         ( c.*P )( v.template as< std::decay_t< T > >() );
      }

      template< template< typename... > class Traits = traits, typename Producer >
      static void consume( Producer& parser, C& c )
      {
         ( c.*P )( json::consume< Traits >( parser ) );
      }
   };

   template< typename C, typename T, void ( C::*P )( T ) noexcept( false ) >
   struct elementw< void ( C::* )( T ) noexcept( false ), P >
   {
      using write_class_t = C;
      using write_value_t = std::decay_t< T >;

      template< typename W >
      static void write( C& c, W&& w ) noexcept( false )
      {
         ( c.*P )( std::forward< W >( w ) );
      }

      template< template< typename... > class Traits >
      static void to( const basic_value< Traits >( v ), C& c )
      {
         ( c.*P )( v.template as< std::decay_t< T > >() );
      }

      template< template< typename... > class Traits = traits, typename Producer >
      static void consume( Producer& parser, C& c )
      {
         ( c.*P )( json::consume< Traits >( parser ) );
      }
   };

#endif

}  // namespace tao::json::binding::internal

#endif
