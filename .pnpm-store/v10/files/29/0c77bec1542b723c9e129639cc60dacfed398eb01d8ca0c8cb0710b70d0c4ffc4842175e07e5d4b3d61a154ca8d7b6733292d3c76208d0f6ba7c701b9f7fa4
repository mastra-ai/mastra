// Copyright (c) 2015-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_TYPE_HPP
#define TAO_JSON_TYPE_HPP

#include <cstdint>
#include <string_view>
#include <type_traits>
#include <variant>

#include "binary_view.hpp"

namespace tao::json
{
   enum class type : std::size_t
   {
      UNINITIALIZED = 0,
      NULL_,
      BOOLEAN,
      SIGNED,
      UNSIGNED,
      DOUBLE,
      STRING,
      STRING_VIEW,
      BINARY,
      BINARY_VIEW,
      ARRAY,
      OBJECT,
      VALUE_PTR,
      OPAQUE_PTR,

      VALUELESS_BY_EXCEPTION = std::variant_npos
   };

   constexpr std::string_view to_string( const type t )
   {
      switch( t ) {
         case type::UNINITIALIZED:
            return "uninitialized";
         case type::NULL_:
            return "null";
         case type::BOOLEAN:
            return "boolean";
         case type::SIGNED:
            return "signed";
         case type::UNSIGNED:
            return "unsigned";
         case type::DOUBLE:
            return "double";
         case type::STRING:
            return "string";
         case type::STRING_VIEW:
            return "string_view";
         case type::BINARY:
            return "binary";
         case type::BINARY_VIEW:
            return "binary_view";
         case type::ARRAY:
            return "array";
         case type::OBJECT:
            return "object";
         case type::VALUE_PTR:
            return "value_ptr";
         case type::OPAQUE_PTR:
            return "opaque_ptr";
         case type::VALUELESS_BY_EXCEPTION:
            return "valueless_by_exception";
      }
      return "unknown";
   }

   struct null_t
   {
      explicit constexpr null_t( int /*unused*/ ) {}
   };

   struct empty_string_t
   {
      explicit constexpr empty_string_t( int /*unused*/ ) {}
   };

   struct empty_binary_t
   {
      explicit constexpr empty_binary_t( int /*unused*/ ) {}
   };

   struct empty_array_t
   {
      explicit constexpr empty_array_t( int /*unused*/ ) {}
   };

   struct empty_object_t
   {
      constexpr explicit empty_object_t( int /*unused*/ ) {}
   };

   struct uninitialized_t
   {};

   constexpr inline null_t null{ 0 };

   constexpr inline empty_string_t empty_string{ 0 };
   constexpr inline empty_binary_t empty_binary{ 0 };
   constexpr inline empty_array_t empty_array{ 0 };
   constexpr inline empty_object_t empty_object{ 0 };

   constexpr inline uninitialized_t uninitialized;

}  // namespace tao::json

#endif
