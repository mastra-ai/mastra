// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_PKI_CERT_ISSUER_SOURCE_H_
#define BSSL_PKI_CERT_ISSUER_SOURCE_H_

#include "fillins/openssl_util.h"
#include <memory>
#include <vector>



#include "parsed_certificate.h"

namespace bssl {

// Interface for looking up issuers of a certificate during path building.
// Provides a synchronous and asynchronous method for retrieving issuers, so the
// path builder can try to complete synchronously first. The caller is expected
// to call SyncGetIssuersOf first, see if it can make progress with those
// results, and if not, then fall back to calling AsyncGetIssuersOf.
// An implementations may choose to return results from either one of the Get
// methods, or from both.
class OPENSSL_EXPORT CertIssuerSource {
 public:
  class OPENSSL_EXPORT Request {
   public:
    Request() = default;

    Request(const Request&) = delete;
    Request& operator=(const Request&) = delete;

    // Destruction of the Request cancels it.
    virtual ~Request() = default;

    // Retrieves issuers and appends them to |issuers|.
    //
    // GetNext should be called again to retrieve any remaining issuers.
    //
    // If no issuers are left then |issuers| will not be modified. This
    // indicates that the issuers have been exhausted and GetNext() should
    // not be called again.
    virtual void GetNext(ParsedCertificateList* issuers,
                         void* debug_data) = 0;
  };

  virtual ~CertIssuerSource() = default;

  // Finds certificates whose Subject matches |cert|'s Issuer.
  // Matches are appended to |issuers|. Any existing contents of |issuers| will
  // not be modified. If the implementation does not support synchronous
  // lookups, or if there are no matches, |issuers| is not modified.
  virtual void SyncGetIssuersOf(const ParsedCertificate* cert,
                                ParsedCertificateList* issuers) = 0;

  // Finds certificates whose Subject matches |cert|'s Issuer.
  // If the implementation does not support asynchronous lookups or can
  // determine synchronously that it would return no results, |*out_req|
  // will be set to nullptr.
  //
  // Otherwise a request is started and saved to |out_req|. The results can be
  // read through the Request interface.
  virtual void AsyncGetIssuersOf(const ParsedCertificate* cert,
                                 std::unique_ptr<Request>* out_req) = 0;
};

}  // namespace net

#endif  // BSSL_PKI_CERT_ISSUER_SOURCE_H_
