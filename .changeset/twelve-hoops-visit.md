---
'@mastra/docker': minor
---

`DockerFactorySandbox` keeps a Factory's Build environment variables out of the image and its template identity. Docker template builds don't receive them yet; they reach setup commands only when Factory runs setup itself.
