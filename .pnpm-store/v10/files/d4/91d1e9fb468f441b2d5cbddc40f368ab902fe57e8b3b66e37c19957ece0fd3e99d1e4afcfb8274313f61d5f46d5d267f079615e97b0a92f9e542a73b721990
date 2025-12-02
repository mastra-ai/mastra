// Copyright (c) 2015-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_FROM_FILE_HPP
#define TAO_JSON_FROM_FILE_HPP

#include <utility>

#include "events/from_file.hpp"
#include "events/to_value.hpp"
#include "events/transformer.hpp"
#include "internal/filesystem.hpp"

namespace tao::json
{
   template< template< typename... > class Traits, template< typename... > class... Transformers >
   [[nodiscard]] basic_value< Traits > basic_from_file( const internal::filesystem::path& path )
   {
      events::transformer< events::to_basic_value< Traits >, Transformers... > consumer;
      events::from_file( consumer, path );
      return std::move( consumer.value );
   }

   template< template< typename... > class... Transformers >
   [[nodiscard]] value from_file( const internal::filesystem::path& path )
   {
      return basic_from_file< traits, Transformers... >( path );
   }

}  // namespace tao::json

#endif
