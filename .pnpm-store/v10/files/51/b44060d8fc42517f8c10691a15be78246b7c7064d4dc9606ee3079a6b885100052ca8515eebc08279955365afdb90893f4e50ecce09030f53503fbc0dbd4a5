// Copyright (c) 2016-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_POINTER_HPP
#define TAO_JSON_POINTER_HPP

#include <algorithm>
#include <cassert>
#include <cstdint>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

#include <tao/pegtl/ascii.hpp>
#include <tao/pegtl/memory_input.hpp>
#include <tao/pegtl/parse.hpp>
#include <tao/pegtl/rules.hpp>
#include <tao/pegtl/utf8.hpp>

#include "type.hpp"

#include "internal/format.hpp"

namespace tao::json
{
   namespace internal
   {
      template< std::size_t = sizeof( std::size_t ) >
      struct token_to_index;

      template<>
      struct token_to_index< 4 >
      {
         [[nodiscard]] static std::size_t convert( const std::string& key ) noexcept
         {
            if( !key.empty() && key.size() <= 10 ) {
               if( key == "0" ) {
                  return 0;
               }
               if( ( key[ 0 ] != '0' ) && ( key.find_first_not_of( "0123456789" ) == std::string::npos ) ) {
                  if( key.size() < 10 || key < "4294967296" ) {
                     return static_cast< std::size_t >( std::stoul( key ) );
                  }
               }
            }
            return std::string::npos;
         }
      };

      template<>
      struct token_to_index< 8 >
      {
         [[nodiscard]] static std::size_t convert( const std::string& key ) noexcept
         {
            if( !key.empty() && key.size() <= 20 ) {
               if( key == "0" ) {
                  return 0;
               }
               if( ( key[ 0 ] != '0' ) && ( key.find_first_not_of( "0123456789" ) == std::string::npos ) ) {
                  if( key.size() < 20 || key < "18446744073709551616" ) {
                     return static_cast< std::size_t >( std::stoull( key ) );
                  }
               }
            }
            return std::string::npos;
         }
      };

   }  // namespace internal

   // RFC 6901
   class token
   {
   private:
      std::size_t m_index;
      std::string m_key;

   public:
      explicit token( const std::string& in_key )
         : m_index( internal::token_to_index<>::convert( in_key ) ),
           m_key( in_key )
      {}

      explicit token( std::string&& in_key ) noexcept
         : m_index( internal::token_to_index<>::convert( in_key ) ),
           m_key( std::move( in_key ) )
      {}

      explicit token( const std::size_t in_index )
         : m_index( in_index ),
           m_key( std::to_string( m_index ) )
      {}

      token( const token& ) = default;
      token( token&& v ) noexcept
         : m_index( v.m_index ),
           m_key( std::move( v.m_key ) )
      {}

      ~token() = default;

      token& operator=( const token& ) = default;
      token& operator=( token&& v ) noexcept
      {
         m_index = v.m_index;
         m_key = std::move( v.m_key );
         return *this;
      }

      [[nodiscard]] bool has_index() const noexcept
      {
         return m_index != std::string::npos;
      }

      [[nodiscard]] const std::string& key() const noexcept
      {
         return m_key;
      }

      [[nodiscard]] std::size_t index() const
      {
         if( !has_index() ) {
            throw std::invalid_argument( internal::format( "unable to resolve json pointer with array, token '", m_key, "' is not an index" ) );
         }
         return m_index;
      }

      [[nodiscard]] friend bool operator==( const token& lhs, const token& rhs ) noexcept
      {
         return lhs.m_key == rhs.m_key;
      }

      [[nodiscard]] friend bool operator<( const token& lhs, const token& rhs ) noexcept
      {
         return lhs.m_key < rhs.m_key;
      }
   };

   namespace internal
   {
      // clang-format off
      struct pointer_zero : pegtl::one< '0' > {};
      struct pointer_one : pegtl::one< '1' > {};
      struct pointer_tilde : pegtl::one< '~' > {};
      struct pointer_escaped : pegtl::sor< pointer_zero, pointer_one > {};
      struct pointer_slash : pegtl::one< '/' > {};
      struct pointer_char : pegtl::utf8::not_one< '/' > {};
      struct pointer_escape : pegtl::if_must< pointer_tilde, pointer_escaped > {};
      struct pointer_token : pegtl::star< pegtl::sor< pointer_escape, pointer_char > > {};
      struct pointer_rule : pegtl::until< pegtl::eof, pegtl::must< pointer_slash, pointer_token > > {};
      struct pointer_grammar : pegtl::must< pointer_rule > {};
      // clang-format on

      template< typename Rule >
      struct pointer_action
         : pegtl::nothing< Rule >
      {};

      template<>
      struct pointer_action< pointer_zero >
      {
         static void apply0( std::vector< token >& /*unused*/, std::string& t )
         {
            t += '~';
         }
      };

      template<>
      struct pointer_action< pointer_one >
      {
         static void apply0( std::vector< token >& /*unused*/, std::string& t )
         {
            t += '/';
         }
      };

      template<>
      struct pointer_action< pointer_char >
      {
         template< typename Input >
         static void apply( const Input& in, std::vector< token >& /*unused*/, std::string& t )
         {
            t.append( in.begin(), in.size() );
         }
      };

      template<>
      struct pointer_action< pointer_token >
      {
         static void apply0( std::vector< token >& v, std::string& t )
         {
            v.emplace_back( std::move( t ) );
            t.clear();
         }
      };

   }  // namespace internal

   class pointer
      : public std::vector< token >
   {
   private:
      void parse( const std::string& v )
      {
         std::string t;
         pegtl::memory_input< pegtl::tracking_mode::lazy, pegtl::eol::lf_crlf, const char* > in( v, "parse()" );
         pegtl::parse< internal::pointer_grammar, internal::pointer_action >( in, vector(), t );
      }

   public:
      pointer() = default;
      pointer( const pointer& ) = default;
      pointer( pointer&& p ) = default;

      explicit pointer( const std::string& v )
      {
         parse( v );
      }

      pointer( const std::initializer_list< token >& l )
         : std::vector< token >( l )
      {}

      ~pointer() = default;

      pointer& operator=( const pointer& ) = default;
      pointer& operator=( pointer&& p ) = default;

      pointer& operator=( const std::string& v )
      {
         clear();
         parse( v );
         return *this;
      }

      pointer& operator=( const std::initializer_list< token >& l )
      {
         vector() = l;
         return *this;
      }

      [[nodiscard]] explicit operator bool() const noexcept
      {
         return !empty();
      }

      void push_back() = delete;

      void pop_back()
      {
         assert( !empty() );
         vector().pop_back();
      }

      [[nodiscard]] bool is_prefix_of( const pointer& other ) const noexcept
      {
         if( other.size() >= size() ) {
            return std::equal( begin(), end(), other.begin() );
         }
         return false;
      }

      [[nodiscard]] std::vector< token >& vector() noexcept
      {
         return static_cast< std::vector< token >& >( *this );
      }

      [[nodiscard]] const std::vector< token >& vector() const noexcept
      {
         return static_cast< const std::vector< token >& >( *this );
      }
   };

   [[nodiscard]] inline bool operator==( const pointer& lhs, const pointer& rhs ) noexcept
   {
      return lhs.vector() == rhs.vector();
   }

   [[nodiscard]] inline bool operator<( const pointer& lhs, const pointer& rhs ) noexcept
   {
      return lhs.vector() < rhs.vector();
   }

   [[nodiscard]] inline bool operator!=( const pointer& lhs, const pointer& rhs ) noexcept
   {
      return !( lhs == rhs );
   }

   [[nodiscard]] inline bool operator>( const pointer& lhs, const pointer& rhs ) noexcept
   {
      return rhs < lhs;
   }

   [[nodiscard]] inline bool operator<=( const pointer& lhs, const pointer& rhs ) noexcept
   {
      return !( rhs < lhs );
   }

   [[nodiscard]] inline bool operator>=( const pointer& lhs, const pointer& rhs ) noexcept
   {
      return !( lhs < rhs );
   }

   inline pointer& operator+=( pointer& lhs, const std::string& rhs )
   {
      lhs.emplace_back( rhs );
      return lhs;
   }

   inline pointer& operator+=( pointer& lhs, std::string&& rhs )
   {
      lhs.emplace_back( std::move( rhs ) );
      return lhs;
   }

   inline pointer& operator+=( pointer& lhs, const std::size_t rhs )
   {
      lhs.emplace_back( rhs );
      return lhs;
   }

   [[nodiscard]] inline pointer operator+( const pointer& p, const std::string& v )
   {
      pointer nrv( p );
      nrv += v;
      return nrv;
   }

   [[nodiscard]] inline pointer operator+( const pointer& p, std::string&& v )
   {
      pointer nrv( p );
      nrv += std::move( v );
      return nrv;
   }

   [[nodiscard]] inline pointer operator+( const pointer& p, const std::size_t i )
   {
      pointer nrv( p );
      nrv += i;
      return nrv;
   }

   namespace internal
   {
      [[nodiscard]] inline std::string tokens_to_string( std::vector< token >::const_iterator it, const std::vector< token >::const_iterator& end )
      {
         std::string result;
         while( it != end ) {
            result += '/';
            for( const char c : it->key() ) {
               switch( c ) {
                  case '~':
                     result += "~0";
                     break;
                  case '/':
                     result += "~1";
                     break;
                  default:
                     result += c;
               }
            }
            ++it;
         }
         return result;
      }

      [[nodiscard]] inline std::runtime_error invalid_type( const std::vector< token >::const_iterator& begin, const std::vector< token >::const_iterator& end )
      {
         return std::runtime_error( internal::format( "unable to resolve JSON Pointer '", tokens_to_string( begin, end ), "' -- value type is neither 'object' nor 'array'" ) );
      }

      template< typename T >
      [[nodiscard]] T& pointer_at( T* v, const std::vector< token >::const_iterator& begin, const std::vector< token >::const_iterator& end )
      {
         for( auto it = begin; it != end; ++it ) {
            switch( v->type() ) {
               case type::ARRAY:
                  v = &v->at( it->index() );
                  break;
               case type::OBJECT:
                  v = &v->at( it->key() );
                  break;
               default:
                  throw invalid_type( begin, std::next( it ) );
            }
         }
         return *v;
      }

      template< typename T >
      [[nodiscard]] T* pointer_find( T* v, const std::vector< token >::const_iterator& begin, const std::vector< token >::const_iterator& end )
      {
         for( auto it = begin; v && ( it != end ); ++it ) {
            switch( v->type() ) {
               case type::ARRAY:
                  v = v->find( it->index() );
                  break;
               case type::OBJECT:
                  v = v->find( it->key() );
                  break;
               default:
                  throw invalid_type( begin, std::next( it ) );
            }
         }
         return v;
      }

   }  // namespace internal

   [[nodiscard]] inline std::string to_string( const pointer& p )
   {
      return internal::tokens_to_string( p.begin(), p.end() );
   }

   [[nodiscard]] inline std::string to_string( pointer& p )
   {
      return internal::tokens_to_string( p.begin(), p.end() );
   }

   [[nodiscard]] inline std::string to_string( pointer&& p )
   {
      return internal::tokens_to_string( p.begin(), p.end() );
   }

   inline namespace literals
   {
      [[nodiscard]] inline pointer operator"" _json_pointer( const char* data, const std::size_t size )
      {
         return pointer( { data, size } );
      }

   }  // namespace literals

}  // namespace tao::json

#endif
