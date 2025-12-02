// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_BINDING_HPP
#define TAO_JSON_BINDING_HPP

#include "binding/constant.hpp"
#include "binding/element.hpp"
#include "binding/element2.hpp"
#include "binding/factory.hpp"
#include "binding/for_nothing_value.hpp"
#include "binding/for_unknown_key.hpp"
#include "binding/inherit.hpp"
#include "binding/member.hpp"
#include "binding/versions.hpp"

#include "binding/internal/array.hpp"
#include "binding/internal/inherit.hpp"
#include "binding/internal/object.hpp"

namespace tao::json::binding
{
   namespace internal
   {
      template< typename... As >
      struct make_array
      {
         using list = json::internal::type_list_concat_t< internal::inherit_elements< As >... >;
         using type = internal::array< list >;
      };

   }  // namespace internal

   template< typename... As >
   using array = typename internal::make_array< As... >::type;

   template< for_unknown_key E, for_nothing_value N, typename... As >
   using basic_object = internal::basic_object< E, N, json::internal::type_list_concat_t< internal::inherit_members< As >... > >;

   template< typename... As >
   using object = basic_object< for_unknown_key::fail, for_nothing_value::encode, As... >;

}  // namespace tao::json::binding

#define TAO_JSON_BIND_ELEMENT( ... ) tao::json::binding::element< __VA_ARGS__ >

// No macro for element2 which does read and write with separate functions.

#define TAO_JSON_BIND_ELEMENT_BOOL( VaLue ) tao::json::binding::element_b< VaLue >
#define TAO_JSON_BIND_ELEMENT_SIGNED( VaLue ) tao::json::binding::element_i< VaLue >
#define TAO_JSON_BIND_ELEMENT_UNSIGNED( VaLue ) tao::json::binding::element_u< VaLue >
#define TAO_JSON_BIND_ELEMENT_STRING( VaLue ) tao::json::binding::element_s< TAO_JSON_STRING_T( VaLue ) >

#define TAO_JSON_BIND_REQUIRED( KeY, ... ) tao::json::binding::member< tao::json::binding::member_kind::required, TAO_JSON_STRING_T( KeY ), __VA_ARGS__ >
#define TAO_JSON_BIND_OPTIONAL( KeY, ... ) tao::json::binding::member< tao::json::binding::member_kind::optional, TAO_JSON_STRING_T( KeY ), __VA_ARGS__ >

#define TAO_JSON_BIND_REQUIRED_BOOL( KeY, VaLue ) tao::json::binding::member_b< tao::json::binding::member_kind::required, TAO_JSON_STRING_T( KeY ), VaLue >
#define TAO_JSON_BIND_REQUIRED_SIGNED( KeY, VaLue ) tao::json::binding::member_i< tao::json::binding::member_kind::required, TAO_JSON_STRING_T( KeY ), VaLue >
#define TAO_JSON_BIND_REQUIRED_UNSIGNED( KeY, VaLue ) tao::json::binding::member_u< tao::json::binding::member_kind::required, TAO_JSON_STRING_T( KeY ), VaLue >
#define TAO_JSON_BIND_REQUIRED_STRING( KeY, VaLue ) tao::json::binding::member_s< tao::json::binding::member_kind::required, TAO_JSON_STRING_T( KeY ), TAO_JSON_STRING_T( VaLue ) >

#define TAO_JSON_BIND_OPTIONAL_BOOL( KeY, VaLue ) tao::json::binding::member_b< tao::json::binding::member_kind::optional, TAO_JSON_STRING_T( KeY ), VaLue >
#define TAO_JSON_BIND_OPTIONAL_SIGNED( KeY, VaLue ) tao::json::binding::member_i< tao::json::binding::member_kind::optional, TAO_JSON_STRING_T( KeY ), VaLue >
#define TAO_JSON_BIND_OPTIONAL_UNSIGNED( KeY, VaLue ) tao::json::binding::member_u< tao::json::binding::member_kind::optional, TAO_JSON_STRING_T( KeY ), VaLue >
#define TAO_JSON_BIND_OPTIONAL_STRING( KeY, VaLue ) tao::json::binding::member_s< tao::json::binding::member_kind::optional, TAO_JSON_STRING_T( KeY ), TAO_JSON_STRING_T( VaLue ) >

#define TAO_JSON_BIND_REQUIRED1( ... ) tao::json::binding::member< tao::json::binding::member_kind::required, tao::json::binding::internal::use_default_key, __VA_ARGS__ >
#define TAO_JSON_BIND_OPTIONAL1( ... ) tao::json::binding::member< tao::json::binding::member_kind::optional, tao::json::binding::internal::use_default_key, __VA_ARGS__ >

#define TAO_JSON_FACTORY_BIND( KeY, ... ) tao::json::binding::internal::factory_temp< TAO_JSON_STRING_T( KeY ), __VA_ARGS__ >

#define TAO_JSON_FACTORY_BIND1( ... ) tao::json::binding::internal::factory_temp< tao::json::binding::internal::use_default_key, __VA_ARGS__ >

#endif
