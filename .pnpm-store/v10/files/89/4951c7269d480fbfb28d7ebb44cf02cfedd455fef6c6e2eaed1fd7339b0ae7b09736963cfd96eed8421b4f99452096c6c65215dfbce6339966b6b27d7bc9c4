// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_RULES_HPP
#define TAO_PEGTL_RULES_HPP

#include "config.hpp"
#include "parse_error.hpp"

#include "internal/rules.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   // clang-format off
   template< template< typename... > class Action, typename... Rules > struct action : internal::action< Action, Rules... > {};
   template< typename... Actions > struct apply : internal::apply< Actions... > {};
   template< typename... Actions > struct apply0 : internal::apply0< Actions... > {};
   template< typename... Rules > struct at : internal::at< Rules... > {};
   struct bof : internal::bof {};
   struct bol : internal::bol {};
   template< unsigned Num > struct bytes : internal::bytes< Num > {};
   template< template< typename... > class Control, typename... Rules > struct control : internal::control< Control, Rules... > {};
   template< typename... Rules > struct disable : internal::disable< Rules... > {};
   struct discard : internal::discard {};
   template< typename... Rules > struct enable : internal::enable< Rules... > {};
   struct eof : internal::eof {};
   struct eolf : internal::eolf {};
   struct failure : internal::failure {};
   template< typename Rule, typename... Actions > struct if_apply : internal::if_apply< Rule, Actions... > {};
   template< typename Cond, typename Then, typename Else > struct if_then_else : internal::if_then_else< Cond, Then, Else > {};
   template< typename Rule, typename Sep, typename Pad = void > struct list : internal::list< Rule, internal::pad< Sep, Pad > > {};
   template< typename Rule, typename Sep > struct list< Rule, Sep, void > : internal::list< Rule, Sep > {};
   template< typename Rule, typename Sep, typename Pad = void > struct list_tail : internal::list_tail_pad< Rule, Sep, Pad > {};
   template< typename Rule, typename Sep > struct list_tail< Rule, Sep, void > : internal::list_tail< Rule, Sep > {};
   template< typename M, typename S > struct minus : internal::minus< M, S > {};
   template< typename... Rules > struct not_at : internal::not_at< Rules... > {};
   template< typename... Rules > struct opt : internal::opt< Rules... > {};
   template< typename Rule, typename Pad1, typename Pad2 = Pad1 > struct pad : internal::pad< Rule, Pad1, Pad2 > {};
   template< typename Rule, typename Pad > struct pad_opt : internal::pad_opt< Rule, Pad > {};
   template< typename Rule, typename... Rules > struct plus : internal::plus< Rule, Rules... > {};
   template< typename Head, typename... Rules > struct rematch : internal::rematch< Head, Rules... > {};
   template< unsigned Num, typename... Rules > struct rep : internal::rep< Num, Rules... > {};
   template< unsigned Max, typename... Rules > struct rep_max : internal::rep_min_max< 0, Max, Rules... > {};
   template< unsigned Min, typename Rule, typename... Rules > struct rep_min : internal::rep_min< Min, Rule, Rules... > {};
   template< unsigned Min, unsigned Max, typename... Rules > struct rep_min_max : internal::rep_min_max< Min, Max, Rules... > {};
   template< unsigned Max, typename... Rules > struct rep_opt : internal::rep_opt< Max, Rules... > {};
   template< unsigned Amount > struct require : internal::require< Amount > {};
   template< typename... Rules > struct seq : internal::seq< Rules... > {};
   template< typename... Rules > struct sor : internal::sor< Rules... > {};
   template< typename Rule, typename... Rules > struct star : internal::star< Rule, Rules... > {};
   template< typename State, typename... Rules > struct state : internal::state< State, Rules... > {};
   struct success : internal::success {};
   template< typename Cond, typename... Rules > struct until : internal::until< Cond, Rules... > {};

#if defined( __cpp_exceptions )
   template< typename Cond, typename... Thens > struct if_must : internal::if_must< false, Cond, Thens... > {};
   template< typename Cond, typename Then, typename Else > struct if_must_else : internal::if_must_else< Cond, Then, Else > {};
   template< typename Rule, typename Sep, typename Pad = void > struct list_must : internal::list_must< Rule, internal::pad< Sep, Pad > > {};
   template< typename Rule, typename Sep > struct list_must< Rule, Sep, void > : internal::list_must< Rule, Sep > {};
   template< typename... Rules > struct must : internal::must< Rules... > {};
   template< typename Cond, typename... Rules > struct opt_must : internal::if_must< true, Cond, Rules... > {};
   template< typename Exception > struct raise : internal::raise< Exception > {};
   template< typename Cond, typename... Rules > struct star_must : internal::star_must< Cond, Rules... > {};
   template< typename... Rules > struct try_catch : internal::try_catch_type< parse_error, Rules... > {};
   template< typename Exception, typename... Rules > struct try_catch_type : internal::seq< internal::try_catch_type< Exception, Rules... > > {};
#endif
   // clang-format on

}  // namespace TAO_PEGTL_NAMESPACE

#endif
