# Interface: AwsCredentialsProviderInit

[oidc](../modules/oidc.md).AwsCredentialsProviderInit

The init object for the `awsCredentialsProvider` function.

## Hierarchy

- [`Omit`](https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys)<`FromWebTokenInit`, `"webIdentityToken"`\>

  ↳ **`AwsCredentialsProviderInit`**

## Table of contents

### Properties

- [clientConfig](oidc.AwsCredentialsProviderInit.md#clientconfig)
- [clientPlugins](oidc.AwsCredentialsProviderInit.md#clientplugins)
- [durationSeconds](oidc.AwsCredentialsProviderInit.md#durationseconds)
- [logger](oidc.AwsCredentialsProviderInit.md#logger)
- [parentClientConfig](oidc.AwsCredentialsProviderInit.md#parentclientconfig)
- [policy](oidc.AwsCredentialsProviderInit.md#policy)
- [policyArns](oidc.AwsCredentialsProviderInit.md#policyarns)
- [providerId](oidc.AwsCredentialsProviderInit.md#providerid)
- [roleArn](oidc.AwsCredentialsProviderInit.md#rolearn)
- [roleAssumerWithWebIdentity](oidc.AwsCredentialsProviderInit.md#roleassumerwithwebidentity)
- [roleSessionName](oidc.AwsCredentialsProviderInit.md#rolesessionname)

## Properties

### clientConfig

• `Optional` **clientConfig**: `any`

Custom STS client configurations overriding the default ones.

#### Inherited from

Omit.clientConfig

#### Defined in

node*modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.609.0*@aws-sdk+client-sts@3.731.1/node_modules/@aws-sdk/credential-provider-web-identity/dist-types/fromWebToken.d.ts:135

---

### clientPlugins

• `Optional` **clientPlugins**: `Pluggable`<`any`, `any`\>[]

Custom STS client middleware plugin to modify the client default behavior.

#### Inherited from

Omit.clientPlugins

#### Defined in

node*modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.609.0*@aws-sdk+client-sts@3.731.1/node_modules/@aws-sdk/credential-provider-web-identity/dist-types/fromWebToken.d.ts:139

---

### durationSeconds

• **durationSeconds**: `undefined` \| `number`

The duration, in seconds, of the role session. Defaults to 3600 seconds.

#### Inherited from

Omit.durationSeconds

---

### logger

• `Optional` **logger**: `Logger`

This logger is only used to provide information
on what credential providers were used during resolution.

It does not log credentials.

#### Inherited from

Omit.logger

#### Defined in

node_modules/.pnpm/@aws-sdk+types@3.609.0/node_modules/@aws-sdk/types/dist-types/credentials.d.ts:31

---

### parentClientConfig

• `Optional` **parentClientConfig**: `Object`

Present if the credential provider was created by calling
the defaultCredentialProvider in a client's middleware, having
access to the client's config.

The region of that parent or outer client is important because
an inner client used by the credential provider may need
to match its default partition or region with that of
the outer client.

**`Deprecated`**

- not truly deprecated, marked as a warning to not use this.

#### Index signature

▪ [key: `string`]: `unknown`

#### Type declaration

| Name      | Type                              |
| :-------- | :-------------------------------- |
| `region?` | `string` \| `Provider`<`string`\> |

#### Inherited from

Omit.parentClientConfig

#### Defined in

node_modules/.pnpm/@aws-sdk+types@3.609.0/node_modules/@aws-sdk/types/dist-types/credentials.d.ts:45

---

### policy

• **policy**: `undefined` \| `string`

An IAM policy in JSON format that you want to use as an inline session policy.

#### Inherited from

Omit.policy

---

### policyArns

• **policyArns**: `undefined` \| { `arn?`: `string` }[]

ARNs of the IAM managed policies that you want to use as managed session policies.

#### Inherited from

Omit.policyArns

---

### providerId

• **providerId**: `undefined` \| `string`

The fully qualified host component of the domain name of the identity provider.

#### Inherited from

Omit.providerId

---

### roleArn

• **roleArn**: `string`

ARN of the role that the caller is assuming.

#### Inherited from

Omit.roleArn

---

### roleAssumerWithWebIdentity

• `Optional` **roleAssumerWithWebIdentity**: (`params`: `AssumeRoleWithWebIdentityParams`) => [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)<`AwsCredentialIdentity`\>

#### Type declaration

▸ (`params`): [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)<`AwsCredentialIdentity`\>

A function that assumes a role with web identity and returns a promise fulfilled with credentials for the assumed role.

##### Parameters

| Name     | Type                              |
| :------- | :-------------------------------- |
| `params` | `AssumeRoleWithWebIdentityParams` |

##### Returns

[`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)<`AwsCredentialIdentity`\>

#### Inherited from

Omit.roleAssumerWithWebIdentity

#### Defined in

node*modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.609.0*@aws-sdk+client-sts@3.731.1/node_modules/@aws-sdk/credential-provider-web-identity/dist-types/fromWebToken.d.ts:130

---

### roleSessionName

• `Optional` **roleSessionName**: `string`

An identifier for the assumed role session.

#### Inherited from

Omit.roleSessionName

#### Defined in

node*modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.609.0*@aws-sdk+client-sts@3.731.1/node_modules/@aws-sdk/credential-provider-web-identity/dist-types/fromWebToken.d.ts:123
