import {
  ReleasePlan,
  Config,
  NewChangeset,
  ComprehensiveRelease,
} from "@changesets/types";
import * as git from "@changesets/git";
import fs from "fs-extra";
import path from "path";
import outdent from "outdent";
import spawn from "spawndamnit";
import { defaultConfig } from "@changesets/config";

import applyReleasePlan from "./";
import { getPackages } from "@manypkg/get-packages";
import {
  temporarilySilenceLogs,
  testdir,
  Fixture,
} from "@changesets/test-utils";

class FakeReleasePlan {
  changesets: NewChangeset[];
  releases: ComprehensiveRelease[];
  config: Config;

  constructor(
    changesets: NewChangeset[] = [],
    releases: ComprehensiveRelease[] = [],
    config: Partial<Config> = {}
  ) {
    const baseChangeset: NewChangeset = {
      id: "quick-lions-devour",
      summary: "Hey, let's have fun with testing!",
      releases: [{ name: "pkg-a", type: "minor" }],
    };
    const baseRelease: ComprehensiveRelease = {
      name: "pkg-a",
      type: "minor",
      oldVersion: "1.0.0",
      newVersion: "1.1.0",
      changesets: ["quick-lions-devour"],
    };
    this.config = {
      changelog: false,
      commit: false,
      fixed: [],
      linked: [],
      access: "restricted",
      changedFilePatterns: ["**"],
      baseBranch: "main",
      updateInternalDependencies: "patch",
      ignore: [],
      prettier: true,
      privatePackages: { version: true, tag: false },
      ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
        onlyUpdatePeerDependentsWhenOutOfRange: false,
        updateInternalDependents: "out-of-range",
      },
      snapshot: {
        useCalculatedVersion: false,
        prereleaseTemplate: null,
      },
      ...config,
    };

    this.changesets = [baseChangeset, ...changesets];
    this.releases = [baseRelease, ...releases];
  }

  getReleasePlan(): ReleasePlan {
    return {
      changesets: this.changesets,
      releases: this.releases,
      preState: undefined,
    };
  }
}

async function testSetup(
  fixture: Fixture,
  releasePlan: ReleasePlan,
  config?: Config,
  snapshot?: string | undefined,
  setupFunc?: (tempDir: string) => Promise<any>
) {
  if (!config) {
    config = {
      changelog: false,
      commit: false,
      fixed: [],
      linked: [],
      access: "restricted",
      changedFilePatterns: ["**"],
      baseBranch: "main",
      updateInternalDependencies: "patch",
      ignore: [],
      prettier: true,
      privatePackages: { version: true, tag: false },
      snapshot: {
        useCalculatedVersion: false,
        prereleaseTemplate: null,
      },
      ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
        onlyUpdatePeerDependentsWhenOutOfRange: false,
        updateInternalDependents: "out-of-range",
      },
    };
  }
  let tempDir = await testdir(fixture);

  if (setupFunc) {
    await setupFunc(tempDir);
  }

  if (config.commit) {
    await spawn("git", ["init"], { cwd: tempDir });
    await git.add(".", tempDir);
    await git.commit("first commit", tempDir);
  }

  return {
    changedFiles: await applyReleasePlan(
      releasePlan,
      await getPackages(tempDir),
      config,
      snapshot
    ),
    tempDir,
  };
}

describe("apply release plan", () => {
  describe("versioning", () => {
    describe("formatting", () => {
      it("should not reformat a small array in a package.json", async () => {
        const releasePlan = new FakeReleasePlan();
        let { changedFiles } = await testSetup(
          {
            "package.json": `{
  "name": "pkg-a",
  "version": "1.0.0",
  "files": [
    "lib"
  ]
}`,
          },
          releasePlan.getReleasePlan(),
          releasePlan.config
        );
        let pkgPath = changedFiles.find((a) => a.endsWith(`package.json`));

        if (!pkgPath) throw new Error(`could not find an updated package json`);
        let pkgJSON = await fs.readFile(pkgPath, { encoding: "utf-8" });

        expect(pkgJSON).toStrictEqual(`{
  "name": "pkg-a",
  "version": "1.1.0",
  "files": [
    "lib"
  ]
}`);
      });
      it("should not change tab indentation in a package.json", async () => {
        const releasePlan = new FakeReleasePlan();
        let { changedFiles } = await testSetup(
          {
            "package.json": JSON.stringify(
              {
                name: "pkg-a",
                version: "1.0.0",
              },
              null,
              "\t"
            ),
          },
          releasePlan.getReleasePlan(),
          releasePlan.config
        );
        let pkgPath = changedFiles.find((a) => a.endsWith(`package.json`));

        if (!pkgPath) throw new Error(`could not find an updated package json`);
        let pkgJSON = await fs.readFile(pkgPath, { encoding: "utf-8" });

        expect(pkgJSON).toStrictEqual(`{
\t"name": "pkg-a",
\t"version": "1.1.0"
}`);
      });
      it("should not add trailing newlines in a package.json if they don't exist", async () => {
        const releasePlan = new FakeReleasePlan();
        let { changedFiles } = await testSetup(
          {
            "package.json": JSON.stringify({
              name: "pkg-a",
              version: "1.0.0",
            }),
          },
          releasePlan.getReleasePlan(),
          releasePlan.config
        );
        let pkgPath = changedFiles.find((a) => a.endsWith(`package.json`));

        if (!pkgPath) throw new Error(`could not find an updated package json`);
        let pkgJSON = await fs.readFile(pkgPath, { encoding: "utf-8" });

        expect(pkgJSON).toStrictEqual(`{
  "name": "pkg-a",
  "version": "1.1.0"
}`);
      });
      it("should not remove trailing newlines in a package.json if they exist", async () => {
        const releasePlan = new FakeReleasePlan();
        let { changedFiles } = await testSetup(
          {
            "package.json":
              JSON.stringify({
                name: "pkg-a",
                version: "1.0.0",
              }) + "\n",
          },
          releasePlan.getReleasePlan(),
          releasePlan.config
        );
        let pkgPath = changedFiles.find((a) => a.endsWith(`package.json`));

        if (!pkgPath) throw new Error(`could not find an updated package json`);
        let pkgJSON = await fs.readFile(pkgPath, { encoding: "utf-8" });

        expect(pkgJSON).toStrictEqual(`{
  "name": "pkg-a",
  "version": "1.1.0"
}\n`);
      });
    });

    it("should update a version for one package", async () => {
      const releasePlan = new FakeReleasePlan();
      let { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        releasePlan.config
      );
      let pkgPath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`)
      );

      if (!pkgPath) throw new Error(`could not find an updated package json`);
      let pkgJSON = await fs.readJSON(pkgPath);

      expect(pkgJSON).toMatchObject({
        name: "pkg-a",
        version: "1.1.0",
      });
    });
    it("should not update ranges set to *", async () => {
      const releasePlan = new FakeReleasePlan(
        [
          {
            id: "some-id",
            releases: [{ name: "pkg-b", type: "minor" }],
            summary: "a very useful summary",
          },
        ],
        [
          {
            changesets: ["some-id"],
            name: "pkg-b",
            newVersion: "1.1.0",
            oldVersion: "1.0.0",
            type: "minor",
          },
        ]
      );
      let { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "*",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        releasePlan.config
      );
      let pkgPath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`)
      );

      if (!pkgPath) throw new Error(`could not find an updated package json`);
      let pkgJSON = await fs.readJSON(pkgPath);

      expect(pkgJSON).toEqual({
        name: "pkg-a",
        version: "1.1.0",
        dependencies: {
          "pkg-b": "*",
        },
      });
    });
    it("should update workspace ranges", async () => {
      const releasePlan = new FakeReleasePlan(
        [
          {
            id: "some-id",
            releases: [{ name: "pkg-b", type: "minor" }],
            summary: "a very useful summary",
          },
        ],
        [
          {
            changesets: ["some-id"],
            name: "pkg-b",
            newVersion: "1.1.0",
            oldVersion: "1.0.0",
            type: "minor",
          },
        ]
      );
      let { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "workspace:1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        releasePlan.config
      );
      let pkgPath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`)
      );

      if (!pkgPath) throw new Error(`could not find an updated package json`);
      let pkgJSON = await fs.readJSON(pkgPath);

      expect(pkgJSON).toEqual({
        name: "pkg-a",
        version: "1.1.0",
        dependencies: {
          "pkg-b": "workspace:1.1.0",
        },
      });
    });
    it("should not update workspace version aliases", async () => {
      const releasePlan = new FakeReleasePlan(
        [
          {
            id: "some-id",
            releases: [{ name: "pkg-b", type: "minor" }],
            summary: "a very useful summary",
          },
          {
            id: "some-id",
            releases: [{ name: "pkg-c", type: "minor" }],
            summary: "a very useful summary",
          },
          {
            id: "some-id",
            releases: [{ name: "pkg-d", type: "minor" }],
            summary: "a very useful summary",
          },
        ],
        [
          {
            changesets: ["some-id"],
            name: "pkg-b",
            newVersion: "1.1.0",
            oldVersion: "1.0.0",
            type: "minor",
          },
          {
            changesets: ["some-id"],
            name: "pkg-c",
            newVersion: "1.1.0",
            oldVersion: "1.0.0",
            type: "minor",
          },
          {
            changesets: ["some-id"],
            name: "pkg-d",
            newVersion: "1.1.0",
            oldVersion: "1.0.0",
            type: "minor",
          },
        ]
      );
      let { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "workspace:*",
              "pkg-c": "workspace:^",
              "pkg-d": "workspace:~",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
          "packages/pkg-c/package.json": JSON.stringify({
            name: "pkg-c",
            version: "1.0.0",
          }),
          "packages/pkg-d/package.json": JSON.stringify({
            name: "pkg-d",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        releasePlan.config
      );
      let pkgPath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`)
      );

      if (!pkgPath) throw new Error(`could not find an updated package json`);
      let pkgJSON = await fs.readJSON(pkgPath);

      expect(pkgJSON).toEqual({
        name: "pkg-a",
        version: "1.1.0",
        dependencies: {
          "pkg-b": "workspace:*",
          "pkg-c": "workspace:^",
          "pkg-d": "workspace:~",
        },
      });
    });
    it("should update workspace ranges only with bumpVersionsWithWorkspaceProtocolOnly", async () => {
      const releasePlan = new FakeReleasePlan(
        [
          {
            id: "some-id",
            releases: [
              { name: "pkg-b", type: "minor" },
              { name: "pkg-c", type: "minor" },
            ],
            summary: "a very useful summary",
          },
        ],
        [
          {
            changesets: ["some-id"],
            name: "pkg-b",
            newVersion: "1.1.0",
            oldVersion: "1.0.0",
            type: "minor",
          },
          {
            changesets: ["some-id"],
            name: "pkg-c",
            newVersion: "1.1.0",
            oldVersion: "1.0.0",
            type: "minor",
          },
        ],
        {
          bumpVersionsWithWorkspaceProtocolOnly: true,
        }
      );
      let { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "workspace:1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
          "packages/pkg-c/package.json": JSON.stringify({
            name: "pkg-c",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "1.0.0",
            },
          }),
        },
        releasePlan.getReleasePlan(),
        releasePlan.config
      );
      let pkgAPath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`)
      );

      if (!pkgAPath) throw new Error(`could not find an updated package json`);
      let pkgAJSON = await fs.readJSON(pkgAPath);

      expect(pkgAJSON).toEqual({
        name: "pkg-a",
        version: "1.1.0",
        dependencies: {
          "pkg-b": "workspace:1.1.0",
        },
      });

      let pkgCPath = changedFiles.find((a) =>
        a.endsWith(`pkg-c${path.sep}package.json`)
      );

      if (!pkgCPath) throw new Error(`could not find an updated package json`);
      let pkgCJSON = await fs.readJSON(pkgCPath);

      expect(pkgCJSON).toEqual({
        name: "pkg-c",
        version: "1.1.0",
        dependencies: {
          "pkg-b": "1.0.0",
        },
      });
    });
    it("should update a version for two packages with different new versions", async () => {
      const releasePlan = new FakeReleasePlan(
        [],
        [
          {
            name: "pkg-b",
            type: "major",
            oldVersion: "1.0.0",
            newVersion: "2.0.0",
            changesets: [],
          },
        ]
      );

      let { changedFiles } = await testSetup(
        {
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
        },
        releasePlan.getReleasePlan(),
        releasePlan.config
      );
      let pkgPathA = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`)
      );
      let pkgPathB = changedFiles.find((b) =>
        b.endsWith(`pkg-b${path.sep}package.json`)
      );

      if (!pkgPathA || !pkgPathB) {
        throw new Error(`could not find an updated package json`);
      }
      let pkgJSONA = await fs.readJSON(pkgPathA);
      let pkgJSONB = await fs.readJSON(pkgPathB);

      expect(pkgJSONA).toMatchObject({
        name: "pkg-a",
        version: "1.1.0",
      });
      expect(pkgJSONB).toMatchObject({
        name: "pkg-b",
        version: "2.0.0",
      });
    });
    it("should not update the version of the dependent package if the released dep is a dev dep", async () => {
      let { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            devDependencies: {
              "pkg-b": "1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        },
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [
                { name: "pkg-a", type: "none" },
                { name: "pkg-b", type: "minor" },
              ],
            },
          ],
          releases: [
            {
              name: "pkg-a",
              type: "none",
              oldVersion: "1.0.0",
              newVersion: "1.0.0",
              changesets: ["quick-lions-devour"],
            },
            {
              name: "pkg-b",
              type: "minor",
              oldVersion: "1.0.0",
              newVersion: "1.1.0",
              changesets: ["quick-lions-devour"],
            },
          ],
          preState: undefined,
        },
        {
          changelog: false,
          commit: false,
          fixed: [],
          linked: [],
          access: "restricted",
          baseBranch: "main",
          changedFilePatterns: ["**"],
          updateInternalDependencies: "patch",
          prettier: true,
          privatePackages: { version: true, tag: false },
          ignore: [],
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            onlyUpdatePeerDependentsWhenOutOfRange: false,
            updateInternalDependents: "out-of-range",
          },
          snapshot: {
            useCalculatedVersion: false,
            prereleaseTemplate: null,
          },
        }
      );
      let pkgPathA = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`)
      );
      let pkgPathB = changedFiles.find((b) =>
        b.endsWith(`pkg-b${path.sep}package.json`)
      );

      if (!pkgPathA || !pkgPathB) {
        throw new Error(`could not find an updated package json`);
      }
      let pkgJSONA = await fs.readJSON(pkgPathA);
      let pkgJSONB = await fs.readJSON(pkgPathB);

      expect(pkgJSONA).toMatchObject({
        name: "pkg-a",
        version: "1.0.0",
        devDependencies: {
          "pkg-b": "1.1.0",
        },
      });
      expect(pkgJSONB).toMatchObject({
        name: "pkg-b",
        version: "1.1.0",
      });
    });
    it("should skip dependencies that have the same name as the package", async () => {
      let { tempDir } = await testSetup(
        {
          "package.json": JSON.stringify({
            name: "self-referenced",
            version: "1.0.0",
            devDependencies: {
              "self-referenced": "file:",
            },
          }),
        },
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [{ name: "self-referenced", type: "minor" }],
            },
          ],
          releases: [
            {
              name: "self-referenced",
              type: "minor",
              oldVersion: "1.0.0",
              newVersion: "1.1.0",
              changesets: ["quick-lions-devour"],
            },
          ],
          preState: undefined,
        },
        {
          changelog: false,
          commit: false,
          fixed: [],
          linked: [],
          access: "restricted",
          baseBranch: "main",
          changedFilePatterns: ["**"],
          updateInternalDependencies: "patch",
          prettier: true,
          privatePackages: { version: true, tag: false },
          ignore: [],
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            onlyUpdatePeerDependentsWhenOutOfRange: false,
            updateInternalDependents: "out-of-range",
          },
          snapshot: {
            useCalculatedVersion: false,
            prereleaseTemplate: null,
          },
        }
      );

      let pkgJSON = await fs.readJSON(path.join(tempDir, "package.json"));

      expect(pkgJSON).toMatchObject({
        name: "self-referenced",
        version: "1.1.0",
        devDependencies: {
          "self-referenced": "file:",
        },
      });
    });
    it("should not update dependent versions when a package has a changeset type of none", async () => {
      let { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "^1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        },
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [{ name: "pkg-b", type: "none" }],
            },
          ],
          releases: [
            {
              name: "pkg-b",
              type: "none",
              oldVersion: "1.0.0",
              newVersion: "1.0.0",
              changesets: ["quick-lions-devour"],
            },
          ],
          preState: undefined,
        },
        { ...defaultConfig, changelog: false }
      );
      let pkgPathA = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`)
      );
      let pkgPathB = changedFiles.find((b) =>
        b.endsWith(`pkg-b${path.sep}package.json`)
      );

      expect(pkgPathA).toBeUndefined();
      if (!pkgPathB) throw new Error(`could not find an updated package json`);

      let pkgJSONB = await fs.readJSON(pkgPathB);

      expect(pkgJSONB).toMatchObject({
        name: "pkg-b",
        version: "1.0.0",
      });
    });
    it("should not update workspace dependent versions when a package has a changeset type of none", async () => {
      let { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "workspace:1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        },
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [{ name: "pkg-b", type: "none" }],
            },
          ],
          releases: [
            {
              name: "pkg-b",
              type: "none",
              oldVersion: "1.0.0",
              newVersion: "1.0.0",
              changesets: ["quick-lions-devour"],
            },
          ],
          preState: undefined,
        },
        { ...defaultConfig, changelog: false }
      );
      let pkgPathA = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`)
      );
      let pkgPathB = changedFiles.find((b) =>
        b.endsWith(`pkg-b${path.sep}package.json`)
      );

      expect(pkgPathA).toBeUndefined();
      if (!pkgPathB) throw new Error(`could not find an updated package json`);

      let pkgJSONB = await fs.readJSON(pkgPathB);

      expect(pkgJSONB).toMatchObject({
        name: "pkg-b",
        version: "1.0.0",
      });
    });
    it("should use exact versioning when snapshot release is applied, and ignore any range modifiers", async () => {
      const releasePlan = new FakeReleasePlan(
        [
          {
            id: "some-id",
            releases: [{ name: "pkg-b", type: "minor" }],
            summary: "a very useful summary",
          },
        ],
        [
          {
            changesets: ["some-id"],
            name: "pkg-b",
            newVersion: "1.1.0",
            oldVersion: "1.0.0",
            type: "minor",
          },
        ]
      );
      let { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "^1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        releasePlan.config,
        "canary"
      );

      let pkgPath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`)
      );

      if (!pkgPath) throw new Error(`could not find an updated package json`);
      let pkgJSON = await fs.readJSON(pkgPath);

      expect(pkgJSON).toMatchObject({
        name: "pkg-a",
        version: "1.1.0",
        dependencies: {
          "pkg-b": "1.1.0",
        },
      });
    });

    describe("internal dependency bumping", () => {
      describe("updateInternalDependencies set to patch", () => {
        const updateInternalDependencies = "patch";
        it("should update min version ranges of patch bumped internal dependencies", async () => {
          let { changedFiles } = await testSetup(
            {
              "package.json": JSON.stringify({
                private: true,
                workspaces: ["packages/*"],
              }),
              "packages/pkg-a/package.json": JSON.stringify({
                name: "pkg-a",
                version: "1.0.3",
                dependencies: {
                  "pkg-b": "~1.2.0",
                },
              }),
              "packages/pkg-b/package.json": JSON.stringify({
                name: "pkg-b",
                version: "1.2.0",
                dependencies: {
                  "pkg-a": "^1.0.3",
                },
              }),
            },
            {
              changesets: [
                {
                  id: "quick-lions-devour",
                  summary: "Hey, let's have fun with testing!",
                  releases: [
                    { name: "pkg-a", type: "patch" },
                    { name: "pkg-b", type: "patch" },
                  ],
                },
              ],
              releases: [
                {
                  name: "pkg-a",
                  type: "patch",
                  oldVersion: "1.0.3",
                  newVersion: "1.0.4",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-b",
                  type: "patch",
                  oldVersion: "1.2.0",
                  newVersion: "1.2.1",
                  changesets: ["quick-lions-devour"],
                },
              ],
              preState: undefined,
            },
            {
              changelog: false,
              commit: false,
              fixed: [],
              linked: [],
              access: "restricted",
              changedFilePatterns: ["**"],
              baseBranch: "main",
              updateInternalDependencies,
              ignore: [],
              prettier: true,
              privatePackages: { version: true, tag: false },
              ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
                onlyUpdatePeerDependentsWhenOutOfRange: false,
                updateInternalDependents: "out-of-range",
              },
              snapshot: {
                useCalculatedVersion: false,
                prereleaseTemplate: null,
              },
            }
          );
          let pkgPathA = changedFiles.find((a) =>
            a.endsWith(`pkg-a${path.sep}package.json`)
          );
          let pkgPathB = changedFiles.find((b) =>
            b.endsWith(`pkg-b${path.sep}package.json`)
          );

          if (!pkgPathA || !pkgPathB) {
            throw new Error(`could not find an updated package json`);
          }
          let pkgJSONA = await fs.readJSON(pkgPathA);
          let pkgJSONB = await fs.readJSON(pkgPathB);

          expect(pkgJSONA).toMatchObject({
            name: "pkg-a",
            version: "1.0.4",
            dependencies: {
              "pkg-b": "~1.2.1",
            },
          });
          expect(pkgJSONB).toMatchObject({
            name: "pkg-b",
            version: "1.2.1",
            dependencies: {
              "pkg-a": "^1.0.4",
            },
          });
        });
        it("should still update min version ranges of patch bumped internal dependencies that have left semver range", async () => {
          let { changedFiles } = await testSetup(
            {
              "package.json": JSON.stringify({
                private: true,
                workspaces: ["packages/*"],
              }),
              "packages/pkg-a/package.json": JSON.stringify({
                name: "pkg-a",
                version: "1.0.3",
                dependencies: {
                  "pkg-b": "~1.2.0",
                },
              }),
              "packages/pkg-b/package.json": JSON.stringify({
                name: "pkg-b",
                version: "1.2.0",
                dependencies: {
                  "pkg-c": "2.0.0",
                  "pkg-a": "^1.0.3",
                },
              }),
              "packages/pkg-c/package.json": JSON.stringify({
                name: "pkg-c",
                version: "2.0.0",
                dependencies: {
                  "pkg-a": "^1.0.3",
                },
              }),
            },
            {
              changesets: [
                {
                  id: "quick-lions-devour",
                  summary: "Hey, let's have fun with testing!",
                  releases: [
                    { name: "pkg-a", type: "patch" },
                    { name: "pkg-b", type: "patch" },
                    { name: "pkg-c", type: "patch" },
                  ],
                },
              ],
              releases: [
                {
                  name: "pkg-a",
                  type: "patch",
                  oldVersion: "1.0.3",
                  newVersion: "1.0.4",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-b",
                  type: "none",
                  oldVersion: "1.2.0",
                  newVersion: "1.2.0",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-c",
                  type: "patch",
                  oldVersion: "2.0.0",
                  newVersion: "2.0.1",
                  changesets: ["quick-lions-devour"],
                },
              ],
              preState: undefined,
            },
            {
              changelog: false,
              commit: false,
              fixed: [],
              linked: [],
              access: "restricted",
              changedFilePatterns: ["**"],
              baseBranch: "main",
              updateInternalDependencies,
              ignore: [],
              prettier: true,
              privatePackages: { version: true, tag: false },
              ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
                onlyUpdatePeerDependentsWhenOutOfRange: false,
                updateInternalDependents: "out-of-range",
              },
              snapshot: {
                useCalculatedVersion: false,
                prereleaseTemplate: null,
              },
            }
          );
          let pkgPathA = changedFiles.find((a) =>
            a.endsWith(`pkg-a${path.sep}package.json`)
          );
          let pkgPathB = changedFiles.find((b) =>
            b.endsWith(`pkg-b${path.sep}package.json`)
          );

          if (!pkgPathA || !pkgPathB) {
            throw new Error(`could not find an updated package json`);
          }
          let pkgJSONA = await fs.readJSON(pkgPathA);
          let pkgJSONB = await fs.readJSON(pkgPathB);

          expect(pkgJSONA).toMatchObject({
            name: "pkg-a",
            version: "1.0.4",
            dependencies: {
              "pkg-b": "~1.2.0",
            },
          });
          expect(pkgJSONB).toMatchObject({
            name: "pkg-b",
            version: "1.2.0",
            dependencies: {
              "pkg-c": "2.0.1",
              "pkg-a": "^1.0.4",
            },
          });
        });
        it("should update min version ranges of minor bumped internal dependencies", async () => {
          let { changedFiles } = await testSetup(
            {
              "package.json": JSON.stringify({
                private: true,
                workspaces: ["packages/*"],
              }),
              "packages/pkg-a/package.json": JSON.stringify({
                name: "pkg-a",
                version: "1.0.3",
                dependencies: {
                  "pkg-b": "~1.2.0",
                },
              }),
              "packages/pkg-b/package.json": JSON.stringify({
                name: "pkg-b",
                version: "1.2.0",
                dependencies: {
                  "pkg-a": "^1.0.3",
                },
              }),
            },
            {
              changesets: [
                {
                  id: "quick-lions-devour",
                  summary: "Hey, let's have fun with testing!",
                  releases: [
                    { name: "pkg-a", type: "minor" },
                    { name: "pkg-b", type: "patch" },
                  ],
                },
              ],
              releases: [
                {
                  name: "pkg-a",
                  type: "minor",
                  oldVersion: "1.0.3",
                  newVersion: "1.1.0",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-b",
                  type: "patch",
                  oldVersion: "1.2.0",
                  newVersion: "1.2.1",
                  changesets: ["quick-lions-devour"],
                },
              ],
              preState: undefined,
            },
            {
              changelog: false,
              commit: false,
              fixed: [],
              linked: [],
              access: "restricted",
              changedFilePatterns: ["**"],
              baseBranch: "main",
              updateInternalDependencies,
              ignore: [],
              prettier: true,
              privatePackages: { version: true, tag: false },
              ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
                onlyUpdatePeerDependentsWhenOutOfRange: false,
                updateInternalDependents: "out-of-range",
              },
              snapshot: {
                useCalculatedVersion: false,
                prereleaseTemplate: null,
              },
            }
          );
          let pkgPathA = changedFiles.find((a) =>
            a.endsWith(`pkg-a${path.sep}package.json`)
          );
          let pkgPathB = changedFiles.find((b) =>
            b.endsWith(`pkg-b${path.sep}package.json`)
          );

          if (!pkgPathA || !pkgPathB) {
            throw new Error(`could not find an updated package json`);
          }
          let pkgJSONA = await fs.readJSON(pkgPathA);
          let pkgJSONB = await fs.readJSON(pkgPathB);

          expect(pkgJSONA).toMatchObject({
            name: "pkg-a",
            version: "1.1.0",
            dependencies: {
              "pkg-b": "~1.2.1",
            },
          });
          expect(pkgJSONB).toMatchObject({
            name: "pkg-b",
            version: "1.2.1",
            dependencies: {
              "pkg-a": "^1.1.0",
            },
          });
        });
        it("should update min version ranges of major bumped internal dependencies", async () => {
          let { changedFiles } = await testSetup(
            {
              "package.json": JSON.stringify({
                private: true,
                workspaces: ["packages/*"],
              }),
              "packages/pkg-a/package.json": JSON.stringify({
                name: "pkg-a",
                version: "1.0.3",
                dependencies: {
                  "pkg-b": "~1.2.0",
                },
              }),
              "packages/pkg-b/package.json": JSON.stringify({
                name: "pkg-b",
                version: "1.2.0",
                dependencies: {
                  "pkg-a": "^1.0.3",
                },
              }),
            },
            {
              changesets: [
                {
                  id: "quick-lions-devour",
                  summary: "Hey, let's have fun with testing!",
                  releases: [
                    { name: "pkg-a", type: "major" },
                    { name: "pkg-b", type: "patch" },
                  ],
                },
              ],
              releases: [
                {
                  name: "pkg-a",
                  type: "major",
                  oldVersion: "1.0.3",
                  newVersion: "2.0.0",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-b",
                  type: "patch",
                  oldVersion: "1.2.0",
                  newVersion: "1.2.1",
                  changesets: ["quick-lions-devour"],
                },
              ],
              preState: undefined,
            },
            {
              changelog: false,
              commit: false,
              fixed: [],
              linked: [],
              access: "restricted",
              changedFilePatterns: ["**"],
              baseBranch: "main",
              updateInternalDependencies,
              ignore: [],
              prettier: true,
              privatePackages: { version: true, tag: false },
              ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
                onlyUpdatePeerDependentsWhenOutOfRange: false,
                updateInternalDependents: "out-of-range",
              },
              snapshot: {
                useCalculatedVersion: false,
                prereleaseTemplate: null,
              },
            }
          );
          let pkgPathA = changedFiles.find((a) =>
            a.endsWith(`pkg-a${path.sep}package.json`)
          );
          let pkgPathB = changedFiles.find((b) =>
            b.endsWith(`pkg-b${path.sep}package.json`)
          );

          if (!pkgPathA || !pkgPathB) {
            throw new Error(`could not find an updated package json`);
          }
          let pkgJSONA = await fs.readJSON(pkgPathA);
          let pkgJSONB = await fs.readJSON(pkgPathB);

          expect(pkgJSONA).toMatchObject({
            name: "pkg-a",
            version: "2.0.0",
            dependencies: {
              "pkg-b": "~1.2.1",
            },
          });
          expect(pkgJSONB).toMatchObject({
            name: "pkg-b",
            version: "1.2.1",
            dependencies: {
              "pkg-a": "^2.0.0",
            },
          });
        });
        it("should not update dependant's dependency range when it depends on a tag of a bumped dependency", async () => {
          let { changedFiles } = await testSetup(
            {
              "package.json": JSON.stringify({
                private: true,
                workspaces: ["packages/*"],
              }),
              "packages/pkg-a/package.json": JSON.stringify({
                name: "pkg-a",
                version: "1.0.3",
                dependencies: {
                  "pkg-b": "latest",
                },
              }),
              "packages/pkg-b/package.json": JSON.stringify({
                name: "pkg-b",
                version: "1.2.0",
                dependencies: {
                  "pkg-a": "bulbasaur",
                },
              }),
            },
            {
              changesets: [
                {
                  id: "quick-lions-devour",
                  summary: "Hey, let's have fun with testing!",
                  releases: [
                    { name: "pkg-a", type: "patch" },
                    { name: "pkg-b", type: "patch" },
                  ],
                },
              ],
              releases: [
                {
                  name: "pkg-a",
                  type: "patch",
                  oldVersion: "1.0.3",
                  newVersion: "1.0.4",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-b",
                  type: "patch",
                  oldVersion: "1.2.0",
                  newVersion: "1.2.1",
                  changesets: ["quick-lions-devour"],
                },
              ],
              preState: undefined,
            },
            {
              changelog: false,
              commit: false,
              fixed: [],
              linked: [],
              access: "restricted",
              changedFilePatterns: ["**"],
              baseBranch: "main",
              updateInternalDependencies,
              ignore: [],
              prettier: true,
              privatePackages: { version: true, tag: false },
              ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
                onlyUpdatePeerDependentsWhenOutOfRange: false,
                updateInternalDependents: "out-of-range",
              },
              snapshot: {
                useCalculatedVersion: false,
                prereleaseTemplate: null,
              },
            }
          );
          let pkgPathA = changedFiles.find((a) =>
            a.endsWith(`pkg-a${path.sep}package.json`)
          );
          let pkgPathB = changedFiles.find((b) =>
            b.endsWith(`pkg-b${path.sep}package.json`)
          );

          if (!pkgPathA || !pkgPathB) {
            throw new Error(`could not find an updated package json`);
          }
          let pkgJSONA = await fs.readJSON(pkgPathA);
          let pkgJSONB = await fs.readJSON(pkgPathB);

          expect(pkgJSONA).toMatchObject({
            name: "pkg-a",
            version: "1.0.4",
            dependencies: {
              "pkg-b": "latest",
            },
          });
          expect(pkgJSONB).toMatchObject({
            name: "pkg-b",
            version: "1.2.1",
            dependencies: {
              "pkg-a": "bulbasaur",
            },
          });
        });
      });
      describe("updateInternalDependencies set to minor", () => {
        const updateInternalDependencies = "minor";
        it("should NOT update min version ranges of patch bumped internal dependencies", async () => {
          let { changedFiles } = await testSetup(
            {
              "package.json": JSON.stringify({
                private: true,
                workspaces: ["packages/*"],
              }),
              "packages/pkg-a/package.json": JSON.stringify({
                name: "pkg-a",
                version: "1.0.3",
                dependencies: {
                  "pkg-b": "~1.2.0",
                },
              }),
              "packages/pkg-b/package.json": JSON.stringify({
                name: "pkg-b",
                version: "1.2.0",
                dependencies: {
                  "pkg-a": "^1.0.3",
                },
              }),
            },
            {
              changesets: [
                {
                  id: "quick-lions-devour",
                  summary: "Hey, let's have fun with testing!",
                  releases: [
                    { name: "pkg-a", type: "patch" },
                    { name: "pkg-b", type: "patch" },
                  ],
                },
              ],
              releases: [
                {
                  name: "pkg-a",
                  type: "patch",
                  oldVersion: "1.0.3",
                  newVersion: "1.0.4",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-b",
                  type: "patch",
                  oldVersion: "1.2.0",
                  newVersion: "1.2.1",
                  changesets: ["quick-lions-devour"],
                },
              ],
              preState: undefined,
            },
            {
              changelog: false,
              commit: false,
              fixed: [],
              linked: [],
              access: "restricted",
              changedFilePatterns: ["**"],
              baseBranch: "main",
              updateInternalDependencies,
              ignore: [],
              prettier: true,
              privatePackages: { version: true, tag: false },
              ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
                onlyUpdatePeerDependentsWhenOutOfRange: false,
                updateInternalDependents: "out-of-range",
              },
              snapshot: {
                useCalculatedVersion: false,
                prereleaseTemplate: null,
              },
            }
          );
          let pkgPathA = changedFiles.find((a) =>
            a.endsWith(`pkg-a${path.sep}package.json`)
          );
          let pkgPathB = changedFiles.find((b) =>
            b.endsWith(`pkg-b${path.sep}package.json`)
          );

          if (!pkgPathA || !pkgPathB) {
            throw new Error(`could not find an updated package json`);
          }
          let pkgJSONA = await fs.readJSON(pkgPathA);
          let pkgJSONB = await fs.readJSON(pkgPathB);

          expect(pkgJSONA).toMatchObject({
            name: "pkg-a",
            version: "1.0.4",
            dependencies: {
              "pkg-b": "~1.2.0",
            },
          });
          expect(pkgJSONB).toMatchObject({
            name: "pkg-b",
            version: "1.2.1",
            dependencies: {
              "pkg-a": "^1.0.3",
            },
          });
        });
        it("should still update min version ranges of patch bumped internal dependencies that have left semver range", async () => {
          let { changedFiles } = await testSetup(
            {
              "package.json": JSON.stringify({
                private: true,
                workspaces: ["packages/*"],
              }),
              "packages/pkg-a/package.json": JSON.stringify({
                name: "pkg-a",
                version: "1.0.3",
                dependencies: {
                  "pkg-b": "~1.2.0",
                },
              }),
              "packages/pkg-b/package.json": JSON.stringify({
                name: "pkg-b",
                version: "1.2.0",
                dependencies: {
                  "pkg-c": "2.0.0",
                  "pkg-a": "^1.0.3",
                },
              }),
              "packages/pkg-c/package.json": JSON.stringify({
                name: "pkg-c",
                version: "2.0.0",
                dependencies: {
                  "pkg-a": "^1.0.3",
                },
              }),
            },
            {
              changesets: [
                {
                  id: "quick-lions-devour",
                  summary: "Hey, let's have fun with testing!",
                  releases: [
                    { name: "pkg-a", type: "patch" },
                    { name: "pkg-b", type: "patch" },
                    { name: "pkg-c", type: "patch" },
                  ],
                },
              ],
              releases: [
                {
                  name: "pkg-a",
                  type: "patch",
                  oldVersion: "1.0.3",
                  newVersion: "1.0.4",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-b",
                  type: "patch",
                  oldVersion: "1.2.0",
                  newVersion: "1.2.1",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-c",
                  type: "patch",
                  oldVersion: "2.0.0",
                  newVersion: "2.0.1",
                  changesets: ["quick-lions-devour"],
                },
              ],
              preState: undefined,
            },
            {
              changelog: false,
              commit: false,
              fixed: [],
              linked: [],
              access: "restricted",
              changedFilePatterns: ["**"],
              baseBranch: "main",
              updateInternalDependencies,
              ignore: [],
              prettier: true,
              privatePackages: { version: true, tag: false },
              ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
                onlyUpdatePeerDependentsWhenOutOfRange: false,
                updateInternalDependents: "out-of-range",
              },
              snapshot: {
                useCalculatedVersion: false,
                prereleaseTemplate: null,
              },
            }
          );
          let pkgPathA = changedFiles.find((a) =>
            a.endsWith(`pkg-a${path.sep}package.json`)
          );
          let pkgPathB = changedFiles.find((b) =>
            b.endsWith(`pkg-b${path.sep}package.json`)
          );

          if (!pkgPathA || !pkgPathB) {
            throw new Error(`could not find an updated package json`);
          }
          let pkgJSONA = await fs.readJSON(pkgPathA);
          let pkgJSONB = await fs.readJSON(pkgPathB);

          expect(pkgJSONA).toMatchObject({
            name: "pkg-a",
            version: "1.0.4",
            dependencies: {
              "pkg-b": "~1.2.0",
            },
          });
          expect(pkgJSONB).toMatchObject({
            name: "pkg-b",
            version: "1.2.1",
            dependencies: {
              "pkg-c": "2.0.1",
              "pkg-a": "^1.0.3",
            },
          });
        });
        it("should update min version ranges of minor bumped internal dependencies", async () => {
          let { changedFiles } = await testSetup(
            {
              "package.json": JSON.stringify({
                private: true,
                workspaces: ["packages/*"],
              }),
              "packages/pkg-a/package.json": JSON.stringify({
                name: "pkg-a",
                version: "1.0.3",
                dependencies: {
                  "pkg-b": "~1.2.0",
                },
              }),
              "packages/pkg-b/package.json": JSON.stringify({
                name: "pkg-b",
                version: "1.2.0",
                dependencies: {
                  "pkg-c": "2.0.0",
                  "pkg-a": "^1.0.3",
                },
              }),
              "packages/pkg-c/package.json": JSON.stringify({
                name: "pkg-c",
                version: "2.0.0",
                dependencies: {
                  "pkg-a": "^1.0.3",
                },
              }),
            },
            {
              changesets: [
                {
                  id: "quick-lions-devour",
                  summary: "Hey, let's have fun with testing!",
                  releases: [
                    { name: "pkg-a", type: "minor" },
                    { name: "pkg-b", type: "patch" },
                  ],
                },
              ],
              releases: [
                {
                  name: "pkg-a",
                  type: "minor",
                  oldVersion: "1.0.3",
                  newVersion: "1.1.0",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-b",
                  type: "patch",
                  oldVersion: "1.2.0",
                  newVersion: "1.2.1",
                  changesets: ["quick-lions-devour"],
                },
              ],
              preState: undefined,
            },
            {
              changelog: false,
              commit: false,
              fixed: [],
              linked: [],
              access: "restricted",
              changedFilePatterns: ["**"],
              baseBranch: "main",
              updateInternalDependencies,
              ignore: [],
              prettier: true,
              privatePackages: { version: true, tag: false },
              ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
                onlyUpdatePeerDependentsWhenOutOfRange: false,
                updateInternalDependents: "out-of-range",
              },
              snapshot: {
                useCalculatedVersion: false,
                prereleaseTemplate: null,
              },
            }
          );
          let pkgPathA = changedFiles.find((a) =>
            a.endsWith(`pkg-a${path.sep}package.json`)
          );
          let pkgPathB = changedFiles.find((b) =>
            b.endsWith(`pkg-b${path.sep}package.json`)
          );

          if (!pkgPathA || !pkgPathB) {
            throw new Error(`could not find an updated package json`);
          }
          let pkgJSONA = await fs.readJSON(pkgPathA);
          let pkgJSONB = await fs.readJSON(pkgPathB);

          expect(pkgJSONA).toMatchObject({
            name: "pkg-a",
            version: "1.1.0",
            dependencies: {
              "pkg-b": "~1.2.0",
            },
          });
          expect(pkgJSONB).toMatchObject({
            name: "pkg-b",
            version: "1.2.1",
            dependencies: {
              "pkg-a": "^1.1.0",
            },
          });
        });
        it("should update min version ranges of major bumped internal dependencies", async () => {
          let { changedFiles } = await testSetup(
            {
              "package.json": JSON.stringify({
                private: true,
                workspaces: ["packages/*"],
              }),
              "packages/pkg-a/package.json": JSON.stringify({
                name: "pkg-a",
                version: "1.0.3",
                dependencies: {
                  "pkg-b": "~1.2.0",
                },
              }),
              "packages/pkg-b/package.json": JSON.stringify({
                name: "pkg-b",
                version: "1.2.0",
                dependencies: {
                  "pkg-a": "^1.0.3",
                },
              }),
            },
            {
              changesets: [
                {
                  id: "quick-lions-devour",
                  summary: "Hey, let's have fun with testing!",
                  releases: [
                    { name: "pkg-a", type: "major" },
                    { name: "pkg-b", type: "patch" },
                  ],
                },
              ],
              releases: [
                {
                  name: "pkg-a",
                  type: "major",
                  oldVersion: "1.0.3",
                  newVersion: "2.0.0",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-b",
                  type: "patch",
                  oldVersion: "1.2.0",
                  newVersion: "1.2.1",
                  changesets: ["quick-lions-devour"],
                },
              ],
              preState: undefined,
            },
            {
              changelog: false,
              commit: false,
              fixed: [],
              linked: [],
              access: "restricted",
              changedFilePatterns: ["**"],
              baseBranch: "main",
              updateInternalDependencies,
              ignore: [],
              prettier: true,
              privatePackages: { version: true, tag: false },
              ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
                onlyUpdatePeerDependentsWhenOutOfRange: false,
                updateInternalDependents: "out-of-range",
              },
              snapshot: {
                useCalculatedVersion: false,
                prereleaseTemplate: null,
              },
            }
          );
          let pkgPathA = changedFiles.find((a) =>
            a.endsWith(`pkg-a${path.sep}package.json`)
          );
          let pkgPathB = changedFiles.find((b) =>
            b.endsWith(`pkg-b${path.sep}package.json`)
          );

          if (!pkgPathA || !pkgPathB) {
            throw new Error(`could not find an updated package json`);
          }
          let pkgJSONA = await fs.readJSON(pkgPathA);
          let pkgJSONB = await fs.readJSON(pkgPathB);

          expect(pkgJSONA).toMatchObject({
            name: "pkg-a",
            version: "2.0.0",
            dependencies: {
              "pkg-b": "~1.2.0",
            },
          });
          expect(pkgJSONB).toMatchObject({
            name: "pkg-b",
            version: "1.2.1",
            dependencies: {
              "pkg-a": "^2.0.0",
            },
          });
        });
      });
    });

    describe("onlyUpdatePeerDependentsWhenOutOfRange set to true", () => {
      it("should not bump peerDependencies if they are still in range", async () => {
        let { changedFiles } = await testSetup(
          {
            "package.json": JSON.stringify({
              private: true,
              workspaces: ["packages/*"],
            }),
            "packages/depended-upon/package.json": JSON.stringify({
              name: "depended-upon",
              version: "1.0.0",
            }),
            "packages/has-peer-dep/package.json": JSON.stringify({
              name: "has-peer-dep",
              version: "1.0.0",
              peerDependencies: {
                "depended-upon": "^1.0.0",
              },
            }),
          },
          {
            changesets: [
              {
                id: "quick-lions-devour",
                summary: "Hey, let's have fun with testing!",
                releases: [
                  { name: "depended-upon", type: "patch" },
                  { name: "has-peer-dep", type: "patch" },
                ],
              },
            ],
            releases: [
              {
                name: "has-peer-dep",
                type: "patch",
                oldVersion: "1.0.0",
                newVersion: "1.0.1",
                changesets: ["quick-lions-devour"],
              },
              {
                name: "depended-upon",
                type: "patch",
                oldVersion: "1.0.0",
                newVersion: "1.0.1",
                changesets: ["quick-lions-devour"],
              },
            ],
            preState: undefined,
          },
          {
            changelog: false,
            commit: false,
            fixed: [],
            linked: [],
            access: "restricted",
            changedFilePatterns: ["**"],
            baseBranch: "main",
            updateInternalDependencies: "patch",
            ignore: [],
            prettier: true,
            privatePackages: { version: true, tag: false },
            ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
              onlyUpdatePeerDependentsWhenOutOfRange: true,
              updateInternalDependents: "out-of-range",
            },
            snapshot: {
              useCalculatedVersion: false,
              prereleaseTemplate: null,
            },
          }
        );
        let pkgPathDependent = changedFiles.find((a) =>
          a.endsWith(`has-peer-dep${path.sep}package.json`)
        );
        let pkgPathDepended = changedFiles.find((b) =>
          b.endsWith(`depended-upon${path.sep}package.json`)
        );

        if (!pkgPathDependent || !pkgPathDepended) {
          throw new Error(`could not find an updated package json`);
        }
        let pkgJSONDependent = await fs.readJSON(pkgPathDependent);
        let pkgJSONDepended = await fs.readJSON(pkgPathDepended);

        expect(pkgJSONDependent).toMatchObject({
          name: "has-peer-dep",
          version: "1.0.1",
          peerDependencies: {
            "depended-upon": "^1.0.0",
          },
        });
        expect(pkgJSONDepended).toMatchObject({
          name: "depended-upon",
          version: "1.0.1",
        });
      });
    });
  });
  describe("changelogs", () => {
    it("should not generate any changelogs", async () => {
      const releasePlan = new FakeReleasePlan();
      let { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        {
          ...releasePlan.config,
          changelog: false,
        }
      );

      expect(
        changedFiles.find((a) => a.endsWith(`pkg-a${path.sep}CHANGELOG.md`))
      ).toBeUndefined();
    });
    it("should update a changelog for one package", async () => {
      const releasePlan = new FakeReleasePlan();
      let { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        {
          ...releasePlan.config,
          changelog: [
            path.resolve(__dirname, "test-utils/simple-get-changelog-entry"),
            null,
          ],
        }
      );

      let readmePath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}CHANGELOG.md`)
      );

      if (!readmePath) throw new Error(`could not find an updated changelog`);
      let readme = await fs.readFile(readmePath, "utf-8");

      expect(readme.trim()).toEqual(outdent`# pkg-a

      ## 1.1.0

      ### Minor Changes

      - Hey, let's have fun with testing!`);
    });
    it("should update a changelog for two packages", async () => {
      const releasePlan = new FakeReleasePlan(
        [],
        [
          {
            name: "pkg-b",
            type: "major",
            oldVersion: "1.0.0",
            newVersion: "2.0.0",
            changesets: [],
          },
        ]
      );

      let { changedFiles } = await testSetup(
        {
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
        },
        releasePlan.getReleasePlan(),
        {
          ...releasePlan.config,
          changelog: [
            path.resolve(__dirname, "test-utils/simple-get-changelog-entry"),
            null,
          ],
        }
      );

      let readmePath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}CHANGELOG.md`)
      );
      let readmePathB = changedFiles.find((a) =>
        a.endsWith(`pkg-b${path.sep}CHANGELOG.md`)
      );

      if (!readmePath || !readmePathB)
        throw new Error(`could not find an updated changelog`);
      let readme = await fs.readFile(readmePath, "utf-8");
      let readmeB = await fs.readFile(readmePathB, "utf-8");

      expect(readme.trim()).toEqual(outdent`# pkg-a

      ## 1.1.0

      ### Minor Changes

      - Hey, let's have fun with testing!

      ### Patch Changes

      - pkg-b@2.0.0`);

      expect(readmeB.trim()).toEqual(outdent`# pkg-b

      ## 2.0.0`);
    });
    it("should not update the changelog if only devDeps changed", async () => {
      let { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            devDependencies: {
              "pkg-b": "1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        },
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [
                { name: "pkg-a", type: "none" },
                { name: "pkg-b", type: "minor" },
              ],
            },
          ],
          releases: [
            {
              name: "pkg-a",
              type: "none",
              oldVersion: "1.0.0",
              newVersion: "1.0.0",
              changesets: [],
            },
            {
              name: "pkg-b",
              type: "minor",
              oldVersion: "1.0.0",
              newVersion: "1.1.0",
              changesets: ["quick-lions-devour"],
            },
          ],
          preState: undefined,
        },
        {
          commit: false,
          fixed: [],
          linked: [],
          access: "restricted",
          baseBranch: "main",
          changedFilePatterns: ["**"],
          changelog: [
            path.resolve(__dirname, "test-utils/simple-get-changelog-entry"),
            null,
          ],
          updateInternalDependencies: "patch",
          ignore: [],
          prettier: true,
          privatePackages: { version: true, tag: false },
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            onlyUpdatePeerDependentsWhenOutOfRange: false,
            updateInternalDependents: "out-of-range",
          },
          snapshot: {
            useCalculatedVersion: false,
            prereleaseTemplate: null,
          },
        }
      );
      let pkgAChangelogPath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}CHANGELOG.md`)
      );

      expect(pkgAChangelogPath).toBeUndefined();
    });

    test("should list multi-line same-type summaries correctly", async () => {
      const releasePlan = new FakeReleasePlan([
        {
          id: "some-id-1",
          summary: "Random stuff\n\nget it while it's hot!",
          releases: [{ name: "pkg-a", type: "minor" }],
        },
        {
          id: "some-id-2",
          summary: "New feature, much wow\n\nlook at this shiny stuff!",
          releases: [{ name: "pkg-a", type: "minor" }],
        },
      ]);
      releasePlan.releases[0].changesets.push("some-id-1", "some-id-2");

      let { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        {
          ...releasePlan.config,
          changelog: [
            path.resolve(__dirname, "test-utils/simple-get-changelog-entry"),
            null,
          ],
        }
      );

      let readmePath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}CHANGELOG.md`)
      );

      if (!readmePath) throw new Error(`could not find an updated changelog`);
      let readme = await fs.readFile(readmePath, "utf-8");
      expect(readme.trim()).toEqual(
        [
          "# pkg-a\n",
          "## 1.1.0\n",
          "### Minor Changes\n",
          "- Hey, let's have fun with testing!",
          "- Random stuff\n",
          "  get it while it's hot!\n",
          "- New feature, much wow\n",
          "  look at this shiny stuff!",
        ].join("\n")
      );
    });

    it("should add an updated dependencies line when dependencies have been updated", async () => {
      let { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.3",
            dependencies: {
              "pkg-b": "~1.2.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.2.0",
            dependencies: {
              "pkg-a": "^1.0.3",
            },
          }),
        },
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [
                { name: "pkg-a", type: "patch" },
                { name: "pkg-b", type: "patch" },
              ],
            },
          ],
          releases: [
            {
              name: "pkg-a",
              type: "patch",
              oldVersion: "1.0.3",
              newVersion: "1.0.4",
              changesets: ["quick-lions-devour"],
            },
            {
              name: "pkg-b",
              type: "patch",
              oldVersion: "1.2.0",
              newVersion: "1.2.1",
              changesets: ["quick-lions-devour"],
            },
          ],
          preState: undefined,
        },
        {
          changelog: [
            path.resolve(__dirname, "test-utils/simple-get-changelog-entry"),
            null,
          ],
          commit: false,
          fixed: [],
          linked: [],
          access: "restricted",
          changedFilePatterns: ["**"],
          baseBranch: "main",
          updateInternalDependencies: "patch",
          ignore: [],
          prettier: true,
          privatePackages: { version: true, tag: false },
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            onlyUpdatePeerDependentsWhenOutOfRange: false,
            updateInternalDependents: "out-of-range",
          },
          snapshot: {
            useCalculatedVersion: false,
            prereleaseTemplate: null,
          },
        }
      );

      let readmePath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}CHANGELOG.md`)
      );
      let readmePathB = changedFiles.find((a) =>
        a.endsWith(`pkg-b${path.sep}CHANGELOG.md`)
      );

      if (!readmePath || !readmePathB)
        throw new Error(`could not find an updated changelog`);
      let readme = await fs.readFile(readmePath, "utf-8");
      let readmeB = await fs.readFile(readmePathB, "utf-8");

      expect(readme.trim()).toEqual(outdent`# pkg-a

      ## 1.0.4

      ### Patch Changes

      - Hey, let's have fun with testing!
      - Updated dependencies
        - pkg-b@1.2.1`);

      expect(readmeB.trim()).toEqual(outdent`# pkg-b

      ## 1.2.1

      ### Patch Changes

      - Hey, let's have fun with testing!
      - Updated dependencies
        - pkg-a@1.0.4`);
    });

    it("should NOT add updated dependencies line if dependencies have NOT been updated", async () => {
      let { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.3",
            dependencies: {
              "pkg-b": "~1.2.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.2.0",
            dependencies: {
              "pkg-a": "^1.0.3",
            },
          }),
        },
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [
                { name: "pkg-a", type: "patch" },
                { name: "pkg-b", type: "patch" },
              ],
            },
          ],
          releases: [
            {
              name: "pkg-a",
              type: "patch",
              oldVersion: "1.0.3",
              newVersion: "1.0.4",
              changesets: ["quick-lions-devour"],
            },
            {
              name: "pkg-b",
              type: "patch",
              oldVersion: "1.2.0",
              newVersion: "1.2.1",
              changesets: ["quick-lions-devour"],
            },
          ],
          preState: undefined,
        },
        {
          changelog: [
            path.resolve(__dirname, "test-utils/simple-get-changelog-entry"),
            null,
          ],
          commit: false,
          fixed: [],
          linked: [],
          access: "restricted",
          changedFilePatterns: ["**"],
          baseBranch: "main",
          updateInternalDependencies: "minor",
          ignore: [],
          prettier: true,
          privatePackages: { version: true, tag: false },
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            onlyUpdatePeerDependentsWhenOutOfRange: false,
            updateInternalDependents: "out-of-range",
          },
          snapshot: {
            useCalculatedVersion: false,
            prereleaseTemplate: null,
          },
        }
      );

      let readmePath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}CHANGELOG.md`)
      );
      let readmePathB = changedFiles.find((a) =>
        a.endsWith(`pkg-b${path.sep}CHANGELOG.md`)
      );

      if (!readmePath || !readmePathB)
        throw new Error(`could not find an updated changelog`);
      let readme = await fs.readFile(readmePath, "utf-8");
      let readmeB = await fs.readFile(readmePathB, "utf-8");

      expect(readme.trim()).toEqual(outdent`# pkg-a

      ## 1.0.4

      ### Patch Changes

      - Hey, let's have fun with testing!`);

      expect(readmeB.trim()).toEqual(outdent`# pkg-b

      ## 1.2.1

      ### Patch Changes

      - Hey, let's have fun with testing!`);
    });

    it("should only add updated dependencies line for dependencies that have been updated", async () => {
      let { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.3",
            dependencies: {
              "pkg-b": "~1.2.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.2.0",
            dependencies: {
              "pkg-c": "2.0.0",
              "pkg-a": "^1.0.3",
            },
          }),
          "packages/pkg-c/package.json": JSON.stringify({
            name: "pkg-c",
            version: "2.0.0",
            dependencies: {
              "pkg-a": "^1.0.3",
            },
          }),
        },
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [
                { name: "pkg-a", type: "patch" },
                { name: "pkg-b", type: "patch" },
                { name: "pkg-c", type: "minor" },
              ],
            },
          ],
          releases: [
            {
              name: "pkg-a",
              type: "patch",
              oldVersion: "1.0.3",
              newVersion: "1.0.4",
              changesets: ["quick-lions-devour"],
            },
            {
              name: "pkg-b",
              type: "patch",
              oldVersion: "1.2.0",
              newVersion: "1.2.1",
              changesets: ["quick-lions-devour"],
            },
            {
              name: "pkg-c",
              type: "minor",
              oldVersion: "2.0.0",
              newVersion: "2.1.0",
              changesets: ["quick-lions-devour"],
            },
          ],
          preState: undefined,
        },
        {
          changelog: [
            path.resolve(__dirname, "test-utils/simple-get-changelog-entry"),
            null,
          ],
          commit: false,
          fixed: [],
          linked: [],
          access: "restricted",
          changedFilePatterns: ["**"],
          baseBranch: "main",
          updateInternalDependencies: "minor",
          ignore: [],
          prettier: true,
          privatePackages: { version: true, tag: false },
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            onlyUpdatePeerDependentsWhenOutOfRange: false,
            updateInternalDependents: "out-of-range",
          },
          snapshot: {
            useCalculatedVersion: false,
            prereleaseTemplate: null,
          },
        }
      );

      let readmePath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}CHANGELOG.md`)
      );
      let readmePathB = changedFiles.find((a) =>
        a.endsWith(`pkg-b${path.sep}CHANGELOG.md`)
      );
      let readmePathC = changedFiles.find((a) =>
        a.endsWith(`pkg-c${path.sep}CHANGELOG.md`)
      );

      if (!readmePath || !readmePathB || !readmePathC)
        throw new Error(`could not find an updated changelog`);
      let readme = await fs.readFile(readmePath, "utf-8");
      let readmeB = await fs.readFile(readmePathB, "utf-8");
      let readmeC = await fs.readFile(readmePathC, "utf-8");

      expect(readme.trim()).toEqual(outdent`# pkg-a

      ## 1.0.4

      ### Patch Changes

      - Hey, let's have fun with testing!`);

      expect(readmeB.trim()).toEqual(outdent`# pkg-b

      ## 1.2.1

      ### Patch Changes

      - Hey, let's have fun with testing!
      - Updated dependencies
        - pkg-c@2.1.0`);

      expect(readmeC.trim()).toEqual(outdent`# pkg-c

      ## 2.1.0

      ### Minor Changes

      - Hey, let's have fun with testing!`);
    });

    it("should still add updated dependencies line for dependencies that have a bump type less than the minimum internal bump range but leave semver range", async () => {
      let { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.3",
            dependencies: {
              "pkg-b": "~1.2.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.2.0",
            dependencies: {
              "pkg-c": "2.0.0",
              "pkg-a": "^1.0.3",
            },
          }),
          "packages/pkg-c/package.json": JSON.stringify({
            name: "pkg-c",
            version: "2.0.0",
            dependencies: {
              "pkg-a": "^1.0.3",
            },
          }),
        },
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [
                { name: "pkg-a", type: "patch" },
                { name: "pkg-b", type: "patch" },
                { name: "pkg-c", type: "patch" },
              ],
            },
          ],
          releases: [
            {
              name: "pkg-a",
              type: "patch",
              oldVersion: "1.0.3",
              newVersion: "1.0.4",
              changesets: ["quick-lions-devour"],
            },
            {
              name: "pkg-b",
              type: "patch",
              oldVersion: "1.2.0",
              newVersion: "1.2.1",
              changesets: ["quick-lions-devour"],
            },
            {
              name: "pkg-c",
              type: "patch",
              oldVersion: "2.0.0",
              newVersion: "2.0.1",
              changesets: ["quick-lions-devour"],
            },
          ],
          preState: undefined,
        },
        {
          changelog: [
            path.resolve(__dirname, "test-utils/simple-get-changelog-entry"),
            null,
          ],
          commit: false,
          fixed: [],
          linked: [],
          access: "restricted",
          changedFilePatterns: ["**"],
          baseBranch: "main",
          updateInternalDependencies: "minor",
          ignore: [],
          prettier: true,
          privatePackages: { version: true, tag: false },
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            onlyUpdatePeerDependentsWhenOutOfRange: false,
            updateInternalDependents: "out-of-range",
          },
          snapshot: {
            useCalculatedVersion: false,
            prereleaseTemplate: null,
          },
        }
      );

      let readmePath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}CHANGELOG.md`)
      );
      let readmePathB = changedFiles.find((a) =>
        a.endsWith(`pkg-b${path.sep}CHANGELOG.md`)
      );
      let readmePathC = changedFiles.find((a) =>
        a.endsWith(`pkg-c${path.sep}CHANGELOG.md`)
      );

      if (!readmePath || !readmePathB || !readmePathC)
        throw new Error(`could not find an updated changelog`);
      let readme = await fs.readFile(readmePath, "utf-8");
      let readmeB = await fs.readFile(readmePathB, "utf-8");
      let readmeC = await fs.readFile(readmePathC, "utf-8");

      expect(readme.trim()).toEqual(outdent`# pkg-a

      ## 1.0.4

      ### Patch Changes

      - Hey, let's have fun with testing!`);

      expect(readmeB.trim()).toEqual(outdent`# pkg-b

      ## 1.2.1

      ### Patch Changes

      - Hey, let's have fun with testing!
      - Updated dependencies
        - pkg-c@2.0.1`);

      expect(readmeC.trim()).toEqual(outdent`# pkg-c

      ## 2.0.1

      ### Patch Changes

      - Hey, let's have fun with testing!`);
    });
  });
  describe("should error and not write if", () => {
    // This is skipped as *for now* we are assuming we have been passed
    // valid releasePlans - this may get work done on it in the future
    it.skip("a package appears twice", async () => {
      let changedFiles;
      try {
        let testResults = await testSetup(
          {
            "package.json": JSON.stringify({
              private: true,
              workspaces: ["packages/*"],
            }),
            "packages/pkg-a/package.json": JSON.stringify({
              name: "pkg-a",
              version: "1.0.0",
            }),
          },
          {
            changesets: [
              {
                id: "quick-lions-devour",
                summary: "Hey, let's have fun with testing!",
                releases: [{ name: "pkg-a", type: "minor" }],
              },
            ],
            releases: [
              {
                name: "pkg-a",
                type: "minor",
                oldVersion: "1.0.0",
                newVersion: "1.1.0",
                changesets: ["quick-lions-devour"],
              },
              {
                name: "pkg-a",
                type: "minor",
                oldVersion: "1.0.0",
                newVersion: "1.1.0",
                changesets: ["quick-lions-devour"],
              },
            ],
            preState: undefined,
          }
        );
        changedFiles = testResults.changedFiles;
      } catch (e) {
        expect((e as Error).message).toEqual("some string probably");

        return;
      }

      throw new Error(
        `expected error but instead got changed files: \n${changedFiles.join(
          "\n"
        )}`
      );
    });
    it("a package cannot be found", async () => {
      let releasePlan = new FakeReleasePlan(
        [],
        [
          {
            name: "impossible-package",
            type: "minor",
            oldVersion: "1.0.0",
            newVersion: "1.0.0",
            changesets: [],
          },
        ]
      );

      let tempDir = await testdir({
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
      });

      await spawn("git", ["init"], { cwd: tempDir });

      await git.add(".", tempDir);
      await git.commit("first commit", tempDir);

      try {
        await applyReleasePlan(
          releasePlan.getReleasePlan(),
          await getPackages(tempDir),
          releasePlan.config
        );
      } catch (e) {
        expect((e as Error).message).toEqual(
          "Could not find matching package for release of: impossible-package"
        );

        let gitCmd = await spawn("git", ["status"], { cwd: tempDir });

        expect(gitCmd.stdout.toString().includes("nothing to commit")).toEqual(
          true
        );
        return;
      }

      throw new Error("Expected test to exit before this point");
    });
    it(
      "a provided changelog function fails",
      temporarilySilenceLogs(async () => {
        let releasePlan = new FakeReleasePlan();

        let tempDir = await testdir({
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
        });

        await spawn("git", ["init"], { cwd: tempDir });

        await git.add(".", tempDir);
        await git.commit("first commit", tempDir);

        try {
          await applyReleasePlan(
            releasePlan.getReleasePlan(),
            await getPackages(tempDir),
            {
              ...releasePlan.config,
              changelog: [
                path.resolve(__dirname, "test-utils/failing-functions"),
                null,
              ],
            }
          );
        } catch (e) {
          expect((e as Error).message).toEqual("no chance");

          let gitCmd = await spawn("git", ["status"], { cwd: tempDir });

          expect(
            gitCmd.stdout.toString().includes("nothing to commit")
          ).toEqual(true);
          expect((console.error as any).mock.calls).toMatchInlineSnapshot(`
            [
              [
                "The following error was encountered while generating changelog entries",
              ],
              [
                "We have escaped applying the changesets, and no files should have been affected",
              ],
            ]
          `);
          return;
        }

        throw new Error("Expected test to exit before this point");
      })
    );
  });
  describe("changesets", () => {
    it("should delete one changeset after it is applied", async () => {
      const releasePlan = new FakeReleasePlan();

      let changesetPath: string;

      const setupFunc = (tempDir: string) =>
        Promise.all(
          releasePlan.getReleasePlan().changesets.map(({ id, summary }) => {
            const thisPath = path.resolve(tempDir, ".changeset", `${id}.md`);
            changesetPath = thisPath;
            const content = `---\n---\n${summary}`;
            return fs.outputFile(thisPath, content);
          })
        );

      await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        releasePlan.config,
        undefined,
        setupFunc
      );

      // @ts-ignore this is possibly bad
      let pathExists = await fs.pathExists(changesetPath);
      expect(pathExists).toEqual(false);
    });
    it("should NOT delete changesets for ignored packages", async () => {
      const releasePlan = new FakeReleasePlan();

      let changesetPath: string;

      const setupFunc = (tempDir: string) =>
        Promise.all(
          releasePlan.getReleasePlan().changesets.map(({ id, summary }) => {
            const thisPath = path.resolve(tempDir, ".changeset", `${id}.md`);
            changesetPath = thisPath;
            const content = `---\n---\n${summary}`;
            return fs.outputFile(thisPath, content);
          })
        );

      await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        { ...releasePlan.config, ignore: ["pkg-a"] },
        undefined,
        setupFunc
      );

      // @ts-ignore this is possibly bad
      let pathExists = await fs.pathExists(changesetPath);
      expect(pathExists).toEqual(true);
    });
    it("should NOT delete changesets for private unversioned packages", async () => {
      const releasePlan = new FakeReleasePlan();

      let changesetPath: string;

      const setupFunc = (tempDir: string) =>
        Promise.all(
          releasePlan.getReleasePlan().changesets.map(({ id, summary }) => {
            const thisPath = path.resolve(tempDir, ".changeset", `${id}.md`);
            changesetPath = thisPath;
            const content = `---\n---\n${summary}`;
            return fs.outputFile(thisPath, content);
          })
        );

      await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            private: true,
          }),
        },
        releasePlan.getReleasePlan(),
        {
          ...releasePlan.config,
          privatePackages: { version: false, tag: false },
        },
        undefined,
        setupFunc
      );

      // @ts-ignore this is possibly bad
      let pathExists = await fs.pathExists(changesetPath);
      expect(pathExists).toEqual(true);
    });
    it("should delete an old format changeset if it is applied", async () => {
      const releasePlan = new FakeReleasePlan();

      let changesetMDPath: string;
      let changesetJSONPath: string;

      const setupFunc = (tempDir: string) =>
        Promise.all(
          releasePlan
            .getReleasePlan()
            .changesets.map(async ({ id, summary }) => {
              changesetMDPath = path.resolve(
                tempDir,
                ".changeset",
                id,
                `changes.md`
              );
              changesetJSONPath = path.resolve(
                tempDir,
                ".changeset",
                id,
                `changes.json`
              );
              await fs.outputFile(changesetMDPath, summary);
              await fs.outputFile(
                changesetJSONPath,
                JSON.stringify({ id, summary })
              );
            })
        );

      await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        releasePlan.config,
        undefined,
        setupFunc
      );

      // @ts-ignore this is possibly bad
      let mdPathExists = await fs.pathExists(changesetMDPath);
      // @ts-ignore this is possibly bad
      let JSONPathExists = await fs.pathExists(changesetMDPath);

      expect(mdPathExists).toEqual(false);
      expect(JSONPathExists).toEqual(false);
    });
  });

  it("should get the commit for an old changeset", async () => {
    const releasePlan = new FakeReleasePlan();

    let changesetMDPath: string;
    let changesetJSONPath: string;

    const setupFunc = (tempDir: string) =>
      Promise.all(
        releasePlan.changesets.map(async ({ id, summary }) => {
          changesetMDPath = path.resolve(
            tempDir,
            ".changeset",
            id,
            `changes.md`
          );
          changesetJSONPath = path.resolve(
            tempDir,
            ".changeset",
            id,
            `changes.json`
          );
          await fs.outputFile(changesetMDPath, summary);
          await fs.outputFile(
            changesetJSONPath,
            JSON.stringify({ id, summary })
          );
        })
      );

    let { tempDir } = await testSetup(
      {
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
      },
      releasePlan.getReleasePlan(),
      {
        ...releasePlan.config,
        commit: [
          path.resolve(__dirname, "test-utils/simple-get-commit-entry"),
          null,
        ],
        changelog: [
          path.resolve(__dirname, "test-utils/simple-get-changelog-entry"),
          null,
        ],
      },
      undefined,
      setupFunc
    );

    let thing = await spawn("git", ["rev-list", "HEAD"], { cwd: tempDir });
    let commits = thing.stdout
      .toString("utf8")
      .split("\n")
      .filter((x) => x);

    let lastCommit = commits[commits.length - 1].substring(0, 7);

    expect(
      await fs.readFile(
        path.join(tempDir, "packages", "pkg-a", "CHANGELOG.md"),
        "utf8"
      )
    ).toBe(`# pkg-a

## 1.1.0

### Minor Changes

- ${lastCommit}: Hey, let's have fun with testing!
`);
  });

  describe("files", () => {
    it("shouldn't commit updated files from packages", async () => {
      const releasePlan = new FakeReleasePlan();

      let { tempDir } = await testSetup(
        {
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
        },
        releasePlan.getReleasePlan(),
        {
          ...releasePlan.config,
          commit: [
            path.resolve(__dirname, "test-utils/simple-get-commit-entry"),
            null,
          ],
        }
      );

      let gitCmd = await spawn("git", ["status"], { cwd: tempDir });

      expect(gitCmd.stdout.toString()).toContain(
        "Changes not staged for commit"
      );

      expect(gitCmd.stdout.toString()).toContain(
        "modified:   packages/pkg-a/package.json"
      );

      let lastCommit = await spawn("git", ["log", "-1"], { cwd: tempDir });

      expect(lastCommit.stdout.toString()).toContain("first commit");
    });

    it("should remove applied changesets", async () => {
      const releasePlan = new FakeReleasePlan();

      let changesetPath: string;

      const setupFunc = (tempDir: string) =>
        Promise.all(
          releasePlan.changesets.map(({ id, summary }) => {
            const thisPath = path.resolve(tempDir, ".changeset", `${id}.md`);
            changesetPath = thisPath;
            const content = `---\n---\n${summary}`;
            return fs.outputFile(thisPath, content);
          })
        );

      let { tempDir } = await testSetup(
        {
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
        },
        releasePlan.getReleasePlan(),
        {
          ...releasePlan.config,
          commit: [
            path.resolve(__dirname, "test-utils/simple-get-commit-entry"),
            null,
          ],
        },
        undefined,
        setupFunc
      );

      // @ts-ignore this is possibly bad
      let pathExists = await fs.pathExists(changesetPath);

      expect(pathExists).toEqual(false);

      let gitCmd = await spawn("git", ["status"], { cwd: tempDir });

      const changesetsDeleted = releasePlan.changesets.reduce(
        (prev, { id }) => {
          return (
            prev &&
            gitCmd.stdout.toString().includes(`deleted:    .changeset/${id}.md`)
          );
        },
        true
      );

      expect(releasePlan.changesets.length).toBeGreaterThan(0);
      expect(changesetsDeleted).toBe(true);
    });
  });
});
