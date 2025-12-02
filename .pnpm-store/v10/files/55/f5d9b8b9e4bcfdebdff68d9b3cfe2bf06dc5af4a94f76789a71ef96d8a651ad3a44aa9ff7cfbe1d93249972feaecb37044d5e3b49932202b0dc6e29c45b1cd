import path from "path";
import pc from "picocolors";
import { NewChangeset } from "@changesets/types";
import * as fs from "fs-extra";
import pFilter from "p-filter";
import { warn } from "@changesets/logger";

// THIS SHOULD BE REMOVED WHEN SUPPORT FOR CHANGESETS FROM V1 IS DROPPED

let importantSeparator = pc.red(
  "===============================IMPORTANT!==============================="
);

let importantEnd = pc.red(
  "----------------------------------------------------------------------"
);

async function getOldChangesets(
  changesetBase: string,
  dirs: string[]
): Promise<Array<NewChangeset>> {
  // this needs to support just not dealing with dirs that aren't set up properly
  let changesets = await pFilter(dirs, async (dir) =>
    (await fs.lstat(path.join(changesetBase, dir))).isDirectory()
  );

  const changesetContents = changesets.map(async (changesetDir) => {
    const jsonPath = path.join(changesetBase, changesetDir, "changes.json");

    const [summary, json] = await Promise.all([
      fs.readFile(
        path.join(changesetBase, changesetDir, "changes.md"),
        "utf-8"
      ),
      fs.readJson(jsonPath),
    ]);

    return { releases: json.releases, summary, id: changesetDir };
  });
  return Promise.all(changesetContents);
}

// this function only exists while we wait for v1 changesets to be obsoleted
// and should be deleted before v3
export default async function getOldChangesetsAndWarn(
  changesetBase: string,
  dirs: string[]
): Promise<Array<NewChangeset>> {
  let oldChangesets = await getOldChangesets(changesetBase, dirs);
  if (oldChangesets.length === 0) {
    return [];
  }
  warn(importantSeparator);
  warn("There were old changesets from version 1 found");
  warn("These are being applied now but the dependents graph may have changed");
  warn("Make sure you validate all your dependencies");
  warn(
    "In a future major version, we will no longer apply these old changesets, and will instead throw here"
  );
  warn(importantEnd);

  return oldChangesets;
}
