import fixturez from "fixturez";
import { getPackages, getPackagesSync } from "./";

const f = fixturez(__dirname);

type GetPackages = typeof getPackages | typeof getPackagesSync;

let runTests = (getPackages: GetPackages) => {
  it("should resolve workspaces for yarn", async () => {
    const allPackages = await getPackages(f.copy("yarn-workspace-base"));

    if (allPackages.packages === null) {
      return expect(allPackages.packages).not.toBeNull();
    }

    expect(allPackages.packages[0].packageJson.name).toEqual(
      "yarn-workspace-base-pkg-a"
    );
    expect(allPackages.packages[1].packageJson.name).toEqual(
      "yarn-workspace-base-pkg-b"
    );
    expect(allPackages.tool).toEqual("yarn");
  });

  it("should resolve yarn workspaces if the yarn option is passed and packages field is used", async () => {
    const allPackages = await getPackages(f.copy("yarn-workspace-base"));

    if (allPackages.packages === null) {
      return expect(allPackages.packages).not.toBeNull();
    }
    expect(allPackages.packages[0].packageJson.name).toEqual(
      "yarn-workspace-base-pkg-a"
    );
    expect(allPackages.packages[1].packageJson.name).toEqual(
      "yarn-workspace-base-pkg-b"
    );
    expect(allPackages.tool).toEqual("yarn");
  });

  it("should resolve workspaces for bolt", async () => {
    const allPackages = await getPackages(f.copy("bolt-workspace"));

    if (allPackages.packages === null) {
      return expect(allPackages.packages).not.toBeNull();
    }

    expect(allPackages.packages[0].packageJson.name).toEqual(
      "bolt-workspace-pkg-a"
    );
    expect(allPackages.packages[1].packageJson.name).toEqual(
      "bolt-workspace-pkg-b"
    );
    expect(allPackages.tool).toEqual("bolt");
  });

  it("should resolve workspaces for pnpm", async () => {
    const allPackages = await getPackages(f.copy("pnpm-workspace-base"));

    if (allPackages.packages === null) {
      return expect(allPackages.packages).not.toBeNull();
    }

    expect(allPackages.packages[0].packageJson.name).toEqual(
      "pnpm-workspace-base-pkg-a"
    );
    expect(allPackages.packages[1].packageJson.name).toEqual(
      "pnpm-workspace-base-pkg-b"
    );
    expect(allPackages.tool).toEqual("pnpm");
  });

  it("should resolve workspace for pnpm with exclude rules", async () => {
    const allPackages = await getPackages(f.copy("pnpm-exclude-workspace-case"));

    expect(allPackages.packages[0].packageJson.name).toEqual(
      "pnpm-exclude-workspace-case-pkg-a"
    );
    expect(allPackages.packages[1].packageJson.name).toEqual(
      "pnpm-exclude-workspace-case-pkg-b"
    );
    expect(allPackages.packages.length).toEqual(2);
    expect(allPackages.tool).toEqual("pnpm");
  })

  it("should resolve workspaces for lerna", async () => {
    const allPackages = await getPackages(f.copy("lerna-workspace-base"));

    if (allPackages.packages === null) {
      return expect(allPackages.packages).not.toBeNull();
    }

    expect(allPackages.packages[0].packageJson.name).toEqual(
      "lerna-workspace-base-pkg-a"
    );
    expect(allPackages.packages[1].packageJson.name).toEqual(
      "lerna-workspace-base-pkg-b"
    );
    expect(allPackages.packages).toHaveLength(2);
    expect(allPackages.tool).toEqual("lerna");
  });

  it("should resolve workspaces for lerna without explicit packages config", async () => {
    const allPackages = await getPackages(f.copy("basic-lerna"));

    if (allPackages.packages === null) {
      return expect(allPackages.packages).not.toBeNull();
    }

    expect(allPackages.packages[0].packageJson.name).toEqual(
      "@manypkg/basic-lerna-fixture-pkg-one"
    );
    expect(allPackages.packages).toHaveLength(1);
    expect(allPackages.tool).toEqual("lerna");
  });

  it("should resolve the main package", async () => {
    const path = f.copy("root-only");
    const allPackages = await getPackages(path);

    if (allPackages.packages === null) {
      return expect(allPackages.packages).not.toBeNull();
    }

    expect(allPackages.packages[0].dir).toEqual(path);
    expect(allPackages.packages.length).toEqual(1);
    expect(allPackages.tool).toEqual("root");
  });

  it("should throw an error if a package.json is missing the name field", async () => {
    try {
      const allPackages = await getPackagesSync(f.copy("no-name-field"));
    } catch (err) {
      expect(err.message).toBe(
        'The following package.jsons are missing the "name" field:\npackages/pkg-a/package.json\npackages/pkg-b/package.json'
      );
    }
  });

  it("should not crash on cyclic deps", async () => {
    const allPackages = await getPackages(f.copy("local-deps-cycle"));

    if (allPackages.packages === null) {
      return expect(allPackages.packages).not.toBeNull();
    }

    expect(allPackages.packages[0].packageJson.name).toEqual(
      "@manypkg/cyclic-dep"
    );
    expect(allPackages.tool).toEqual("yarn");
  });
};

describe("getPackages", () => {
  runTests(getPackages);
});

describe("getPackagesSync", () => {
  runTests(getPackagesSync);
});
