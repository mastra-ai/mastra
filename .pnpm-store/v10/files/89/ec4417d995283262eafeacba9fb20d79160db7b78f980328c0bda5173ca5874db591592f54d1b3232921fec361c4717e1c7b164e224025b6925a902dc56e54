// Copyright (c) 2021-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_SEPARATED_SEQ_HPP
#define TAO_PEGTL_CONTRIB_SEPARATED_SEQ_HPP

#include "../config.hpp"

#include "../internal/seq.hpp"
#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   namespace internal
   {
      template< typename... >
      struct sep;

      template< typename... Ts, typename S, typename Rule, typename... Rules >
      struct sep< type_list< Ts... >, S, Rule, Rules... >
         : sep< type_list< Ts..., Rule, S >, S, Rules... >
      {};

      template< typename... Ts, typename S, typename Rule >
      struct sep< type_list< Ts... >, S, Rule >
      {
         using type = seq< Ts..., Rule >;
      };

      template< typename S >
      struct sep< type_list<>, S >
      {
         using type = seq<>;
      };

   }  // namespace internal

   template< typename S, typename... Rules >
   struct separated_seq
      : internal::sep< type_list<>, S, Rules... >::type
   {};

}  // namespace TAO_PEGTL_NAMESPACE

#endif
