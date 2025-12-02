// Copyright (c) 2017-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_PARSE_TREE_HPP
#define TAO_PEGTL_CONTRIB_PARSE_TREE_HPP

#include <cassert>
#include <memory>
#include <string>
#include <string_view>
#include <tuple>
#include <type_traits>
#include <typeindex>
#include <utility>
#include <vector>

#include "remove_first_state.hpp"
#include "shuffle_states.hpp"

#include "../apply_mode.hpp"
#include "../config.hpp"
#include "../demangle.hpp"
#include "../memory_input.hpp"
#include "../normal.hpp"
#include "../nothing.hpp"
#include "../parse.hpp"
#include "../rewind_mode.hpp"

#include "../internal/enable_control.hpp"
#include "../internal/has_unwind.hpp"
#include "../internal/iterator.hpp"

namespace TAO_PEGTL_NAMESPACE::parse_tree
{
   template< typename T, typename Source = std::string_view >
   struct basic_node
   {
      using node_t = T;
      using children_t = std::vector< std::unique_ptr< node_t > >;
      children_t children;

      std::string_view type;
      Source source;

      TAO_PEGTL_NAMESPACE::internal::iterator m_begin;
      TAO_PEGTL_NAMESPACE::internal::iterator m_end;

      // each node will be default constructed
      basic_node() = default;

      // no copy/move is necessary
      // (nodes are always owned/handled by a std::unique_ptr)
      basic_node( const basic_node& ) = delete;
      basic_node( basic_node&& ) = delete;

      ~basic_node() = default;

      // no assignment either
      basic_node& operator=( const basic_node& ) = delete;
      basic_node& operator=( basic_node&& ) = delete;

      [[nodiscard]] bool is_root() const noexcept
      {
         return type.empty();
      }

      template< typename U >
      [[nodiscard]] bool is_type() const noexcept
      {
         const auto u = demangle< U >();
         return ( ( type.data() == u.data() ) && ( type.size() == u.size() ) ) || ( type == u );
      }

      template< typename U >
      void set_type() noexcept
      {
         type = demangle< U >();
      }

      [[nodiscard]] position begin() const
      {
         return position( m_begin, source );
      }

      [[nodiscard]] position end() const
      {
         return position( m_end, source );
      }

      [[nodiscard]] bool has_content() const noexcept
      {
         return m_end.data != nullptr;
      }

      [[nodiscard]] std::string_view string_view() const noexcept
      {
         assert( has_content() );
         return std::string_view( m_begin.data, m_end.data - m_begin.data );
      }

      [[nodiscard]] std::string string() const
      {
         assert( has_content() );
         return std::string( m_begin.data, m_end.data );
      }

      template< tracking_mode P = tracking_mode::eager, typename Eol = eol::lf_crlf >
      [[nodiscard]] memory_input< P, Eol > as_memory_input() const
      {
         assert( has_content() );
         return { m_begin.data, m_end.data, source, m_begin.byte, m_begin.line, m_begin.column };
      }

      template< typename... States >
      void remove_content( States&&... /*unused*/ ) noexcept
      {
         m_end = TAO_PEGTL_NAMESPACE::internal::iterator();
      }

      // all non-root nodes are initialized by calling this method
      template< typename Rule, typename ParseInput, typename... States >
      void start( const ParseInput& in, States&&... /*unused*/ )
      {
         set_type< Rule >();
         source = in.source();
         m_begin = TAO_PEGTL_NAMESPACE::internal::iterator( in.iterator() );
      }

      // if parsing of the rule succeeded, this method is called
      template< typename Rule, typename ParseInput, typename... States >
      void success( const ParseInput& in, States&&... /*unused*/ ) noexcept
      {
         m_end = TAO_PEGTL_NAMESPACE::internal::iterator( in.iterator() );
      }

      // if parsing of the rule failed, this method is called
      template< typename Rule, typename ParseInput, typename... States >
      void failure( const ParseInput& /*unused*/, States&&... /*unused*/ ) noexcept
      {}

      // if parsing succeeded and the (optional) transform call
      // did not discard the node, it is appended to its parent.
      // note that "child" is the node whose Rule just succeeded
      // and "*this" is the parent where the node should be appended.
      template< typename... States >
      void emplace_back( std::unique_ptr< node_t >&& child, States&&... /*unused*/ )
      {
         assert( child );
         children.emplace_back( std::move( child ) );
      }
   };

   struct node
      : basic_node< node >
   {};

   namespace internal
   {
      template< typename Node >
      struct state
      {
         std::vector< std::unique_ptr< Node > > stack;

         state()
         {
            emplace_back();
         }

         void emplace_back()
         {
            stack.emplace_back( std::make_unique< Node >() );
         }

         [[nodiscard]] std::unique_ptr< Node >& back() noexcept
         {
            assert( !stack.empty() );
            return stack.back();
         }

         void pop_back() noexcept
         {
            assert( !stack.empty() );
            return stack.pop_back();
         }
      };

      template< typename Selector, typename... Parameters >
      void transform( Parameters&&... /*unused*/ ) noexcept
      {}

      template< typename Selector, typename ParseInput, typename Node, typename... States >
      auto transform( const ParseInput& in, std::unique_ptr< Node >& n, States&&... st ) noexcept( noexcept( Selector::transform( in, n, st... ) ) )
         -> decltype( (void)Selector::transform( in, n, st... ) )
      {
         Selector::transform( in, n, st... );
      }

      template< typename Selector, typename ParseInput, typename Node, typename... States >
      auto transform( const ParseInput& /*unused*/, std::unique_ptr< Node >& n, States&&... st ) noexcept( noexcept( Selector::transform( n, st... ) ) )
         -> decltype( (void)Selector::transform( n, st... ) )
      {
         Selector::transform( n, st... );
      }

      template< typename Rule, template< typename... > class Selector >
      inline constexpr bool is_selected_node = ( TAO_PEGTL_NAMESPACE::internal::enable_control< Rule > && Selector< Rule >::value );

      template< unsigned Level, typename Subs, template< typename... > class Selector >
      inline constexpr bool is_leaf{};

      template< typename... Rules, template< typename... > class Selector >
      inline constexpr bool is_leaf< 0, type_list< Rules... >, Selector > = ( sizeof...( Rules ) == 0 );

      template< unsigned Level, typename Rule, template< typename... > class Selector >
      inline constexpr bool is_unselected_branch = ( !is_selected_node< Rule, Selector > && is_leaf< Level, typename Rule::subs_t, Selector > );

      template< unsigned Level, typename... Rules, template< typename... > class Selector >
      inline constexpr bool is_leaf< Level, type_list< Rules... >, Selector > = ( is_unselected_branch< Level - 1, Rules, Selector > && ... );

      template< typename Node, template< typename... > class Selector, template< typename... > class Control >
      struct make_control
      {
         template< typename Rule, bool, bool >
         struct state_handler;

         template< typename Rule >
         using type = rotate_states_right< state_handler< Rule, is_selected_node< Rule, Selector >, is_leaf< 8, typename Rule::subs_t, Selector > > >;
      };

      template< typename, typename, typename... >
      inline constexpr bool node_has_unwind = false;

      template< typename Node, typename Rule, typename... States >
      inline constexpr bool node_has_unwind< Node,
                                             Rule,
                                             decltype( std::declval< Node >().template unwind< Rule >( std::declval< States >()... ) ),
                                             States... > = true;

      template< typename Control, typename... States >
      inline constexpr bool control_has_unwind = TAO_PEGTL_NAMESPACE::internal::has_unwind< Control, void, States... >;

      template< typename Node, template< typename... > class Selector, template< typename... > class Control >
      template< typename Rule >
      struct make_control< Node, Selector, Control >::state_handler< Rule, false, true >
         : remove_first_state< Control< Rule > >
      {};

      template< typename Node, template< typename... > class Selector, template< typename... > class Control >
      template< typename Rule >
      struct make_control< Node, Selector, Control >::state_handler< Rule, false, false >
         : remove_first_state< Control< Rule > >
      {
         static constexpr bool enable = true;

         template< typename ParseInput, typename... States >
         static void start( const ParseInput& /*unused*/, state< Node >& state, States&&... /*unused*/ )
         {
            state.emplace_back();
         }

         template< typename ParseInput, typename... States >
         static void success( const ParseInput& /*unused*/, state< Node >& state, States&&... /*unused*/ )
         {
            auto n = std::move( state.back() );
            state.pop_back();
            for( auto& c : n->children ) {
               state.back()->children.emplace_back( std::move( c ) );
            }
         }

         template< typename ParseInput, typename... States >
         static void failure( const ParseInput& /*unused*/, state< Node >& state, States&&... /*unused*/ )
         {
            state.pop_back();
         }

         template< typename ParseInput, typename... States >
         static void unwind( const ParseInput& /*unused*/, state< Node >& state, States&&... /*unused*/ )
         {
            state.pop_back();
         }
      };

      template< typename Node, template< typename... > class Selector, template< typename... > class Control >
      template< typename Rule, bool B >
      struct make_control< Node, Selector, Control >::state_handler< Rule, true, B >
         : remove_first_state< Control< Rule > >
      {
         template< typename ParseInput, typename... States >
         static void start( const ParseInput& in, state< Node >& state, States&&... st )
         {
            Control< Rule >::start( in, st... );
            state.emplace_back();
            state.back()->template start< Rule >( in, st... );
         }

         template< typename ParseInput, typename... States >
         static void success( const ParseInput& in, state< Node >& state, States&&... st )
         {
            auto n = std::move( state.back() );
            state.pop_back();
            n->template success< Rule >( in, st... );
            transform< Selector< Rule > >( in, n, st... );
            if( n ) {
               state.back()->emplace_back( std::move( n ), st... );
            }
            Control< Rule >::success( in, st... );
         }

         template< typename ParseInput, typename... States >
         static void failure( const ParseInput& in, state< Node >& state, States&&... st )
         {
            state.back()->template failure< Rule >( in, st... );
            state.pop_back();
            Control< Rule >::failure( in, st... );
         }

         template< typename ParseInput, typename... States >
         static void unwind( [[maybe_unused]] const ParseInput& in, [[maybe_unused]] state< Node >& state, States&&... st )
         {
            if constexpr( node_has_unwind< Node, Rule, void, const ParseInput&, States... > ) {
               state.back()->template unwind< Rule >( in, st... );
            }
            state.pop_back();
            if constexpr( control_has_unwind< Control< Rule >, const ParseInput&, States... > ) {
               Control< Rule >::unwind( in, st... );
            }
#if defined( _MSC_VER )
            ( (void)st,
              ... );
#endif
         }
      };

      template< typename >
      using store_all = std::true_type;

      template< typename >
      struct selector;

      template< typename T >
      struct selector< std::tuple< T > >
      {
         using type = typename T::type;
      };

      template< typename... Ts >
      struct selector< std::tuple< Ts... > >
      {
         static_assert( sizeof...( Ts ) == 0, "multiple matches found" );
         using type = std::false_type;
      };

      template< typename T >
      using selector_t = typename selector< T >::type;

      template< typename Rule, typename Collection >
      using select_tuple = std::conditional_t< Collection::template contains< Rule >, std::tuple< Collection >, std::tuple<> >;

   }  // namespace internal

   template< typename Rule, typename... Collections >
   using selector = internal::selector_t< decltype( std::tuple_cat( std::declval< internal::select_tuple< Rule, Collections > >()... ) ) >;

   template< typename Base >
   struct apply
      : std::true_type
   {
      template< typename... Rules >
      struct on
      {
         using type = Base;

         template< typename Rule >
         static constexpr bool contains = ( std::is_same_v< Rule, Rules > || ... );
      };
   };

   struct store_content
      : apply< store_content >
   {};

   // some nodes don't need to store their content
   struct remove_content
      : apply< remove_content >
   {
      template< typename Node, typename... States >
      static void transform( std::unique_ptr< Node >& n, States&&... st ) noexcept( noexcept( n->Node::remove_content( st... ) ) )
      {
         n->remove_content( st... );
      }
   };

   // if a node has only one child, replace the node with its child, otherwise remove content
   struct fold_one
      : apply< fold_one >
   {
      template< typename Node, typename... States >
      static void transform( std::unique_ptr< Node >& n, States&&... st ) noexcept( noexcept( n->children.size(), n->Node::remove_content( st... ) ) )
      {
         if( n->children.size() == 1 ) {
            n = std::move( n->children.front() );
         }
         else {
            n->remove_content( st... );
         }
      }
   };

   // if a node has no children, discard the node, otherwise remove content
   struct discard_empty
      : apply< discard_empty >
   {
      template< typename Node, typename... States >
      static void transform( std::unique_ptr< Node >& n, States&&... st ) noexcept( noexcept( (void)n->children.empty(), n->Node::remove_content( st... ) ) )
      {
         if( n->children.empty() ) {
            n.reset();
         }
         else {
            n->remove_content( st... );
         }
      }
   };

   template< typename Rule,
             typename Node,
             template< typename... > class Selector = internal::store_all,
             template< typename... > class Action = nothing,
             template< typename... > class Control = normal,
             typename ParseInput,
             typename... States >
   [[nodiscard]] std::unique_ptr< Node > parse( ParseInput&& in, States&&... st )
   {
      internal::state< Node > state;
      if( !TAO_PEGTL_NAMESPACE::parse< Rule, Action, internal::make_control< Node, Selector, Control >::template type >( in, st..., state ) ) {
         return nullptr;
      }
      assert( state.stack.size() == 1 );
      return std::move( state.back() );
   }

   template< typename Rule,
             template< typename... > class Selector = internal::store_all,
             template< typename... > class Action = nothing,
             template< typename... > class Control = normal,
             typename ParseInput,
             typename... States >
   [[nodiscard]] std::unique_ptr< node > parse( ParseInput&& in, States&&... st )
   {
      return parse< Rule, node, Selector, Action, Control >( in, st... );
   }

}  // namespace TAO_PEGTL_NAMESPACE::parse_tree

#endif
