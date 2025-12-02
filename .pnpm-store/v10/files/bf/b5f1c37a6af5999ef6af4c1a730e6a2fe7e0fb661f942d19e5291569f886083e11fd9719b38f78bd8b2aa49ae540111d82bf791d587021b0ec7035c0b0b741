import fs from "fs-extra";
import path from "node:path";
import outdent from "outdent";

import read from "./";
import { gitdir, silenceLogsInBlock, testdir } from "@changesets/test-utils";
import writeChangeset from "@changesets/write";
import { add } from "@changesets/git";

silenceLogsInBlock();

describe("read changesets from disc", () => {
  it("should read a changeset from disc", async () => {
    const cwd = await testdir({
      ".changeset/cool-computer-club.md": `---
"cool-package": minor
---

Nice simple summary`,
    });

    const changesets = await read(cwd);
    expect(changesets).toEqual([
      {
        releases: [{ name: "cool-package", type: "minor" }],
        summary: "Nice simple summary",
        id: "cool-computer-club",
      },
    ]);
  });
  it("should ignore a readme file", async () => {
    const cwd = await testdir({
      ".changeset/README.md": `Changesets are great for monorepos`,
      ".changeset/one-chance.md": `---
"cool-package": minor
---

Nice simple summary
`,
    });

    const changesets = await read(cwd);
    expect(changesets).toEqual([
      {
        releases: [{ name: "cool-package", type: "minor" }],
        summary: "Nice simple summary",
        id: "one-chance",
      },
    ]);
  });
  it("read a changeset that isn't a three word id", async () => {
    // I just want it enshrined in the tests that the file name's format
    // is in no way part of the changeset spec
    const cwd = await testdir({
      ".changeset/basic-changeset.md": `---
"cool-package": minor
---

Nice simple summary`,
    });

    const changesets = await read(cwd);
    expect(changesets).toEqual([
      {
        releases: [{ name: "cool-package", type: "minor" }],
        summary: "Nice simple summary",
        id: "basic-changeset",
      },
    ]);
  });
  it("should read many changesets from disc", async () => {
    const cwd = await testdir({
      ".changeset/cool-computer-club.md": `---
"cool-package": minor
---

Nice simple summary`,
      ".changeset/tiny-little-but-awesome.md": `---
"perfect-package": patch
---

I'm amazed we needed to update the best package, because it was already the best
`,
    });

    const changesets = await read(cwd);
    expect(changesets).toEqual([
      {
        releases: [{ name: "cool-package", type: "minor" }],
        summary: "Nice simple summary",
        id: "cool-computer-club",
      },
      {
        releases: [{ name: "perfect-package", type: "patch" }],
        summary:
          "I'm amazed we needed to update the best package, because it was already the best",
        id: "tiny-little-but-awesome",
      },
    ]);
  });
  it("should return an empty array when no changesets are found", async () => {
    const cwd = await testdir({});
    await fs.mkdir(path.join(cwd, ".changeset"));

    const changesets = await read(cwd);
    expect(changesets).toEqual([]);
  });
  it("should error when there is no changeset folder", async () => {
    const cwd = await testdir({});

    try {
      await read(cwd);
    } catch (e) {
      expect((e as Error).message).toBe(
        "There is no .changeset directory in this project"
      );
      return;
    }
    expect("never run this because we returned above").toBe(true);
  });
  it("should error on broken changeset?", async () => {
    const cwd = await testdir({
      ".changeset/broken-changeset.md": `---

"cool-package": minor

--

Everything is wrong`,
    });

    expect(read(cwd)).rejects.toThrow(
      outdent`could not parse changeset - invalid frontmatter: ---

      "cool-package": minor

      --

      Everything is wrong`
    );
  });
  it("should return no releases and empty summary when the changeset is empty", async () => {
    const cwd = await testdir({
      ".changeset/empty-like-void.md": `---
---`,
    });

    const changesets = await read(cwd);
    expect(changesets).toEqual([
      {
        releases: [],
        summary: "",
        id: "empty-like-void",
      },
    ]);
  });
  it("should filter out ignored changesets", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/changesets-are-beautiful.md": `---
"pkg-a": minor
---

Nice simple summary, much wow
`,
      ".changeset/.ignored-temporarily.md": `---
"pkg-b": minor
---

Awesome feature, hidden behind a feature flag
`,
    });

    const changesets = await read(cwd);
    expect(changesets).toEqual([
      {
        releases: [{ name: "pkg-a", type: "minor" }],
        summary: "Nice simple summary, much wow",
        id: "changesets-are-beautiful",
      },
    ]);
  });

  it("should read an old changeset", async () => {
    const cwd = await testdir({
      ".changeset/basic-changeset/changes.json": JSON.stringify({
        releases: [
          {
            name: "cool-package",
            type: "minor",
          },
        ],
        dependents: [],
      }),
      ".changeset/basic-changeset/changes.md": `Nice simple summary`,
    });

    const changesets = await read(cwd);
    expect(changesets).toEqual([
      {
        releases: [{ name: "cool-package", type: "minor" }],
        summary: "Nice simple summary",
        id: "basic-changeset",
      },
    ]);
  });
  it("should read a nested changeset relative to git root", async () => {
    const cwd = await gitdir({
      "library/package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "library/packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
      }),
      "library/.changeset/config.json": JSON.stringify({}),
    });

    const changesetId = await writeChangeset(
      {
        releases: [
          {
            name: "pkg-a",
            type: "minor",
          },
        ],
        summary: "Awesome summary",
      },
      path.join(cwd, "library")
    );
    await add("library/.changeset", cwd);

    const changesets = await read(path.join(cwd, "library"), "main");
    expect(changesets).toEqual([
      {
        releases: [{ name: "pkg-a", type: "minor" }],
        summary: "Awesome summary",
        id: changesetId,
      },
    ]);
  });
});
