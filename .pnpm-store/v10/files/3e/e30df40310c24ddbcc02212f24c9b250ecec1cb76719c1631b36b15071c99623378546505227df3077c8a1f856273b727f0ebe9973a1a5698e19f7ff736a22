// Copyright (c) 2016-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_TRAITS_HPP
#define TAO_JSON_TRAITS_HPP

#include <cstddef>
#include <cstdint>
#include <cstdlib>

#include <algorithm>
#include <map>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "binary_view.hpp"
#include "consume.hpp"
#include "forward.hpp"
#include "type.hpp"

#include "events/from_value.hpp"
#include "events/produce.hpp"

#include "internal/format.hpp"
#include "internal/identity.hpp"
#include "internal/number_traits.hpp"
#include "internal/string_t.hpp"
#include "internal/type_traits.hpp"

#define TAO_JSON_DEFAULT_KEY( x )                   \
   template< template< typename... > class Traits > \
   using default_key = TAO_JSON_STRING_T( x )

#if defined( _MSC_VER )
#pragma warning( push )
#pragma warning( disable : 4702 )
#endif

namespace tao::json
{
   namespace internal
   {
      struct empty_base
      {};

   }  // namespace internal

   // Traits< void > is special and configures the basic_value class template
   template<>
   struct traits< void >
   {
      static constexpr bool enable_implicit_constructor = true;

      template< typename >
      using public_base = internal::empty_base;
   };

   template<>
   struct traits< uninitialized_t >
   {
      static constexpr bool enable_implicit_constructor = true;

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& /*unused*/, uninitialized_t /*unused*/ ) noexcept
      {}

      template< template< typename... > class Traits >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, uninitialized_t /*unused*/ ) noexcept
      {
         return lhs.skip_value_ptr().is_uninitialized();
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool less_than( const basic_value< Traits >& /*unused*/, uninitialized_t /*unused*/ ) noexcept
      {
         return false;  // Because std::underlying_type_t< tao::json::type > is unsigned and type::uninitialized is 0.
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool greater_than( const basic_value< Traits >& lhs, uninitialized_t /*unused*/ ) noexcept
      {
         return lhs.skip_value_ptr().type() > type::UNINITIALIZED;
      }
   };

   template<>
   struct traits< null_t >
   {
      static constexpr bool enable_implicit_constructor = true;

      template< template< typename... > class Traits >
      [[nodiscard]] static null_t as( const basic_value< Traits >& v )
      {
         return v.get_null();
      }

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, null_t /*unused*/ ) noexcept
      {
         v.set_null();
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const null_t /*unused*/ )
      {
         c.null();
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, null_t /*unused*/ ) noexcept
      {
         return lhs.skip_value_ptr().is_null();
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool less_than( const basic_value< Traits >& lhs, null_t /*unused*/ ) noexcept
      {
         return lhs.skip_value_ptr().type() < type::NULL_;
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool greater_than( const basic_value< Traits >& lhs, null_t /*unused*/ ) noexcept
      {
         return lhs.skip_value_ptr().type() > type::NULL_;
      }
   };

   template<>
   struct traits< bool >
   {
      template< template< typename... > class Traits >
      [[nodiscard]] static bool as( const basic_value< Traits >& v )
      {
         return v.get_boolean();
      }

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, const bool b ) noexcept
      {
         v.set_boolean( b );
      }

      template< template< typename... > class, typename Producer >
      [[nodiscard]] static bool consume( Producer& parser )
      {
         return parser.boolean();
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const bool b )
      {
         c.boolean( b );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, const bool rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         return p.is_boolean() && ( p.get_boolean() == rhs );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool less_than( const basic_value< Traits >& lhs, const bool rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         return ( p.type() < type::BOOLEAN ) || ( p.is_boolean() && ( p.get_boolean() < rhs ) );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool greater_than( const basic_value< Traits >& lhs, const bool rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         return ( p.type() > type::BOOLEAN ) || ( p.is_boolean() && ( p.get_boolean() > rhs ) );
      }
   };

   // clang-format off
   template<> struct traits< signed char > : internal::signed_trait< signed char > {};
   template<> struct traits< signed short > : internal::signed_trait< signed short > {};
   template<> struct traits< signed int > : internal::signed_trait< signed int > {};
   template<> struct traits< signed long > : internal::signed_trait< signed long > {};
   template<> struct traits< signed long long > : internal::signed_trait< signed long long > {};

   template<> struct traits< unsigned char > : internal::unsigned_trait< unsigned char > {};
   template<> struct traits< unsigned short > : internal::unsigned_trait< unsigned short > {};
   template<> struct traits< unsigned int > : internal::unsigned_trait< unsigned int > {};
   template<> struct traits< unsigned long > : internal::unsigned_trait< unsigned long > {};
   template<> struct traits< unsigned long long > : internal::unsigned_trait< unsigned long long > {};

   template<> struct traits< float > : internal::float_trait< float > {};
   template<> struct traits< double > : internal::float_trait< double > {};
   // clang-format on

   template<>
   struct traits< empty_string_t >
   {
      static constexpr bool enable_implicit_constructor = true;

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, empty_string_t /*unused*/ ) noexcept
      {
         v.emplace_string();
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, empty_string_t /*unused*/ ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::STRING:
               return p.get_string().empty();
            case type::STRING_VIEW:
               return p.get_string_view().empty();
            default:
               return false;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool less_than( const basic_value< Traits >& lhs, empty_string_t /*unused*/ ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::STRING:
            case type::STRING_VIEW:
               return false;
            default:
               return p.type() < type::STRING;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool greater_than( const basic_value< Traits >& lhs, empty_string_t /*unused*/ ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::STRING:
               return !p.get_string().empty();
            case type::STRING_VIEW:
               return !p.get_string_view().empty();
            default:
               return p.type() > type::STRING;
         }
      }
   };

   template<>
   struct traits< empty_binary_t >
   {
      static constexpr bool enable_implicit_constructor = true;

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, empty_binary_t /*unused*/ ) noexcept
      {
         v.emplace_binary();
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, empty_binary_t /*unused*/ ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::BINARY:
               return p.get_binary().empty();
            case type::BINARY_VIEW:
               return p.get_binary_view().empty();
            default:
               return false;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool less_than( const basic_value< Traits >& lhs, empty_binary_t /*unused*/ ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::BINARY:
            case type::BINARY_VIEW:
               return false;
            default:
               return p.type() < type::BINARY;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool greater_than( const basic_value< Traits >& lhs, empty_binary_t /*unused*/ ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::BINARY:
               return !p.get_binary().empty();
            case type::BINARY_VIEW:
               return !p.get_binary_view().empty();
            default:
               return p.type() > type::BINARY;
         }
      }
   };

   template<>
   struct traits< empty_array_t >
   {
      static constexpr bool enable_implicit_constructor = true;

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, empty_array_t /*unused*/ ) noexcept
      {
         v.emplace_array();
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, empty_array_t /*unused*/ ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         return p.is_array() && p.get_array().empty();
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool less_than( const basic_value< Traits >& lhs, empty_array_t /*unused*/ ) noexcept
      {
         return lhs.skip_value_ptr().type() < type::ARRAY;
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool greater_than( const basic_value< Traits >& lhs, empty_array_t /*unused*/ ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         return ( p.type() > type::ARRAY ) || ( p.is_array() && !p.get_array().empty() );
      }
   };

   template<>
   struct traits< empty_object_t >
   {
      static constexpr bool enable_implicit_constructor = true;

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, empty_object_t /*unused*/ ) noexcept
      {
         v.emplace_object();
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, empty_object_t /*unused*/ ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         return p.is_object() && p.get_object().empty();
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool less_than( const basic_value< Traits >& lhs, empty_object_t /*unused*/ ) noexcept
      {
         return lhs.skip_value_ptr().type() < type::OBJECT;
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool greater_than( const basic_value< Traits >& lhs, empty_object_t /*unused*/ ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         return ( p.type() > type::OBJECT ) || ( p.is_object() && !p.get_object().empty() );
      }
   };

   template<>
   struct traits< std::string >
   {
      template< template< typename... > class Traits >
      [[nodiscard]] static std::string as( const basic_value< Traits >& v )
      {
         switch( v.type() ) {
            case type::STRING:
               return v.get_string();
            case type::STRING_VIEW:
               return std::string( v.get_string_view() );
            default:
               throw std::logic_error( internal::format( "invalid json type '", v.type(), "' for conversion to std::string", json::message_extension( v ) ) );
         }
      }

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, const std::string& s )
      {
         v.set_string( s );
      }

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, std::string&& s ) noexcept
      {
         v.set_string( std::move( s ) );
      }

      template< template< typename... > class, typename Producer >
      [[nodiscard]] static std::string consume( Producer& parser )
      {
         return parser.string();
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const std::string& s )
      {
         c.string( s );
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, std::string&& s )
      {
         c.string( std::move( s ) );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, const std::string& rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::STRING:
               return p.get_string() == rhs;
            case type::STRING_VIEW:
               return p.get_string_view() == rhs;
            default:
               return false;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool less_than( const basic_value< Traits >& lhs, const std::string& rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::STRING:
               return p.get_string() < rhs;
            case type::STRING_VIEW:
               return p.get_string_view() < rhs;
            default:
               return p.type() < type::STRING;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool greater_than( const basic_value< Traits >& lhs, const std::string& rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::STRING:
               return p.get_string() > rhs;
            case type::STRING_VIEW:
               return p.get_string_view() > rhs;
            default:
               return p.type() > type::STRING;
         }
      }
   };

   template<>
   struct traits< std::string_view >
   {
      template< template< typename... > class Traits >
      [[nodiscard]] static std::string_view as( const basic_value< Traits >& v )
      {
         switch( v.type() ) {
            case type::STRING:
               return v.get_string();
            case type::STRING_VIEW:
               return v.get_string_view();
            default:
               throw std::logic_error( internal::format( "invalid json type '", v.type(), "' for conversion to std::string_view", json::message_extension( v ) ) );
         }
      }

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, const std::string_view sv )
      {
         v.emplace_string( sv );
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const std::string_view sv )
      {
         c.string( sv );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, const std::string_view rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::STRING:
               return p.get_string() == rhs;
            case type::STRING_VIEW:
               return p.get_string_view() == rhs;
            default:
               return false;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool less_than( const basic_value< Traits >& lhs, const std::string_view rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::STRING:
               return p.get_string() < rhs;
            case type::STRING_VIEW:
               return p.get_string_view() < rhs;
            default:
               return p.type() < type::STRING;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool greater_than( const basic_value< Traits >& lhs, const std::string_view rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::STRING:
               return p.get_string() > rhs;
            case type::STRING_VIEW:
               return p.get_string_view() > rhs;
            default:
               return p.type() > type::STRING;
         }
      }
   };

   template<>
   struct traits< const char* >
   {
      template< template< typename... > class Traits >
      [[nodiscard]] static const char* as( const basic_value< Traits >& v )
      {
         return v.get_string().c_str();  // String views might not be '\0'-terminated.
      }

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, const char* s )
      {
         v.emplace_string( s );
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const char* s )
      {
         c.string( s );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, const char* rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::STRING:
               return p.get_string() == rhs;
            case type::STRING_VIEW:
               return p.get_string_view() == rhs;
            default:
               return false;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool less_than( const basic_value< Traits >& lhs, const char* rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::STRING:
               return p.get_string() < rhs;
            case type::STRING_VIEW:
               return p.get_string_view() < rhs;
            default:
               return p.type() < type::STRING;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool greater_than( const basic_value< Traits >& lhs, const char* rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::STRING:
               return p.get_string() > rhs;
            case type::STRING_VIEW:
               return p.get_string_view() > rhs;
            default:
               return p.type() > type::STRING;
         }
      }
   };

   template<>
   struct traits< const std::string& >
   {
      template< template< typename... > class Traits >
      [[nodiscard]] static const std::string& as( const basic_value< Traits >& v )
      {
         return v.get_string();
      }
   };

   template<>
   struct traits< std::vector< std::byte > >
   {
      template< template< typename... > class Traits >
      [[nodiscard]] static std::vector< std::byte > as( const basic_value< Traits >& v )
      {
         switch( v.type() ) {
            case type::BINARY:
               return v.get_binary();
            case type::BINARY_VIEW: {
               const auto xv = v.get_binary_view();
               return std::vector< std::byte >( xv.begin(), xv.end() );
            }
            default:
               throw std::logic_error( internal::format( "invalid json type '", v.type(), "' for conversion to std::vector< std::byte >", json::message_extension( v ) ) );
         }
      }

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, const std::vector< std::byte >& x )
      {
         v.set_binary( x );
      }

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, std::vector< std::byte >&& x ) noexcept
      {
         v.set_binary( std::move( x ) );
      }

      template< template< typename... > class, typename Producer >
      [[nodiscard]] static std::vector< std::byte > consume( Producer& parser )
      {
         return parser.binary();
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const std::vector< std::byte >& x )
      {
         c.binary( x );
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, std::vector< std::byte >&& x )
      {
         c.binary( std::move( x ) );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, const std::vector< std::byte >& rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::BINARY:
               return p.get_binary() == rhs;
            case type::BINARY_VIEW:
               return tao::internal::binary_equal( p.get_binary_view(), rhs );
            default:
               return false;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool less_than( const basic_value< Traits >& lhs, const std::vector< std::byte >& rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::BINARY:
               return p.get_binary() < rhs;
            case type::BINARY_VIEW:
               return tao::internal::binary_less( p.get_binary_view(), rhs );
            default:
               return p.type() < type::BINARY;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool greater_than( const basic_value< Traits >& lhs, const std::vector< std::byte >& rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::BINARY:
               return p.get_binary() > rhs;
            case type::BINARY_VIEW:
               return tao::internal::binary_less( rhs, p.get_binary_view() );
            default:
               return p.type() > type::BINARY;
         }
      }
   };

   template<>
   struct traits< tao::binary_view >
   {
      template< template< typename... > class Traits >
      [[nodiscard]] static tao::binary_view as( const basic_value< Traits >& v )
      {
         switch( v.type() ) {
            case type::BINARY:
               return v.get_binary();
            case type::BINARY_VIEW:
               return v.get_binary_view();
            default:
               throw std::logic_error( internal::format( "invalid json type '", v.type(), "' for conversion to tao::binary_view", json::message_extension( v ) ) );
         }
      }

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, const tao::binary_view xv )
      {
         v.emplace_binary( xv.begin(), xv.end() );
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const tao::binary_view xv )
      {
         c.binary( xv );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, const tao::binary_view rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::BINARY:
               return tao::internal::binary_equal( p.get_binary(), rhs );
            case type::BINARY_VIEW:
               return tao::internal::binary_equal( p.get_binary_view(), rhs );
            default:
               return false;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool less_than( const basic_value< Traits >& lhs, const tao::binary_view rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::BINARY:
               return tao::internal::binary_less( p.get_binary(), rhs );
            case type::BINARY_VIEW:
               return tao::internal::binary_less( p.get_binary_view(), rhs );
            default:
               return p.type() < type::BINARY;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool greater_than( const basic_value< Traits >& lhs, const tao::binary_view rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::BINARY:
               return tao::internal::binary_less( rhs, p.get_binary() );
            case type::BINARY_VIEW:
               return tao::internal::binary_less( rhs, p.get_binary_view() );
            default:
               return p.type() > type::BINARY;
         }
      }
   };

   template<>
   struct traits< const std::vector< std::byte >& >
   {
      template< template< typename... > class Traits >
      [[nodiscard]] static const std::vector< std::byte >& as( const basic_value< Traits >& v )
      {
         return v.get_binary();
      }
   };

   template< template< typename... > class Traits >
   struct traits< basic_value< Traits > >
   {
      template< template< typename... > class, typename Consumer >
      static void produce( Consumer& c, const basic_value< Traits >& v )
      {
         events::from_value( c, v );
      }

      template< template< typename... > class, typename Consumer >
      static void produce( Consumer& c, basic_value< Traits >&& v )
      {
         events::from_value( c, std::move( v ) );
      }
   };

   template< template< typename... > class Traits >
   struct traits< std::vector< basic_value< Traits > > >
   {
      static void assign( basic_value< Traits >& v, const std::vector< basic_value< Traits > >& a )
      {
         v.set_array( a );
      }

      static void assign( basic_value< Traits >& v, std::vector< basic_value< Traits > >&& a ) noexcept
      {
         v.set_array( std::move( a ) );
      }

      template< template< typename... > class, typename Consumer >
      static void produce( Consumer& c, const std::vector< basic_value< Traits > >& a )
      {
         c.begin_array( a.size() );
         for( const auto& i : a ) {
            Traits< basic_value< Traits > >::produce( c, i );
            c.element();
         }
         c.end_array( a.size() );
      }

      template< template< typename... > class, typename Consumer >
      static void produce( Consumer& c, std::vector< basic_value< Traits > >&& a )
      {
         c.begin_array( a.size() );
         for( auto&& i : a ) {
            Traits< basic_value< Traits > >::produce( c, std::move( i ) );
            c.element();
         }
         c.end_array( a.size() );
      }
   };

   template< template< typename... > class Traits >
   struct traits< std::map< std::string, basic_value< Traits >, std::less<> > >
   {
      static void assign( basic_value< Traits >& v, const std::map< std::string, basic_value< Traits >, std::less<> >& o )
      {
         v.set_object( o );
      }

      static void assign( basic_value< Traits >& v, std::map< std::string, basic_value< Traits >, std::less<> >&& o ) noexcept
      {
         v.set_object( std::move( o ) );
      }

      template< template< typename... > class, typename Consumer >
      static void produce( Consumer& c, const std::map< std::string, basic_value< Traits >, std::less<> >& o )
      {
         c.begin_object( o.size() );
         for( const auto& i : o ) {
            c.key( i.first );
            Traits< basic_value< Traits > >::produce( c, i.second );
            c.member();
         }
         c.end_object( o.size() );
      }

      template< template< typename... > class, typename Consumer >
      static void produce( Consumer& c, std::map< std::string, basic_value< Traits >, std::less<> >&& o )
      {
         c.begin_object( o.size() );
         for( auto&& i : o ) {
            c.key( std::move( i.first ) );
            Traits< basic_value< Traits > >::produce( c, std::move( i.second ) );
            c.member();
         }
         c.end_object( o.size() );
      }
   };

   template< template< typename... > class Traits >
   struct traits< const basic_value< Traits >* >
   {
      static void assign( basic_value< Traits >& v, const basic_value< Traits >* p ) noexcept
      {
         v.set_value_ptr( p );
      }

      template< template< typename... > class TraitsLL >
      [[nodiscard]] static bool equal( const basic_value< TraitsLL >& lhs, const basic_value< Traits >* rhs ) noexcept
      {
         assert( rhs );
         return lhs == *rhs;
      }

      template< template< typename... > class TraitsLL >
      [[nodiscard]] static bool less_than( const basic_value< TraitsLL >& lhs, const basic_value< Traits >* rhs ) noexcept
      {
         assert( rhs );
         return lhs < *rhs;
      }

      template< template< typename... > class TraitsLL >
      [[nodiscard]] static bool greater_than( const basic_value< TraitsLL >& lhs, const basic_value< Traits >* rhs ) noexcept
      {
         assert( rhs );
         return lhs > *rhs;
      }
   };

   template< template< typename... > class Traits >
   struct traits< basic_value< Traits >* >
      : traits< const basic_value< Traits >* >
   {
   };

   template< typename T >
   struct traits< std::optional< T > >
   {
      template< template< typename... > class Traits >
      using default_key = typename Traits< T >::template default_key< Traits >;

      template< template< typename... > class Traits >
      [[nodiscard]] static bool is_nothing( const std::optional< T >& o )
      {
         return ( !bool( o ) ) || internal::is_nothing< Traits >( *o );  // TODO: Only query o?
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static std::optional< T > as( const basic_value< Traits >& v )
      {
         if( v == null ) {
            return std::nullopt;
         }
         return v.template as< T >();
      }

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, const std::optional< T >& o )
      {
         if( o ) {
            v.assign( *o );
         }
         else {
            v.set_null();
         }
      }

      template< template< typename... > class Traits, typename Producer >
      [[nodiscard]] static std::optional< T > consume( Producer& parser )
      {
         if( parser.null() ) {
            return std::nullopt;
         }
         return json::consume< T, Traits >( parser );
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const std::optional< T >& o )
      {
         if( o ) {
            json::events::produce< Traits >( c, *o );
         }
         else {
            json::events::produce< Traits >( c, null );
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, const std::optional< T >& rhs ) noexcept
      {
         return rhs ? ( lhs == *rhs ) : ( lhs == null );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool less_than( const basic_value< Traits >& lhs, const std::optional< T >& rhs ) noexcept
      {
         return rhs ? ( lhs < *rhs ) : ( lhs < null );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool greater_than( const basic_value< Traits >& lhs, const std::optional< T >& rhs ) noexcept
      {
         return rhs ? ( lhs > *rhs ) : ( lhs > null );
      }
   };

}  // namespace tao::json

#if defined( _MSC_VER )
#pragma warning( pop )
#endif

#endif
