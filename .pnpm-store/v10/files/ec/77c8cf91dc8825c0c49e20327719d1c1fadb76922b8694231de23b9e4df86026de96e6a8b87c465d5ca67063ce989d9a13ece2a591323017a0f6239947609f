// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_REF_HPP
#define TAO_JSON_EVENTS_REF_HPP

#include <cstddef>
#include <utility>

namespace tao::json::events
{
   template< typename Consumer >
   class ref
   {
   private:
      Consumer& r_;

   public:
      explicit ref( Consumer& r ) noexcept
         : r_( r )
      {}

      void null() noexcept( noexcept( r_.null() ) )
      {
         r_.null();
      }

      template< typename T >
      void boolean( T&& v ) noexcept( noexcept( r_.boolean( std::forward< T >( v ) ) ) )
      {
         r_.boolean( std::forward< T >( v ) );
      }

      template< typename T >
      void number( T&& v ) noexcept( noexcept( r_.number( std::forward< T >( v ) ) ) )
      {
         r_.number( std::forward< T >( v ) );
      }

      template< typename T >
      void string( T&& v ) noexcept( noexcept( r_.string( std::forward< T >( v ) ) ) )
      {
         r_.string( std::forward< T >( v ) );
      }

      template< typename T >
      void binary( T&& v ) noexcept( noexcept( r_.binary( std::forward< T >( v ) ) ) )
      {
         r_.binary( std::forward< T >( v ) );
      }

      void begin_array() noexcept( noexcept( r_.begin_array() ) )
      {
         r_.begin_array();
      }

      void begin_array( const std::size_t size ) noexcept( noexcept( r_.begin_array( size ) ) )
      {
         r_.begin_array( size );
      }

      void element() noexcept( noexcept( r_.element() ) )
      {
         r_.element();
      }

      void end_array() noexcept( noexcept( r_.end_array() ) )
      {
         r_.end_array();
      }

      void end_array( const std::size_t size ) noexcept( noexcept( r_.end_array( size ) ) )
      {
         r_.end_array( size );
      }

      void begin_object() noexcept( noexcept( r_.begin_object() ) )
      {
         r_.begin_object();
      }

      void begin_object( const std::size_t size ) noexcept( noexcept( r_.begin_object( size ) ) )
      {
         r_.begin_object( size );
      }

      template< typename T >
      void key( T&& v ) noexcept( noexcept( r_.key( std::forward< T >( v ) ) ) )
      {
         r_.key( std::forward< T >( v ) );
      }

      void member() noexcept( noexcept( r_.member() ) )
      {
         r_.member();
      }

      void end_object() noexcept( noexcept( r_.end_object() ) )
      {
         r_.end_object();
      }

      void end_object( const std::size_t size ) noexcept( noexcept( r_.end_object( size ) ) )
      {
         r_.end_object( size );
      }
   };

   template< typename Consumer >
   ref( Consumer& ) -> ref< Consumer >;

}  // namespace tao::json::events

#endif
