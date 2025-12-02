It's useful to vendor dependencies that are pretty stable and unlikely to
receive security updates: we can remove parts we don't use for a smaller bundle
and we spare our users runtime dependencies to install. We know how our library
needs to be bundled,

Some thoughts from tmwc on this:

- https://blog.val.town/gardening-dependencies
- https://macwright.com/2021/03/11/vendor-by-default

We're currently vendoring just a few libraries:

1. long.js, which only need a small amount of functionality of.
1. jwt-decode which has caused some users trouble when installing deps
1. jwt-encode is gone from GitHub, very short, and the published version uses an
   old crypto lib we can avoid using by vendoring and swapping it out.
1. progress is by good old TJ but it hasn't been published in 7 years and is
   tiny.
