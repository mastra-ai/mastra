// Copyright (c) 2016-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_FROM_VALUE_HPP
#define TAO_JSON_EVENTS_FROM_VALUE_HPP

#include <stdexcept>

#include "../basic_value.hpp"
#include "../internal/format.hpp"

#include "virtualize.hpp"

namespace tao::json::events
{
   // Events producer to generate events from a JSON Value.

   template< auto Recurse, typename Consumer, template< typename... > class Traits >
   void from_value( Consumer& consumer, const basic_value< Traits >& v )
   {
      switch( v.type() ) {
         case type::UNINITIALIZED:
            throw std::logic_error( "unable to produce events from uninitialized values" );

         case type::NULL_:
            consumer.null();
            return;

         case type::BOOLEAN:
            consumer.boolean( v.get_boolean() );
            return;

         case type::SIGNED:
            consumer.number( v.get_signed() );
            return;

         case type::UNSIGNED:
            consumer.number( v.get_unsigned() );
            return;

         case type::DOUBLE:
            consumer.number( v.get_double() );
            return;

         case type::STRING:
            consumer.string( v.get_string() );
            return;

         case type::STRING_VIEW:
            consumer.string( v.get_string_view() );
            return;

         case type::BINARY:
            consumer.binary( v.get_binary() );
            return;

         case type::BINARY_VIEW:
            consumer.binary( v.get_binary_view() );
            return;

         case type::ARRAY: {
            const auto& a = v.get_array();
            const auto s = a.size();
            consumer.begin_array( s );
            for( const auto& e : a ) {
               Recurse( consumer, e );
               consumer.element();
            }
            consumer.end_array( s );
            return;
         }

         case type::OBJECT: {
            const auto& o = v.get_object();
            const auto s = o.size();
            consumer.begin_object( s );
            for( const auto& e : o ) {
               consumer.key( e.first );
               Recurse( consumer, e.second );
               consumer.member();
            }
            consumer.end_object( s );
            return;
         }

         case type::VALUE_PTR:
            Recurse( consumer, *v.get_value_ptr() );
            return;

         case type::OPAQUE_PTR: {
            const auto& q = v.get_opaque_ptr();
            decltype( auto ) ref = events::virtualize( consumer );
            q.producer( ref, q.data );
            return;
         }

         case type::VALUELESS_BY_EXCEPTION:
            throw std::logic_error( "unable to produce events from valueless-by-exception value" );
      }
      throw std::logic_error( internal::format( "invalid value '", static_cast< std::uint8_t >( v.type() ), "' for tao::json::type" ) );  // LCOV_EXCL_LINE, NOLINT(google-readability-casting)
   }

   template< typename Consumer, template< typename... > class Traits >
   void from_value( Consumer& consumer, const basic_value< Traits >& v )
   {
      from_value< static_cast< void ( * )( Consumer&, const basic_value< Traits >& ) >( &from_value< Consumer, Traits > ), Consumer, Traits >( consumer, v );
   }

   // Events producer to generate events from an rvalue JSON value.
   // Note: Strings from the source might be moved to the consumer.

   template< auto Recurse, typename Consumer, template< typename... > class Traits >
   void from_value( Consumer& consumer, basic_value< Traits >&& v )
   {
      switch( v.type() ) {
         case type::UNINITIALIZED:
            throw std::logic_error( "unable to produce events from uninitialized values" );

         case type::NULL_:
            consumer.null();
            return;

         case type::BOOLEAN:
            consumer.boolean( v.get_boolean() );
            return;

         case type::SIGNED:
            consumer.number( v.get_signed() );
            return;

         case type::UNSIGNED:
            consumer.number( v.get_unsigned() );
            return;

         case type::DOUBLE:
            consumer.number( v.get_double() );
            return;

         case type::STRING:
            consumer.string( std::move( v.get_string() ) );
            return;

         case type::STRING_VIEW:
            consumer.string( v.get_string_view() );
            return;

         case type::BINARY:
            consumer.binary( std::move( v.get_binary() ) );
            return;

         case type::BINARY_VIEW:
            consumer.binary( v.get_binary_view() );
            return;

         case type::ARRAY: {
            const auto& a = v.get_array();
            const auto s = a.size();
            consumer.begin_array( s );
            for( auto&& e : a ) {
               Recurse( consumer, std::move( e ) );
               consumer.element();
            }
            consumer.end_array( s );
            return;
         }

         case type::OBJECT: {
            const auto& o = v.get_object();
            const auto s = o.size();
            consumer.begin_object( s );
            for( auto&& e : o ) {
               consumer.key( e.first );
               Recurse( consumer, std::move( e.second ) );
               consumer.member();
            }
            consumer.end_object( s );
            return;
         }

         case type::VALUE_PTR:
            Recurse( consumer, *v.get_value_ptr() );
            return;

         case type::OPAQUE_PTR: {
            const auto& q = v.get_opaque_ptr();
            decltype( auto ) ref = events::virtualize( consumer );
            q.producer( ref, q.data );
            return;
         }

         case type::VALUELESS_BY_EXCEPTION:
            throw std::logic_error( "unable to produce events from valueless-by-exception value" );
      }
      throw std::logic_error( internal::format( "invalid value '", static_cast< std::uint8_t >( v.type() ), "' for tao::json::type" ) );  // LCOV_EXCL_LINE, NOLINT(google-readability-casting)
   }

   template< typename Consumer, template< typename... > class Traits >
   void from_value( Consumer& consumer, basic_value< Traits >&& v )
   {
      from_value< static_cast< void ( * )( Consumer&, basic_value< Traits >&& ) >( &from_value< Consumer, Traits > ), Consumer, Traits >( consumer, std::move( v ) );
   }

}  // namespace tao::json::events

#endif
