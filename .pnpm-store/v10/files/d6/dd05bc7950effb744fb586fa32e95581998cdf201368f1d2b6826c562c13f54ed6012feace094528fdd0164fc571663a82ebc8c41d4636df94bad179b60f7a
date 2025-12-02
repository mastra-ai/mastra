// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CBOR_CONSUME_STRING_HPP
#define TAO_JSON_CBOR_CONSUME_STRING_HPP

#include <tao/pegtl/memory_input.hpp>

#include "../consume.hpp"
#include "../forward.hpp"

#include "parts_parser.hpp"

namespace tao::json::cbor
{
   template< typename T, template< typename... > class Traits = traits, typename F >
   [[nodiscard]] T consume_string( F&& string )
   {
      cbor::basic_parts_parser< utf8_mode::check, 8, pegtl::memory_input< pegtl::tracking_mode::lazy, pegtl::eol::lf_crlf, const char* > > pp( string, __FUNCTION__ );
      return json::consume< T, Traits >( pp );
   }

   template< template< typename... > class Traits = traits, typename F, typename T >
   void consume_string( F&& string, T& t )
   {
      cbor::basic_parts_parser< utf8_mode::check, 8, pegtl::memory_input< pegtl::tracking_mode::lazy, pegtl::eol::lf_crlf, const char* > > pp( string, __FUNCTION__ );
      json::consume< Traits >( pp, t );
   }

}  // namespace tao::json::cbor

#endif
