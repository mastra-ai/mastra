/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 */

'use strict';
const AwsSigv4SignerError = require('./errors');
const { giveAwsV4Signer, giveAwsCredentialProviderLoader } = require('./shared');

const getAwsSDKCredentialsProvider = async () => {
  try {
    const awsV3 = await import('@aws-sdk/credential-provider-node');
    if (typeof awsV3.defaultProvider === 'function') {
      return awsV3.defaultProvider();
    }
  } catch (err) {
    throw new AwsSigv4SignerError(
      "Missing '@aws-sdk/credential-provider-node' module. Install it as a dependency."
    );
  }
};

const AwsSigv4Signer = giveAwsV4Signer(
  giveAwsCredentialProviderLoader(getAwsSDKCredentialsProvider)
);

module.exports = AwsSigv4Signer;
