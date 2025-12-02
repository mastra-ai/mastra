// Copyright (c) 2020-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_ANALYZE_TRAITS_HPP
#define TAO_PEGTL_CONTRIB_ANALYZE_TRAITS_HPP

#include <type_traits>

#include "../ascii.hpp"
#include "../config.hpp"
#include "../rules.hpp"
#include "../type_list.hpp"

#include "forward.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   namespace internal
   {
      enum class analyze_type
      {
         any,  // Consumption-on-success is always true; assumes bounded repetition of conjunction of sub-rules.
         opt,  // Consumption-on-success not necessarily true; assumes bounded repetition of conjunction of sub-rules.
         seq,  // Consumption-on-success depends on consumption of (non-zero bounded repetition of) conjunction of sub-rules.
         sor   // Consumption-on-success depends on consumption of (non-zero bounded repetition of) disjunction of sub-rules.
      };

   }  // namespace internal

   template< typename... Rules >
   struct analyze_any_traits
   {
      static constexpr internal::analyze_type type_v = internal::analyze_type::any;
      using subs_t = type_list< Rules... >;
   };

   template< typename... Rules >
   struct analyze_opt_traits
   {
      static constexpr internal::analyze_type type_v = internal::analyze_type::opt;
      using subs_t = type_list< Rules... >;
   };

   template< typename... Rules >
   struct analyze_seq_traits
   {
      static constexpr internal::analyze_type type_v = internal::analyze_type::seq;
      using subs_t = type_list< Rules... >;
   };

   template< typename... Rules >
   struct analyze_sor_traits
   {
      static constexpr internal::analyze_type type_v = internal::analyze_type::sor;
      using subs_t = type_list< Rules... >;
   };

   template< typename Name, template< typename... > class Action, typename... Rules >
   struct analyze_traits< Name, internal::action< Action, Rules... > >
      : analyze_traits< Name, typename seq< Rules... >::rule_t >
   {};

   template< typename Name, typename Peek >
   struct analyze_traits< Name, internal::any< Peek > >
      : analyze_any_traits<>
   {};

   template< typename Name, typename... Actions >
   struct analyze_traits< Name, internal::apply< Actions... > >
      : analyze_opt_traits<>
   {};

   template< typename Name, typename... Actions >
   struct analyze_traits< Name, internal::apply0< Actions... > >
      : analyze_opt_traits<>
   {};

   template< typename Name, typename... Rules >
   struct analyze_traits< Name, internal::at< Rules... > >
      : analyze_traits< Name, typename opt< Rules... >::rule_t >
   {};

   template< typename Name >
   struct analyze_traits< Name, internal::bof >
      : analyze_opt_traits<>
   {};

   template< typename Name >
   struct analyze_traits< Name, internal::bol >
      : analyze_opt_traits<>
   {};

   template< typename Name, unsigned Cnt >
   struct analyze_traits< Name, internal::bytes< Cnt > >
      : std::conditional_t< ( Cnt != 0 ), analyze_any_traits<>, analyze_opt_traits<> >
   {};

   template< typename Name, template< typename... > class Control, typename... Rules >
   struct analyze_traits< Name, internal::control< Control, Rules... > >
      : analyze_traits< Name, typename seq< Rules... >::rule_t >
   {};

   template< typename Name, typename... Rules >
   struct analyze_traits< Name, internal::disable< Rules... > >
      : analyze_traits< Name, typename seq< Rules... >::rule_t >
   {};

   template< typename Name >
   struct analyze_traits< Name, internal::discard >
      : analyze_opt_traits<>
   {};

   template< typename Name, typename... Rules >
   struct analyze_traits< Name, internal::enable< Rules... > >
      : analyze_traits< Name, typename seq< Rules... >::rule_t >
   {};

   template< typename Name >
   struct analyze_traits< Name, internal::eof >
      : analyze_opt_traits<>
   {};

   template< typename Name >
   struct analyze_traits< Name, internal::eol >
      : analyze_any_traits<>
   {};

   template< typename Name >
   struct analyze_traits< Name, internal::eolf >
      : analyze_opt_traits<>
   {};

   template< typename Name >
   struct analyze_traits< Name, internal::failure >
      : analyze_any_traits<>
   {};

   template< typename Name, typename Rule, typename... Actions >
   struct analyze_traits< Name, internal::if_apply< Rule, Actions... > >
      : analyze_traits< Name, typename Rule::rule_t >
   {};

   template< typename Name, typename Cond, typename Then, typename Else >
   struct analyze_traits< Name, internal::if_then_else< Cond, Then, Else > >
      : analyze_traits< Name, typename sor< seq< Cond, Then >, Else >::rule_t >
   {};

   template< typename Name, char... Cs >
   struct analyze_traits< Name, internal::istring< Cs... > >
      : std::conditional_t< ( sizeof...( Cs ) != 0 ), analyze_any_traits<>, analyze_opt_traits<> >
   {};

   template< typename Name, typename... Rules >
   struct analyze_traits< Name, internal::not_at< Rules... > >
      : analyze_traits< Name, typename opt< Rules... >::rule_t >
   {};

   template< typename Name, internal::result_on_found R, typename Peek, typename Peek::data_t... Cs >
   struct analyze_traits< Name, internal::one< R, Peek, Cs... > >
      : analyze_any_traits<>
   {};

   template< typename Name, typename Rule, typename... Rules >
   struct analyze_traits< Name, internal::opt< Rule, Rules... > >
      : analyze_opt_traits< Rule, Rules... >
   {};

   template< typename Name, typename... Rules >
   struct analyze_traits< Name, internal::plus< Rules... > >
      : analyze_traits< Name, typename seq< Rules..., opt< Name > >::rule_t >
   {};

   template< typename Name, internal::result_on_found R, typename Peek, typename Peek::data_t Lo, typename Peek::data_t Hi >
   struct analyze_traits< Name, internal::range< R, Peek, Lo, Hi > >
      : analyze_any_traits<>
   {};

   template< typename Name, typename Peek, typename Peek::data_t... Cs >
   struct analyze_traits< Name, internal::ranges< Peek, Cs... > >
      : analyze_any_traits<>
   {};

   template< typename Name, typename Head, typename... Rules >
   struct analyze_traits< Name, internal::rematch< Head, Rules... > >
      : analyze_traits< Name, typename sor< Head, sor< seq< Rules, any >... > >::rule_t >  // TODO: Correct (enough)?
   {};

   template< typename Name, unsigned Cnt, typename... Rules >
   struct analyze_traits< Name, internal::rep< Cnt, Rules... > >
      : analyze_traits< Name, std::conditional_t< ( Cnt != 0 ), typename seq< Rules... >::rule_t, typename opt< Rules... >::rule_t > >
   {};

   template< typename Name, unsigned Min, unsigned Max, typename... Rules >
   struct analyze_traits< Name, internal::rep_min_max< Min, Max, Rules... > >
      : analyze_traits< Name, std::conditional_t< ( Min != 0 ), typename seq< Rules... >::rule_t, typename opt< Rules... >::rule_t > >
   {};

   template< typename Name, unsigned Max, typename... Rules >
   struct analyze_traits< Name, internal::rep_opt< Max, Rules... > >
      : analyze_traits< Name, typename opt< Rules... >::rule_t >
   {};

   template< typename Name, unsigned Amount >
   struct analyze_traits< Name, internal::require< Amount > >
      : analyze_opt_traits<>
   {};

   template< typename Name, typename Rule, typename... Rules >
   struct analyze_traits< Name, internal::seq< Rule, Rules... > >
      : analyze_seq_traits< Rule, Rules... >
   {};

   template< typename Name, typename Rule, typename... Rules >
   struct analyze_traits< Name, internal::sor< Rule, Rules... > >
      : analyze_sor_traits< Rule, Rules... >
   {};

   template< typename Name, typename... Rules >
   struct analyze_traits< Name, internal::star< Rules... > >
      : analyze_traits< Name, typename opt< Rules..., Name >::rule_t >
   {};

   template< typename Name, typename State, typename... Rules >
   struct analyze_traits< Name, internal::state< State, Rules... > >
      : analyze_traits< Name, typename seq< Rules... >::rule_t >
   {};

   template< typename Name, char... Cs >
   struct analyze_traits< Name, internal::string< Cs... > >
      : std::conditional_t< ( sizeof...( Cs ) != 0 ), analyze_any_traits<>, analyze_opt_traits<> >
   {};

   template< typename Name >
   struct analyze_traits< Name, internal::success >
      : analyze_opt_traits<>
   {};

   template< typename Name, typename Cond >
   struct analyze_traits< Name, internal::until< Cond > >
      : analyze_traits< Name, typename Cond::rule_t >
   {};

   template< typename Name, typename Cond, typename... Rules >
   struct analyze_traits< Name, internal::until< Cond, Rules... > >
      : analyze_traits< Name, typename seq< star< Rules... >, Cond >::rule_t >
   {};

#if defined( __cpp_exceptions )
   template< typename Name, typename Cond, typename... Rules >
   struct analyze_traits< Name, internal::if_must< true, Cond, Rules... > >
      : analyze_traits< Name, typename opt< Cond, Rules... >::rule_t >
   {};

   template< typename Name, typename Cond, typename... Rules >
   struct analyze_traits< Name, internal::if_must< false, Cond, Rules... > >
      : analyze_traits< Name, typename seq< Cond, Rules... >::rule_t >
   {};

   template< typename Name, typename... Rules >
   struct analyze_traits< Name, internal::must< Rules... > >
      : analyze_traits< Name, typename seq< Rules... >::rule_t >
   {};

   template< typename Name, typename T >
   struct analyze_traits< Name, internal::raise< T > >
      : analyze_any_traits<>
   {};

   template< typename Name, typename Exception, typename... Rules >
   struct analyze_traits< Name, internal::try_catch_type< Exception, Rules... > >
      : analyze_traits< Name, typename seq< Rules... >::rule_t >
   {};
#endif

}  // namespace TAO_PEGTL_NAMESPACE

#endif
