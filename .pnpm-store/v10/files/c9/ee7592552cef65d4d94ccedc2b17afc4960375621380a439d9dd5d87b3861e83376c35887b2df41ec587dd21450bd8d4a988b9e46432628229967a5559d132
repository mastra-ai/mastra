// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CBOR_PARTS_PARSER_HPP
#define TAO_JSON_CBOR_PARTS_PARSER_HPP

#include <cstdint>
#include <optional>

#include <tao/pegtl/parse.hpp>
#include <tao/pegtl/parse_error.hpp>
#include <tao/pegtl/rules.hpp>
#include <tao/pegtl/string_input.hpp>

#include "../events/discard.hpp"
#include "../utf8.hpp"

#include "internal/grammar.hpp"

namespace tao::json::cbor
{
   namespace internal
   {
      template< typename Input >
      [[nodiscard]] major peek_first_major( Input& in )
      {
         const auto m = peek_major( in );
         if( m != major::TAG ) {
            return m;
         }
         switch( auto n = peek_minor_unsafe( in ) ) {
            default:
               in.bump_in_this_line();
               break;
            case 24:
               consume_or_throw( in, 2 );
               break;
            case 25:
               consume_or_throw( in, 3 );
               break;
            case 26:
               consume_or_throw( in, 5 );
               break;
            case 27:
               consume_or_throw( in, 9 );
               break;
            case 28:
            case 29:
            case 30:
            case 31:
               throw pegtl::parse_error( json::internal::format( "unexpected minor ", n, " for tag" ), in );
         }
         return peek_major( in );
      }

#if defined( _MSC_VER )
#pragma warning( push )
#pragma warning( disable : 4702 )
#endif
      template< typename Input >
      [[nodiscard]] bool read_boolean( Input& in )
      {
         const auto b = json::internal::peek_uint8( in );
         switch( b ) {
            case static_cast< std::uint8_t >( major::OTHER ) + 20:
            case static_cast< std::uint8_t >( major::OTHER ) + 21:
               in.bump_in_this_line( 1 );
               return static_cast< bool >( b - static_cast< std::uint8_t >( major::OTHER ) - 20 );
            default:
               throw pegtl::parse_error( "expected boolean", in );
         }
         std::abort();
      }
#if defined( _MSC_VER )
#pragma warning( pop )
#endif

   }  // namespace internal

   template< utf8_mode V = utf8_mode::check, std::size_t N = 8, typename Input = pegtl::string_input< pegtl::tracking_mode::lazy > >
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
         if( json::internal::peek_uint8( m_input ) == static_cast< std::uint8_t >( internal::major::OTHER ) + 22 ) {
            m_input.bump_in_this_line( 1 );
            return true;
         }
         return false;
      }

      [[nodiscard]] bool boolean()
      {
         return internal::read_boolean( m_input );
      }

   private:
      void check_major( const internal::major m, const char* e )
      {
         const auto b = internal::peek_first_major( m_input );
         if( b != m ) {
            throw pegtl::parse_error( e, m_input );
         }
      }

      template< utf8_mode U, typename T >
      [[nodiscard]] T string_impl( const internal::major m, const char* e )
      {
         check_major( m, e );
         if( internal::peek_minor_unsafe( m_input ) != internal::minor_mask ) {
            return internal::read_string_1< U, T >( m_input );
         }
         return internal::read_string_n< U, T >( m_input, m );
      }

   public:
      [[nodiscard]] std::string string()
      {
         return string_impl< V, std::string >( internal::major::STRING, "expected string" );
      }

      [[nodiscard]] std::string binary()
      {
         return string_impl< utf8_mode::trust, std::vector< std::byte > >( internal::major::BINARY, "expected binary" );
      }

      [[nodiscard]] std::string key()
      {
         return string();
      }

      [[nodiscard]] std::string_view string_view()
      {
         const auto b = json::internal::peek_uint8( m_input );
         if( b != static_cast< std::uint8_t >( internal::major::STRING ) + internal::minor_mask ) {
            throw pegtl::parse_error( "expected definitive string", m_input );
         }
         return internal::read_string_1< V, std::string_view >( m_input );
      }

      [[nodiscard]] tao::binary_view binary_view()
      {
         const auto b = json::internal::peek_uint8( m_input );
         if( b != static_cast< std::uint8_t >( internal::major::BINARY ) + internal::minor_mask ) {
            throw pegtl::parse_error( "expected definitive binary", m_input );
         }
         return internal::read_string_1< utf8_mode::trust, tao::binary_view >( m_input );
      }

      [[nodiscard]] std::string_view key_view()
      {
         return string_view();
      }

   private:
      [[nodiscard]] std::int64_t number_signed_unsigned()
      {
         const auto u = internal::read_unsigned_unsafe( m_input );
         if( u > 9223372036854775807ULL ) {
            throw pegtl::parse_error( "positive integer overflow", m_input );
         }
         return static_cast< std::int64_t >( u );
      }

      [[nodiscard]] std::int64_t number_signed_negative()
      {
         const auto u = internal::read_unsigned_unsafe( m_input );
         if( u > 9223372036854775808ULL ) {
            throw pegtl::parse_error( "negative integer overflow", m_input );
         }
         return static_cast< std::int64_t >( ~u );
      }

#if defined( _MSC_VER )
#pragma warning( push )
#pragma warning( disable : 4702 )
#endif
   public:
      [[nodiscard]] std::int64_t number_signed()
      {
         const auto b = internal::peek_first_major( m_input );
         switch( b ) {
            case internal::major::UNSIGNED:
               return number_signed_unsigned();
            case internal::major::NEGATIVE:
               return number_signed_negative();
            default:
               throw pegtl::parse_error( "expected integer", m_input );
         }
         std::abort();
      }
#if defined( _MSC_VER )
#pragma warning( pop )
#endif

      [[nodiscard]] std::uint64_t number_unsigned()
      {
         check_major( internal::major::UNSIGNED, "expected unsigned" );
         return internal::read_unsigned_unsafe( m_input );
      }

      [[nodiscard]] double number_double()
      {
         const auto b = json::internal::peek_uint8( m_input );
         switch( b ) {
            case static_cast< std::uint8_t >( internal::major::OTHER ) + 25:
               return internal::read_fp16( m_input );
            case static_cast< std::uint8_t >( internal::major::OTHER ) + 26:
               return json::internal::read_big_endian_number< float >( m_input + 1 );
            case static_cast< std::uint8_t >( internal::major::OTHER ) + 27:
               return json::internal::read_big_endian_number< double >( m_input + 1 );
            default:
               throw pegtl::parse_error( "expected floating point number", m_input );
         }
      }

   private:
      struct state_t
      {
         state_t() = default;

         explicit state_t( const std::size_t in_size )
            : size( in_size )
         {}

         std::size_t i = 0;
         std::optional< std::size_t > size;
      };

      [[nodiscard]] state_t begin_container()
      {
         if( internal::peek_minor_unsafe( m_input ) == 31 ) {
            m_input.bump_in_this_line( 1 );
            return state_t();
         }
         return state_t( internal::read_size_unsafe( m_input ) );
      }

   public:
      [[nodiscard]] state_t begin_array()
      {
         check_major( internal::major::ARRAY, "expected array" );
         return begin_container();
      }

      [[nodiscard]] state_t begin_object()
      {
         check_major( internal::major::OBJECT, "expected object" );
         return begin_container();
      }

   private:
      void end_container_sized( const state_t& p )
      {
         if( *p.size != p.i ) {
            throw pegtl::parse_error( "container size mismatch", m_input );
         }
      }

      void end_container_indefinite()
      {
         if( json::internal::peek_uint8( m_input ) != 0xff ) {
            throw pegtl::parse_error( "container not at end", m_input );
         }
         m_input.bump_in_this_line( 1 );
      }

      void end_container( const state_t& p )
      {
         if( p.size ) {
            end_container_sized( p );
         }
         else {
            end_container_indefinite();
         }
      }

   public:
      void end_array( const state_t& p )
      {
         end_container( p );
      }

      void end_object( const state_t& p )
      {
         end_container( p );
      }

   private:
      void next_in_container_sized( state_t& p )
      {
         if( p.i++ >= *p.size ) {
            throw pegtl::parse_error( "unexpected end of sized container", m_input );
         }
      }

      void next_in_container_indefinite()
      {
         if( json::internal::peek_uint8( m_input ) == 0xff ) {
            throw pegtl::parse_error( "unexpected end of indefinite container", m_input );
         }
      }

      void next_in_container( state_t& p )
      {
         if( p.size ) {
            next_in_container_sized( p );
         }
         else {
            next_in_container_indefinite();
         }
      }

   public:
      void element( state_t& p )
      {
         next_in_container( p );
      }

      void member( state_t& p )
      {
         next_in_container( p );
      }

   private:
      [[nodiscard]] bool next_or_end_container_sized( state_t& p )
      {
         return p.i++ < *p.size;
      }

      [[nodiscard]] bool next_or_end_container_indefinite()
      {
         if( json::internal::peek_uint8( m_input ) == 0xff ) {
            m_input.bump_in_this_line( 1 );
            return false;
         }
         return true;
      }

      [[nodiscard]] bool next_or_end_container( state_t& p )
      {
         if( p.size ) {
            return next_or_end_container_sized( p );
         }
         return next_or_end_container_indefinite();
      }

   public:
      [[nodiscard]] bool element_or_end_array( state_t& p )
      {
         return next_or_end_container( p );
      }

      [[nodiscard]] bool member_or_end_object( state_t& p )
      {
         return next_or_end_container( p );
      }

      void skip_value()
      {
         json::events::discard consumer;  // TODO: Optimise to not generate events (which requires preparing their - discarded - arguments)?
         pegtl::parse< pegtl::must< internal::data< V, N > > >( m_input, consumer );
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

   using parts_parser = basic_parts_parser<>;

}  // namespace tao::json::cbor

#endif
