// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_UBJSON_PARTS_PARSER_HPP
#define TAO_JSON_UBJSON_PARTS_PARSER_HPP

#include <cstdint>
#include <optional>

#include <tao/pegtl/parse_error.hpp>
#include <tao/pegtl/rules.hpp>
#include <tao/pegtl/string_input.hpp>

#include "../events/discard.hpp"
#include "../utf8.hpp"

#include "internal/grammar.hpp"

namespace tao::json::ubjson
{
   namespace internal
   {
      template< typename Input >
      [[nodiscard]] bool read_boolean( Input& in )
      {
         const auto b = peek_marker( in );
         switch( b ) {
            case marker::TRUE_:
               in.bump_in_this_line( 1 );
               return true;
            case marker::FALSE_:
               in.bump_in_this_line( 1 );
               return false;
            default:
               throw pegtl::parse_error( "expected boolean", in );
         }
         std::abort();
      }

      template< typename Input >
      [[nodiscard]] std::int64_t read_signed( Input& in )
      {
         const auto b = peek_marker( in );
         switch( format( b ) ) {
            case marker::INT8:
               return json::internal::read_big_endian_number< std::int64_t, std::int8_t >( in, 1 );
            case marker::UINT8:
               return json::internal::read_big_endian_number< std::int64_t, std::uint8_t >( in, 1 );
            case marker::INT16:
               return json::internal::read_big_endian_number< std::int64_t, std::int16_t >( in, 1 );
            case marker::INT32:
               return json::internal::read_big_endian_number< std::int64_t, std::int32_t >( in, 1 );
            case marker::INT64:
               return json::internal::read_big_endian_number< std::int64_t >( in, 1 );
            default:
               throw pegtl::parse_error( "expected signed number", in );
         }
      }

      [[nodiscard]] inline std::uint64_t test_unsigned( const std::int64_t i )
      {
         if( i < 0 ) {
            throw std::runtime_error( "negative number for unsigned" );
         }
         return static_cast< std::uint64_t >( i );
      }

      template< typename Input >
      [[nodiscard]] std::uint64_t read_unsigned( Input& in )
      {
         const auto b = peek_marker( in );
         switch( b ) {
            case marker::INT8:
               return test_unsigned( json::internal::read_big_endian_number< std::int64_t, std::int8_t >( in, 1 ) );
            case marker::UINT8:
               return json::internal::read_big_endian_number< std::uint64_t, std::uint8_t >( in, 1 );
            case marker::INT16:
               return test_unsigned( json::internal::read_big_endian_number< std::int64_t, std::int16_t >( in, 1 ) );
            case marker::INT32:
               return test_unsigned( json::internal::read_big_endian_number< std::int64_t, std::int32_t >( in, 1 ) );
            case marker::INT64:
               return test_unsigned( json::internal::read_big_endian_number< std::int64_t >( in, 1 ) );
            default:
               throw pegtl::parse_error( "expected positive number", in );
         }
      }

      template< typename Input >
      [[nodiscard]] double read_double( Input& in )
      {
         switch( peek_marker( in ) ) {
            case marker::FLOAT32:
               return json::internal::read_big_endian_number< double, float >( in, 1 );
            case marker::FLOAT64:
               return json::internal::read_big_endian_number< double >( in, 1 );
            default:
               throw pegtl::parse_error( "expected floating point number", in );
         }
      }

      template< utf8_mode V, typename Result, typename Input >
      [[nodiscard]] Result read_string_or_char( Input& in )
      {
         const auto b = read_marker( in );
         switch( b ) {
            case marker::CHAR:
               return internal::read_char< Result >( in );
            case marker::STRING:
               return internal::read_string< V, Result >( in );
            default:
               throw pegtl::parse_error( "expected string (or char)", in );
         }
      }

   }  // namespace internal

   template< std::size_t L, utf8_mode V = utf8_mode::check, typename Input = pegtl::string_input< pegtl::tracking_mode::lazy > >
   class basic_parts_parser
   {
   public:
      template< typename... Ts >
      explicit basic_parts_parser( Ts&&... ts )
         : m_input( std::forward< Ts >( ts )... )
      {}

      [[nodiscard]] bool empty()
      {
         return m_input.empty();
      }

      [[nodiscard]] bool null()
      {
         if( internal::peek_marker( m_input ) == internal::marker::NULL_ ) {
            m_input.bump_in_this_line( 1 );
            return true;
         }
         return false;
      }

      [[nodiscard]] bool boolean()
      {
         return internal::read_boolean( m_input );
      }

      void check_marker( const internal::marker m, const char* e )
      {
         const auto b = internal::peek_marker( m_input );
         if( b != m ) {
            throw pegtl::parse_error( e, m_input );
         }
         m_input.bump_in_this_line();
      }

      [[nodiscard]] std::string_view string()
      {
         return internal::read_string_or_char< V, std::string_view >( m_input );
      }

      [[nodiscard]] tao::binary_view binary()
      {
         check_marker( internal::marker::BEGIN_ARRAY, "expected array for binary" );
         check_marker( internal::marker::CONTAINER_TYPE, "expected typed array for binary" );
         check_marker( internal::marker::UINT8, "expected type uint8 for array for binary" );
         check_marker( internal::marker::CONTAINER_SIZE, "expected sized array for binary" );
         const auto size = internal::read_size< L >( m_input );
         return json::internal::read_string< utf8_mode::trust, tao::binary_view >( m_input, size );
      }

      [[nodiscard]] std::string_view key()
      {
         return string();
      }

      [[nodiscard]] std::int64_t number_signed()
      {
         return internal::read_signed( m_input );
      }

      [[nodiscard]] std::uint64_t number_unsigned()
      {
         return internal::read_unsigned( m_input );
      }

      [[nodiscard]] double number_double()
      {
         return internal::read_double( m_input );
      }

      struct state_t
      {
         state_t() = default;

         explicit state_t( const std::size_t in_size )
            : size( in_size )
         {}

         std::size_t i = 0;
         std::optional< std::size_t > size;
      };

      template< internal::marker Begin, internal::marker End >
      [[nodiscard]] state_t begin_container( const char* e )
      {
         check_marker( Begin, e );
         const auto b = internal::peek_marker( m_input );
         switch( b ) {
            case End:
               return state_t( 0 );
            case internal::marker::CONTAINER_TYPE:
               throw pegtl::parse_error( "typed ubjson containers not implemented", m_input );
            case internal::marker::CONTAINER_SIZE:
               m_input.bump_in_this_line( 1 );
               return state_t( number_unsigned() );
            default:
               return state_t();
         }
      }

      [[nodiscard]] state_t begin_array()
      {
         return begin_container< internal::marker::BEGIN_ARRAY, internal::marker::END_ARRAY >( "expected array" );
      }

      [[nodiscard]] state_t begin_object()
      {
         return begin_container< internal::marker::BEGIN_OBJECT, internal::marker::END_OBJECT >( "expected object" );
      }

      void end_array_sized( const state_t& p )
      {
         if( *p.size != p.i ) {
            throw pegtl::parse_error( "array size mismatch", m_input );
         }
      }

      void end_object_sized( const state_t& p )
      {
         if( *p.size != p.i ) {
            throw pegtl::parse_error( "object size mismatch", m_input );
         }
      }

      void end_array_indefinite( const state_t& /*unused*/ )
      {
         if( internal::peek_marker( m_input ) != internal::marker::END_ARRAY ) {
            throw pegtl::parse_error( "array not at end", m_input );
         }
         m_input.bump_in_this_line( 1 );
      }

      void end_object_indefinite( const state_t& /*unused*/ )
      {
         if( internal::peek_marker( m_input ) != internal::marker::END_OBJECT ) {
            throw pegtl::parse_error( "object not at end", m_input );
         }
         m_input.bump_in_this_line( 1 );
      }

      void end_array( const state_t& p )
      {
         if( p.size ) {
            end_array_sized( p );
         }
         else {
            end_array_indefinite( p );
         }
      }

      void end_object( const state_t& p )
      {
         if( p.size ) {
            end_object_sized( p );
         }
         else {
            end_object_indefinite( p );
         }
      }

      void element_sized( state_t& p )
      {
         if( p.i++ >= *p.size ) {
            throw pegtl::parse_error( "unexpected array end", m_input );
         }
      }

      void member_sized( state_t& p )
      {
         if( p.i++ >= *p.size ) {
            throw pegtl::parse_error( "unexpected object end", m_input );
         }
      }

      void element_indefinite( state_t& /*unused*/ )
      {
         if( internal::peek_marker( m_input ) == internal::marker::END_ARRAY ) {
            throw pegtl::parse_error( "unexpected array end", m_input );
         }
      }

      void member_indefinite( state_t& /*unused*/ )
      {
         if( internal::peek_marker( m_input ) == internal::marker::END_OBJECT ) {
            throw pegtl::parse_error( "unexpected object end", m_input );
         }
      }

      void element( state_t& p )
      {
         if( p.size ) {
            element_sized( p );
         }
         else {
            element_indefinite( p );
         }
      }

      void member( state_t& p )
      {
         if( p.size ) {
            member_sized( p );
         }
         else {
            member_indefinite( p );
         }
      }

      [[nodiscard]] bool element_or_end_array_sized( state_t& p )
      {
         return p.i++ < *p.size;
      }

      [[nodiscard]] bool member_or_end_object_sized( state_t& p )
      {
         return p.i++ < *p.size;
      }

      [[nodiscard]] bool element_or_end_array_indefinite( const state_t& /*unused*/ )
      {
         if( internal::peek_marker( m_input ) == internal::marker::END_ARRAY ) {
            m_input.bump_in_this_line( 1 );
            return false;
         }
         return true;
      }

      [[nodiscard]] bool member_or_end_object_indefinite( const state_t& /*unused*/ )
      {
         if( internal::peek_marker( m_input ) == internal::marker::END_OBJECT ) {
            m_input.bump_in_this_line( 1 );
            return false;
         }
         return true;
      }

      [[nodiscard]] bool element_or_end_array( state_t& p )
      {
         if( p.size ) {
            return element_or_end_array_sized( p );
         }
         return element_or_end_array_indefinite( p );
      }

      [[nodiscard]] bool member_or_end_object( state_t& p )
      {
         if( p.size ) {
            return member_or_end_object_sized( p );
         }
         return member_or_end_object_indefinite( p );
      }

      void skip_value()
      {
         json::events::discard consumer;  // TODO: Optimise to not generate events (which requires preparing their - discarded - arguments)?
         pegtl::parse< pegtl::must< internal::data< L, V > > >( m_input, consumer );
      }

      [[nodiscard]] auto mark()
      {
         return m_input.template mark< pegtl::rewind_mode::required >();
      }

      template< typename T >
      void throw_parse_error( T&& t ) const
      {
         throw pegtl::parse_error( std::forward< T >( t ), m_input );
      }

   protected:
      Input m_input;
   };

   using parts_parser = basic_parts_parser< 1 << 24 >;

}  // namespace tao::json::ubjson

#endif
