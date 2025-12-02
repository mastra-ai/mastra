# BoringSSL pki - Web PKI Certificate path building and verification library

This directory and library should be considered experimental and should not be
depended upon not to change without notice.  You should not use this.

It contains an extracted and modified copy of chrome's certificate
verifier core logic.

It is for the moment, intended to be synchronized from a checkout of chrome's
head with the IMPORT script run in this directory. The eventual goal is to
make both chrome and google3 consume this.

## Current status:
 * Some of the Path Builder tests depending on chrome testing classes and
   SavedUserData are disabled. These probably need either a mimicing
   SaveUserData class here, or be pulled out into chrome only.
 * This contains a copy of der as bssl:der - a consideration for
   re-integrating with chromium. the encode_values part of der does not include
   the base::time or absl::time based stuff as they are not used within the
   library, this should probably be split out for chrome, or chrome's der could
   be modified (along with this one and eventually merged together) to not use
   base::time for encoding GeneralizedTimes, but rather use boringssl posix
   times as does the rest of this library.
 * The Name Constraint limitation code is modified to remove clamped_math
   and mimic BoringSSL's overall limits - Some of the tests that test
   for specific edge cases for chrome's limits have been disabled. The
   tests need to be changed to reflect the overall limit, or ignored
   and we make name constraints subquadratic and stop caring about this.
 * Fuzzer targets are not yet hooked up.
 


