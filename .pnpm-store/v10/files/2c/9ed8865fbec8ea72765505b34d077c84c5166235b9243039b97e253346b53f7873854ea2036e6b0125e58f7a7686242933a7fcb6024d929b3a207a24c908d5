// Copyright (c) 2021-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_CHECK_BYTES_HPP
#define TAO_PEGTL_CONTRIB_CHECK_BYTES_HPP

#include "../apply_mode.hpp"
#include "../config.hpp"
#include "../match.hpp"
#include "../nothing.hpp"
#include "../rewind_mode.hpp"

#if defined( __cpp_exceptions )
#include "../parse_error.hpp"
#else
#include <cstdio>
#include <exception>
#endif

namespace TAO_PEGTL_NAMESPACE
{
   template< std::size_t Maximum >
   struct check_bytes
      : maybe_nothing
   {
      template< typename Rule,
                pegtl::apply_mode A,
                pegtl::rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename ParseInput,
                typename... States >
      static bool match( ParseInput& in, States&&... st )
      {
         const auto* start = in.current();
         if( TAO_PEGTL_NAMESPACE::match< Rule, A, M, Action, Control >( in, st... ) ) {
            if( std::size_t( in.current() - start ) > Maximum ) {
#if defined( __cpp_exceptions )
               throw TAO_PEGTL_NAMESPACE::parse_error( "maximum allowed rule consumption exceeded", in );
#else
               std::fputs( "maximum allowed rule consumption exceeded\n", stderr );
               std::terminate();
#endif
            }
            return true;
         }
         return false;
      }
   };

}  // namespace TAO_PEGTL_NAMESPACE

#endif
