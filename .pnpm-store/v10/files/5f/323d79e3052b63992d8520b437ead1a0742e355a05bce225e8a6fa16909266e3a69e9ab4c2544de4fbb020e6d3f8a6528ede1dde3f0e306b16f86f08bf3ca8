// Copyright (c) 2019-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_REP_STRING_HPP
#define TAO_PEGTL_CONTRIB_REP_STRING_HPP

#include <cstddef>

#include "../config.hpp"
#include "../internal/string.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   namespace internal
   {
      template< std::size_t, typename, char... >
      struct make_rep_string;

      template< char... Ss, char... Cs >
      struct make_rep_string< 0, string< Ss... >, Cs... >
      {
         using type = string< Ss... >;
      };

      template< std::size_t N, char... Ss, char... Cs >
      struct make_rep_string< N, string< Ss... >, Cs... >
         : make_rep_string< N - 1, string< Ss..., Cs... >, Cs... >
      {};

   }  // namespace internal

   inline namespace ascii
   {
      template< std::size_t N, char... Cs >
      struct rep_string
         : internal::make_rep_string< N, internal::string<>, Cs... >::type
      {};

   }  // namespace ascii

}  // namespace TAO_PEGTL_NAMESPACE

#endif
