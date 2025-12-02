// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_TRY_CATCH_TYPE_HPP
#define TAO_PEGTL_INTERNAL_TRY_CATCH_TYPE_HPP

#if !defined( __cpp_exceptions )
#error "Exception support required for tao/pegtl/internal/try_catch_type.hpp"
#else

#include <type_traits>

#include "../config.hpp"

#include "enable_control.hpp"
#include "seq.hpp"
#include "success.hpp"

#include "../apply_mode.hpp"
#include "../rewind_mode.hpp"
#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename Exception, typename... Rules >
   struct try_catch_type
      : try_catch_type< Exception, seq< Rules... > >
   {};

   template< typename Exception >
   struct try_catch_type< Exception >
      : success
   {};

   template< typename Exception, typename Rule >
   struct try_catch_type< Exception, Rule >
   {
      using rule_t = try_catch_type;
      using subs_t = type_list< Rule >;

      template< apply_mode A,
                rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename ParseInput,
                typename... States >
      [[nodiscard]] static bool match( ParseInput& in, States&&... st )
      {
         auto m = in.template mark< M >();
         using m_t = decltype( m );

         try {
            return m( Control< Rule >::template match< A, m_t::next_rewind_mode, Action, Control >( in, st... ) );
         }
         catch( const Exception& ) {
            return false;
         }
      }
   };

   template< typename Exception, typename... Rules >
   inline constexpr bool enable_control< try_catch_type< Exception, Rules... > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
#endif
