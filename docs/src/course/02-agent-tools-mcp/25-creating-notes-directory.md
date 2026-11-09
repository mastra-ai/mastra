# Creating a Notes Directory

Like the Hacker News MCP server, the Filesystem MCP server can be run directly using a package manager. We'll use PNPX (the Pnpm version of NPX) to run it.

First, let's create a directory where our agent can store notes and other files:

```bash
mkdir -p notes
```

This command creates a directory called `notes` in your project's root directory. This is where your agent will store any files it creates or modifies. The `-p` flag ensures that the command doesn't fail if the directory already exists.

The Filesystem server needs an absolute path to that directory. Mastra runs your app with a working directory that is not your project root (under `mastra dev` it is `src/mastra/public`), so a relative `./notes` resolves to the wrong folder. Export the absolute path instead:

```bash
export NOTES_DIR="$(pwd)/notes"
```

Add the same `NOTES_DIR` line with the resolved path to your `.env` file so every restart picks it up.

Creating a dedicated directory for your agent's files is a good practice for several reasons:

- It keeps your agent's files separate from your application code
- It makes it easier to backup or version control your agent's data
- It provides a clear boundary for what your agent can access, enhancing security
