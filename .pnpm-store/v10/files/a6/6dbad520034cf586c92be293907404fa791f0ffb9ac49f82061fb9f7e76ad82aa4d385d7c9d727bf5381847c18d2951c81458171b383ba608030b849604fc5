// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_FILLINS_LOG_H_
#define BSSL_FILLINS_LOG_H_

#include <iostream>

// This header defines the logging macros, inherited from chrome.

// This file is not used in chrome, so check here to make sure we are
// only compiling inside boringssl.
#if !defined(_BORINGSSL_LIBPKI_)
#error "_BORINGSSL_LIBPKI_ is not defined when compiling BoringSSL libpki"
#endif

#if defined(_BORINGSSL_LIBPKI_VERBOSE_)
#define DVLOG(l) std::cerr
#define LOG(l) std::cerr
#else
#define DVLOG(l) 0 && std::cerr
#define LOG(l) 0 && std::cerr
#endif  // _BORINGSSL_LIBPKI_VERBOSE_

#endif  // BSSL_FILLINS_LOG_H_
