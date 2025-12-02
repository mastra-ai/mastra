// Copyright (c) 2020-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_MUST_IF_HPP
#define TAO_PEGTL_MUST_IF_HPP

#if !defined( __cpp_exceptions )
#error "Exception support required for tao/pegtl/internal/must.hpp"
#else

#include <type_traits>

#include "config.hpp"
#include "normal.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   namespace internal
   {
      template< typename Errors, typename Rule, typename = void >
      inline constexpr bool raise_on_failure = ( Errors::template message< Rule > != nullptr );

      template< typename Errors, typename Rule >
      inline constexpr bool raise_on_failure< Errors, Rule, std::void_t< decltype( Errors::template raise_on_failure< Rule > ) > > = Errors::template raise_on_failure< Rule >;

   }  // namespace internal

   template< typename Errors, template< typename... > class Base = normal, bool RequireMessage = true >
   struct must_if
   {
      template< typename Rule >
      struct control
         : Base< Rule >
      {
         template< typename ParseInput, typename... States >
         static void failure( const ParseInput& in, States&&... st ) noexcept( noexcept( Base< Rule >::failure( in, st... ) ) && !internal::raise_on_failure< Errors, Rule > )
         {
            if constexpr( internal::raise_on_failure< Errors, Rule > ) {
               raise( in, st... );
            }
            else {
               Base< Rule >::failure( in, st... );
            }
         }

         template< typename ParseInput, typename... States >
         [[noreturn]] static void raise( const ParseInput& in, [[maybe_unused]] States&&... st )
         {
            if constexpr( RequireMessage ) {
               static_assert( Errors::template message< Rule > != nullptr );
            }
            if constexpr( Errors::template message< Rule > != nullptr ) {
               constexpr const char* p = Errors::template message< Rule >;
               throw parse_error( p, in );
#if defined( _MSC_VER )
               ( (void)st, ... );
#endif
            }
            else {
               Base< Rule >::raise( in, st... );
            }
         }
      };
   };

}  // namespace TAO_PEGTL_NAMESPACE

#endif
#endif
