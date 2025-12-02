import path from "path";
import fs from "fs-extra";
import spawn from "spawndamnit";
import fileUrl from "file-url";
import { gitdir, tempdir } from "@changesets/test-utils";
import writeChangeset from "@changesets/write";

import {
  getCommitsThatAddFiles,
  getChangedFilesSince,
  add,
  commit,
  tag,
  getDivergedCommit,
  getChangedPackagesSinceRef,
  getChangedChangesetFilesSinceRef,
  getAllTags,
  tagExists,
  getCurrentCommitId,
} from "./";

async function getCommitCount(cwd: string) {
  const cmd = await spawn("git", ["rev-list", "--count", "HEAD"], { cwd });
  return parseInt(cmd.stdout.toString(), 10);
}

describe("git", () => {
  describe("getDivergedCommit", () => {
    it("should return same commit when branches have not diverged", async () => {
      const cwd = await gitdir({
        "a.js": 'export default "a"',
        "b.js": 'export default "b"',
      });

      const firstSha = await getCurrentCommitId({ cwd });

      await fs.outputFile(path.join(cwd, "b.js"), 'export default "updated b"');
      await commit("update b", cwd);

      const secondSha = await getCurrentCommitId({ cwd });
      const divergedSha = await getDivergedCommit(cwd, "main");
      expect(firstSha).not.toBe(secondSha);
      expect(divergedSha).toBe(secondSha);
    });

    it("should find commit where branch diverged", async () => {
      const cwd = await gitdir({
        "a.js": 'export default "a"',
        "b.js": 'export default "b"',
      });

      // This is the first commit. We branch (diverge) from here.
      const mainSha = await getCurrentCommitId({ cwd });

      // Create a new branch, and add a commit to it.
      await spawn("git", ["checkout", "-b", "my-branch"], { cwd });

      await fs.outputFile(path.join(cwd, "b.js"), 'export default "updated b"');
      await commit("update b", cwd);

      // Now, get the latest commit from our new branch.
      const branchSha = await getCurrentCommitId({ cwd });

      // Finally, get the divergent commit.
      const divergedSha = await getDivergedCommit(cwd, "main");
      expect(mainSha).not.toBe(branchSha);
      expect(divergedSha).toBe(mainSha);
    });
  });

  describe("add", () => {
    it("should add a file to the staging area", async () => {
      const cwd = await gitdir({
        "a.js": 'export default "a"',
        "b.js": 'export default "b"',
      });

      await fs.outputFile(path.join(cwd, "a.js"), 'export default "updated a"');
      await add("a.js", cwd);

      const gitCmd = await spawn("git", ["diff", "--name-only", "--cached"], {
        cwd,
      });
      const stagedFiles = gitCmd.stdout
        .toString()
        .split("\n")
        .filter((a) => a);

      expect(stagedFiles).toEqual(["a.js"]);
    });

    it("should add multiple files to the staging area", async () => {
      const cwd = await gitdir({
        "a.js": 'export default "a"',
        "b.js": 'export default "b"',
        "c.js": 'export default "c"',
      });

      await fs.outputFile(path.join(cwd, "a.js"), 'export default "updated a"');
      await fs.outputFile(path.join(cwd, "c.js"), 'export default "updated c"');
      await add("a.js", cwd);
      await add("c.js", cwd);

      const gitCmd = await spawn("git", ["diff", "--name-only", "--cached"], {
        cwd,
      });
      const stagedFiles = gitCmd.stdout
        .toString()
        .split("\n")
        .filter((a) => a);

      expect(stagedFiles).toHaveLength(2);
      expect(stagedFiles[0]).toEqual("a.js");
      expect(stagedFiles[1]).toEqual("c.js");
    });

    it("should add a directory", async () => {
      const cwd = await gitdir({
        "foo/a.js": 'export default "a"',
        "foo/b.js": 'export default "b"',
      });

      await fs.outputFile(
        path.join(cwd, "foo/a.js"),
        'export default "updated a"'
      );
      await fs.outputFile(
        path.join(cwd, "foo/b.js"),
        'export default "updated b"'
      );
      await add("foo", cwd);

      const gitCmd = await spawn("git", ["diff", "--name-only", "--cached"], {
        cwd,
      });
      const stagedFiles = gitCmd.stdout
        .toString()
        .split("\n")
        .filter((a) => a);

      expect(stagedFiles).toEqual(["foo/a.js", "foo/b.js"]);
    });
  });

  describe("commit", () => {
    it("should commit a file", async () => {
      const cwd = await gitdir({
        "a.js": 'export default "a"',
      });

      await fs.outputFile(path.join(cwd, "a.js"), 'export default "updated a"');
      await add("a.js", cwd);
      await commit("update a.js", cwd);

      const gitCmd = await spawn("git", ["log", "-1", "--pretty=%B"], {
        cwd,
      });
      const commitMessage = gitCmd.stdout.toString().trim();

      expect(commitMessage).toEqual("update a.js");
    });
  });

  describe("getAllTags", () => {
    it("should retrieve all git tags", async () => {
      const cwd = await gitdir({
        "a.js": 'export default "a"',
      });

      await tag("test_tag", cwd);
      await tag("test_tag2", cwd);
      const tags = await getAllTags(cwd);
      expect(tags).toContain("test_tag");
      expect(tags).toContain("test_tag2");
    });
  });

  describe("tag", () => {
    it("should create a tag for the current head", async () => {
      const cwd = await gitdir({
        "a.js": 'export default "a"',
      });

      const head = await spawn("git", ["rev-parse", "HEAD"], { cwd });
      await tag("tag_message", cwd);

      // Gets the hash of the commit the tag is referring to, not the hash of the tag itself
      const tagRef = await spawn(
        "git",
        ["rev-list", "-n", "1", "tag_message"],
        { cwd }
      );
      expect(tagRef).toEqual(head);
    });

    it("should create a tag, make a new commit, then create a second tag", async () => {
      const cwd = await gitdir({
        "a.js": 'export default "a"',
        "b.js": 'export default "b"',
      });

      const initialHead = await spawn("git", ["rev-parse", "HEAD"], {
        cwd,
      });
      await tag("tag_message", cwd);

      await fs.outputFile(path.join(cwd, "b.js"), 'export default "updated b"');
      await add("b.js", cwd);
      await commit("update b", cwd);

      const newHead = await spawn("git", ["rev-parse", "HEAD"], { cwd });
      await tag("new_tag", cwd);

      // Gets the hash of the commit the tag is referring to, not the hash of the tag itself
      const firstTagRef = await spawn(
        "git",
        ["rev-list", "-n", "1", "tag_message"],
        { cwd }
      );
      const secondTagRef = await spawn(
        "git",
        ["rev-list", "-n", "1", "new_tag"],
        { cwd }
      );

      expect(firstTagRef).toEqual(initialHead);
      expect(secondTagRef).toEqual(newHead);
    });
  });

  describe("tagExists", () => {
    it("returns false when no tag exists", async () => {
      const cwd = await gitdir({
        "a.js": 'export default "a"',
      });

      expect(await tagExists("tag_which_doesn't_exist", cwd)).toBe(false);
    });

    it("returns true when tag exists", async () => {
      const cwd = await gitdir({
        "a.js": 'export default "a"',
      });

      await tag("tag_message", cwd);

      expect(await tagExists("tag_message", cwd)).toBe(true);
    });
  });

  describe("getCommitsThatAddFiles", () => {
    it("should get the hash of the commit that added a file", async () => {
      const cwd = await gitdir({
        "a.js": 'export default "a"',
      });

      const headSha = await getCurrentCommitId({ cwd });
      const commitHash = await getCommitsThatAddFiles(["a.js"], { cwd });

      expect(commitHash).toEqual([headSha]);
    });

    describe("with shallow clone", () => {
      // Roughly how many commits will the deepening algorithm
      // deepen each time?  We use this to set up test data to
      // check that the deepens the clone but doesn't need to *fully* unshallow
      // the clone.
      const shallowCloneDeepeningAmount = 50;

      /**
       * Creates a number of empty commits; this is useful to ensure
       * that a particular commit doesn't make it into a shallow clone.
       */
      async function createDummyCommits(count: number, cwd: string) {
        for (let i = 0; i < count; i++) {
          await commit("dummy commit", cwd);
        }
      }

      async function addFileAndCommit(file: string, cwd: string) {
        await add(file, cwd);
        await commit(`add file ${file}`, cwd);
        const commitSha = await getCurrentCommitId({ cwd });
        return commitSha;
      }

      async function createShallowClone(
        depth: number,
        cwd: string
      ): Promise<string> {
        // Make a 1-commit-deep shallow clone of this repo
        const cloneDir = tempdir();
        await spawn(
          "git",
          // Note: a file:// URL is needed in order to make a shallow clone of
          // a local repo
          ["clone", "--depth", depth.toString(), fileUrl(cwd), "."],
          {
            cwd: cloneDir,
          }
        );
        return cloneDir;
      }

      it("reads the SHA of a file-add without deepening if commit already included in the shallow clone", async () => {
        const cwd = await gitdir({
          "a.js": 'export default "a"',
        });

        // We create a repo that we shallow-clone;
        // the commit we're going to scan for is the latest commit,
        // so will be in the shallow clone immediately without deepening
        await createDummyCommits(10, cwd);
        await fs.outputFile(path.join(cwd, "b.js"), 'export default "b"');
        const originalCommit = await addFileAndCommit("b.js", cwd);

        const clone = await createShallowClone(5, cwd);

        // This file was added in the head commit, so will definitely be in our
        // 1-commit clone.
        const commits = await getCommitsThatAddFiles(["b.js"], { cwd: clone });
        expect(commits).toEqual([originalCommit]);

        // We should not need to have deepened the clone for this
        expect(await getCommitCount(clone)).toEqual(5);
      });

      it("reads the SHA of a file-add even if not already included in the shallow clone", async () => {
        const cwd = await gitdir({
          "a.js": 'export default "a"',
        });

        // We're going to create a repo where the commit we're looking for isn't
        // in the shallow clone, so we'll need to deepen it to locate it.
        await createDummyCommits((shallowCloneDeepeningAmount * 2) / 3, cwd);
        await fs.outputFile(path.join(cwd, "b.js"), 'export default "b"');
        const originalCommit = await addFileAndCommit("b.js", cwd);
        await createDummyCommits((shallowCloneDeepeningAmount * 2) / 3, cwd);

        const clone = await createShallowClone(5, cwd);

        // Finding this commit will require deepening the clone until it appears.
        const commit = (
          await getCommitsThatAddFiles(["b.js"], { cwd: clone })
        )[0];
        expect(commit).toEqual(originalCommit);

        // It should not have completely unshallowed the clone; just enough.
        const originalRepoDepth = await getCommitCount(cwd);
        expect(await getCommitCount(clone)).toBeGreaterThan(5);
        expect(await getCommitCount(clone)).toBeLessThan(originalRepoDepth);
      });

      it("reads the SHA of a file-add even if the first commit of a repo", async () => {
        const cwd = await gitdir({
          "a.js": 'export default "a"',
        });

        // Finding this commit will require deepening the clone right to the start
        // of the repo history, and coping with a commit that has no parent.
        const originalCommit = await getCurrentCommitId({ cwd });
        await createDummyCommits(shallowCloneDeepeningAmount * 2, cwd);
        const clone = await createShallowClone(5, cwd);

        // Finding this commit will require fully deepening the repo
        const commit = (
          await getCommitsThatAddFiles(["a.js"], { cwd: clone })
        )[0];
        expect(commit).toEqual(originalCommit);

        // We should have fully deepened
        const originalRepoDepth = await getCommitCount(cwd);
        expect(await getCommitCount(clone)).toEqual(originalRepoDepth);
      });

      it("can return SHAs for multiple files including return blanks for missing files", async () => {
        const cwd = await gitdir({
          "a.js": 'export default "a"',
        });
        // We want to ensure that we can retrieve SHAs for multiple files at the same time,
        // and also that requesting missing files doesn't affect the location of commits
        // for the files that succeed.
        await createDummyCommits(shallowCloneDeepeningAmount, cwd);

        await fs.outputFile(path.join(cwd, "b.js"), 'export default "b"');
        const originalCommit1 = await addFileAndCommit("b.js", cwd);

        await createDummyCommits(shallowCloneDeepeningAmount, cwd);

        await fs.outputFile(path.join(cwd, "c.js"), 'export default "c"');
        const originalCommit2 = await addFileAndCommit("c.js", cwd);

        const clone = await createShallowClone(5, cwd);

        const commits = await getCommitsThatAddFiles(
          ["b.js", "this-file-does-not-exist", "c.js"],
          { cwd: clone }
        );

        expect(commits).toEqual([originalCommit1, undefined, originalCommit2]);
      });
    });
  });

  describe("getChangedFilesSince", () => {
    it("should be empty if no changes (partial path)", async () => {
      const cwd = await gitdir({
        "a.js": 'export default "a"',
      });

      const head = await getCurrentCommitId({ cwd });
      const changedFiles = await getChangedFilesSince({
        ref: head,
        cwd,
        fullPath: false,
      });

      expect(changedFiles).toHaveLength(0);
    });

    it("should be empty if no changes (full path)", async () => {
      const cwd = await gitdir({
        "a.js": 'export default "a"',
      });

      const head = await getCurrentCommitId({ cwd });
      const changedFiles = await getChangedFilesSince({
        ref: head,
        cwd,
        fullPath: true,
      });

      expect(changedFiles).toHaveLength(0);
    });

    it("should get list of files that have been committed", async () => {
      const cwd = await gitdir({
        "a.js": 'export default "a"',
        "b.js": 'export default "b"',
        "c.js": 'export default "c"',
        "d.js": 'export default "d"',
      });

      const firstRef = await getCurrentCommitId({ cwd });
      await fs.outputFile(path.join(cwd, "b.js"), 'export default "updated b"');
      await add("b.js", cwd);
      await commit("update b.js", cwd);

      const secondRef = await getCurrentCommitId({ cwd });
      await fs.outputFile(path.join(cwd, "d.js"), 'export default "updated d"');
      await add("d.js", cwd);
      await commit("update d.js", cwd);

      const filesChangedSinceFirstRef = await getChangedFilesSince({
        ref: firstRef,
        cwd,
      });
      expect(filesChangedSinceFirstRef).toEqual(["b.js", "d.js"]);

      const filesChangedSinceSecondRef = await getChangedFilesSince({
        ref: secondRef,
        cwd,
      });
      expect(filesChangedSinceSecondRef).toEqual(["d.js"]);
    });
    it("should get correct full paths of changed files irrespective of cwd", async () => {
      const cwd = await gitdir({
        "packages/pkg-a/a.js": 'export default "a"',
        "packages/pkg-b/b.js": 'export default "b"',
        "packages/pkg-c/c.js": 'export default "c"',
      });

      const ref = await getCurrentCommitId({ cwd });

      await fs.outputFile(
        path.join(cwd, "packages/pkg-b/b.js"),
        'export default "updated b"'
      );
      await add("packages/pkg-b/b.js", cwd);
      await commit("update b.js", cwd);

      await fs.outputFile(
        path.join(cwd, "packages/pkg-c/c.js"),
        'export default "updated c"'
      );
      await add("packages/pkg-c/c.js", cwd);
      await commit("update c.js", cwd);

      const filesChangedSinceRef = await getChangedFilesSince({
        ref,
        cwd,
        fullPath: true,
      });
      expect(filesChangedSinceRef).toEqual([
        path.resolve(cwd, "packages/pkg-b/b.js"),
        path.resolve(cwd, "packages/pkg-c/c.js"),
      ]);

      const filesChangedSinceRef2 = await getChangedFilesSince({
        ref,
        cwd: path.resolve(cwd, "packages"),
        fullPath: true,
      });
      expect(filesChangedSinceRef2).toEqual([
        path.resolve(cwd, "packages/pkg-b/b.js"),
        path.resolve(cwd, "packages/pkg-c/c.js"),
      ]);
    });
  });

  describe("getChangedPackagesSinceRef", () => {
    it("should return an empty list if no packages have changed", async () => {
      const cwd = await gitdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
        }),
        "packages/pkg-a/a.js": 'export default "a"',
      });

      await fs.outputFile(
        path.join(cwd, "packages/pkg-a/a.js"),
        'export default "updated a"'
      );
      await add("packages/pkg-a/a.js", cwd);
      await commit("update a.js", cwd);

      await spawn("git", ["checkout", "-b", "new-branch"], { cwd });
      const changedPackages = await getChangedPackagesSinceRef({
        cwd,
        ref: "main",
      });
      expect(changedPackages).toHaveLength(0);
    });

    it("should check changed packages on a branch against base branch", async () => {
      const cwd = await gitdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
        }),
        "packages/pkg-c/package.json": JSON.stringify({
          name: "pkg-c",
        }),
        "packages/pkg-d/package.json": JSON.stringify({
          name: "pkg-d",
        }),
      });

      await spawn("git", ["checkout", "-b", "new-branch"], { cwd });

      await fs.outputFile(
        path.join(cwd, "packages/pkg-b/package.json"),
        JSON.stringify({
          name: "pkg-b",
          private: true,
        })
      );
      await commit("update pkg-b", cwd);

      await fs.outputFile(
        path.join(cwd, "packages/pkg-d/package.json"),
        JSON.stringify({
          name: "pkg-d",
          private: true,
        })
      );
      await commit("update pkg-d", cwd);

      const changedPackages = await getChangedPackagesSinceRef({
        cwd,
        ref: "main",
      });

      expect(changedPackages.map((pkg) => pkg.packageJson.name)).toEqual([
        "pkg-b",
        "pkg-d",
      ]);
    });

    it("should return the closest package for a changed file (shorter workspace pattern before a longer one)", async () => {
      const cwd = await gitdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*", "packages/*/examples/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
        }),
        "packages/pkg-a/examples/example-a/package.json": JSON.stringify({
          name: "example-a",
        }),
      });

      await spawn("git", ["checkout", "-b", "new-branch"], { cwd });

      const newFilePath = "packages/pkg-a/examples/example-a/file.js";

      await fs.outputFile(
        path.join(cwd, newFilePath),
        "console.log('hello world');"
      );

      await add(newFilePath, cwd);
      await commit("new file in the example", cwd);

      const changedPackages = await getChangedPackagesSinceRef({
        cwd,
        ref: "main",
      });

      expect(changedPackages.map((pkg) => pkg.packageJson.name)).toEqual([
        "example-a",
      ]);
    });

    it("should return the closest package for a changed file (longer workspace pattern before a shorter one)", async () => {
      const cwd = await gitdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*/examples/*", "packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
        }),
        "packages/pkg-a/examples/example-a/package.json": JSON.stringify({
          name: "example-a",
        }),
      });

      await spawn("git", ["checkout", "-b", "new-branch"], { cwd });

      const newFilePath = "packages/pkg-a/examples/example-a/file.js";

      await fs.outputFile(
        path.join(cwd, newFilePath),
        "console.log('hello world');"
      );

      await add(newFilePath, cwd);
      await commit("new file in the example", cwd);

      const changedPackages = await getChangedPackagesSinceRef({
        cwd,
        ref: "main",
      });

      expect(changedPackages.map((pkg) => pkg.packageJson.name)).toEqual([
        "example-a",
      ]);
    });

    it("should not return package as changed when a file not matching the changed pattern has been changed", async () => {
      const cwd = await gitdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
        }),
      });

      await spawn("git", ["checkout", "-b", "new-branch"], { cwd });

      const newFilePath = "packages/pkg-a/__tests__/file.js";

      await fs.outputFile(
        path.join(cwd, newFilePath),
        "expect(answer).toBe(42);"
      );

      await add(newFilePath, cwd);
      await commit("new test file", cwd);

      const changedPackages = await getChangedPackagesSinceRef({
        cwd,
        ref: "main",
        changedFilePatterns: ["src/**"],
      });

      expect(changedPackages.map((pkg) => pkg.packageJson.name)).toEqual([]);
    });

    it("should return package as changed when a file matching the changed pattern has been changed", async () => {
      const cwd = await gitdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
        }),
      });

      await spawn("git", ["checkout", "-b", "new-branch"], { cwd });

      const newFilePath = "packages/pkg-a/src/index.js";

      await fs.outputFile(
        path.join(cwd, newFilePath),
        "export const answer = 42;"
      );

      await add(newFilePath, cwd);
      await commit("awesome implementation file", cwd);

      const changedPackages = await getChangedPackagesSinceRef({
        cwd,
        ref: "main",
        changedFilePatterns: ["src/**"],
      });

      expect(changedPackages.map((pkg) => pkg.packageJson.name)).toEqual([
        "pkg-a",
      ]);
    });
  });

  describe("getChangedChangesetFilesSinceRef", () => {
    it("should be empty if no changeset files have been added", async () => {
      const cwd = await gitdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
        }),
        ".changeset/config.json": JSON.stringify({}),
      });

      const files = await getChangedChangesetFilesSinceRef({
        cwd,
        ref: "main",
      });
      expect(files).toHaveLength(0);
    });

    it("should get the relative path to the changeset file", async () => {
      const cwd = await gitdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
        }),
        ".changeset/config.json": JSON.stringify({}),
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
        cwd
      );
      await add(".changeset", cwd);

      const files = await getChangedChangesetFilesSinceRef({
        cwd,
        ref: "main",
      });
      expect(files).toEqual([`.changeset/${changesetId}.md`]);
    });
    it("should work on a ref that isn't the base branch", async () => {
      const cwd = await gitdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
        }),
        ".changeset/config.json": JSON.stringify({}),
      });

      await spawn("git", ["checkout", "-b", "some-branch"], { cwd });

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
        cwd
      );
      await add(".changeset", cwd);

      const files = await getChangedChangesetFilesSinceRef({
        cwd,
        ref: "some-branch",
      });
      expect(files).toEqual([`.changeset/${changesetId}.md`]);
    });

    it("should still get the relative path to the changeset file if git config relative has been set to true", async () => {
      const cwd = await gitdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
        }),
        ".changeset/config.json": JSON.stringify({}),
      });

      await spawn("git", ["config", "diff.relative", "true"], {
        cwd,
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
        cwd
      );
      await add(".changeset", cwd);

      const files = await getChangedChangesetFilesSinceRef({
        cwd: path.join(cwd, ".changeset"),
        ref: "main",
      });
      expect(files).toEqual([`.changeset/${changesetId}.md`]);
    });
  });
});
