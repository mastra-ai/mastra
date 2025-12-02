import { Command, Option } from "@commander-js/extra-typings";
import path from "path";
import { oneoffContext } from "../bundler/context.js";

const cwd = path.basename(process.cwd());

// Initialize a new Convex project.
// This command is deprecated and hidden from the command help.
// `npx convex dev --once --configure=new` replaces it.
export const init = new Command("init")
  .description("Initialize a new Convex project in the current directory")
  .allowExcessArguments(false)
  .addOption(
    new Option(
      "--project <name>",
      `Name of the project to create. Defaults to \`${cwd}\` (the current directory)`,
    ),
  )
  .addOption(
    new Option(
      "--team <slug>",
      "Slug identifier for the team this project will belong to.",
    ),
  )
  .action(async (_options) => {
    return (
      await oneoffContext({
        url: undefined,
        adminKey: undefined,
        envFile: undefined,
      })
    ).crash({
      exitCode: 1,
      errorType: "fatal",
      errForSentry:
        "The `init` command is deprecated. Use `npx convex dev --once --configure=new` instead.",
      printedMessage:
        "The `init` command is deprecated. Use `npx convex dev --once --configure=new` instead.",
    });
  });
