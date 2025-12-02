import { temporarilySilenceLogs } from "@changesets/test-utils";
import getDependencyGraph from "./get-dependency-graph";

const consoleError = console.error;

beforeEach(() => {
  console.error = jest.fn();
});

afterEach(() => {
  console.error = consoleError;
});

describe("getting the dependency graph", function () {
  it("should skip dependencies specified through the link protocol", function () {
    const { graph, valid } = getDependencyGraph({
      root: {
        dir: ".",
        packageJson: { name: "root", version: "1.0.0" },
      },
      packages: [
        {
          dir: "foo",
          packageJson: {
            name: "foo",
            version: "1.0.0",
            devDependencies: {
              bar: "link:../bar",
            },
          },
        },
        {
          dir: "bar",
          packageJson: {
            name: "bar",
            version: "1.0.0",
          },
        },
      ],
      tool: "pnpm",
    });
    expect(graph.get("foo")!.dependencies).toStrictEqual([]);
    expect(valid).toBeTruthy();
    expect((console.error as any).mock.calls).toMatchInlineSnapshot(`[]`);
  });

  it("should skip dependencies specified using a tag", function () {
    const { graph, valid } = getDependencyGraph({
      root: {
        dir: ".",
        packageJson: { name: "root", version: "1.0.0" },
      },
      packages: [
        {
          dir: "examples/foo",
          packageJson: {
            name: "foo-example",
            version: "1.0.0",
            dependencies: {
              bar: "latest",
            },
          },
        },
        {
          dir: "packages/bar",
          packageJson: {
            name: "bar",
            version: "1.0.0",
          },
        },
      ],
      tool: "pnpm",
    });
    expect(graph.get("foo-example")!.dependencies).toStrictEqual([]);
    expect(valid).toBeTruthy();
    expect((console.error as any).mock.calls).toMatchInlineSnapshot(`[]`);
  });

  it(
    "should set valid to false if the link protocol is used in a non-dev dep",
    temporarilySilenceLogs(() => {
      const { valid } = getDependencyGraph({
        root: {
          dir: ".",
          packageJson: { name: "root", version: "1.0.0" },
        },
        packages: [
          {
            dir: "foo",
            packageJson: {
              name: "foo",
              version: "1.0.0",
              dependencies: {
                bar: "link:../bar",
              },
            },
          },
          {
            dir: "bar",
            packageJson: {
              name: "bar",
              version: "1.0.0",
            },
          },
        ],
        tool: "pnpm",
      });
      expect(valid).toBeFalsy();
      expect((console.error as any).mock.calls).toMatchInlineSnapshot(`
        [
          [
            "Package [36m"foo"[39m must depend on the current version of [36m"bar"[39m: [32m"1.0.0"[39m vs [31m"link:../bar"[39m",
          ],
        ]
      `);
    })
  );
});
