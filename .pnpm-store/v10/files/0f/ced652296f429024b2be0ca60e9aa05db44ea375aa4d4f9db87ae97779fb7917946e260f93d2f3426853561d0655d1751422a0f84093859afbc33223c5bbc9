import { vi, test, expect } from "vitest";
import { oneoffContext } from "../../../bundler/context.js";
import { logFailure } from "../../../bundler/log.js";
import { findLatestVersionWithBinary } from "./download.js";
import { components } from "@octokit/openapi-types";
import { stripVTControlCharacters } from "util";

async function setupContext() {
  const originalContext = await oneoffContext({
    url: undefined,
    adminKey: undefined,
    envFile: undefined,
  });
  const ctx = {
    ...originalContext,
    crash: (args: { printedMessage: string | null }) => {
      if (args.printedMessage !== null) {
        logFailure(args.printedMessage);
      }
      throw new Error();
    },
  };
  return ctx;
}
test("findLatestVersionWithBinary", async () => {
  // Make a context that throws on crashes so we can detect them.
  const ctx = await setupContext();
  const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => {
    // Do nothing
    return true;
  });

  const getVersion = async (inp: GitHubRelease[]) => {
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(inp),
      } as Response),
    );

    const expected = await findLatestVersionWithBinary(ctx, true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.github.com/repos/get-convex/convex-backend/releases?per_page=30",
    );
    fetchSpy.mockRestore();
    return expected;
  };

  const failToGetVersion = async (inp: GitHubRelease[]) => {
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(inp),
      } as Response),
    );
    stderrSpy.mockClear();

    await expect(findLatestVersionWithBinary(ctx, true)).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.github.com/repos/get-convex/convex-backend/releases?per_page=30",
    );
    const calledWith = stderrSpy.mock.calls as string[][];
    const err = stripVTControlCharacters(calledWith[0][0]);
    fetchSpy.mockRestore();
    stderrSpy.mockClear();
    return err;
  };

  // Default: take the older version, it's not a prerelease.
  expect(await getVersion(githubReleases())).toBe(
    "precompiled-2025-01-31-e52353b",
  );

  // Take the newer one when they both aren't prereleases
  {
    const [latest, older] = githubReleases();
    latest.prerelease = false;
    expect(await getVersion([latest, older])).toBe(
      "precompiled-2025-02-03-2da5268",
    );
  }

  // Take the older one since it has the artifacts
  {
    const [latest, older] = githubReleases();
    latest.prerelease = false;
    latest.assets = [];
    expect(await getVersion([latest, older])).toBe(
      "precompiled-2025-01-31-e52353b",
    );
  }

  // Fail, everything is a prerelease
  {
    const [latest, older] = githubReleases();
    older.prerelease = true;
    expect(await failToGetVersion([latest, older])).toBe(
      "✖ Failed to get latest convex backend releases\n",
    );
  }

  // Fail, nothing has artifacts
  {
    const [latest, older] = githubReleases();
    older.prerelease = true;
    latest.assets = [];
    older.assets = [];
    expect(await failToGetVersion([latest, older])).toBe(
      "✖ Failed to get latest convex backend releases\n",
    );
  }
});

// experimentally, we get more fields than there are types for here
type GitHubRelease = components["schemas"]["release"] & {
  author: components["schemas"]["release"]["author"] & {
    user_view_type: "public";
  };
};

function githubReleases() {
  const data: GitHubRelease[] = [
    {
      url: "https://api.github.com/repos/get-convex/convex-backend/releases/198003843",
      assets_url:
        "https://api.github.com/repos/get-convex/convex-backend/releases/198003843/assets",
      upload_url:
        "https://uploads.github.com/repos/get-convex/convex-backend/releases/198003843/assets{?name,label}",
      html_url:
        "https://github.com/get-convex/convex-backend/releases/tag/precompiled-2025-02-03-2da5268",
      id: 198003843,
      author: {
        login: "github-actions[bot]",
        id: 41898282,
        node_id: "MDM6Qm90NDE4OTgyODI=",
        avatar_url: "https://avatars.githubusercontent.com/in/15368?v=4",
        gravatar_id: "",
        url: "https://api.github.com/users/github-actions%5Bbot%5D",
        html_url: "https://github.com/apps/github-actions",
        followers_url:
          "https://api.github.com/users/github-actions%5Bbot%5D/followers",
        following_url:
          "https://api.github.com/users/github-actions%5Bbot%5D/following{/other_user}",
        gists_url:
          "https://api.github.com/users/github-actions%5Bbot%5D/gists{/gist_id}",
        starred_url:
          "https://api.github.com/users/github-actions%5Bbot%5D/starred{/owner}{/repo}",
        subscriptions_url:
          "https://api.github.com/users/github-actions%5Bbot%5D/subscriptions",
        organizations_url:
          "https://api.github.com/users/github-actions%5Bbot%5D/orgs",
        repos_url: "https://api.github.com/users/github-actions%5Bbot%5D/repos",
        events_url:
          "https://api.github.com/users/github-actions%5Bbot%5D/events{/privacy}",
        received_events_url:
          "https://api.github.com/users/github-actions%5Bbot%5D/received_events",
        type: "Bot",
        user_view_type: "public",
        site_admin: false,
      },
      node_id: "RE_kwDOLdZc7c4LzUyD",
      tag_name: "precompiled-2025-02-03-2da5268",
      target_commitish: "main",
      name: "Precompiled 2025-02-03-2da5268",
      draft: false,
      prerelease: true,
      created_at: "2025-02-01T00:27:43Z",
      published_at: "2025-02-03T00:54:40Z",
      assets: [
        {
          url: "https://api.github.com/repos/get-convex/convex-backend/releases/assets/225737903",
          id: 225737903,
          node_id: "RA_kwDOLdZc7c4NdHyv",
          name: "convex-local-backend-aarch64-apple-darwin.zip",
          label: "",
          uploader: null as any,
          content_type: "application/zip",
          state: "uploaded",
          size: 34505055,
          download_count: 4,
          created_at: "2025-02-03T00:54:41Z",
          updated_at: "2025-02-03T00:54:42Z",
          browser_download_url:
            "https://github.com/get-convex/convex-backend/releases/download/precompiled-2025-02-03-2da5268/convex-local-backend-aarch64-apple-darwin.zip",
        },
        {
          url: "https://api.github.com/repos/get-convex/convex-backend/releases/assets/225738218",
          id: 225738218,
          node_id: "RA_kwDOLdZc7c4NdH3q",
          name: "convex-local-backend-aarch64-unknown-linux-gnu.zip",
          label: "",
          uploader: null as any,
          content_type: "application/zip",
          state: "uploaded",
          size: 45542485,
          download_count: 0,
          created_at: "2025-02-03T00:55:52Z",
          updated_at: "2025-02-03T00:55:54Z",
          browser_download_url:
            "https://github.com/get-convex/convex-backend/releases/download/precompiled-2025-02-03-2da5268/convex-local-backend-aarch64-unknown-linux-gnu.zip",
        },
        {
          url: "https://api.github.com/repos/get-convex/convex-backend/releases/assets/225738688",
          id: 225738688,
          node_id: "RA_kwDOLdZc7c4NdH_A",
          name: "convex-local-backend-x86_64-apple-darwin.zip",
          label: "",
          uploader: null as any,
          content_type: "application/zip",
          state: "uploaded",
          size: 37369137,
          download_count: 1,
          created_at: "2025-02-03T00:57:40Z",
          updated_at: "2025-02-03T00:57:42Z",
          browser_download_url:
            "https://github.com/get-convex/convex-backend/releases/download/precompiled-2025-02-03-2da5268/convex-local-backend-x86_64-apple-darwin.zip",
        },
        {
          url: "https://api.github.com/repos/get-convex/convex-backend/releases/assets/225746665",
          id: 225746665,
          node_id: "RA_kwDOLdZc7c4NdJ7p",
          name: "convex-local-backend-x86_64-pc-windows-msvc.zip",
          label: "",
          uploader: null as any,
          content_type: "application/zip",
          state: "uploaded",
          size: 34199085,
          download_count: 2,
          created_at: "2025-02-03T01:22:57Z",
          updated_at: "2025-02-03T01:22:58Z",
          browser_download_url:
            "https://github.com/get-convex/convex-backend/releases/download/precompiled-2025-02-03-2da5268/convex-local-backend-x86_64-pc-windows-msvc.zip",
        },
        {
          url: "https://api.github.com/repos/get-convex/convex-backend/releases/assets/225745550",
          id: 225745550,
          node_id: "RA_kwDOLdZc7c4NdJqO",
          name: "convex-local-backend-x86_64-unknown-linux-gnu.zip",
          label: "",
          uploader: [Object],
          content_type: "application/zip",
          state: "uploaded",
          size: 45196613,
          download_count: 3,
          created_at: "2025-02-03T01:19:39Z",
          updated_at: "2025-02-03T01:19:42Z",
          browser_download_url:
            "https://github.com/get-convex/convex-backend/releases/download/precompiled-2025-02-03-2da5268/convex-local-backend-x86_64-unknown-linux-gnu.zip",
        },
        {
          url: "https://api.github.com/repos/get-convex/convex-backend/releases/assets/225746666",
          id: 225746666,
          node_id: "RA_kwDOLdZc7c4NdJ7q",
          name: "LICENSE.md",
          label: "",
          uploader: null as any,
          content_type: "text/markdown",
          state: "uploaded",
          size: 3861,
          download_count: 0,
          created_at: "2025-02-03T01:22:57Z",
          updated_at: "2025-02-03T01:22:57Z",
          browser_download_url:
            "https://github.com/get-convex/convex-backend/releases/download/precompiled-2025-02-03-2da5268/LICENSE.md",
        },
      ],
      tarball_url:
        "https://api.github.com/repos/get-convex/convex-backend/tarball/precompiled-2025-02-03-2da5268",
      zipball_url:
        "https://api.github.com/repos/get-convex/convex-backend/zipball/precompiled-2025-02-03-2da5268",
      body: "",
    },
    {
      url: "https://api.github.com/repos/get-convex/convex-backend/releases/197690907",
      assets_url:
        "https://api.github.com/repos/get-convex/convex-backend/releases/197690907/assets",
      upload_url:
        "https://uploads.github.com/repos/get-convex/convex-backend/releases/197690907/assets{?name,label}",
      html_url:
        "https://github.com/get-convex/convex-backend/releases/tag/precompiled-2025-01-31-e52353b",
      id: 197690907,
      author: {
        login: "github-actions[bot]",
        id: 41898282,
        node_id: "MDM6Qm90NDE4OTgyODI=",
        avatar_url: "https://avatars.githubusercontent.com/in/15368?v=4",
        gravatar_id: "",
        url: "https://api.github.com/users/github-actions%5Bbot%5D",
        html_url: "https://github.com/apps/github-actions",
        followers_url:
          "https://api.github.com/users/github-actions%5Bbot%5D/followers",
        following_url:
          "https://api.github.com/users/github-actions%5Bbot%5D/following{/other_user}",
        gists_url:
          "https://api.github.com/users/github-actions%5Bbot%5D/gists{/gist_id}",
        starred_url:
          "https://api.github.com/users/github-actions%5Bbot%5D/starred{/owner}{/repo}",
        subscriptions_url:
          "https://api.github.com/users/github-actions%5Bbot%5D/subscriptions",
        organizations_url:
          "https://api.github.com/users/github-actions%5Bbot%5D/orgs",
        repos_url: "https://api.github.com/users/github-actions%5Bbot%5D/repos",
        events_url:
          "https://api.github.com/users/github-actions%5Bbot%5D/events{/privacy}",
        received_events_url:
          "https://api.github.com/users/github-actions%5Bbot%5D/received_events",
        type: "Bot",
        user_view_type: "public",
        site_admin: false,
      },
      node_id: "RE_kwDOLdZc7c4LyIYb",
      tag_name: "precompiled-2025-01-31-e52353b",
      target_commitish: "main",
      name: "Precompiled 2025-01-31-e52353b",
      draft: false,
      prerelease: false,
      created_at: "2025-01-31T00:41:09Z",
      published_at: "2025-01-31T00:48:53Z",
      assets: [
        {
          url: "https://api.github.com/repos/get-convex/convex-backend/releases/assets/225737903",
          id: 225737903,
          node_id: "RA_kwDOLdZc7c4NdHyv",
          name: "convex-local-backend-aarch64-apple-darwin.zip",
          label: "",
          uploader: null as any,
          content_type: "application/zip",
          state: "uploaded",
          size: 34505055,
          download_count: 4,
          created_at: "2025-02-03T00:54:41Z",
          updated_at: "2025-02-03T00:54:42Z",
          browser_download_url:
            "https://github.com/get-convex/convex-backend/releases/download/precompiled-2025-02-03-2da5268/convex-local-backend-aarch64-apple-darwin.zip",
        },
        {
          url: "https://api.github.com/repos/get-convex/convex-backend/releases/assets/225738218",
          id: 225738218,
          node_id: "RA_kwDOLdZc7c4NdH3q",
          name: "convex-local-backend-aarch64-unknown-linux-gnu.zip",
          label: "",
          uploader: null as any,
          content_type: "application/zip",
          state: "uploaded",
          size: 45542485,
          download_count: 0,
          created_at: "2025-02-03T00:55:52Z",
          updated_at: "2025-02-03T00:55:54Z",
          browser_download_url:
            "https://github.com/get-convex/convex-backend/releases/download/precompiled-2025-02-03-2da5268/convex-local-backend-aarch64-unknown-linux-gnu.zip",
        },
        {
          url: "https://api.github.com/repos/get-convex/convex-backend/releases/assets/225738688",
          id: 225738688,
          node_id: "RA_kwDOLdZc7c4NdH_A",
          name: "convex-local-backend-x86_64-apple-darwin.zip",
          label: "",
          uploader: null as any,
          content_type: "application/zip",
          state: "uploaded",
          size: 37369137,
          download_count: 1,
          created_at: "2025-02-03T00:57:40Z",
          updated_at: "2025-02-03T00:57:42Z",
          browser_download_url:
            "https://github.com/get-convex/convex-backend/releases/download/precompiled-2025-02-03-2da5268/convex-local-backend-x86_64-apple-darwin.zip",
        },
        {
          url: "https://api.github.com/repos/get-convex/convex-backend/releases/assets/225746665",
          id: 225746665,
          node_id: "RA_kwDOLdZc7c4NdJ7p",
          name: "convex-local-backend-x86_64-pc-windows-msvc.zip",
          label: "",
          uploader: null as any,
          content_type: "application/zip",
          state: "uploaded",
          size: 34199085,
          download_count: 2,
          created_at: "2025-02-03T01:22:57Z",
          updated_at: "2025-02-03T01:22:58Z",
          browser_download_url:
            "https://github.com/get-convex/convex-backend/releases/download/precompiled-2025-02-03-2da5268/convex-local-backend-x86_64-pc-windows-msvc.zip",
        },
        {
          url: "https://api.github.com/repos/get-convex/convex-backend/releases/assets/225745550",
          id: 225745550,
          node_id: "RA_kwDOLdZc7c4NdJqO",
          name: "convex-local-backend-x86_64-unknown-linux-gnu.zip",
          label: "",
          uploader: [Object],
          content_type: "application/zip",
          state: "uploaded",
          size: 45196613,
          download_count: 3,
          created_at: "2025-02-03T01:19:39Z",
          updated_at: "2025-02-03T01:19:42Z",
          browser_download_url:
            "https://github.com/get-convex/convex-backend/releases/download/precompiled-2025-02-03-2da5268/convex-local-backend-x86_64-unknown-linux-gnu.zip",
        },
        {
          url: "https://api.github.com/repos/get-convex/convex-backend/releases/assets/225746666",
          id: 225746666,
          node_id: "RA_kwDOLdZc7c4NdJ7q",
          name: "LICENSE.md",
          label: "",
          uploader: null as any,
          content_type: "text/markdown",
          state: "uploaded",
          size: 3861,
          download_count: 0,
          created_at: "2025-02-03T01:22:57Z",
          updated_at: "2025-02-03T01:22:57Z",
          browser_download_url:
            "https://github.com/get-convex/convex-backend/releases/download/precompiled-2025-02-03-2da5268/LICENSE.md",
        },
      ],
      tarball_url:
        "https://api.github.com/repos/get-convex/convex-backend/tarball/precompiled-2025-01-31-e52353b",
      zipball_url:
        "https://api.github.com/repos/get-convex/convex-backend/zipball/precompiled-2025-01-31-e52353b",
      body: "",
    },
  ];

  return data;
}
