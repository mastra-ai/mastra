export async function readFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";

    process.stdin.setEncoding("utf8");

    process.stdin.on("readable", () => {
      let chunk;
      while (null !== (chunk = process.stdin.read())) {
        data += chunk;
      }
    });

    process.stdin.on("end", () => {
      // Remove trailing newline if present
      resolve(data.replace(/\n$/, ""));
    });

    process.stdin.on("error", (err) => {
      reject(err);
    });
  });
}
