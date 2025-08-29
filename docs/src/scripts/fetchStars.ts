import fs from "node:fs";
import path from "node:path";

const main = async () => {
  const res = await fetch("https://api.github.com/repos/mastra-ai/mastra", {
    cache: "no-cache",
  });
  const data = await res.json();

  fs.writeFileSync(
    path.join(__dirname, "..", "public", "githubStarCount.json"),
    JSON.stringify({
      githubStarCount: data.stargazers_count,
    }),
  );
};

main();
