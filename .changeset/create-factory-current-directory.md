---
'create-factory': patch
---

`create-factory` can now set up the Factory in the current directory. When you run it without a name, the prompt defaults to the current directory if it's empty: press Enter to use it, or type a name to create a new directory. Passing `.` or an empty name (`--name ""`) uses the current directory without prompting. An existing empty directory can also be used as the target.
