#ifndef TAO_JSON_CONTRIB_POINTER_TRAITS_HPP
#define TAO_JSON_CONTRIB_POINTER_TRAITS_HPP

#include "../pointer.hpp"
#include "../traits.hpp"

namespace tao::json
{
   struct token_traits
   {
      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, const token& t )
      {
         if( t.has_index() ) {
            v = t.index();
         }
         else {
            v = t.key();
         }
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const token& t )
      {
         if( t.has_index() ) {
            json::events::produce< Traits >( c, t.index() );
         }
         else {
            json::events::produce< Traits >( c, t.key() );
         }
      }
   };

   struct pointer_traits
   {
      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, const pointer& p )
      {
         v.prepare_array().reserve( p.size() );
         for( const auto& i : p ) {
            v.emplace_back( i );
         }
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const pointer& p )
      {
         c.begin_array( p.size() );
         for( const auto& i : p ) {
            json::events::produce< Traits >( c, i );
            c.element();
         }
         c.end_array( p.size() );
      }
   };

}  // namespace tao::json

#endif
