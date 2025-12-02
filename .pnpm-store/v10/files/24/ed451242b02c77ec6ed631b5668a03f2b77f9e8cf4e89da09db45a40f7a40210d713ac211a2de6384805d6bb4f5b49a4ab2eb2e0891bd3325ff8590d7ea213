// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_EOF_HPP
#define TAO_PEGTL_INTERNAL_EOF_HPP

#include "../config.hpp"

#include "enable_control.hpp"

#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   struct eof
   {
      using rule_t = eof;
      using subs_t = empty_list;

      template< typename ParseInput >
      [[nodiscard]] static bool match( ParseInput& in ) noexcept( noexcept( in.empty() ) )
      {
         return in.empty();
      }
   };

   template<>
   inline constexpr bool enable_control< eof > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
