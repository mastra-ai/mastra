// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_ASCII_HPP
#define TAO_PEGTL_ASCII_HPP

#include "config.hpp"

#include "internal/result_on_found.hpp"
#include "internal/rules.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   inline namespace ascii
   {
      // clang-format off
      struct alnum : internal::ranges< internal::peek_char, 'a', 'z', 'A', 'Z', '0', '9' > {};
      struct alpha : internal::ranges< internal::peek_char, 'a', 'z', 'A', 'Z' > {};
      struct any : internal::any< internal::peek_char > {};
      struct blank : internal::one< internal::result_on_found::success, internal::peek_char, ' ', '\t' > {};
      struct digit : internal::range< internal::result_on_found::success, internal::peek_char, '0', '9' > {};
      struct ellipsis : internal::string< '.', '.', '.' > {};
      template< char... Cs > struct forty_two : internal::rep< 42, internal::one< internal::result_on_found::success, internal::peek_char, Cs... > > {};
      struct identifier_first : internal::identifier_first {};
      struct identifier_other : internal::identifier_other {};
      struct identifier : internal::identifier {};
      template< char... Cs > struct istring : internal::istring< Cs... > {};
      template< char... Cs > struct keyword : internal::seq< internal::string< Cs... >, internal::not_at< internal::identifier_other > > { static_assert( sizeof...( Cs ) > 0 ); };
      struct lower : internal::range< internal::result_on_found::success, internal::peek_char, 'a', 'z' > {};
      template< char... Cs > struct not_one : internal::one< internal::result_on_found::failure, internal::peek_char, Cs... > {};
      template< char Lo, char Hi > struct not_range : internal::range< internal::result_on_found::failure, internal::peek_char, Lo, Hi > {};
      struct nul : internal::one< internal::result_on_found::success, internal::peek_char, char( 0 ) > {};
      struct odigit : internal::range< internal::result_on_found::success, internal::peek_char, '0', '7' > {};
      template< char... Cs > struct one : internal::one< internal::result_on_found::success, internal::peek_char, Cs... > {};
      struct print : internal::range< internal::result_on_found::success, internal::peek_char, char( 32 ), char( 126 ) > {};
      template< char Lo, char Hi > struct range : internal::range< internal::result_on_found::success, internal::peek_char, Lo, Hi > {};
      template< char... Cs > struct ranges : internal::ranges< internal::peek_char, Cs... > {};
      struct seven : internal::range< internal::result_on_found::success, internal::peek_char, char( 0 ), char( 127 ) > {};
      struct shebang : internal::seq< internal::string< '#', '!' >, internal::until< internal::eolf > > {};
      struct space : internal::one< internal::result_on_found::success, internal::peek_char, ' ', '\n', '\r', '\t', '\v', '\f' > {};
      template< char... Cs > struct string : internal::string< Cs... > {};
      template< char C > struct three : internal::string< C, C, C > {};
      template< char C > struct two : internal::string< C, C > {};
      struct upper : internal::range< internal::result_on_found::success, internal::peek_char, 'A', 'Z' > {};
      struct xdigit : internal::ranges< internal::peek_char, '0', '9', 'a', 'f', 'A', 'F' > {};
      // clang-format on

   }  // namespace ascii

}  // namespace TAO_PEGTL_NAMESPACE

#include "internal/pegtl_string.hpp"

#endif
