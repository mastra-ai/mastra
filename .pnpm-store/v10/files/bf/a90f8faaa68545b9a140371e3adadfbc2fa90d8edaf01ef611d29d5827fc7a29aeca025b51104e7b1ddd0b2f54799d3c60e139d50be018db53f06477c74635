// Copyright (c) 2019-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CBOR_EVENTS_FROM_INPUT_HPP
#define TAO_JSON_CBOR_EVENTS_FROM_INPUT_HPP

#include <utility>

#include <tao/pegtl/parse.hpp>

#include "../internal/grammar.hpp"

namespace tao::json::cbor::events
{
   // Events producers that parse CBOR from a PEGTL input (or something compatible).

   template< typename Consumer, typename Input >
   void from_input( Consumer& consumer, Input&& in )
   {
      pegtl::parse< cbor::internal::grammar >( std::forward< Input >( in ), consumer );
   }

   template< typename Consumer, typename Input >
   void from_input_embedded( Consumer& consumer, Input&& in )
   {
      pegtl::parse< cbor::internal::embedded >( std::forward< Input >( in ), consumer );
   }

   template< typename Consumer, typename Outer, typename Input >
   void from_input_nested( Consumer& consumer, const Outer& oi, Input&& in )
   {
      pegtl::parse_nested< cbor::internal::grammar >( oi, std::forward< Input >( in ), consumer );
   }

   template< typename Consumer, typename Outer, typename Input >
   void from_input_embedded_nested( Consumer& consumer, const Outer& oi, Input&& in )
   {
      pegtl::parse_nested< cbor::internal::embedded >( oi, std::forward< Input >( in ), consumer );
   }

}  // namespace tao::json::cbor::events

#endif
