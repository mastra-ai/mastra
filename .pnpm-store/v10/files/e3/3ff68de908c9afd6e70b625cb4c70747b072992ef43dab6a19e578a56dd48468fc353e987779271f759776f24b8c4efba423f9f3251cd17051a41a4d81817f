// Copyright (c) 2016-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CONTRIB_TO_NLOHMANN_HPP
#define TAO_JSON_CONTRIB_TO_NLOHMANN_HPP

#include <cstdint>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include <tao/json/binary_view.hpp>

namespace tao::json::events
{
   // Events consumer to build an nlohmann/json value.

   template< typename Value >
   class to_nlohmann
   {
   private:
      std::vector< Value > stack_;
      std::vector< std::string > keys_;

   public:
      Value value;

      void null()
      {
         value = nullptr;
      }

      void boolean( const bool v )
      {
         value = v;
      }

      void number( const std::int64_t v )
      {
         value = v;
      }

      void number( const std::uint64_t v )
      {
         value = v;
      }

      void number( const double v )
      {
         value = v;
      }

      void string( const char* v )
      {
         value = v;
      }

      void string( const std::string& v )
      {
         value = v;
      }

      void string( std::string&& v )
      {
         value = std::move( v );
      }

      void string( const std::string_view v )
      {
         value = v;
      }

      void binary( const tao::binary_view v )
      {
         value = v;
      }

      // array
      void begin_array( const std::size_t /*unused*/ = 0 )
      {
         stack_.push_back( Value::array() );
      }

      void element()
      {
         stack_.back().push_back( std::move( value ) );
      }

      void end_array( const std::size_t /*unused*/ = 0 )
      {
         value = std::move( stack_.back() );
         stack_.pop_back();
      }

      // object
      void begin_object( const std::size_t /*unused*/ = 0 )
      {
         stack_.push_back( Value::object() );
      }

      void key( const std::string_view v )
      {
         keys_.emplace_back( v );
      }

      void member()
      {
         stack_.back().push_back( typename Value::object_t::value_type( std::move( keys_.back() ), std::move( value ) ) );
         keys_.pop_back();
      }

      void end_object( const std::size_t /*unused*/ = 0 )
      {
         value = std::move( stack_.back() );
         stack_.pop_back();
      }
   };

}  // namespace tao::json::events

#endif
