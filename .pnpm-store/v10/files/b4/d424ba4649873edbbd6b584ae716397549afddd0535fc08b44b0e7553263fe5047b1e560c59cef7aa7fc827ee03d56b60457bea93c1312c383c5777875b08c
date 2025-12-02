// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_MSGPACK_INTERNAL_FORMAT_HPP
#define TAO_JSON_MSGPACK_INTERNAL_FORMAT_HPP

#include <cstdint>

namespace tao::json::msgpack::internal
{
   enum class format : std::uint8_t
   {
      POSITIVE_MAX = 0x7f,
      FIXMAP_MIN = 0x80,
      FIXMAP_MAX = 0x8f,
      FIXARRAY_MIN = 0x90,
      FIXARRAY_MAX = 0x9f,
      FIXSTR_MIN = 0xa0,
      FIXSTR_MAX = 0xbf,
      NIL = 0xc0,
      UNUSED = 0xc1,
      BOOL_FALSE = 0xc2,
      BOOL_TRUE = 0xc3,
      BIN8 = 0xc4,
      BIN16 = 0xc5,
      BIN32 = 0xc6,
      EXT8 = 0xc7,
      EXT16 = 0xc8,
      EXT32 = 0xc9,
      FLOAT32 = 0xca,
      FLOAT64 = 0xcb,
      UINT8 = 0xcc,
      UINT16 = 0xcd,
      UINT32 = 0xce,
      UINT64 = 0xcf,
      INT8 = 0xd0,
      INT16 = 0xd1,
      INT32 = 0xd2,
      INT64 = 0xd3,
      FIXEXT1 = 0xd4,
      FIXEXT2 = 0xd5,
      FIXEXT4 = 0xd6,
      FIXEXT8 = 0xd7,
      FIXEXT16 = 0xd8,
      STR8 = 0xd9,
      STR16 = 0xda,
      STR32 = 0xdb,
      ARRAY16 = 0xdc,
      ARRAY32 = 0xdd,
      MAP16 = 0xde,
      MAP32 = 0xdf,
      NEGATIVE_MIN = 0xe0
   };

}  // namespace tao::json::msgpack::internal

#endif
