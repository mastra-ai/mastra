// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "cert_error_id.h"

namespace bssl {

const char* CertErrorIdToDebugString(CertErrorId id) {
  // The CertErrorId is simply a pointer for a C-string literal.
  return reinterpret_cast<const char*>(id);
}

}  // namespace net
