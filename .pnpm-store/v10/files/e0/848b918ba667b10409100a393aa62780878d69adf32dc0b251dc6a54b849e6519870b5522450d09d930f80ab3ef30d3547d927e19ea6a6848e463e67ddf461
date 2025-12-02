// Copyright (c) 2020-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_COVERAGE_HPP
#define TAO_PEGTL_CONTRIB_COVERAGE_HPP

#include <cstddef>
#include <map>
#include <string_view>
#include <vector>

#include "state_control.hpp"

#include "../apply_mode.hpp"
#include "../config.hpp"
#include "../demangle.hpp"
#include "../normal.hpp"
#include "../nothing.hpp"
#include "../parse.hpp"
#include "../rewind_mode.hpp"
#include "../type_list.hpp"
#include "../visit.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   struct coverage_info
   {
      std::size_t start = 0;
      std::size_t success = 0;
      std::size_t failure = 0;
      std::size_t unwind = 0;
      std::size_t raise = 0;
   };

   struct coverage_entry
      : coverage_info
   {
      std::map< std::string_view, coverage_info > branches;
   };

   using coverage_result = std::map< std::string_view, coverage_entry >;

   namespace internal
   {
      template< typename Rule >
      struct coverage_insert
      {
         static void visit( std::map< std::string_view, coverage_entry >& map )
         {
            visit_branches( map.try_emplace( demangle< Rule >() ).first->second.branches, typename Rule::subs_t() );
         }

         template< typename... Ts >
         static void visit_branches( std::map< std::string_view, coverage_info >& branches, type_list< Ts... > /*unused*/ )
         {
            ( branches.try_emplace( demangle< Ts >() ), ... );
         }
      };

      struct coverage_state
      {
         template< typename Rule >
         static constexpr bool enable = true;

         explicit coverage_state( coverage_result& in_result )
            : result( in_result )
         {}

         coverage_result& result;
         std::vector< std::string_view > stack;

         template< typename Rule, typename ParseInput, typename... States >
         void start( const ParseInput& /*unused*/, States&&... /*unused*/ )
         {
            const auto name = demangle< Rule >();
            ++result.at( name ).start;
            if( !stack.empty() ) {
               ++result.at( stack.back() ).branches.at( name ).start;
            }
            stack.push_back( name );
         }

         template< typename Rule, typename ParseInput, typename... States >
         void success( const ParseInput& /*unused*/, States&&... /*unused*/ )
         {
            stack.pop_back();
            const auto name = demangle< Rule >();
            ++result.at( name ).success;
            if( !stack.empty() ) {
               ++result.at( stack.back() ).branches.at( name ).success;
            }
         }

         template< typename Rule, typename ParseInput, typename... States >
         void failure( const ParseInput& /*unused*/, States&&... /*unused*/ )
         {
            stack.pop_back();
            const auto name = demangle< Rule >();
            ++result.at( name ).failure;
            if( !stack.empty() ) {
               ++result.at( stack.back() ).branches.at( name ).failure;
            }
         }

         template< typename Rule, typename ParseInput, typename... States >
         void raise( const ParseInput& /*unused*/, States&&... /*unused*/ )
         {
            const auto name = demangle< Rule >();
            ++result.at( name ).raise;
            if( !stack.empty() ) {
               ++result.at( stack.back() ).branches.at( name ).raise;
            }
         }

         template< typename Rule, typename ParseInput, typename... States >
         void unwind( const ParseInput& /*unused*/, States&&... /*unused*/ )
         {
            stack.pop_back();
            const auto name = demangle< Rule >();
            ++result.at( name ).unwind;
            if( !stack.empty() ) {
               ++result.at( stack.back() ).branches.at( name ).unwind;
            }
         }

         template< typename Rule, typename ParseInput, typename... States >
         void apply( const ParseInput& /*unused*/, States&&... /*unused*/ ) noexcept
         {}

         template< typename Rule, typename ParseInput, typename... States >
         void apply0( const ParseInput& /*unused*/, States&&... /*unused*/ ) noexcept
         {}
      };

   }  // namespace internal

   template< typename Rule,
             template< typename... > class Action = nothing,
             template< typename... > class Control = normal,
             typename ParseInput,
             typename... States >
   bool coverage( ParseInput&& in, coverage_result& result, States&&... st )
   {
      internal::coverage_state state( result );
      visit< Rule, internal::coverage_insert >( state.result );  // Fill map with all sub-rules of the grammar.
      return parse< Rule, Action, state_control< Control >::template type >( in, st..., state );
   }

}  // namespace TAO_PEGTL_NAMESPACE

#endif
