// Copyright (c) 2020-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_PRINT_COVERAGE_HPP
#define TAO_PEGTL_CONTRIB_PRINT_COVERAGE_HPP

#include <ostream>

#include "coverage.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   inline std::ostream& operator<<( std::ostream& os, const coverage_result& result )
   {
      os << "[\n";
      bool f = true;
      for( const auto& [ k, v ] : result ) {
         if( f ) {
            f = false;
         }
         else {
            os << ",\n";
         }
         os << "  {\n"
            << "    \"rule\": \"" << k << "\",\n"
            << "    \"start\": " << v.start << ", \"success\": " << v.success << ", \"failure\": " << v.failure << ", \"unwind\": " << v.unwind << ", \"raise\": " << v.raise << ",\n";
         if( v.branches.empty() ) {
            os << "    \"branches\": []\n";
         }
         else {
            os << "    \"branches\": [\n";
            bool f2 = true;
            for( const auto& [ k2, v2 ] : v.branches ) {
               if( f2 ) {
                  f2 = false;
               }
               else {
                  os << ",\n";
               }
               os << "      { \"branch\": \"" << k2 << "\", \"start\": " << v2.start << ", \"success\": " << v2.success << ", \"failure\": " << v2.failure << ", \"unwind\": " << v2.unwind << ", \"raise\": " << v2.raise << " }";
            }
            os << "\n    ]\n";
         }
         os << "  }";
      }
      os << "\n";
      os << "]\n";
      return os;
   }

}  // namespace TAO_PEGTL_NAMESPACE

#endif
