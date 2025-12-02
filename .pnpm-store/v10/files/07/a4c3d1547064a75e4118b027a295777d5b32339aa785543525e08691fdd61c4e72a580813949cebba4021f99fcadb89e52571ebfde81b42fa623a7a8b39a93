// Copyright 2017 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "nist_pkits_unittest.h"

#include "certificate_policies.h"

#include <sstream>

namespace bssl {

namespace {

// 2.16.840.1.101.3.2.1.48.1
const uint8_t kTestPolicy1[] = {0x60, 0x86, 0x48, 0x01, 0x65,
                                0x03, 0x02, 0x01, 0x30, 0x01};

// 2.16.840.1.101.3.2.1.48.2
const uint8_t kTestPolicy2[] = {0x60, 0x86, 0x48, 0x01, 0x65,
                                0x03, 0x02, 0x01, 0x30, 0x02};

// 2.16.840.1.101.3.2.1.48.3
const uint8_t kTestPolicy3[] = {0x60, 0x86, 0x48, 0x01, 0x65,
                                0x03, 0x02, 0x01, 0x30, 0x03};

// 2.16.840.1.101.3.2.1.48.6
const uint8_t kTestPolicy6[] = {0x60, 0x86, 0x48, 0x01, 0x65,
                                0x03, 0x02, 0x01, 0x30, 0x06};

void SetPolicySetFromString(const char* const policy_names,
                            std::set<der::Input>* out) {
  out->clear();
  std::istringstream stream(policy_names);
  for (std::string line; std::getline(stream, line, ',');) {
    size_t start = line.find_first_not_of(" \n\t\r\f\v");
    if (start == std::string::npos) {
      continue;
    }
    size_t end = line.find_last_not_of(" \n\t\r\f\v");
    if (end == std::string::npos) {
      continue;
    }
    std::string policy_name = line.substr(start, end + 1);
    if (policy_name.empty()) {
      continue;
    }

    if (policy_name == "anyPolicy") {
      out->insert(der::Input(kAnyPolicyOid));
    } else if (policy_name == "NIST-test-policy-1") {
      out->insert(der::Input(kTestPolicy1));
    } else if (policy_name == "NIST-test-policy-2") {
      out->insert(der::Input(kTestPolicy2));
    } else if (policy_name == "NIST-test-policy-3") {
      out->insert(der::Input(kTestPolicy3));
    } else if (policy_name == "NIST-test-policy-6") {
      out->insert(der::Input(kTestPolicy6));
    } else {
      ADD_FAILURE() << "Unknown policy name: " << policy_name;
    }
  }
}

}  // namespace

PkitsTestInfo::PkitsTestInfo() {
  SetInitialPolicySet("anyPolicy");
  SetUserConstrainedPolicySet("NIST-test-policy-1");
}

PkitsTestInfo::PkitsTestInfo(const PkitsTestInfo& other) = default;

PkitsTestInfo::~PkitsTestInfo() = default;

void PkitsTestInfo::SetInitialExplicitPolicy(bool b) {
  initial_explicit_policy =
      b ? InitialExplicitPolicy::kTrue : InitialExplicitPolicy::kFalse;
}

void PkitsTestInfo::SetInitialPolicyMappingInhibit(bool b) {
  initial_policy_mapping_inhibit = b ? InitialPolicyMappingInhibit::kTrue
                                     : InitialPolicyMappingInhibit::kFalse;
}

void PkitsTestInfo::SetInitialInhibitAnyPolicy(bool b) {
  initial_inhibit_any_policy =
      b ? InitialAnyPolicyInhibit::kTrue : InitialAnyPolicyInhibit::kFalse;
}

void PkitsTestInfo::SetInitialPolicySet(const char* const policy_names) {
  SetPolicySetFromString(policy_names, &initial_policy_set);
}

void PkitsTestInfo::SetUserConstrainedPolicySet(
    const char* const policy_names) {
  SetPolicySetFromString(policy_names, &user_constrained_policy_set);
}

}  // namespace net
