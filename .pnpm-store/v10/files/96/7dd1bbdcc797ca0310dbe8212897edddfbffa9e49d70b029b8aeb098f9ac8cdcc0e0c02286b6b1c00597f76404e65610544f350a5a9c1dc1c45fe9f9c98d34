// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_VIRTUAL_BASE_HPP
#define TAO_JSON_EVENTS_VIRTUAL_BASE_HPP

#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

#include "../binary_view.hpp"

namespace tao::json::events
{
   // Events consumer interface with virtual functions.

   class virtual_base
   {
   public:
      void null()
      {
         v_null();
      }

      void boolean( const bool v )
      {
         v_boolean( v );
      }

      void number( const std::int64_t v )
      {
         v_number( v );
      }

      void number( const std::uint64_t v )
      {
         v_number( v );
      }

      void number( const double v )
      {
         v_number( v );
      }

      void string( const char* v )
      {
         v_string( v );
      }

      void string( std::string&& v )
      {
         v_string( std::move( v ) );
      }

      void string( const std::string& v )
      {
         v_string( v );
      }

      void string( const std::string_view v )
      {
         v_string( v );
      }

      void binary( std::vector< std::byte >&& v )
      {
         v_binary( std::move( v ) );
      }

      void binary( const std::vector< std::byte >& v )
      {
         v_binary( v );
      }

      void binary( const tao::binary_view v )
      {
         v_binary( v );
      }

      void begin_array()
      {
         v_begin_array();
      }

      void begin_array( const std::size_t v )
      {
         v_begin_array( v );
      }

      void element()
      {
         v_element();
      }

      void end_array()
      {
         v_end_array();
      }

      void end_array( const std::size_t v )
      {
         v_end_array( v );
      }

      void begin_object()
      {
         v_begin_object();
      }

      void begin_object( const std::size_t v )
      {
         v_begin_object( v );
      }

      void key( const char* v )
      {
         v_key( v );
      }

      void key( std::string&& v )
      {
         v_key( std::move( v ) );
      }

      void key( const std::string& v )
      {
         v_key( v );
      }

      void key( const std::string_view v )
      {
         v_key( v );
      }

      void member()
      {
         v_member();
      }

      void end_object()
      {
         v_end_object();
      }

      void end_object( const std::size_t v )
      {
         v_end_object( v );
      }

      virtual_base( virtual_base&& ) = delete;
      virtual_base( const virtual_base& ) = delete;

      void operator=( virtual_base&& ) = delete;
      void operator=( const virtual_base& ) = delete;

   protected:
      virtual_base() = default;
      ~virtual_base() = default;

      virtual void v_null() = 0;
      virtual void v_boolean( bool ) = 0;
      virtual void v_number( std::int64_t ) = 0;
      virtual void v_number( std::uint64_t ) = 0;
      virtual void v_number( double ) = 0;
      virtual void v_string( const char* ) = 0;
      virtual void v_string( std::string&& ) = 0;
      virtual void v_string( const std::string& ) = 0;
      virtual void v_string( std::string_view ) = 0;
      virtual void v_binary( std::vector< std::byte >&& ) = 0;
      virtual void v_binary( const std::vector< std::byte >& ) = 0;
      virtual void v_binary( tao::binary_view ) = 0;
      virtual void v_begin_array() = 0;
      virtual void v_begin_array( std::size_t ) = 0;
      virtual void v_element() = 0;
      virtual void v_end_array() = 0;
      virtual void v_end_array( std::size_t ) = 0;
      virtual void v_begin_object() = 0;
      virtual void v_begin_object( std::size_t ) = 0;
      virtual void v_key( const char* ) = 0;
      virtual void v_key( std::string&& ) = 0;
      virtual void v_key( const std::string& ) = 0;
      virtual void v_key( std::string_view ) = 0;
      virtual void v_member() = 0;
      virtual void v_end_object() = 0;
      virtual void v_end_object( std::size_t ) = 0;
   };

}  // namespace tao::json::events

#endif
