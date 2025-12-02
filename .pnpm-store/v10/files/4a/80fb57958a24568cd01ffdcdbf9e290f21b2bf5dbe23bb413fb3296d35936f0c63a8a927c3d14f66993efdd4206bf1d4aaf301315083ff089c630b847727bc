# @aws-sdk/endpoint-cache

[![NPM version](https://img.shields.io/npm/v/@aws-sdk/endpoint-cache/latest.svg)](https://www.npmjs.com/package/@aws-sdk/endpoint-cache)
[![NPM downloads](https://img.shields.io/npm/dm/@aws-sdk/endpoint-cache.svg)](https://www.npmjs.com/package/@aws-sdk/endpoint-cache)

> An internal package

## Usage

You probably shouldn't, at least directly.

## EndpointCache

- uses `mnemonist/lru-cache` for storing the cache.
- the `set` operation stores milliseconds elapsed since the UNIX epoch in Expires param based on CachePeriodInMinutes provided in Endpoint.
- the `get` operation returns all un-expired endpoints with their Expires values.
- the `getEndpoint` operation returns a randomly selected un-expired endpoint.
