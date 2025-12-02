// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CBOR_INTERNAL_MAJOR_HPP
#define TAO_JSON_CBOR_INTERNAL_MAJOR_HPP

#include <cstdint>

namespace tao::json::cbor::internal
{
   enum class major : std::uint8_t
   {
      UNSIGNED = 0,
      NEGATIVE = 0x20,
      BINARY = 0x40,
      STRING = 0x60,
      ARRAY = 0x80,
      OBJECT = 0xa0,
      TAG = 0xc0,
      OTHER = 0xe0
   };

   static constexpr std::uint8_t major_mask = 0xe0;
   static constexpr std::uint8_t minor_mask = 0x1f;

}  // namespace tao::json::cbor::internal

#endif
