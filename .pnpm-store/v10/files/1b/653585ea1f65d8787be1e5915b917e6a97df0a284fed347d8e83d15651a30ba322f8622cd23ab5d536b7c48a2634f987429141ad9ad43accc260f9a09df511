// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_UNWIND_GUARD_HPP
#define TAO_PEGTL_INTERNAL_UNWIND_GUARD_HPP

#include "../config.hpp"

#include <optional>
#include <utility>

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename Unwind >
   struct unwind_guard
   {
      explicit unwind_guard( Unwind&& unwind_impl )
         : unwind( std::move( unwind_impl ) )
      {}

      ~unwind_guard()
      {
         if( unwind ) {
            ( *unwind )();
         }
      }

      unwind_guard( const unwind_guard& ) = delete;
      unwind_guard( unwind_guard&& ) noexcept = delete;

      unwind_guard& operator=( const unwind_guard& ) = delete;
      unwind_guard& operator=( unwind_guard&& ) noexcept = delete;

      std::optional< Unwind > unwind;
   };

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
