// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "file_util.h"

#include <fstream>
#include <iostream>
#include <streambuf>
#include <string>

namespace bssl {

namespace fillins {

bool ReadFileToString(const FilePath &path, std::string *out) {
  std::ifstream file(path.value(), std::ios::binary);
  file.unsetf(std::ios::skipws);

  file.seekg(0, std::ios::end);
  if (file.tellg() <= 0) {
    return false;
  }
  out->reserve(file.tellg());
  file.seekg(0, std::ios::beg);

  out->assign(std::istreambuf_iterator<char>(file),
              std::istreambuf_iterator<char>());

  return true;
}

}  // namespace fillins

}  // namespace bssl
