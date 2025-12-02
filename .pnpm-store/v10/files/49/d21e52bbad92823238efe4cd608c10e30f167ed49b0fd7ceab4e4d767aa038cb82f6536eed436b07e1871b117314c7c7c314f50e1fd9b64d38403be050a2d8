// Copyright (c) 2016-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CONTRIB_PATCH_HPP
#define TAO_JSON_CONTRIB_PATCH_HPP

#include <stdexcept>
#include <utility>

#include "../pointer.hpp"
#include "../value.hpp"

namespace tao::json
{
   template< template< typename... > class Traits >
   void patch_inplace( basic_value< Traits >& v, const basic_value< Traits >& patch )
   {
      for( const auto& entry : patch.get_array() ) {
         const auto& op = entry.at( "op" ).get_string();
         const auto& path = entry.at( "path" ).get_string();
         const pointer path_pointer( path );
         if( op == "test" ) {
            if( v.at( path_pointer ) != entry.at( "value" ) ) {
               throw std::runtime_error( internal::format( "json patch 'test' failed for '", path, '\'', json::message_extension( v ) ) );
            }
         }
         else if( op == "remove" ) {
            v.erase( path_pointer );
         }
         else if( op == "add" ) {
            v.insert( path_pointer, entry.at( "value" ) );
         }
         else if( op == "replace" ) {
            v.at( path_pointer ) = entry.at( "value" );
         }
         else if( op == "move" ) {
            const pointer from( entry.at( "from" ).get_string() );
            if( from == path_pointer ) {
               continue;
            }
            if( from.is_prefix_of( path_pointer ) ) {
               throw std::runtime_error( internal::format( "json patch 'test' failed for '", path, '\'', json::message_extension( v ) ) );
            }
            auto t = std::move( v.at( from ) );
            v.erase( from );  // NOLINT(clang-analyzer-cplusplus.Move)
            v.insert( path_pointer, std::move( t ) );
         }
         else if( op == "copy" ) {
            const pointer from( entry.at( "from" ).get_string() );
            v.insert( path_pointer, v.at( from ) );
         }
         else {
            throw std::runtime_error( internal::format( "unknown json patch operation '", op, '\'' ) );
         }
      }
   }

   template< template< typename... > class Traits >
   void patch_inplace( basic_value< Traits >& v, basic_value< Traits >&& patch )
   {
      for( const auto& entry : patch.get_array() ) {
         const auto& op = entry.at( "op" ).get_string();
         const auto& path = entry.at( "path" ).get_string();
         const pointer path_pointer( path );
         if( op == "test" ) {
            if( v.at( path_pointer ) != entry.at( "value" ) ) {
               throw std::runtime_error( internal::format( "json patch 'test' failed for '", path, '\'', json::message_extension( v ) ) );
            }
         }
         else if( op == "remove" ) {
            v.erase( path_pointer );
         }
         else if( op == "add" ) {
            v.insert( path_pointer, std::move( entry.at( "value" ) ) );
         }
         else if( op == "replace" ) {
            v.at( path_pointer ) = std::move( entry.at( "value" ) );
         }
         else if( op == "move" ) {
            const pointer from( entry.at( "from" ).get_string() );
            if( from == path_pointer ) {
               continue;
            }
            if( from.is_prefix_of( path_pointer ) ) {
               throw std::runtime_error( internal::format( "json patch 'test' failed for '", path, '\'', json::message_extension( v ) ) );
            }
            auto t = std::move( v.at( from ) );
            v.erase( from );
            v.insert( path_pointer, std::move( t ) );
         }
         else if( op == "copy" ) {
            const pointer from( entry.at( "from" ).get_string() );
            v.insert( path_pointer, v.at( from ) );
         }
         else {
            throw std::runtime_error( internal::format( "unknown json patch operation '", op, '\'' ) );
         }
      }
   }

   template< template< typename... > class Traits >
   [[nodiscard]] basic_value< Traits > patch( basic_value< Traits > v, const basic_value< Traits >& patch )
   {
      patch_inplace( v, patch );
      return v;
   }

   template< template< typename... > class Traits >
   [[nodiscard]] basic_value< Traits > patch( basic_value< Traits > v, basic_value< Traits >&& patch )
   {
      patch_inplace( v, std::move( patch ) );
      return v;
   }

}  // namespace tao::json

#endif
