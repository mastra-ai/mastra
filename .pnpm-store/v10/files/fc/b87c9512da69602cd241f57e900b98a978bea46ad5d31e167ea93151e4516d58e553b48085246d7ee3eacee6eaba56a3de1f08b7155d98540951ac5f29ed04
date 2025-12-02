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
  // First try V3
  try {
    const awsV3 = await import('@aws-sdk/credential-provider-node');
    if (typeof awsV3.defaultProvider === 'function') {
      return awsV3.defaultProvider();
    }
  } catch (err) {
    // Ignore
  }
  try {
    const awsV2 = await import('aws-sdk');
    if (awsV2.default && typeof awsV2.default.config.getCredentials === 'function') {
      return () =>
        new Promise((resolve, reject) => {
          awsV2.default.config.getCredentials((err, credentials) => {
            if (err) {
              reject(err);
            } else {
              resolve(credentials);
            }
          });
        });
    }
  } catch (err) {
    // Ignore
  }

  throw new AwsSigv4SignerError(
    'Unable to find a valid AWS SDK, please provide a valid getCredentials function to AwsSigv4Signer options.'
  );
};

const AwsSigv4Signer = giveAwsV4Signer(
  giveAwsCredentialProviderLoader(getAwsSDKCredentialsProvider)
);

module.exports = AwsSigv4Signer;
