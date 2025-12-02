// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_INTERNAL_NUMBER_TRAITS_HPP
#define TAO_JSON_INTERNAL_NUMBER_TRAITS_HPP

#include <cstdint>
#include <stdexcept>

#include "../forward.hpp"
#include "../message_extension.hpp"
#include "../type.hpp"

#include "format.hpp"

#if defined( _MSC_VER )
#pragma warning( push )
#pragma warning( disable : 4702 )
#endif

namespace tao::json::internal
{
   template< typename T >
   struct number_trait
   {
      template< template< typename... > class Traits >
      [[nodiscard]] static T as( const basic_value< Traits >& v )
      {
         switch( v.type() ) {
            case type::SIGNED:
               return static_cast< T >( v.get_signed() );
            case type::UNSIGNED:
               return static_cast< T >( v.get_unsigned() );
            case type::DOUBLE:
               return static_cast< T >( v.get_double() );
            default:
               throw std::logic_error( internal::format( "invalid json type '", v.type(), "' for conversion to number", json::message_extension( v ) ) );
         }
      }
   };

   template< typename T >
   struct signed_trait
      : number_trait< T >
   {
      template< template< typename... > class, typename Parts >
      [[nodiscard]] static T consume( Parts& parser )
      {
         return static_cast< T >( parser.number_signed() );
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const T i )
      {
         c.number( std::int64_t( i ) );
      }

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, const T i ) noexcept
      {
         v.set_signed( i );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, const T rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::SIGNED:
               return p.get_signed() == rhs;
            case type::UNSIGNED:
               return ( rhs >= 0 ) && ( p.get_unsigned() == static_cast< std::uint64_t >( rhs ) );
            case type::DOUBLE:
               return p.get_double() == rhs;
            default:
               return false;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool less_than( const basic_value< Traits >& lhs, const T rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::SIGNED:
               return p.get_signed() < rhs;
            case type::UNSIGNED:
               return ( rhs >= 0 ) && ( p.get_unsigned() < static_cast< std::uint64_t >( rhs ) );
            case type::DOUBLE:
               return p.get_double() < rhs;
            default:
               return p.type() < type::SIGNED;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool greater_than( const basic_value< Traits >& lhs, const T rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::SIGNED:
               return p.get_signed() > rhs;
            case type::UNSIGNED:
               return ( rhs < 0 ) || ( p.get_unsigned() > static_cast< std::uint64_t >( rhs ) );
            case type::DOUBLE:
               return p.get_double() > rhs;
            default:
               return p.type() > type::SIGNED;
         }
      }
   };

   template< typename T >
   struct unsigned_trait
      : number_trait< T >
   {
      template< template< typename... > class, typename Parts >
      [[nodiscard]] static T consume( Parts& parser )
      {
         return static_cast< T >( parser.number_unsigned() );
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const T i )
      {
         c.number( std::uint64_t( i ) );
      }

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, const T i ) noexcept
      {
         v.set_unsigned( i );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, const T rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::SIGNED: {
               const auto v = p.get_signed();
               return ( v >= 0 ) && ( static_cast< std::uint64_t >( v ) == rhs );
            }
            case type::UNSIGNED:
               return p.get_unsigned() == rhs;
            case type::DOUBLE:
               return p.get_double() == rhs;
            default:
               return false;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool less_than( const basic_value< Traits >& lhs, const T rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::SIGNED: {
               const auto v = p.get_signed();
               return ( v < 0 ) || ( static_cast< std::uint64_t >( v ) < rhs );
            }
            case type::UNSIGNED:
               return p.get_unsigned() < rhs;
            case type::DOUBLE:
               return p.get_double() < rhs;
            default:
               return p.type() < type::UNSIGNED;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool greater_than( const basic_value< Traits >& lhs, const T rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::SIGNED: {
               const auto v = p.get_signed();
               return ( v >= 0 ) && ( static_cast< std::uint64_t >( v ) > rhs );
            }
            case type::UNSIGNED:
               return p.get_unsigned() > rhs;
            case type::DOUBLE:
               return p.get_double() > rhs;
            default:
               return p.type() > type::UNSIGNED;
         }
      }
   };

   template< typename T >
   struct float_trait
      : number_trait< T >
   {
      template< template< typename... > class, typename Parts >
      [[nodiscard]] static T consume( Parts& parser )
      {
         return static_cast< T >( parser.number_double() );
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const T f )
      {
         c.number( double( f ) );
      }

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, const T f ) noexcept
      {
         v.set_double( f );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, const T rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::SIGNED:
               return p.get_signed() == rhs;
            case type::UNSIGNED:
               return p.get_unsigned() == rhs;
            case type::DOUBLE:
               return p.get_double() == rhs;  // TODO: Is it ok for overall semantics that NaN != NaN?
            default:
               return false;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool less_than( const basic_value< Traits >& lhs, const T rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::SIGNED:
               return p.get_signed() < rhs;
            case type::UNSIGNED:
               return p.get_unsigned() < rhs;
            case type::DOUBLE:
               return p.get_double() < rhs;
            default:
               return p.type() < type::DOUBLE;
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool greater_than( const basic_value< Traits >& lhs, const T rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         switch( p.type() ) {
            case type::SIGNED:
               return p.get_signed() > rhs;
            case type::UNSIGNED:
               return p.get_unsigned() > rhs;
            case type::DOUBLE:
               return p.get_double() > rhs;
            default:
               return p.type() > type::DOUBLE;
         }
      }
   };

}  // namespace tao::json::internal

#if defined( _MSC_VER )
#pragma warning( pop )
#endif

#endif
