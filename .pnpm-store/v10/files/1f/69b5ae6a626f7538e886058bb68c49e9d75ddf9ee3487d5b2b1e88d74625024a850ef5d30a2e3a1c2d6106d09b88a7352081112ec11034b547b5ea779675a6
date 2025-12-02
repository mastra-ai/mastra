// Copyright (c) 2018-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_UINT64_HPP
#define TAO_PEGTL_CONTRIB_UINT64_HPP

#include "../config.hpp"
#include "../internal/result_on_found.hpp"
#include "../internal/rules.hpp"

#include "internal/peek_mask_uint.hpp"
#include "internal/peek_uint.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   namespace uint64_be
   {
      // clang-format off
      struct any : internal::any< internal::peek_uint64_be > {};

      template< std::uint64_t... Cs > struct not_one : internal::one< internal::result_on_found::failure, internal::peek_uint64_be, Cs... > {};
      template< std::uint64_t Lo, std::uint64_t Hi > struct not_range : internal::range< internal::result_on_found::failure, internal::peek_uint64_be, Lo, Hi > {};
      template< std::uint64_t... Cs > struct one : internal::one< internal::result_on_found::success, internal::peek_uint64_be, Cs... > {};
      template< std::uint64_t Lo, std::uint64_t Hi > struct range : internal::range< internal::result_on_found::success, internal::peek_uint64_be, Lo, Hi > {};
      template< std::uint64_t... Cs > struct ranges : internal::ranges< internal::peek_uint64_be, Cs... > {};
      template< std::uint64_t... Cs > struct string : internal::seq< internal::one< internal::result_on_found::success, internal::peek_uint64_be, Cs >... > {};


      template< std::uint64_t M, std::uint64_t... Cs > struct mask_not_one : internal::one< internal::result_on_found::failure, internal::peek_mask_uint64_be< M >, Cs... > {};
      template< std::uint64_t M, std::uint64_t Lo, std::uint64_t Hi > struct mask_not_range : internal::range< internal::result_on_found::failure, internal::peek_mask_uint64_be< M >, Lo, Hi > {};
      template< std::uint64_t M, std::uint64_t... Cs > struct mask_one : internal::one< internal::result_on_found::success, internal::peek_mask_uint64_be< M >, Cs... > {};
      template< std::uint64_t M, std::uint64_t Lo, std::uint64_t Hi > struct mask_range : internal::range< internal::result_on_found::success, internal::peek_mask_uint64_be< M >, Lo, Hi > {};
      template< std::uint64_t M, std::uint64_t... Cs > struct mask_ranges : internal::ranges< internal::peek_mask_uint64_be< M >, Cs... > {};
      template< std::uint64_t M, std::uint64_t... Cs > struct mask_string : internal::seq< internal::one< internal::result_on_found::success, internal::peek_mask_uint64_be< M >, Cs >... > {};
      // clang-format on

   }  // namespace uint64_be

   namespace uint64_le
   {
      // clang-format off
      struct any : internal::any< internal::peek_uint64_le > {};

      template< std::uint64_t... Cs > struct not_one : internal::one< internal::result_on_found::failure, internal::peek_uint64_le, Cs... > {};
      template< std::uint64_t Lo, std::uint64_t Hi > struct not_range : internal::range< internal::result_on_found::failure, internal::peek_uint64_le, Lo, Hi > {};
      template< std::uint64_t... Cs > struct one : internal::one< internal::result_on_found::success, internal::peek_uint64_le, Cs... > {};
      template< std::uint64_t Lo, std::uint64_t Hi > struct range : internal::range< internal::result_on_found::success, internal::peek_uint64_le, Lo, Hi > {};
      template< std::uint64_t... Cs > struct ranges : internal::ranges< internal::peek_uint64_le, Cs... > {};
      template< std::uint64_t... Cs > struct string : internal::seq< internal::one< internal::result_on_found::success, internal::peek_uint64_le, Cs >... > {};

      template< std::uint64_t M, std::uint64_t... Cs > struct mask_not_one : internal::one< internal::result_on_found::failure, internal::peek_mask_uint64_le< M >, Cs... > {};
      template< std::uint64_t M, std::uint64_t Lo, std::uint64_t Hi > struct mask_not_range : internal::range< internal::result_on_found::failure, internal::peek_mask_uint64_le< M >, Lo, Hi > {};
      template< std::uint64_t M, std::uint64_t... Cs > struct mask_one : internal::one< internal::result_on_found::success, internal::peek_mask_uint64_le< M >, Cs... > {};
      template< std::uint64_t M, std::uint64_t Lo, std::uint64_t Hi > struct mask_range : internal::range< internal::result_on_found::success, internal::peek_mask_uint64_le< M >, Lo, Hi > {};
      template< std::uint64_t M, std::uint64_t... Cs > struct mask_ranges : internal::ranges< internal::peek_mask_uint64_le< M >, Cs... > {};
      template< std::uint64_t M, std::uint64_t... Cs > struct mask_string : internal::seq< internal::one< internal::result_on_found::success, internal::peek_mask_uint64_le< M >, Cs >... > {};
      // clang-format on

   }  // namespace uint64_le

}  // namespace TAO_PEGTL_NAMESPACE

#endif
