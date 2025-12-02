// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_JAXN_TO_STRING_HPP
#define TAO_JSON_JAXN_TO_STRING_HPP

#include <sstream>
#include <utility>

#include "../value.hpp"

#include "to_stream.hpp"

namespace tao::json::jaxn
{
   template< template< typename... > class... Transformers, template< typename... > class Traits >
   [[nodiscard]] std::string to_string( const basic_value< Traits >& v )
   {
      std::ostringstream oss;
      jaxn::to_stream< Transformers... >( oss, v );
      return std::move( oss ).str();
   }

   template< template< typename... > class... Transformers, template< typename... > class Traits >
   [[nodiscard]] std::string to_string( const basic_value< Traits >& v, const unsigned indent )
   {
      std::ostringstream oss;
      jaxn::to_stream< Transformers... >( oss, v, indent );
      return std::move( oss ).str();
   }

}  // namespace tao::json::jaxn

#endif
