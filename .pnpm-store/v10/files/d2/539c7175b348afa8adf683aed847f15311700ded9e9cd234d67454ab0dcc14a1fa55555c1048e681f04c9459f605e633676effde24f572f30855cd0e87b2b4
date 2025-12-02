"use strict";
export async function readFromStdin() {
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
      resolve(data.replace(/\n$/, ""));
    });
    process.stdin.on("error", (err) => {
      reject(err);
    });
  });
}
//# sourceMappingURL=stdin.js.map
