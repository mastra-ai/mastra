// Copyright (c) 2020-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_ANALYZE_HPP
#define TAO_PEGTL_CONTRIB_ANALYZE_HPP

#include <cassert>
#include <cstddef>
#include <iostream>
#include <map>
#include <set>
#include <stdexcept>
#include <string_view>
#include <utility>
#include <vector>

#include "../config.hpp"
#include "../demangle.hpp"

#include "analyze_traits.hpp"

#include "internal/set_stack_guard.hpp"
#include "internal/vector_stack_guard.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   namespace internal
   {
      struct analyze_entry
      {
         explicit analyze_entry( const analyze_type in_type ) noexcept
            : type( in_type )
         {}

         const analyze_type type;
         std::vector< std::string_view > subs;
      };

      class analyze_cycles_impl
      {
      public:
         analyze_cycles_impl( analyze_cycles_impl&& ) = delete;
         analyze_cycles_impl( const analyze_cycles_impl& ) = delete;

         ~analyze_cycles_impl() = default;

         analyze_cycles_impl& operator=( analyze_cycles_impl&& ) = delete;
         analyze_cycles_impl& operator=( const analyze_cycles_impl& ) = delete;

         [[nodiscard]] std::size_t problems()
         {
            for( auto& i : m_entries ) {
               assert( m_trace.empty() );
               assert( m_stack.empty() );
               m_results[ i.first ] = work( i, false );
            }
            // The number of problems returned is not very informative as some problems will be found multiple times.
            return m_problems;
         }

         template< typename Rule >
         [[nodiscard]] bool consumes() const
         {
            // The name "consumes" is a shortcut for "the analyze cycles algorithm could prove that this rule always consumes when it succeeds".
            return m_results.at( demangle< Rule >() );
         }

      protected:
         explicit analyze_cycles_impl( const int verbose ) noexcept
            : m_verbose( verbose ),
              m_problems( 0 )
         {}

         [[nodiscard]] const std::pair< const std::string_view, analyze_entry >& find( const std::string_view name ) const noexcept
         {
            const auto iter = m_entries.find( name );
            assert( iter != m_entries.end() );
            return *iter;
         }

         [[nodiscard]] bool work( const std::pair< const std::string_view, analyze_entry >& entry, const bool accum )
         {
            if( const auto g = set_stack_guard( m_stack, entry.first ) ) {
               const auto v = vector_stack_guard( m_trace, entry.first );
               switch( entry.second.type ) {
                  case analyze_type::any: {
                     bool a = false;
                     for( const auto& r : entry.second.subs ) {
                        a = a || work( find( r ), accum || a );
                     }
                     return true;
                  }
                  case analyze_type::opt: {
                     bool a = false;
                     for( const auto& r : entry.second.subs ) {
                        a = a || work( find( r ), accum || a );
                     }
                     return false;
                  }
                  case analyze_type::seq: {
                     bool a = false;
                     for( const auto& r : entry.second.subs ) {
                        a = a || work( find( r ), accum || a );
                     }
                     return a;
                  }
                  case analyze_type::sor: {
                     bool a = true;
                     for( const auto& r : entry.second.subs ) {
                        a = a && work( find( r ), accum );
                     }
                     return a;
                  }
               }
               assert( false );  // LCOV_EXCL_LINE
            }
            assert( !m_trace.empty() );

            if( !accum ) {
               ++m_problems;
               // LCOV_EXCL_START
               if( ( m_verbose >= 0 ) && ( m_trace.front() == entry.first ) ) {
                  for( const auto& r : m_trace ) {
                     if( r < entry.first ) {
                        return accum;
                     }
                  }
                  std::cerr << "WARNING: Possible cycle without progress at rule " << entry.first << std::endl;
                  if( m_verbose > 0 ) {
                     for( const auto& r : m_trace ) {
                        std::cerr << "- involved (transformed) rule: " << r << std::endl;
                     }
                  }
               }
               // LCOV_EXCL_STOP
            }
            return accum;
         }

         const int m_verbose;

         std::size_t m_problems;

         std::set< std::string_view > m_stack;
         std::vector< std::string_view > m_trace;
         std::map< std::string_view, bool > m_results;
         std::map< std::string_view, analyze_entry > m_entries;
      };

      template< typename Name >
      std::string_view analyze_insert( std::map< std::string_view, analyze_entry >& entry )
      {
         using Traits = analyze_traits< Name, typename Name::rule_t >;

         const auto [ i, b ] = entry.try_emplace( demangle< Name >(), Traits::type_v );
         if( b ) {
            analyze_insert_impl( typename Traits::subs_t(), i->second.subs, entry );
         }
         return i->first;
      }

      template< typename... Subs >
      void analyze_insert_impl( type_list< Subs... > /*unused*/, std::vector< std::string_view >& subs, std::map< std::string_view, analyze_entry >& entry )
      {
         ( subs.emplace_back( analyze_insert< Subs >( entry ) ), ... );
      }

      template< typename Grammar >
      struct analyze_cycles
         : analyze_cycles_impl
      {
         explicit analyze_cycles( const int verbose )
            : analyze_cycles_impl( verbose )
         {
            analyze_insert< Grammar >( m_entries );
         }
      };

   }  // namespace internal

   template< typename Grammar >
   [[nodiscard]] std::size_t analyze( const int verbose = 1 )
   {
      return internal::analyze_cycles< Grammar >( verbose ).problems();
   }

}  // namespace TAO_PEGTL_NAMESPACE

#endif
