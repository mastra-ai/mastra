// Copyright (c) 2020-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_SHUFFLE_STATES_HPP
#define TAO_PEGTL_CONTRIB_SHUFFLE_STATES_HPP

#include <tuple>
#include <type_traits>
#include <utility>

#include "../config.hpp"

#include "../internal/has_unwind.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   namespace internal
   {
      template< std::size_t N >
      struct rotate_left
      {
         template< std::size_t I, std::size_t S >
         static constexpr std::size_t value = ( I + N ) % S;
      };

      template< std::size_t N >
      struct rotate_right
      {
         template< std::size_t I, std::size_t S >
         static constexpr std::size_t value = ( I + S - N ) % S;
      };

      struct reverse
      {
         template< std::size_t I, std::size_t S >
         static constexpr std::size_t value = ( S - 1 ) - I;
      };

   }  // namespace internal

   // Applies 'Shuffle' to the states of start(), success(), failure(), raise(), apply(), and apply0()
   template< typename Base, typename Shuffle >
   struct shuffle_states
      : Base
   {
      template< typename ParseInput, typename Tuple, std::size_t... Is >
      static void start_impl( const ParseInput& in, const Tuple& t, std::index_sequence< Is... > /*unused*/ ) noexcept( noexcept( Base::start( in, std::get< Shuffle::template value< Is, sizeof...( Is ) > >( t )... ) ) )
      {
         Base::start( in, std::get< Shuffle::template value< Is, sizeof...( Is ) > >( t )... );
      }

      template< typename ParseInput, typename... States >
      static void start( const ParseInput& in, States&&... st ) noexcept( noexcept( start_impl( in, std::tie( st... ), std::make_index_sequence< sizeof...( st ) >() ) ) )
      {
         start_impl( in, std::tie( st... ), std::make_index_sequence< sizeof...( st ) >() );
      }

      template< typename ParseInput, typename State >
      static void start( const ParseInput& in, State&& st ) noexcept( noexcept( Base::start( in, st ) ) )
      {
         Base::start( in, st );
      }

      template< typename ParseInput, typename Tuple, std::size_t... Is >
      static void success_impl( const ParseInput& in, const Tuple& t, std::index_sequence< Is... > /*unused*/ ) noexcept( noexcept( Base::success( in, std::get< Shuffle::template value< Is, sizeof...( Is ) > >( t )... ) ) )
      {
         Base::success( in, std::get< Shuffle::template value< Is, sizeof...( Is ) > >( t )... );
      }

      template< typename ParseInput, typename... States >
      static void success( const ParseInput& in, States&&... st ) noexcept( noexcept( success_impl( in, std::tie( st... ), std::make_index_sequence< sizeof...( st ) >() ) ) )
      {
         success_impl( in, std::tie( st... ), std::make_index_sequence< sizeof...( st ) >() );
      }

      template< typename ParseInput, typename State >
      static void success( const ParseInput& in, State&& st ) noexcept( noexcept( Base::success( in, st ) ) )
      {
         Base::success( in, st );
      }

      template< typename ParseInput, typename Tuple, std::size_t... Is >
      static void failure_impl( const ParseInput& in, const Tuple& t, std::index_sequence< Is... > /*unused*/ ) noexcept( noexcept( Base::failure( in, std::get< Shuffle::template value< Is, sizeof...( Is ) > >( t )... ) ) )
      {
         Base::failure( in, std::get< Shuffle::template value< Is, sizeof...( Is ) > >( t )... );
      }

      template< typename ParseInput, typename... States >
      static void failure( const ParseInput& in, States&&... st ) noexcept( noexcept( failure_impl( in, std::tie( st... ), std::make_index_sequence< sizeof...( st ) >() ) ) )
      {
         failure_impl( in, std::tie( st... ), std::make_index_sequence< sizeof...( st ) >() );
      }

      template< typename ParseInput, typename State >
      static void failure( const ParseInput& in, State&& st ) noexcept( noexcept( Base::failure( in, st ) ) )
      {
         Base::failure( in, st );
      }

      template< typename ParseInput, typename Tuple, std::size_t... Is >
      [[noreturn]] static void raise_impl( const ParseInput& in, const Tuple& t, std::index_sequence< Is... > /*unused*/ )
      {
         Base::raise( in, std::get< Shuffle::template value< Is, sizeof...( Is ) > >( t )... );
      }

      template< typename ParseInput, typename... States >
      [[noreturn]] static void raise( const ParseInput& in, States&&... st )
      {
         raise_impl( in, std::tie( st... ), std::make_index_sequence< sizeof...( st ) >() );
      }

      template< typename ParseInput, typename State >
      [[noreturn]] static void raise( const ParseInput& in, State&& st )
      {
         Base::raise( in, st );
      }

      template< typename ParseInput, typename Tuple, std::size_t... Is >
      static auto unwind_impl( const ParseInput& in, const Tuple& t, std::index_sequence< Is... > /*unused*/ )
         -> std::enable_if_t< internal::has_unwind< Base, void, const ParseInput&, std::tuple_element_t< Shuffle::template value< Is, sizeof...( Is ) >, Tuple >... > >
      {
         Base::unwind( in, std::get< Shuffle::template value< Is, sizeof...( Is ) > >( t )... );
      }

      template< typename ParseInput, typename... States >
      static auto unwind( const ParseInput& in, States&&... st )
         -> decltype( unwind_impl( in, std::tie( st... ), std::make_index_sequence< sizeof...( st ) >() ) )
      {
         unwind_impl( in, std::tie( st... ), std::make_index_sequence< sizeof...( st ) >() );
      }

      template< typename ParseInput, typename State >
      static auto unwind( const ParseInput& in, State&& st )
         -> std::enable_if_t< internal::has_unwind< Base, void, const ParseInput&, State > >
      {
         Base::unwind( in, st );
      }

      template< template< typename... > class Action, typename Iterator, typename ParseInput, typename Tuple, std::size_t... Is >
      static auto apply_impl( const Iterator& begin, const ParseInput& in, const Tuple& t, std::index_sequence< Is... > /*unused*/ ) noexcept( noexcept( Base::template apply< Action >( begin, in, std::get< Shuffle::template value< Is, sizeof...( Is ) > >( t )... ) ) )
         -> decltype( Base::template apply< Action >( begin, in, std::get< Shuffle::template value< Is, sizeof...( Is ) > >( t )... ) )
      {
         return Base::template apply< Action >( begin, in, std::get< Shuffle::template value< Is, sizeof...( Is ) > >( t )... );
      }

      template< template< typename... > class Action, typename Iterator, typename ParseInput, typename... States >
      static auto apply( const Iterator& begin, const ParseInput& in, States&&... st ) noexcept( noexcept( apply_impl< Action >( begin, in, std::tie( st... ), std::make_index_sequence< sizeof...( st ) >() ) ) )
         -> decltype( apply_impl< Action >( begin, in, std::tie( st... ), std::make_index_sequence< sizeof...( st ) >() ) )
      {
         return apply_impl< Action >( begin, in, std::tie( st... ), std::make_index_sequence< sizeof...( st ) >() );
      }

      template< template< typename... > class Action, typename Iterator, typename ParseInput, typename State >
      static auto apply( const Iterator& begin, const ParseInput& in, State&& st ) noexcept( noexcept( Base::template apply< Action >( begin, in, st ) ) )
         -> decltype( Base::template apply< Action >( begin, in, st ) )
      {
         return Base::template apply< Action >( begin, in, st );
      }

      template< template< typename... > class Action, typename ParseInput, typename Tuple, std::size_t... Is >
      static auto apply0_impl( const ParseInput& in, const Tuple& t, std::index_sequence< Is... > /*unused*/ ) noexcept( noexcept( Base::template apply0< Action >( in, std::get< Shuffle::template value< Is, sizeof...( Is ) > >( t )... ) ) )
         -> decltype( Base::template apply0< Action >( in, std::get< Shuffle::template value< Is, sizeof...( Is ) > >( t )... ) )
      {
         return Base::template apply0< Action >( in, std::get< Shuffle::template value< Is, sizeof...( Is ) > >( t )... );
      }

      template< template< typename... > class Action, typename ParseInput, typename... States >
      static auto apply0( const ParseInput& in, States&&... st ) noexcept( noexcept( apply0_impl< Action >( in, std::tie( st... ), std::make_index_sequence< sizeof...( st ) >() ) ) )
         -> decltype( apply0_impl< Action >( in, std::tie( st... ), std::make_index_sequence< sizeof...( st ) >() ) )
      {
         return apply0_impl< Action >( in, std::tie( st... ), std::make_index_sequence< sizeof...( st ) >() );
      }

      template< template< typename... > class Action, typename ParseInput, typename State >
      static auto apply0( const ParseInput& in, State&& st ) noexcept( noexcept( Base::template apply0< Action >( in, st ) ) )
         -> decltype( Base::template apply0< Action >( in, st ) )
      {
         return Base::template apply0< Action >( in, st );
      }
   };

   template< typename Base, std::size_t N = 1 >
   using rotate_states_left = shuffle_states< Base, internal::rotate_left< N > >;

   template< typename Base, std::size_t N = 1 >
   using rotate_states_right = shuffle_states< Base, internal::rotate_right< N > >;

   template< typename Base >
   using reverse_states = shuffle_states< Base, internal::reverse >;

}  // namespace TAO_PEGTL_NAMESPACE

#endif
