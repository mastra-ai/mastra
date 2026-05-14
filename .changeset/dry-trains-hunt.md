---
'@mastra/memory': patch
---

Fix observational memory so step 0 can synchronously observe when a single oversized message already exceeds the configured message token threshold.
