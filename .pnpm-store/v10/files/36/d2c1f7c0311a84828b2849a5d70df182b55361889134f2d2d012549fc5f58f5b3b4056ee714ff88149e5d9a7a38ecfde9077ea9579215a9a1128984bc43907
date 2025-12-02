// Copyright (c) 2016-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CONTRIB_REFERENCE_HPP
#define TAO_JSON_CONTRIB_REFERENCE_HPP

#include "../internal/uri_fragment.hpp"
#include "../pointer.hpp"
#include "../value.hpp"

namespace tao::json
{
   namespace internal
   {
      // JSON Reference, see draft ("work in progress") RFC at
      // https://tools.ietf.org/html/draft-pbryan-zyp-json-ref-03

      // NOTE: Currently, only URI fragments are supported.
      // Remote references are ignored, i.e., left untouched.

      // JSON References are replaced with a VALUE_PTR,
      // which might lead to infinite loops if you try
      // to traverse the value. Make sure you understand
      // the consequences and handle the resulting value
      // accordingly!

      // Self-references will throw an exception, as well as
      // references into JSON Reference additional members
      // (which shall be ignored as per the specification).

      template< template< typename... > class Traits >
      void resolve_references( basic_value< Traits >& r, basic_value< Traits >& v )
      {
         switch( v.type() ) {
            case type::UNINITIALIZED:
            case type::NULL_:
            case type::BOOLEAN:
            case type::SIGNED:
            case type::UNSIGNED:
            case type::DOUBLE:
            case type::STRING:
            case type::STRING_VIEW:
            case type::BINARY:
            case type::BINARY_VIEW:
            case type::VALUE_PTR:
            case type::OPAQUE_PTR:
            case type::VALUELESS_BY_EXCEPTION:
               return;

            case type::ARRAY:
               for( auto& e : v.get_array() ) {
                  resolve_references( r, e );
               }
               return;

            case type::OBJECT:
               for( auto& e : v.get_object() ) {
                  resolve_references( r, e.second );
               }
               if( const auto* ref = v.find( "$ref" ) ) {
                  ref = &ref->skip_value_ptr();
                  if( ref->is_string_type() ) {
                     const std::string_view s = ref->get_string_type();
                     if( !s.empty() && s[ 0 ] == '#' ) {
                        const pointer ptr = internal::uri_fragment_to_pointer( s );
                        const auto* p = &r;
                        auto it = ptr.begin();
                        while( it != ptr.end() ) {
                           switch( p->type() ) {
                              case type::ARRAY:
                                 p = &p->at( it->index() ).skip_value_ptr();
                                 break;
                              case type::OBJECT:
                                 if( const auto* t = p->find( "$ref" ) ) {
                                    if( t->is_string_type() ) {
                                       throw std::runtime_error( "invalid JSON Reference: referencing additional data members is invalid" );
                                    }
                                 }
                                 p = &p->at( it->key() ).skip_value_ptr();
                                 break;
                              default:
                                 throw invalid_type( ptr.begin(), std::next( it ) );
                           }
                           ++it;
                        }
                        if( p == &v ) {
                           throw std::runtime_error( "JSON Reference: invalid self reference" );
                        }
                        v.set_value_ptr( p );
                        resolve_references( r, v );
                     }
                     else {
                        // Ignore remote references for now...
                        // throw std::runtime_error( "JSON Reference: unsupported or invalid URI: " + s ); // NOLINT
                     }
                  }
               }
               return;
         }
         throw std::logic_error( "invalid value for tao::json::type" );  // LCOV_EXCL_LINE
      }

   }  // namespace internal

   template< template< typename... > class Traits >
   void resolve_references( basic_value< Traits >& r )
   {
      internal::resolve_references( r, r );
   }

}  // namespace tao::json

#endif
