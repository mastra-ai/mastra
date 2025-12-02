// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_JAXN_EVENTS_FROM_INPUT_HPP
#define TAO_JSON_JAXN_EVENTS_FROM_INPUT_HPP

#include <utility>

#include <tao/pegtl/parse.hpp>

#include "../internal/action.hpp"
#include "../internal/errors.hpp"
#include "../internal/grammar.hpp"

namespace tao::json::jaxn::events
{
   // Events producers that parse a JAXN string representation from a PEGTL input (or something compatible).

   template< typename Consumer, typename Input >
   void from_input( Consumer& consumer, Input&& in )
   {
      pegtl::parse< internal::grammar, internal::action, internal::errors >( std::forward< Input >( in ), consumer );
   }

   template< typename Consumer, typename Input >
   void from_input_embedded( Consumer& consumer, Input&& in )
   {
      pegtl::parse< internal::embedded, internal::action, internal::errors >( std::forward< Input >( in ), consumer );
   }

   template< typename Consumer, typename Outer, typename Input >
   void from_input_nested( Consumer& consumer, const Outer& oi, Input&& in )
   {
      pegtl::parse_nested< internal::grammar, internal::action, internal::errors >( oi, std::forward< Input >( in ), consumer );
   }

   template< typename Consumer, typename Outer, typename Input >
   void from_input_embedded_nested( Consumer& consumer, const Outer& oi, Input&& in )
   {
      pegtl::parse_nested< internal::embedded, internal::action, internal::errors >( oi, std::forward< Input >( in ), consumer );
   }

}  // namespace tao::json::jaxn::events

#endif
