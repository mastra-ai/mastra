// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_UTF32_HPP
#define TAO_PEGTL_CONTRIB_UTF32_HPP

#include "../config.hpp"
#include "../internal/result_on_found.hpp"
#include "../internal/rules.hpp"

#include "internal/peek_utf32.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   namespace utf32_be
   {
      // clang-format off
      struct any : internal::any< internal::peek_utf32_be > {};
      struct bom : internal::one< internal::result_on_found::success, internal::peek_utf32_be, 0xfeff > {};
      template< char32_t... Cs > struct not_one : internal::one< internal::result_on_found::failure, internal::peek_utf32_be, Cs... > {};
      template< char32_t Lo, char32_t Hi > struct not_range : internal::range< internal::result_on_found::failure, internal::peek_utf32_be, Lo, Hi > {};
      template< char32_t... Cs > struct one : internal::one< internal::result_on_found::success, internal::peek_utf32_be, Cs... > {};
      template< char32_t Lo, char32_t Hi > struct range : internal::range< internal::result_on_found::success, internal::peek_utf32_be, Lo, Hi > {};
      template< char32_t... Cs > struct ranges : internal::ranges< internal::peek_utf32_be, Cs... > {};
      template< char32_t... Cs > struct string : internal::seq< internal::one< internal::result_on_found::success, internal::peek_utf32_be, Cs >... > {};
      // clang-format on

   }  // namespace utf32_be

   namespace utf32_le
   {
      // clang-format off
      struct any : internal::any< internal::peek_utf32_le > {};
      struct bom : internal::one< internal::result_on_found::success, internal::peek_utf32_le, 0xfeff > {};
      template< char32_t... Cs > struct not_one : internal::one< internal::result_on_found::failure, internal::peek_utf32_le, Cs... > {};
      template< char32_t Lo, char32_t Hi > struct not_range : internal::range< internal::result_on_found::failure, internal::peek_utf32_le, Lo, Hi > {};
      template< char32_t... Cs > struct one : internal::one< internal::result_on_found::success, internal::peek_utf32_le, Cs... > {};
      template< char32_t Lo, char32_t Hi > struct range : internal::range< internal::result_on_found::success, internal::peek_utf32_le, Lo, Hi > {};
      template< char32_t... Cs > struct ranges : internal::ranges< internal::peek_utf32_le, Cs... > {};
      template< char32_t... Cs > struct string : internal::seq< internal::one< internal::result_on_found::success, internal::peek_utf32_le, Cs >... > {};
      // clang-format on

   }  // namespace utf32_le

#if defined( _WIN32 ) && !defined( __MINGW32__ ) && !defined( __CYGWIN__ )
   namespace utf32 = utf32_le;
#elif __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__
   namespace utf32 = utf32_le;
#elif __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
   namespace utf32 = utf32_be;
#else
#error Unknown endianness.
#endif

}  // namespace TAO_PEGTL_NAMESPACE

#endif
