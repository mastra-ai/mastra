// Copyright (c) 2019-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_PARSE_TREE_TO_DOT_HPP
#define TAO_PEGTL_CONTRIB_PARSE_TREE_TO_DOT_HPP

#include <cassert>
#include <ostream>
#include <string>

#include "parse_tree.hpp"

namespace TAO_PEGTL_NAMESPACE::parse_tree
{
   namespace internal
   {
      inline void escape( std::ostream& os, const std::string_view s )
      {
         static const char* h = "0123456789abcdef";

         const char* p = s.data();
         const char* l = p;
         const char* const e = s.data() + s.size();
         while( p != e ) {
            const unsigned char c = *p;
            if( c == '\\' ) {
               os.write( l, p - l );
               l = ++p;
               os << "\\\\\\\\";
            }
            else if( c == '"' ) {
               os.write( l, p - l );
               l = ++p;
               os << "\\\\\\\"";
            }
            else if( c < 32 ) {
               os.write( l, p - l );
               l = ++p;
               switch( c ) {
                  case '\a':
                     os << "\\\\a";
                     break;
                  case '\b':
                     os << "\\\\b";
                     break;
                  case '\f':
                     os << "\\\\f";
                     break;
                  case '\n':
                     os << "\\\\n";
                     break;
                  case '\r':
                     os << "\\\\r";
                     break;
                  case '\t':
                     os << "\\\\t";
                     break;
                  case '\v':
                     os << "\\\\v";
                     break;
                  default:
                     os << "\\\\u00" << h[ ( c & 0xf0 ) >> 4 ] << h[ c & 0x0f ];
               }
            }
            else if( c == 127 ) {
               os.write( l, p - l );
               l = ++p;
               os << "\\\\u007f";
            }
            else {
               ++p;
            }
         }
         os.write( l, p - l );
      }

      template< typename Node >
      void print_dot_node( std::ostream& os, const Node& n, const std::string_view s )
      {
         os << "  x" << &n << " [ label=\"";
         escape( os, s );
         if( n.has_content() ) {
            os << "\\n\\\"";
            escape( os, n.string_view() );
            os << "\\\"";
         }
         os << "\" ]\n";
         if( !n.children.empty() ) {
            os << "  x" << &n << " -> { ";
            for( auto& up : n.children ) {
               os << "x" << up.get() << ( ( up == n.children.back() ) ? " }\n" : ", " );
            }
            for( auto& up : n.children ) {
               print_dot_node( os, *up, up->type );
            }
         }
      }

   }  // namespace internal

   template< typename Node >
   void print_dot( std::ostream& os, const Node& n )
   {
      os << "digraph parse_tree\n{\n";
      internal::print_dot_node( os, n, n.is_root() ? "ROOT" : n.type );
      os << "}\n";
   }

}  // namespace TAO_PEGTL_NAMESPACE::parse_tree

#endif
