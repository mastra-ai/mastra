// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_STRING_INPUT_HPP
#define TAO_PEGTL_STRING_INPUT_HPP

#include <string>
#include <utility>

#include "config.hpp"
#include "eol.hpp"
#include "memory_input.hpp"
#include "tracking_mode.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   namespace internal
   {
      struct string_holder
      {
         const std::string data;

         template< typename T >
         explicit string_holder( T&& in_data )
            : data( std::forward< T >( in_data ) )
         {}

         string_holder( const string_holder& ) = delete;
         string_holder( string_holder&& ) = delete;

         ~string_holder() = default;

         string_holder& operator=( const string_holder& ) = delete;
         string_holder& operator=( string_holder&& ) = delete;
      };

   }  // namespace internal

   template< tracking_mode P = tracking_mode::eager, typename Eol = eol::lf_crlf, typename Source = std::string >
   struct string_input
      : private internal::string_holder,
        public memory_input< P, Eol, Source >
   {
      template< typename V, typename T, typename... Ts >
      explicit string_input( V&& in_data, T&& in_source, Ts&&... ts )
         : internal::string_holder( std::forward< V >( in_data ) ),
           memory_input< P, Eol, Source >( data.data(), data.size(), std::forward< T >( in_source ), std::forward< Ts >( ts )... )
      {}

      string_input( const string_input& ) = delete;
      string_input( string_input&& ) = delete;

      ~string_input() = default;

      string_input& operator=( const string_input& ) = delete;
      string_input& operator=( string_input&& ) = delete;
   };

   template< typename... Ts >
   explicit string_input( Ts&&... ) -> string_input<>;

}  // namespace TAO_PEGTL_NAMESPACE

#endif
