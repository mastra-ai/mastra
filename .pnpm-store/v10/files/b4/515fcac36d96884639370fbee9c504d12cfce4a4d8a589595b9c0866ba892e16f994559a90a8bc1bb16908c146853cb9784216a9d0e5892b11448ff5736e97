// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_POSITION_HPP
#define TAO_PEGTL_POSITION_HPP

#include <cstdlib>
#include <ostream>
#include <sstream>
#include <string>
#include <utility>

#include "config.hpp"

#include "internal/iterator.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   struct position
   {
      position() = delete;

#if defined( __GNUC__ ) && !defined( __clang__ )
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wmaybe-uninitialized"
#endif
      position( position&& p ) noexcept
         : byte( p.byte ),
           line( p.line ),
           column( p.column ),
           source( std::move( p.source ) )
      {}
#if defined( __GNUC__ ) && !defined( __clang__ )
#pragma GCC diagnostic pop
#endif

      position( const position& ) = default;

      position& operator=( position&& p ) noexcept
      {
         byte = p.byte;
         line = p.line;
         column = p.column;
         source = std::move( p.source );
         return *this;
      }

      position& operator=( const position& ) = default;

      template< typename T >
      position( const internal::iterator& in_iter, T&& in_source )
         : byte( in_iter.byte ),
           line( in_iter.line ),
           column( in_iter.column ),
           source( std::forward< T >( in_source ) )
      {}

      template< typename T >
      position( const std::size_t in_byte, const std::size_t in_line, const std::size_t in_column, T&& in_source )
         : byte( in_byte ),
           line( in_line ),
           column( in_column ),
           source( in_source )
      {}

      ~position() = default;

      std::size_t byte;
      std::size_t line;
      std::size_t column;
      std::string source;
   };

   inline bool operator==( const position& lhs, const position& rhs ) noexcept
   {
      return ( lhs.byte == rhs.byte ) && ( lhs.source == rhs.source );
   }

   inline bool operator!=( const position& lhs, const position& rhs ) noexcept
   {
      return !( lhs == rhs );
   }

   inline std::ostream& operator<<( std::ostream& os, const position& p )
   {
      return os << p.source << ':' << p.line << ':' << p.column;
   }

   [[nodiscard]] inline std::string to_string( const position& p )
   {
      std::ostringstream oss;
      oss << p;
      return std::move( oss ).str();
   }

}  // namespace TAO_PEGTL_NAMESPACE

#endif
