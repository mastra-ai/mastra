// Copyright (c) 2015-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_TO_STREAM_HPP
#define TAO_JSON_TO_STREAM_HPP

#include <cstddef>
#include <ostream>
#include <utility>

#include "events/from_value.hpp"
#include "events/to_pretty_stream.hpp"
#include "events/to_stream.hpp"
#include "events/transformer.hpp"
#include "value.hpp"

namespace tao::json
{
   template< template< typename... > class... Transformers, template< typename... > class Traits >
   void to_stream( std::ostream& os, const basic_value< Traits >& v )
   {
      events::transformer< events::to_stream, Transformers... > consumer( os );
      events::from_value( consumer, v );
   }

   template< template< typename... > class... Transformers, template< typename... > class Traits >
   void to_stream( std::ostream& os, const basic_value< Traits >& v, const std::size_t indent )
   {
      events::transformer< events::to_pretty_stream, Transformers... > consumer( os, indent );
      events::from_value( consumer, v );
   }

   template< template< typename... > class... Transformers, template< typename... > class Traits, typename S >
   void to_stream( std::ostream& os, const basic_value< Traits >& v, const std::size_t indent, S&& eol )
   {
      events::transformer< events::to_pretty_stream, Transformers... > consumer( os, indent, std::forward< S >( eol ) );
      events::from_value( consumer, v );
   }

}  // namespace tao::json

#endif
