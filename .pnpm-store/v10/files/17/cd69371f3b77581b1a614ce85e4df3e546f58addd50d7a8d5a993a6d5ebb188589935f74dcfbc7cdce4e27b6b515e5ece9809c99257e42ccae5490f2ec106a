# Couchbase Node.js Client

The Node.js SDK library allows you to connect to a Couchbase cluster from
Node.js. It is a native Node.js module and uses the very fast libcouchbase
library to handle communicating to the cluster over the Couchbase binary
protocol.

## Useful Links

Source - [https://github.com/couchbase/couchnode](https://github.com/couchbase/couchnode)

Bug Tracker - [https://jira.issues.couchbase.com/projects/JSCBC/issues/](https://jira.issues.couchbase.com/projects/JSCBC/issues/)

Couchbase Developer Portal - [https://docs.couchbase.com/](https://docs.couchbase.com/nodejs-sdk/3.0/hello-world/start-using-sdk.html)

Release Notes - [https://docs.couchbase.com/nodejs-sdk/3.0/project-docs/sdk-release-notes.html](https://docs.couchbase.com/nodejs-sdk/3.0/project-docs/sdk-release-notes.html)

## Installing

To install the lastest release using npm, run:

```bash
npm install couchbase
```

To install the development version directly from github, run:

```bash
npm install "git+https://github.com/couchbase/couchnode.git#master"
```

## Introduction

Connecting to a Couchbase bucket is as simple as creating a new `Cluster`
instance to represent the `Cluster` you are using, and then using the
`bucket` and `collection` commands against this to open a connection to
open your specific bucket and collection. You are able to execute most
operations immediately, and they will be queued until the connection is
successfully established.

Here is a simple example of instantiating a connection, adding a new document
into the bucket and then retrieving its contents:

**Javascript:**
```javascript
const couchbase = require('couchbase')

async function main() {
  const cluster = await couchbase.connect(
    'couchbase://127.0.0.1',
    {
      username: 'username',
      password: 'password',
    })

  const bucket = cluster.bucket('default')
  const coll = bucket.defaultCollection()
  await coll.upsert('testdoc', { foo: 'bar' })

  const res = await coll.get('testdoc')
  console.log(res.content)
}

// Run the main function
main()
  .then((_) => {
    console.log ('Success!')
  })
  .catch((err) => {
    console.log('ERR:', err)
  })
```

**Typescript:**
```javascript
import {
  Bucket,
  Cluster,
  Collection,
  connect,
  GetResult,
} from 'couchbase'

async function main() {
  const cluster: Cluster = await connect(
    'couchbase://127.0.0.1',
    {
      username: 'username',
      password: 'password',
    })

  const bucket: Bucket = cluster.bucket('default')
  const coll: Collection = bucket.defaultCollection()
  await coll.upsert('testdoc', { foo: 'bar' })

  const res: GetResult = await coll.get('testdoc')
  console.log(res.content)
}

// Run the main function
main()
  .then((_) => {
    console.log ('Success!')
  })
  .catch((err) => {
    console.log('ERR:', err)
  })
```

## AWS Lambda

Version 4.2.5 of the SDK significantly reduces the size of the prebuilt binary provided with the SDK on supported platforms. The reduction
enables the SDK to meet the [minimum size requirements](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html) for an AWS lambda deployment package without extra steps for reducing the size of the package.  However, if further size reduction is desired, the SDK provides a script to provide recommendations for size reduction.

**Script:**
```bash
npm explore couchbase -- npm run help-prune
```

**Example output:**
```bash
Checking for platform packages in /tmp/couchnode-test/node_modules/@couchbase that do not match the expected platform package (couchbase-linux-x64-openssl1).
Found mismatch: Path=/tmp/couchnode-test/node_modules/@couchbase/couchbase-linuxmusl-x64-openssl1

Recommendations for pruning:

Removing mismatched platform=couchbase-linuxmusl-x64-openssl1 (path=/tmp/couchnode-test/node_modules/@couchbase/couchbase-linuxmusl-x64-openssl1) saves ~13.31 MB on disk.
Removing Couchbase deps/ (path=/tmp/couchnode-test/node_modules/couchbase/deps) saves ~45.51 MB on disk.
Removing Couchbase src/ (path=/tmp/couchnode-test/node_modules/couchbase/src) saves ~0.61 MB on disk.
```

## Documentation

An extensive documentation is available on the Couchbase website - [https://docs.couchbase.com/nodejs-sdk/3.0/hello-world/start-using-sdk.html](https://docs.couchbase.com/nodejs-sdk/3.0/hello-world/start-using-sdk.html) -
including numerous examples and code samples.

Visit our [Couchbase Node.js SDK forum](https://forums.couchbase.com/c/node-js-sdk) for help.
Or get involved in the [Couchbase Community](https://couchbase.com/community) on the [Couchbase](https://couchbase.com) website.

## Source Control

The source code is available at
[https://github.com/couchbase/couchnode](https://github.com/couchbase/couchnode).
Once you have cloned the repository, you may contribute changes through our
gerrit server. For more details see
[CONTRIBUTING.md](https://github.com/couchbase/couchnode/blob/master/CONTRIBUTING.md).

To build the client, follow the steps outlined on the [BUILDING page](https://github.com/couchbase/couchnode/blob/main/BUILDING.md)

To execute our test suite, run `make test` from the root directory.

To execute our code coverage, run `make cover` from the root directory.

In addition to the full test suite and full code coverage, you may additionally
execute a subset of the tests which excludes slow-running tests for quick
verifications. These can be run through `make fasttest` and `make fastcover`
respectively.

Finally, to build the API reference for the project, run `make docs` from the
root directory, and a docs folder will be created with the api reference.

# Support & Additional Resources

If you found an issue, please file it in our [Github issues](https://github.com/couchbase/couchnode/issues).  We will bring over the issue to our [JIRA](https://jira.issues.couchbase.com/projects/JSCBC/issues/) as needed.

The Couchbase Discord server is a place where you can collaborate about all things Couchbase. Connect with others from the community, learn tips and tricks, and ask questions. [Join Discord and contribute](https://discord.com/invite/sQ5qbPZuTh).

You can ask questions in our [forums](https://forums.couchbase.com/).

## License

Copyright 2013 Couchbase Inc.

Licensed under the Apache License, Version 2.0.

See
[LICENSE](https://github.com/couchbase/couchnode/blob/master/LICENSE)
for further details.
