---
'@mastra/core': patch
---

Fixed `LocalSandbox` replacing your custom seatbelt profile. When you point `nativeSandbox.seatbeltProfilePath` at a profile file you wrote, that profile now stays active after a mount or an unmount.

Mastra uses your profile exactly as written and does not add mount paths to it, so the profile must already allow every path you mount. If no file exists at that path, Mastra still generates a default profile, and that generated profile keeps allowing the paths you mount. Generated profiles now carry a marker comment, so a later run regenerates them and keeps allowing mount paths instead of reading them back as your own profile. To edit a generated profile and keep your edits, delete that marker comment: the file then counts as yours.
