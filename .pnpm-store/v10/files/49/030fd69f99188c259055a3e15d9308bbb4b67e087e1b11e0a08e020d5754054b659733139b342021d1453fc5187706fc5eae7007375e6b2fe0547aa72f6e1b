// Copyright (c) 2015-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_TO_STRING_HPP
#define TAO_JSON_TO_STRING_HPP

#include <sstream>
#include <string>
#include <utility>

#include "to_stream.hpp"

namespace tao::json
{
   template< template< typename... > class... Transformers, typename... Ts >
   [[nodiscard]] std::string to_string( Ts&&... ts )
   {
      std::ostringstream oss;
      json::to_stream< Transformers... >( oss, std::forward< Ts >( ts )... );
      return std::move( oss ).str();
   }

}  // namespace tao::json

#endif
