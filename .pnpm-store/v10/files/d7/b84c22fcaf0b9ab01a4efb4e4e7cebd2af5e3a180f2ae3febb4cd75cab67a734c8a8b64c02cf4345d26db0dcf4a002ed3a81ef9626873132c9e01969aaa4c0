// Copyright (c) 2018-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_ICU_INTERNAL_HPP
#define TAO_PEGTL_CONTRIB_ICU_INTERNAL_HPP

#include <unicode/uchar.h>

#include "../analyze_traits.hpp"

#include "../../config.hpp"
#include "../../type_list.hpp"

#include "../../internal/enable_control.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   namespace internal
   {
      namespace icu
      {
         template< typename Peek, UProperty P, bool V = true >
         struct binary_property
         {
            using peek_t = Peek;
            using data_t = typename Peek::data_t;

            using rule_t = binary_property;
            using subs_t = empty_list;

            [[nodiscard]] static bool test( const data_t c ) noexcept
            {
               return u_hasBinaryProperty( c, P ) == V;
            }

            template< typename ParseInput >
            [[nodiscard]] static bool match( ParseInput& in ) noexcept( noexcept( Peek::peek( in ) ) )
            {
               if( const auto t = Peek::peek( in ) ) {
                  if( test( t.data ) ) {
                     in.bump( t.size );
                     return true;
                  }
               }
               return false;
            }
         };

         template< typename Peek, UProperty P, int V >
         struct property_value
         {
            using peek_t = Peek;
            using data_t = typename Peek::data_t;

            using rule_t = property_value;
            using subs_t = empty_list;

            [[nodiscard]] static bool test( const data_t c ) noexcept
            {
               return u_getIntPropertyValue( c, P ) == V;
            }

            template< typename ParseInput >
            [[nodiscard]] static bool match( ParseInput& in ) noexcept( noexcept( Peek::peek( in ) ) )
            {
               if( const auto t = Peek::peek( in ) ) {
                  if( test( t.data ) ) {
                     in.bump( t.size );
                     return true;
                  }
               }
               return false;
            }
         };

      }  // namespace icu

      template< typename Peek, UProperty P, bool V >
      inline constexpr bool enable_control< icu::binary_property< Peek, P, V > > = false;

      template< typename Peek, UProperty P, int V >
      inline constexpr bool enable_control< icu::property_value< Peek, P, V > > = false;

   }  // namespace internal

   template< typename Name, typename Peek, UProperty P, bool V >
   struct analyze_traits< Name, internal::icu::binary_property< Peek, P, V > >
      : analyze_any_traits<>
   {};

   template< typename Name, typename Peek, UProperty P, int V >
   struct analyze_traits< Name, internal::icu::property_value< Peek, P, V > >
      : analyze_any_traits<>
   {};

}  // namespace TAO_PEGTL_NAMESPACE

#endif
