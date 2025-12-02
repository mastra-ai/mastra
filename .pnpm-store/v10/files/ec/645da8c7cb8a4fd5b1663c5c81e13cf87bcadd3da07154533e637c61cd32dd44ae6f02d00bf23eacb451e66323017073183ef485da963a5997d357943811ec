// Copyright (c) 2020-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_TRACE_HPP
#define TAO_PEGTL_CONTRIB_TRACE_HPP

#include <cstddef>
#include <iomanip>
#include <iostream>
#include <string_view>
#include <tuple>

#include "state_control.hpp"

#include "../apply_mode.hpp"
#include "../config.hpp"
#include "../demangle.hpp"
#include "../normal.hpp"
#include "../nothing.hpp"
#include "../parse.hpp"
#include "../rewind_mode.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   template< bool HideInternal = false, bool UseColor = true, std::size_t IndentIncrement = 2, std::size_t InitialIndent = 8 >
   struct tracer_traits
   {
      template< typename Rule >
      static constexpr bool enable = ( HideInternal ? normal< Rule >::enable : true );

      static constexpr std::size_t initial_indent = InitialIndent;
      static constexpr std::size_t indent_increment = IndentIncrement;

      static constexpr std::string_view ansi_reset = UseColor ? "\033[m" : "";
      static constexpr std::string_view ansi_rule = UseColor ? "\033[36m" : "";
      static constexpr std::string_view ansi_hide = UseColor ? "\033[37m" : "";

      static constexpr std::string_view ansi_position = UseColor ? "\033[1;34m" : "";
      static constexpr std::string_view ansi_success = UseColor ? "\033[32m" : "";
      static constexpr std::string_view ansi_failure = UseColor ? "\033[31m" : "";
      static constexpr std::string_view ansi_raise = UseColor ? "\033[1;31m" : "";
      static constexpr std::string_view ansi_unwind = UseColor ? "\033[31m" : "";
      static constexpr std::string_view ansi_apply = UseColor ? "\033[1;36m" : "";
   };

   using standard_tracer_traits = tracer_traits< true >;
   using complete_tracer_traits = tracer_traits< false >;

   template< typename TracerTraits >
   struct tracer
   {
      const std::ios_base::fmtflags m_flags;
      std::size_t m_count = 0;
      std::vector< std::size_t > m_stack;
      position m_position;

      template< typename Rule >
      static constexpr bool enable = TracerTraits::template enable< Rule >;

      template< typename ParseInput >
      explicit tracer( const ParseInput& in )
         : m_flags( std::cerr.flags() ),
           m_position( in.position() )
      {
         std::cerr << std::left;
         print_position();
      }

      tracer( const tracer& ) = delete;
      tracer( tracer&& ) = delete;

      ~tracer()
      {
         std::cerr.flags( m_flags );
      }

      tracer& operator=( const tracer& ) = delete;
      tracer& operator=( tracer&& ) = delete;

      [[nodiscard]] std::size_t indent() const noexcept
      {
         return TracerTraits::initial_indent + TracerTraits::indent_increment * m_stack.size();
      }

      void print_position() const
      {
         std::cerr << std::setw( indent() ) << ' ' << TracerTraits::ansi_position << "position" << TracerTraits::ansi_reset << ' ' << m_position << '\n';
      }

      void update_position( const position& p )
      {
         if( m_position != p ) {
            m_position = p;
            print_position();
         }
      }

      template< typename Rule, typename ParseInput, typename... States >
      void start( const ParseInput& /*unused*/, States&&... /*unused*/ )
      {
         std::cerr << '#' << std::setw( indent() - 1 ) << ++m_count << TracerTraits::ansi_rule << demangle< Rule >() << TracerTraits::ansi_reset << '\n';
         m_stack.push_back( m_count );
      }

      template< typename Rule, typename ParseInput, typename... States >
      void success( const ParseInput& in, States&&... /*unused*/ )
      {
         const auto prev = m_stack.back();
         m_stack.pop_back();
         std::cerr << std::setw( indent() ) << ' ' << TracerTraits::ansi_success << "success" << TracerTraits::ansi_reset;
         if( m_count != prev ) {
            std::cerr << " #" << prev << ' ' << TracerTraits::ansi_hide << demangle< Rule >() << TracerTraits::ansi_reset;
         }
         std::cerr << '\n';
         update_position( in.position() );
      }

      template< typename Rule, typename ParseInput, typename... States >
      void failure( const ParseInput& in, States&&... /*unused*/ )
      {
         const auto prev = m_stack.back();
         m_stack.pop_back();
         std::cerr << std::setw( indent() ) << ' ' << TracerTraits::ansi_failure << "failure" << TracerTraits::ansi_reset;
         if( m_count != prev ) {
            std::cerr << " #" << prev << ' ' << TracerTraits::ansi_hide << demangle< Rule >() << TracerTraits::ansi_reset;
         }
         std::cerr << '\n';
         update_position( in.position() );
      }

      template< typename Rule, typename ParseInput, typename... States >
      void raise( const ParseInput& /*unused*/, States&&... /*unused*/ )
      {
         std::cerr << std::setw( indent() ) << ' ' << TracerTraits::ansi_raise << "raise" << TracerTraits::ansi_reset << ' ' << TracerTraits::ansi_rule << demangle< Rule >() << TracerTraits::ansi_reset << '\n';
      }

      template< typename Rule, typename ParseInput, typename... States >
      void unwind( const ParseInput& in, States&&... /*unused*/ )
      {
         const auto prev = m_stack.back();
         m_stack.pop_back();
         std::cerr << std::setw( indent() ) << ' ' << TracerTraits::ansi_unwind << "unwind" << TracerTraits::ansi_reset;
         if( m_count != prev ) {
            std::cerr << " #" << prev << ' ' << TracerTraits::ansi_hide << demangle< Rule >() << TracerTraits::ansi_reset;
         }
         std::cerr << '\n';
         update_position( in.position() );
      }

      template< typename Rule, typename ParseInput, typename... States >
      void apply( const ParseInput& /*unused*/, States&&... /*unused*/ )
      {
         std::cerr << std::setw( static_cast< int >( indent() - TracerTraits::indent_increment ) ) << ' ' << TracerTraits::ansi_apply << "apply" << TracerTraits::ansi_reset << '\n';
      }

      template< typename Rule, typename ParseInput, typename... States >
      void apply0( const ParseInput& /*unused*/, States&&... /*unused*/ )
      {
         std::cerr << std::setw( static_cast< int >( indent() - TracerTraits::indent_increment ) ) << ' ' << TracerTraits::ansi_apply << "apply0" << TracerTraits::ansi_reset << '\n';
      }

      template< typename Rule,
                template< typename... > class Action = nothing,
                template< typename... > class Control = normal,
                typename ParseInput,
                typename... States >
      bool parse( ParseInput&& in, States&&... st )
      {
         return TAO_PEGTL_NAMESPACE::parse< Rule, Action, state_control< Control >::template type >( in, st..., *this );
      }
   };

   template< typename Rule,
             template< typename... > class Action = nothing,
             template< typename... > class Control = normal,
             typename ParseInput,
             typename... States >
   bool standard_trace( ParseInput&& in, States&&... st )
   {
      tracer< standard_tracer_traits > tr( in );
      return tr.parse< Rule, Action, Control >( in, st... );
   }

   template< typename Rule,
             template< typename... > class Action = nothing,
             template< typename... > class Control = normal,
             typename ParseInput,
             typename... States >
   bool complete_trace( ParseInput&& in, States&&... st )
   {
      tracer< complete_tracer_traits > tr( in );
      return tr.parse< Rule, Action, Control >( in, st... );
   }

   template< typename Tracer >
   struct trace
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
         if constexpr( sizeof...( st ) == 0 ) {
            return TAO_PEGTL_NAMESPACE::match< Rule, A, M, Action, state_control< Control >::template type >( in, st..., Tracer( in ) );
         }
         else if constexpr( !std::is_same_v< std::tuple_element_t< sizeof...( st ) - 1, std::tuple< States... > >, Tracer& > ) {
            return TAO_PEGTL_NAMESPACE::match< Rule, A, M, Action, state_control< Control >::template type >( in, st..., Tracer( in ) );
         }
         else {
            return TAO_PEGTL_NAMESPACE::match< Rule, A, M, Action, Control >( in, st... );
         }
      }
   };

   using trace_standard = trace< tracer< standard_tracer_traits > >;
   using trace_complete = trace< tracer< complete_tracer_traits > >;

}  // namespace TAO_PEGTL_NAMESPACE

#endif
