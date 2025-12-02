// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_BYTES_HPP
#define TAO_PEGTL_INTERNAL_BYTES_HPP

#include "../config.hpp"

#include "enable_control.hpp"
#include "success.hpp"

#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< unsigned Cnt >
   struct bytes
   {
      using rule_t = bytes;
      using subs_t = empty_list;

      template< typename ParseInput >
      [[nodiscard]] static bool match( ParseInput& in ) noexcept( noexcept( in.size( 0 ) ) )
      {
         if( in.size( Cnt ) >= Cnt ) {
            in.bump( Cnt );
            return true;
         }
         return false;
      }
   };

   template<>
   struct bytes< 0 >
      : success
   {};

   template< unsigned Cnt >
   inline constexpr bool enable_control< bytes< Cnt > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
