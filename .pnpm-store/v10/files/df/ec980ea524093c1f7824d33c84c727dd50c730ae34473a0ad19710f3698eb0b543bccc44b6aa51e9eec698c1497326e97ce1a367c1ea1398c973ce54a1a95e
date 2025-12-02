// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_JAXN_EVENTS_FROM_STREAM_HPP
#define TAO_JSON_JAXN_EVENTS_FROM_STREAM_HPP

#include <istream>

#include <tao/pegtl/istream_input.hpp>
#include <tao/pegtl/parse.hpp>

#include "../internal/action.hpp"
#include "../internal/errors.hpp"
#include "../internal/grammar.hpp"

namespace tao::json::jaxn::events
{
   template< typename Consumer >
   void from_stream( Consumer& consumer, std::istream& stream, const char* source = nullptr, const std::size_t maximum_buffer_size = 4000 )
   {
      pegtl::istream_input in( stream, maximum_buffer_size, source ? source : "tao::json::events::jaxn::from_stream" );
      pegtl::parse< internal::grammar, internal::action, internal::errors >( in, consumer );
   }

   template< typename Consumer >
   void from_stream( Consumer& consumer, std::istream& stream, const std::string& source, const std::size_t maximum_buffer_size = 4000 )
   {
      from_stream( consumer, stream, source.c_str(), maximum_buffer_size );
   }

}  // namespace tao::json::jaxn::events

#endif
