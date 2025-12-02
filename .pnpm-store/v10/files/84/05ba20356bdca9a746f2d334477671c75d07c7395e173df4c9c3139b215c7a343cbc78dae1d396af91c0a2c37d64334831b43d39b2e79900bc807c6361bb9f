# @jpwilliams/waitgroup

![npm version](https://img.shields.io/npm/v/@jpwilliams/waitgroup) ![Test on push](https://github.com/jpwilliams/waitgroup/workflows/Test%20on%20push/badge.svg) ![Downloads](https://img.shields.io/npm/dm/@jpwilliams/waitgroup)

A tiny version of Golang's [WaitGroup](https://golang.org/pkg/sync/#WaitGroup) for Node.js and the browser with typings, promises, and zero dependencies.

```sh
npm install @jpwilliams/waitgroup
```

```ts
import http from "http";
import { WaitGroup } from "@jpwilliams/waitgroup";

async function main() {
  const wg = new WaitGroup();

  const urls = [
    "http://www.golang.org/",
    "http://www.google.com/",
    "http://www.somestupidname.com/",
  ];

  urls.forEach((url) => {
    // Increment the WaitGroup counter
    wg.add(1);
    // Fetch the URL
    http.get(url, () => {
      // Decrement the counter when the GET is complete
      wg.done();
    });
  });

  // Wait for all HTTP fetches to complete
  await wg.wait();
}

main();
```

For most applications in Node.js, using built-ins like `Promise.all` will work perfectly, but sometimes this can be a really nice abstraction if the promises you have to keep track of are pretty spread out.

See [jpwilliams/waitgroup-deno](https://github.com/jpwilliams/waitgroup-deno) for a [Deno](https://deno.land/) version.
