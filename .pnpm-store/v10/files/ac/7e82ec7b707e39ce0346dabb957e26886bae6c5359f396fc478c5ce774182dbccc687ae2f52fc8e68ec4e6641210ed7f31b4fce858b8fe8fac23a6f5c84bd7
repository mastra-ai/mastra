// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CONTRIB_GET_HPP
#define TAO_JSON_CONTRIB_GET_HPP

#include "../basic_value.hpp"

namespace tao::json::get
{
   namespace internal
   {
      template< template< typename... > class Traits >
      [[nodiscard]] const basic_value< Traits >* find( const basic_value< Traits >& v, const std::string& key )
      {
         return v.find( key );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] const basic_value< Traits >* find( const basic_value< Traits >& v, const std::size_t index )
      {
         const auto& a = v.get_array();
         return ( index < a.size() ) ? ( a.data() + index ) : nullptr;
      }

   }  // namespace internal

   template< template< typename... > class Traits, typename K >
   [[nodiscard]] basic_value< Traits > value( const basic_value< Traits >& v, const K& key )
   {
      if( const auto& w = v.skip_value_ptr() ) {
         if( const auto* p = internal::find( w, key ) ) {
            return basic_value< Traits >( &p->skip_value_ptr() );  // Returns a Value with tao::json::type::VALUE_PTR that is invalidated when v is destroyed!
         }
      }
      return basic_value< Traits >();
   }

   template< template< typename... > class Traits, typename K, typename... Ks >
   [[nodiscard]] basic_value< Traits > value( const basic_value< Traits >& v, const K& key, const Ks&... ks )
   {
      if( const auto& w = v.skip_value_ptr() ) {
         if( const auto* p = internal::find( w, key ) ) {
            return get::value( *p, ks... );
         }
      }
      return basic_value< Traits >();
   }

   template< typename T, typename U, template< typename... > class Traits >
   [[nodiscard]] T as( const basic_value< Traits >& v )
   {
      return v.skip_value_ptr().template as< U >();
   }

   template< typename T, template< typename... > class Traits >
   [[nodiscard]] auto as( const basic_value< Traits >& v )
   {
      return as< T, T >( v );
   }

   template< typename T, typename U, template< typename... > class Traits, typename K, typename... Ks >
   [[nodiscard]] T as( const basic_value< Traits >& v, const K& key, Ks&&... ks )
   {
      return get::as< T, U >( v.skip_value_ptr().at( key ), ks... );
   }

   template< typename T, template< typename... > class Traits, typename K, typename... Ks >
   [[nodiscard]] auto as( const basic_value< Traits >& v, const K& key, Ks&&... ks )
   {
      return as< T, T >( v, key, ks... );
   }

   template< typename T, template< typename... > class Traits >
   void to( const basic_value< Traits >& v, T& t )
   {
      v.skip_value_ptr().to( t );
   }

   template< typename T, template< typename... > class Traits, typename K, typename... Ks >
   void to( const basic_value< Traits >& v, T& t, const K& key, Ks&&... ks )
   {
      get::to( v.skip_value_ptr().at( key ), t, ks... );
   }

   template< typename T, typename U, template< typename... > class Traits >
   [[nodiscard]] std::optional< T > optional( const basic_value< Traits >& v )
   {
      if( const auto& w = v.skip_value_ptr() ) {
         return std::optional< T >( std::in_place, get::as< U >( w ) );
      }
      return std::nullopt;
   }

   template< typename T, template< typename... > class Traits >
   [[nodiscard]] auto optional( const basic_value< Traits >& v )
   {
      return optional< T, T >( v );
   }

   template< typename T, typename U, template< typename... > class Traits, typename K, typename... Ks >
   [[nodiscard]] std::optional< T > optional( const basic_value< Traits >& v, const K& key, const Ks&... ks )
   {
      if( const auto& w = v.skip_value_ptr() ) {
         if( const auto* p = internal::find( w, key ) ) {
            return get::optional< T, U >( *p, ks... );
         }
      }
      return std::nullopt;
   }

   template< typename T, template< typename... > class Traits, typename K, typename... Ks >
   [[nodiscard]] auto optional( const basic_value< Traits >& v, const K& key, const Ks&... ks )
   {
      return optional< T, T >( v, key, ks... );
   }

   template< typename T, typename U, template< typename... > class Traits >
   [[nodiscard]] T defaulted( const T& t, const basic_value< Traits >& v )
   {
      if( const auto& w = v.skip_value_ptr() ) {
         return get::as< T, U >( w );
      }
      return t;
   }

   template< typename T, template< typename... > class Traits >
   [[nodiscard]] auto defaulted( const T& t, const basic_value< Traits >& v )
   {
      return defaulted< T, T >( t, v );
   }

   template< typename T, typename U, template< typename... > class Traits, typename K, typename... Ks >
   [[nodiscard]] T defaulted( const T& t, const basic_value< Traits >& v, const K& key, const Ks&... ks )
   {
      if( const auto& w = v.skip_value_ptr() ) {
         if( const auto* p = internal::find( w, key ) ) {
            return get::defaulted< T, U >( t, *p, ks... );
         }
      }
      return t;
   }

   template< typename T, template< typename... > class Traits, typename K, typename... Ks >
   [[nodiscard]] auto defaulted( const T& t, const basic_value< Traits >& v, const K& key, const Ks&... ks )
   {
      return defaulted< T, T >( t, v, key, ks... );
   }

}  // namespace tao::json::get

#endif
