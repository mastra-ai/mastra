// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_VIRTUAL_REF_HPP
#define TAO_JSON_EVENTS_VIRTUAL_REF_HPP

#include <cstddef>
#include <utility>

#include "virtual_base.hpp"

#if defined( _MSC_VER )
#pragma warning( push )
#pragma warning( disable : 4373 )
#endif

namespace tao::json::events
{
   template< typename Consumer >
   class virtual_ref
      : public virtual_base
   {
   public:
      explicit virtual_ref( Consumer& r ) noexcept
         : m_r( r )
      {}

      virtual_ref( const virtual_ref& ) = delete;
      virtual_ref( virtual_ref&& ) = delete;

      virtual ~virtual_ref() = default;

      virtual_ref& operator=( const virtual_ref& ) = delete;
      virtual_ref& operator=( virtual_ref&& ) = delete;

   private:
      Consumer& m_r;

      void v_null() override
      {
         m_r.null();
      }

      void v_boolean( const bool v ) override
      {
         m_r.boolean( v );
      }

      void v_number( const std::int64_t v ) override
      {
         m_r.number( v );
      }

      void v_number( const std::uint64_t v ) override
      {
         m_r.number( v );
      }

      void v_number( const double v ) override
      {
         m_r.number( v );
      }

      void v_string( const char* v ) override
      {
         m_r.string( v );
      }

      void v_string( std::string&& v ) override
      {
         m_r.string( std::move( v ) );
      }

      void v_string( const std::string& v ) override
      {
         m_r.string( v );
      }

      void v_string( const std::string_view v ) override
      {
         m_r.string( v );
      }

      void v_binary( std::vector< std::byte >&& v ) override
      {
         m_r.binary( std::move( v ) );
      }

      void v_binary( const std::vector< std::byte >& v ) override
      {
         m_r.binary( v );
      }

      void v_binary( const tao::binary_view v ) override
      {
         m_r.binary( v );
      }

      void v_begin_array() override
      {
         m_r.begin_array();
      }

      void v_begin_array( const std::size_t v ) override
      {
         m_r.begin_array( v );
      }

      void v_element() override
      {
         m_r.element();
      }

      void v_end_array() override
      {
         m_r.end_array();
      }

      void v_end_array( const std::size_t v ) override
      {
         m_r.end_array( v );
      }

      void v_begin_object() override
      {
         m_r.begin_object();
      }

      void v_begin_object( const std::size_t v ) override
      {
         m_r.begin_object( v );
      }

      void v_key( const char* v ) override
      {
         m_r.key( v );
      }

      void v_key( std::string&& v ) override
      {
         m_r.key( std::move( v ) );
      }

      void v_key( const std::string& v ) override
      {
         m_r.key( v );
      }

      void v_key( const std::string_view v ) override
      {
         m_r.key( v );
      }

      void v_member() override
      {
         m_r.member();
      }

      void v_end_object() override
      {
         m_r.end_object();
      }

      void v_end_object( const std::size_t v ) override
      {
         m_r.end_object( v );
      }
   };

   template< typename Consumer >
   virtual_ref( Consumer& ) -> virtual_ref< Consumer >;

}  // namespace tao::json::events

#if defined( _MSC_VER )
#pragma warning( pop )
#endif

#endif
