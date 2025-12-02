// Copyright (c) 2022-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_VIRTUAL_WRAP_HPP
#define TAO_JSON_EVENTS_VIRTUAL_WRAP_HPP

#include "virtual_base.hpp"

// #if defined( _MSC_VER )
// #pragma warning( push )
// #pragma warning( disable : 4373 )
// #endif

namespace tao::json::events
{
   template< typename Consumer >
   class virtual_wrap
      : public virtual_base
   {
   public:
      Consumer wrapped;

      template< typename... Ts >
      virtual_wrap( Ts&&... ts ) noexcept( noexcept( Consumer( std::forward< Ts >( ts )... ) ) )
         : wrapped( std::forward< Ts >( ts )... )
      {}

   protected:
      void v_null() override
      {
         wrapped.null();
      }

      void v_boolean( const bool v ) override
      {
         wrapped.boolean( v );
      }

      void v_number( const std::int64_t v ) override
      {
         wrapped.number( v );
      }

      void v_number( const std::uint64_t v ) override
      {
         wrapped.number( v );
      }

      void v_number( const double v ) override
      {
         wrapped.number( v );
      }

      void v_string( const char* v ) override
      {
         wrapped.string( v );
      }

      void v_string( std::string&& v ) override
      {
         wrapped.string( std::move( v ) );
      }

      void v_string( const std::string& v ) override
      {
         wrapped.string( v );
      }

      void v_string( const std::string_view v ) override
      {
         wrapped.string( v );
      }

      void v_binary( std::vector< std::byte >&& v ) override
      {
         wrapped.binary( std::move( v ) );
      }

      void v_binary( const std::vector< std::byte >& v ) override
      {
         wrapped.binary( v );
      }

      void v_binary( const tao::binary_view v ) override
      {
         wrapped.binary( v );
      }

      void v_begin_array() override
      {
         wrapped.begin_array();
      }

      void v_begin_array( const std::size_t v ) override
      {
         wrapped.begin_array( v );
      }

      void v_element() override
      {
         wrapped.element();
      }

      void v_end_array() override
      {
         wrapped.end_array();
      }

      void v_end_array( const std::size_t v ) override
      {
         wrapped.end_array( v );
      }

      void v_begin_object() override
      {
         wrapped.begin_object();
      }

      void v_begin_object( const std::size_t v ) override
      {
         wrapped.begin_object( v );
      }

      void v_key( const char* v ) override
      {
         wrapped.key( v );
      }

      void v_key( std::string&& v ) override
      {
         wrapped.key( std::move( v ) );
      }

      void v_key( const std::string& v ) override
      {
         wrapped.key( v );
      }

      void v_key( const std::string_view v ) override
      {
         wrapped.key( v );
      }

      void v_member() override
      {
         wrapped.member();
      }

      void v_end_object() override
      {
         wrapped.end_object();
      }

      void v_end_object( const std::size_t v ) override
      {
         wrapped.end_object( v );
      }
   };

}  // namespace tao::json::events

// #if defined( _MSC_VER )
// #pragma warning( pop )
// #endif

#endif
