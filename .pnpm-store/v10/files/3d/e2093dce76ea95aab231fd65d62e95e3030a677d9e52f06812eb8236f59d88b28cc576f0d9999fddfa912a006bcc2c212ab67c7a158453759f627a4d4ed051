// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_UBJSON_FROM_FILE_HPP
#define TAO_JSON_UBJSON_FROM_FILE_HPP

#include <utility>

#include "../events/to_value.hpp"
#include "../events/transformer.hpp"
#include "../internal/filesystem.hpp"

#include "events/from_file.hpp"

namespace tao::json::ubjson
{
   template< template< typename... > class Traits, template< typename... > class... Transformers >
   [[nodiscard]] basic_value< Traits > basic_from_file( const json::internal::filesystem::path& path )
   {
      json::events::transformer< json::events::to_basic_value< Traits >, Transformers... > consumer;
      events::from_file( consumer, path );
      return std::move( consumer.value );
   }

   template< template< typename... > class... Transformers >
   [[nodiscard]] value from_file( const json::internal::filesystem::path& path )
   {
      return basic_from_file< traits, Transformers... >( path );
   }

}  // namespace tao::json::ubjson

#endif
