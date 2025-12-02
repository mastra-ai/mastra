// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_BINDING_INTERNAL_OBJECT_HPP
#define TAO_JSON_BINDING_INTERNAL_OBJECT_HPP

#include <bitset>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <utility>

#include <tao/pegtl/demangle.hpp>

#include "../for_nothing_value.hpp"
#include "../for_unknown_key.hpp"
#include "../member_kind.hpp"

#include "../../forward.hpp"

#include "../../basic_value.hpp"
#include "../../internal/escape.hpp"
#include "../../internal/format.hpp"
#include "../../internal/type_traits.hpp"

#if defined( _MSC_VER )
#pragma warning( push )
#pragma warning( disable : 4702 )
#endif

namespace tao::json::binding::internal
{
   template< typename... Ts >
   void list_all_keys( std::ostream& oss, const std::map< std::string, Ts... >& m )
   {
      for( const auto& p : m ) {
         json::internal::format_to( oss, ' ', p.first );
      }
   }

   template< std::size_t N, typename... Ts >
   void list_missing_keys( std::ostream& oss, const std::bitset< N >& t, const std::map< std::string, Ts... >& m )
   {
      for( const auto& p : m ) {
         if( !t.test( p.second.index ) ) {
            json::internal::format_to( oss, ' ', p.first );
         }
      }
   }

   template< typename... As, std::size_t... Is >
   auto make_bitset( std::index_sequence< Is... > /*unused*/ ) noexcept
   {
      std::bitset< sizeof...( As ) > r;
      ( r.set( Is, As::kind == member_kind::optional ), ... );
      return r;
   }

   template< typename F >
   struct wrap
   {
      F function;
      std::size_t index;
   };

   template< typename A, typename C, template< typename... > class Traits >
   void wrap_to( const basic_value< Traits >& v, C& x )
   {
      A::template to< Traits >( v, x );
   }

   template< template< typename... > class Traits, typename C, typename... As, std::size_t... Is >
   auto make_map_to( std::index_sequence< Is... > /*unused*/ )
   {
      using F = void ( * )( const basic_value< Traits >&, C& );
      return std::map< std::string, wrap< F > >{
         { As::template key< Traits >(), { &wrap_to< As, C, Traits >, Is } }...
      };
   }

   template< typename A, typename C, template< typename... > class Traits, typename Producer >
   void wrap_consume( Producer& p, C& x )
   {
      A::template consume< Traits, Producer >( p, x );
   }

   template< typename C, template< typename... > class Traits, typename Producer, typename... As, std::size_t... Is >
   auto make_map_consume( std::index_sequence< Is... > /*unused*/ )
   {
      using F = void ( * )( Producer&, C& );
      return std::map< std::string, wrap< F > >{
         { As::template key< Traits >(), { &wrap_consume< As, C, Traits, Producer >, Is } }...
      };
   }

   template< for_unknown_key E, for_nothing_value N, typename T >
   struct basic_object;

   template< for_unknown_key E, for_nothing_value N, typename... As >
   struct basic_object< E, N, json::internal::type_list< As... > >
   {
      using members = json::internal::type_list< As... >;

      template< template< typename... > class Traits, typename C >
      static void to( const basic_value< Traits >& v, C& x )
      {
         static const auto m = make_map_to< Traits, C, As... >( std::index_sequence_for< As... >() );
         static const auto o = make_bitset< As... >( std::index_sequence_for< As... >() );

         const auto& a = v.get_object();
         std::bitset< sizeof...( As ) > b;
         for( const auto& p : a ) {
            const auto& k = p.first;
            const auto i = m.find( k );
            if( i == m.end() ) {
               if constexpr( E == for_unknown_key::skip ) {
                  continue;
               }
               std::ostringstream oss;
               json::internal::format_to( oss, "unknown object key \"", json::internal::escape( k ), "\" -- known are" );
               list_all_keys( oss, m );
               json::internal::format_to( oss, " for type ", pegtl::demangle< C >(), json::message_extension( v ) );
               throw std::runtime_error( std::move( oss ).str() );
            }
            i->second.function( p.second, x );
            b.set( i->second.index );
         }
         b |= o;
         if( !b.all() ) {
            std::ostringstream oss;
            json::internal::format_to( oss, "missing required key(s)" );
            list_missing_keys( oss, b, m );
            json::internal::format_to( oss, " for type ", pegtl::demangle< C >(), json::message_extension( v ) );
            throw std::runtime_error( oss.str() );
         }
      }

#if defined( _MSC_VER )
#pragma warning( push )
#pragma warning( disable : 4127 )
#endif
      template< typename A, template< typename... > class Traits, typename C >
      static void assign_member( basic_value< Traits >& v, const C& x )
      {
         if( ( N == for_nothing_value::encode ) || ( !A::template is_nothing< Traits >( x ) ) ) {
            v.try_emplace( A::template key< Traits >(), A::read( x ) );
         }
      }
#if defined( _MSC_VER )
#pragma warning( pop )
#endif

      template< template< typename... > class Traits, typename C >
      static void assign( basic_value< Traits >& v, const C& x )
      {
         v.emplace_object();
         ( assign_member< As >( v, x ), ... );
      }

      template< template< typename... > class Traits = traits, typename Producer, typename C >
      static void consume( Producer& parser, C& x )
      {
         static const auto m = make_map_consume< C, Traits, Producer, As... >( std::index_sequence_for< As... >() );
         static const auto o = make_bitset< As... >( std::index_sequence_for< As... >() );

         auto s = parser.begin_object();
         std::bitset< sizeof...( As ) > b;
         while( parser.member_or_end_object( s ) ) {
            const auto k = parser.key();
            const auto i = m.find( k );
            if( i == m.end() ) {
               if constexpr( E == for_unknown_key::skip ) {
                  parser.skip_value();
                  continue;
               }
               std::ostringstream oss;
               json::internal::format_to( oss, "unknown object key \"", json::internal::escape( k ), "\" -- known are" );
               list_all_keys( oss, m );
               json::internal::format_to( oss, " for type ", pegtl::demangle< C >() );
               parser.throw_parse_error( std::move( oss ).str() );
            }
            if( b.test( i->second.index ) ) {
               parser.throw_parse_error( json::internal::format( "duplicate object key \"", json::internal::escape( k ), "\" for type ", pegtl::demangle< C >() ) );
            }
            i->second.function( parser, x );
            b.set( i->second.index );
         }
         b |= o;
         if( !b.all() ) {
            std::ostringstream oss;
            json::internal::format_to( oss, "missing required key(s)" );
            list_missing_keys( oss, b, m );
            json::internal::format_to( oss, " for type ", pegtl::demangle< C >() );
            parser.throw_parse_error( std::move( oss ).str() );
         }
      }

      template< template< typename... > class Traits, typename C >
      [[nodiscard]] static std::size_t produce_size( const C& x )
      {
         if constexpr( N == for_nothing_value::encode ) {
            return sizeof...( As );
         }
         return ( std::size_t( !As::template is_nothing< Traits >( x ) ) + ... );
      }

#if defined( _MSC_VER )
#pragma warning( push )
#pragma warning( disable : 4127 )
#endif

      template< typename A, template< typename... > class Traits, typename Consumer, typename C >
      static void produce_member( Consumer& consumer, const C& x )
      {
         if( ( N == for_nothing_value::encode ) || ( !A::template is_nothing< Traits >( x ) ) ) {
            A::template produce_key< Traits >( consumer );
            A::template produce< Traits >( consumer, x );
            consumer.member();
         }
      }

#if defined( _MSC_VER )
#pragma warning( pop )
#endif

      template< template< typename... > class Traits = traits, typename Consumer, typename C >
      static void produce( Consumer& consumer, const C& x )
      {
         const auto size = produce_size< Traits >( x );
         consumer.begin_object( size );
         ( produce_member< As, Traits >( consumer, x ), ... );
         consumer.end_object( size );
      }

      template< typename A, template< typename... > class Traits, typename C >
      [[nodiscard]] static bool equal_member( const std::map< std::string, basic_value< Traits >, std::less<> >& a, C& x )
      {
         if( !A::template is_nothing< Traits >( x ) ) {
            return a.at( A::template key< Traits >() ) == A::read( x );
         }
         if constexpr( N == for_nothing_value::encode ) {
            return a.at( A::template key< Traits >() ).is_null();
         }
         const auto i = a.find( A::template key< Traits >() );
         return ( i == a.end() ) || i->second.is_null();
      }

      template< template< typename... > class Traits, typename C >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, const C& rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         if( p.is_object() ) {
            const auto& a = p.get_object();
            if( p.get_object().size() == sizeof...( As ) ) {
               return ( equal_member< As >( a, rhs ) && ... );
            }
         }
         return false;
      }
   };

}  // namespace tao::json::binding::internal

#if defined( _MSC_VER )
#pragma warning( pop )
#endif

#endif
