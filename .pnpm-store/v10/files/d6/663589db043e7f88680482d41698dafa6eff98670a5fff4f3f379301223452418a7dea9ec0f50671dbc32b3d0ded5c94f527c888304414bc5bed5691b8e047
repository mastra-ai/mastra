# hpagent

[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](http://standardjs.com/)  ![build](https://github.com/delvedor/hpagent/workflows/build/badge.svg). ![npm](https://img.shields.io/npm/dm/hpagent)

A ready to use http and https agent for working with proxies that keeps connections alive!

## Install

```
npm install hpagent
```

## Usage

Based on your infrastructure, you should use the http agent or the https agent.
The following table will help you picking the right one.

| Type              | Proxy  | Server |
|-------------------|--------|--------|
| `HttpProxyAgent`  | HTTP   | HTTP   |
| `HttpProxyAgent`  | HTTPS  | HTTP   |
| `HttpsProxyAgent` | HTTP   | HTTPS  |
| `HttpsProxyAgent` | HTTPS  | HTTPS  |

```js
const { HttpProxyAgent, HttpsProxyAgent } = require('hpagent')
```

Once you have understood the right agent for your use case, you can instance it. It takes the same parameter of the Node.js core's http(s) agent and an additional `proxy` option, which is the url of your proxy.

```js
const http = require('http')
const { HttpProxyAgent } = require('hpagent')

const agent = new HttpProxyAgent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 256,
  maxFreeSockets: 256,
  proxy: 'http://localhost:8080'
})

http.get('http://localhost:9200', { agent })
    .on('response', console.log)
    .end()
```

If your proxy requires basic authentication, you can configure it in the proxy url:

```js
const http = require('http')
const { HttpProxyAgent } = require('hpagent')

const agent = new HttpProxyAgent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 256,
  maxFreeSockets: 256,
  proxy: 'http://user:pwd@localhost:8080'
})

http.get('http://localhost:9200', { agent })
    .on('response', console.log)
    .end()
```

You can also pass custom options intended only for the proxy CONNECT request with the `proxyConnectOptions` option,
such as headers or `tls.connect()` options:

```js
const fs = require('fs')
const http = require('http')
const { HttpProxyAgent } = require('hpagent')

const agent = new HttpProxyAgent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 256,
  maxFreeSockets: 256,
  proxy: 'https://localhost:8080',
  proxyConnectOptions: {
    headers: {
      'Proxy-Authorization': 'Basic YWxhZGRpbjpvcGVuc2VzYW1l',
    },
    ca: [ fs.readFileSync('custom-proxy-cert.pem') ]
  }
})

http.get('http://localhost:9200', { agent })
    .on('response', console.log)
    .end()
```

## Integrations

Following you can find the list of userland http libraries that are tested with this agent.

### [got](https://github.com/sindresorhus/got)

```js
got('http://localhost:9200', {
  agent: {
    http: new HttpProxyAgent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 256,
      maxFreeSockets: 256,
      scheduling: 'lifo',
      proxy: 'http://localhost:8080'
    })
  }
})
```

### [needle](https://github.com/tomas/needle)

```js
needle('get', 'http://localhost:9200', {
  agent: new HttpProxyAgent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 256,
    maxFreeSockets: 256,
    scheduling: 'lifo',
    proxy: 'http://localhost:8080'
  })
})
```

### [node-fetch](https://github.com/node-fetch/node-fetch)

```js
fetch('http://localhost:9200', {
  agent: new HttpProxyAgent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 256,
    maxFreeSockets: 256,
    scheduling: 'lifo',
    proxy: 'http://localhost:8080'
  })
})
```

### [simple-get](https://github.com/feross/simple-get)

```js
sget.concat({
  url: `http://${server.address().address}:${server.address().port}`,
  agent: new HttpProxyAgent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 256,
    maxFreeSockets: 256,
    scheduling: 'lifo',
    proxy: `https://${proxy.address().address}:${proxy.address().port}`
  })
}, function (err, response, data) {
  // handle the response
})
```

## License

This software is licensed under the [MIT](./LICENSE).
