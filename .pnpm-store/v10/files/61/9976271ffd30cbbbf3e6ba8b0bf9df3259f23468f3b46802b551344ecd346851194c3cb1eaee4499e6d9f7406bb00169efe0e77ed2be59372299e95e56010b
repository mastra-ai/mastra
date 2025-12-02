// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_BINDING_CONSTANT_HPP
#define TAO_JSON_BINDING_CONSTANT_HPP

#include <cstdint>
#include <string>

#include "../internal/escape.hpp"
#include "../internal/format.hpp"
#include "../internal/string_t.hpp"
#include "../message_extension.hpp"

#include "element.hpp"
#include "member_kind.hpp"

#include "internal/type_key.hpp"

namespace tao::json::binding
{
   template< bool V >
   struct element_b
   {
      using value_t = bool;

      template< typename C >
      [[nodiscard]] static bool read( const C& /*unused*/ )
      {
         return V;
      }

      template< template< typename... > class Traits, typename C >
      static void to( const basic_value< Traits >& v, C& /*unused*/ )
      {
         const auto t = v.template as< bool >();
         if( t != V ) {
            throw std::runtime_error( json::internal::format( "boolean mismatch, expected '", V, "' parsed '", t, '\'', json::message_extension( v ) ) );
         }
      }

      template< template< typename... > class Traits = traits, typename Consumer, typename C >
      static void produce( Consumer& consumer, const C& /*unused*/ )
      {
         consumer.boolean( V );
      }

      template< template< typename... > class Traits = traits, typename Producer, typename C >
      static void consume( Producer& parser, C& /*unused*/ )
      {
         const auto t = parser.boolean();
         if( t != V ) {
            parser.throw_parse_error( json::internal::format( "boolean mismatch, expected '", V, "' parsed '", t, '\'' ) );
         }
      }
   };

   template< std::int64_t V >
   struct element_i
   {
      using value_t = std::int64_t;

      template< typename C >
      [[nodiscard]] static std::int64_t read( const C& /*unused*/ )
      {
         return V;
      }

      template< template< typename... > class Traits, typename C >
      static void to( const basic_value< Traits >& v, C& /*unused*/ )
      {
         const auto t = v.template as< std::int64_t >();
         if( t != V ) {
            throw std::runtime_error( json::internal::format( "signed integer mismatch, expected '", V, "' parsed '", t, '\'', json::message_extension( v ) ) );
         }
      }

      template< template< typename... > class Traits = traits, typename Consumer, typename C >
      static void produce( Consumer& consumer, const C& /*unused*/ )
      {
         consumer.number( V );
      }

      template< template< typename... > class Traits = traits, typename Producer, typename C >
      static void consume( Producer& parser, C& /*unused*/ )
      {
         const auto t = parser.number_signed();
         if( t != V ) {
            parser.throw_parse_error( json::internal::format( "signed integer mismatch, expected '", V, "' parsed '", t, '\'' ) );
         }
      }
   };

   template< std::uint64_t V >
   struct element_u
   {
      using value_t = std::uint64_t;

      template< typename C >
      [[nodiscard]] static std::uint64_t read( const C& /*unused*/ )
      {
         return V;
      }

      template< template< typename... > class Traits, typename C >
      static void to( const basic_value< Traits >& v, C& /*unused*/ )
      {
         const auto t = v.template as< std::uint64_t >();
         if( t != V ) {
            throw std::runtime_error( json::internal::format( "unsigned integer mismatch, expected '", V, "' parsed '", t, '\'', json::message_extension( v ) ) );
         }
      }

      template< template< typename... > class Traits = traits, typename Consumer, typename C >
      static void produce( Consumer& consumer, const C& /*unused*/ )
      {
         consumer.number( V );
      }

      template< template< typename... > class Traits = traits, typename Producer, typename C >
      static void consume( Producer& parser, C& /*unused*/ )
      {
         const auto t = parser.number_unsigned();
         if( t != V ) {
            parser.throw_parse_error( json::internal::format( "unsigned integer mismatch, expected '", V, "' parsed '", t, '\'' ) );
         }
      }
   };

   template< typename S >
   struct element_s;

   template< char... Cs >
   struct element_s< json::internal::string_t< Cs... > >
   {
      using value_t = std::string;  // TODO: Or std::string_view? Something else? Nothing?

      using string = json::internal::string_t< Cs... >;

      template< typename C >
      [[nodiscard]] static std::string_view read( const C& /*unused*/ )
      {
         return string::as_string_view();
      }

      template< template< typename... > class Traits, typename C >
      static void to( const basic_value< Traits >& v, C& /*unused*/ )
      {
         const auto sc = string::as_string_view();
         const auto sv = v.template as< std::string_view >();
         if( sv != sc ) {
            throw std::runtime_error( json::internal::format( "string mismatch, expected \"", json::internal::escape( sc ), "\" parsed \"", json::internal::escape( sv ), '"', json::message_extension( v ) ) );
         }
      }

      template< template< typename... > class Traits = traits, typename Consumer, typename T >
      static void produce( Consumer& consumer, const T& /*unused*/ )
      {
         consumer.string( string::as_string_view() );
      }

      template< template< typename... > class Traits = traits, typename Producer, typename T >
      static void consume( Producer& parser, T& /*unused*/ )
      {
         const auto sc = string::as_string_view();
         const auto ss = parser.string();
         if( ss != sc ) {
            parser.throw_parse_error( json::internal::format( "string mismatch, expected \"", json::internal::escape( sc ), "\" parsed \"", json::internal::escape( ss ), '"' ) );
         }
      }
   };

   template< member_kind R, typename K, bool B >
   struct member_b
      : element_b< B >,
        internal::type_key< K, void >
   {
      static constexpr member_kind kind = R;

      template< template< typename... > class Traits, typename T >
      [[nodiscard]] static bool is_nothing( const T& /*unused*/ )
      {
         return false;
      }
   };

   template< member_kind R, typename K, std::int64_t V >
   struct member_i
      : element_i< V >,
        internal::type_key< K, void >
   {
      static constexpr member_kind kind = R;

      template< template< typename... > class Traits, typename T >
      [[nodiscard]] static bool is_nothing( const T& /*unused*/ )
      {
         return false;
      }
   };

   template< member_kind R, typename K, std::uint64_t V >
   struct member_u
      : element_u< V >,
        internal::type_key< K, void >
   {
      static constexpr member_kind kind = R;

      template< template< typename... > class Traits, typename T >
      [[nodiscard]] static bool is_nothing( const T& /*unused*/ )
      {
         return false;
      }
   };

   template< member_kind R, typename K, typename S >
   struct member_s
      : element_s< S >,
        internal::type_key< K, void >
   {
      static constexpr member_kind kind = R;

      template< template< typename... > class Traits, typename T >
      [[nodiscard]] static bool is_nothing( const T& /*unused*/ )
      {
         return false;
      }
   };

}  // namespace tao::json::binding

#endif
