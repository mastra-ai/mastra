# Module: oidc

## Table of contents

### Interfaces

- [AwsCredentialsProviderInit](../interfaces/oidc.AwsCredentialsProviderInit.md)

### Functions

- [awsCredentialsProvider](oidc.md#awscredentialsprovider)
- [getVercelOidcToken](oidc.md#getverceloidctoken)

## Functions

### awsCredentialsProvider

▸ **awsCredentialsProvider**(`init`): `AwsCredentialIdentityProvider`

Obtains the Vercel OIDC token and creates an AWS credential provider function
that gets AWS credentials by calling STS AssumeRoleWithWebIdentity API.

**`Example`**

```js
import * as s3 from '@aws-sdk/client-s3';
import { awsCredentialsProvider } from '@vercel/functions/oidc';

const s3Client = new s3.S3Client({
  credentials: awsCredentialsProvider({
    roleArn: 'arn:aws:iam::1234567890:role/RoleA',
    clientConfig: { region: 'us-west-2' },
    clientPlugins: [addFooHeadersPlugin],
    roleAssumerWithWebIdentity: customRoleAssumer,
    roleSessionName: 'session_123',
    providerId: 'graph.facebook.com',
    policyArns: [{ arn: 'arn:aws:iam::1234567890:policy/SomePolicy' }],
    policy:
      '{"Statement": [{"Effect": "Allow", "Action": "s3:ListBucket", "Resource": "*"}]}',
    durationSeconds: 7200,
  }),
});
```

#### Parameters

| Name   | Type                                                                             | Description                |
| :----- | :------------------------------------------------------------------------------- | :------------------------- |
| `init` | [`AwsCredentialsProviderInit`](../interfaces/oidc.AwsCredentialsProviderInit.md) | The initialization object. |

#### Returns

`AwsCredentialIdentityProvider`

A function that provides AWS credentials.

#### Defined in

[packages/functions/src/oidc/aws-credentials-provider.ts:60](https://github.com/vercel/vercel/blob/main/packages/functions/src/oidc/aws-credentials-provider.ts#L60)

---

### getVercelOidcToken

▸ **getVercelOidcToken**(): [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)<`string`\>

Returns the OIDC token from the request context or the environment variable.

This function first checks if the OIDC token is available in the environment variable
`VERCEL_OIDC_TOKEN`. If it is not found there, it retrieves the token from the request
context headers.

**`Throws`**

If the `x-vercel-oidc-token` header is missing from the request context and the environment variable `VERCEL_OIDC_TOKEN` is not set.

**`Example`**

```js
// Using the OIDC token
getVercelOidcToken()
  .then(token => {
    console.log('OIDC Token:', token);
  })
  .catch(error => {
    console.error('Error:', error.message);
  });
```

#### Returns

[`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)<`string`\>

A promise that resolves to the OIDC token.

#### Defined in

[packages/functions/src/oidc/get-vercel-oidc-token.ts:24](https://github.com/vercel/vercel/blob/main/packages/functions/src/oidc/get-vercel-oidc-token.ts#L24)
