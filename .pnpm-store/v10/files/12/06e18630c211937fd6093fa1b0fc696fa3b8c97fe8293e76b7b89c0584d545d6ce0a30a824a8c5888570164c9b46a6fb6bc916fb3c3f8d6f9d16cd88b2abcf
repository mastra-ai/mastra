// Copyright (c) 2021-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_LIMIT_BYTES_HPP
#define TAO_PEGTL_CONTRIB_LIMIT_BYTES_HPP

#include <algorithm>

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
   namespace internal
   {
      template< std::size_t Maximum, typename MemoryInput >
      struct [[nodiscard]] bytes_guard
      {
         MemoryInput& m_in;
         const char* m_end;

         explicit bytes_guard( MemoryInput& in_in ) noexcept
            : m_in( in_in ),
              m_end( in_in.end() )
         {
            m_in.private_set_end( m_in.begin() + std::min( m_in.size(), Maximum ) );
         }

         bytes_guard( bytes_guard&& ) = delete;
         bytes_guard( const bytes_guard& ) = delete;

         ~bytes_guard()
         {
            m_in.private_set_end( m_end );
         }

         bytes_guard& operator=( bytes_guard&& ) = delete;
         bytes_guard& operator=( const bytes_guard& ) = delete;
      };

      // C++17 does not allow for partial deduction guides.

   }  // namespace internal

   template< std::size_t Maximum >
   struct limit_bytes
      : maybe_nothing
   {
      template< typename Rule,
                apply_mode A,
                rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename ParseInput,
                typename... States >
      [[nodiscard]] static bool match( ParseInput& in, States&&... st )
      {
         internal::bytes_guard< Maximum, ParseInput > bg( in );
         if( TAO_PEGTL_NAMESPACE::match< Rule, A, M, Action, Control >( in, st... ) ) {
            if( in.empty() && ( bg.m_end != in.current() ) ) {
#if defined( __cpp_exceptions )
               throw TAO_PEGTL_NAMESPACE::parse_error( "maximum allowed rule consumption reached", in );
#else
               std::fputs( "maximum allowed rule consumption reached\n", stderr );
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
