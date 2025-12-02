// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_INTERNAL_STRING_T_HPP
#define TAO_JSON_INTERNAL_STRING_T_HPP

#include <string>
#include <string_view>

#include <tao/pegtl/internal/pegtl_string.hpp>

namespace tao::json::internal
{
   template< char... Cs >
   struct string_t
      : pegtl::string< Cs... >
   {
      static constexpr const char value[] = { Cs..., 0 };

      [[nodiscard]] static constexpr std::string_view as_string_view() noexcept
      {
         return std::string_view( value, sizeof...( Cs ) );
      }

      [[nodiscard]] static std::string as_string()
      {
         return std::string( value, sizeof...( Cs ) );
      }
   };

}  // namespace tao::json::internal

#define TAO_JSON_STRING_T( x ) TAO_PEGTL_INTERNAL_STRING( tao::json::internal::string_t, x )

#endif
