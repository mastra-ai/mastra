---
'@mastra/core': minor
---

Added component registration and de-registration functions to the Mastra class. Components can still be passed into the constructor as before but now they can also be registered after instantiation. Components can also now be de-registered and removed from the relevant Mastra record. All new methods have error handling to avoid duplicate record keys or trying to remove a component that doesn't exist. I had to strip out the magic typing that the Mastra class was using previously since that pattern doesn't work unless the exact shape is known upfront.
