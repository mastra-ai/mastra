// Copyright (c) 2016-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_DISCARD_HPP
#define TAO_PEGTL_INTERNAL_DISCARD_HPP

#include "../config.hpp"

#include "enable_control.hpp"

#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   struct discard
   {
      using rule_t = discard;
      using subs_t = empty_list;

      template< typename ParseInput >
      [[nodiscard]] static bool match( ParseInput& in ) noexcept
      {
         static_assert( noexcept( in.discard() ) );
         in.discard();
         return true;
      }
   };

   template<>
   inline constexpr bool enable_control< discard > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
