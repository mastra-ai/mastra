// Copyright (c) 2017-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_BOL_HPP
#define TAO_PEGTL_INTERNAL_BOL_HPP

#include "../config.hpp"
#include "../type_list.hpp"

#include "enable_control.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   struct bol
   {
      using rule_t = bol;
      using subs_t = empty_list;

      template< typename ParseInput >
      [[nodiscard]] static bool match( ParseInput& in ) noexcept
      {
         return in.column() == 1;
      }
   };

   template<>
   inline constexpr bool enable_control< bol > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
