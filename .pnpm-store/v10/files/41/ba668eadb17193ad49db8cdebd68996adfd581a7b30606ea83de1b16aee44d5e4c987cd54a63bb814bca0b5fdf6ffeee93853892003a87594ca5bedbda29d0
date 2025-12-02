// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_JAXN_TO_STREAM_HPP
#define TAO_JSON_JAXN_TO_STREAM_HPP

#include <cstddef>
#include <ostream>

#include "../value.hpp"

#include "../events/from_value.hpp"
#include "../events/transformer.hpp"

#include "events/to_pretty_stream.hpp"
#include "events/to_stream.hpp"

namespace tao::json::jaxn
{
   template< template< typename... > class... Transformers, template< typename... > class Traits >
   void to_stream( std::ostream& os, const basic_value< Traits >& v )
   {
      json::events::transformer< events::to_stream, Transformers... > consumer( os );
      json::events::from_value( consumer, v );
   }

   template< template< typename... > class... Transformers, template< typename... > class Traits >
   void to_stream( std::ostream& os, const basic_value< Traits >& v, const std::size_t indent )
   {
      json::events::transformer< events::to_pretty_stream, Transformers... > consumer( os, indent );
      json::events::from_value( consumer, v );
   }

}  // namespace tao::json::jaxn

#endif
