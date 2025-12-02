// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_UBJSON_INTERNAL_MARKER_HPP
#define TAO_JSON_UBJSON_INTERNAL_MARKER_HPP

#include <cstdint>

namespace tao::json::ubjson::internal
{
   enum class marker : char
   {
      NULL_ = 'Z',

      NO_OP = 'N',

      TRUE_ = 'T',
      FALSE_ = 'F',

      INT8 = 'i',
      UINT8 = 'U',
      INT16 = 'I',
      INT32 = 'l',
      INT64 = 'L',

      FLOAT32 = 'd',
      FLOAT64 = 'D',

      HIGH_PRECISION = 'H',

      CHAR = 'C',
      STRING = 'S',

      BEGIN_ARRAY = '[',
      END_ARRAY = ']',

      BEGIN_OBJECT = '{',
      END_OBJECT = '}',

      CONTAINER_SIZE = '#',
      CONTAINER_TYPE = '$'
   };

}  // namespace tao::json::ubjson::internal

#endif
