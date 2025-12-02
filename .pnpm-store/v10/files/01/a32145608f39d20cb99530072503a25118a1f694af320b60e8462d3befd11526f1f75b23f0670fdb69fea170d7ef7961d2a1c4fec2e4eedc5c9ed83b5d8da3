// Copyright (c) 2017-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_BOF_HPP
#define TAO_PEGTL_INTERNAL_BOF_HPP

#include "../config.hpp"

#include "enable_control.hpp"

#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   struct bof
   {
      using rule_t = bof;
      using subs_t = empty_list;

      template< typename ParseInput >
      [[nodiscard]] static bool match( ParseInput& in ) noexcept
      {
         return in.byte() == 0;
      }
   };

   template<>
   inline constexpr bool enable_control< bof > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
