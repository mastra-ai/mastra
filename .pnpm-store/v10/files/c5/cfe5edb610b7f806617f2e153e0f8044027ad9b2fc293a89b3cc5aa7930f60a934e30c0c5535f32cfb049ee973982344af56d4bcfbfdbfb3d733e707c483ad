#!/usr/bin/env node

const fs = require("fs").promises;
const path = require("path");

const extensionMap = {
    ".js": ".mjs",
    ".d.ts": ".d.mts",
};
const oldExtensions = Object.keys(extensionMap);

async function findFiles(rootPath) {
    const files = [];

    async function scan(directory) {
        const entries = await fs.readdir(directory, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                if (entry.name !== "node_modules" && !entry.name.startsWith(".")) {
                    await scan(fullPath);
                }
            } else if (entry.isFile()) {
                if (oldExtensions.some((ext) => entry.name.endsWith(ext))) {
                    files.push(fullPath);
                }
            }
        }
    }

    await scan(rootPath);
    return files;
}

async function updateFiles(files) {
    const updatedFiles = [];
    for (const file of files) {
        const updated = await updateFileContents(file);
        updatedFiles.push(updated);
    }

    console.log(`Updated imports in ${updatedFiles.length} files.`);
}

async function updateFileContents(file) {
    const content = await fs.readFile(file, "utf8");

    let newContent = content;
    // Update each extension type defined in the map
    for (const [oldExt, newExt] of Object.entries(extensionMap)) {
        const regex = new RegExp(`(import|export)(.+from\\s+['"])(\\.\\.?\\/[^'"]+)(\\${oldExt})(['"])`, "g");
        newContent = newContent.replace(regex, `$1$2$3${newExt}$5`);
    }

    if (content !== newContent) {
        await fs.writeFile(file, newContent, "utf8");
        return true;
    }
    return false;
}

async function renameFiles(files) {
    let counter = 0;
    for (const file of files) {
        const ext = oldExtensions.find((ext) => file.endsWith(ext));
        const newExt = extensionMap[ext];

        if (newExt) {
            const newPath = file.slice(0, -ext.length) + newExt;
            await fs.rename(file, newPath);
            counter++;
        }
    }

    console.log(`Renamed ${counter} files.`);
}

async function main() {
    try {
        const targetDir = process.argv[2];
        if (!targetDir) {
            console.error("Please provide a target directory");
            process.exit(1);
        }

        const targetPath = path.resolve(targetDir);
        const targetStats = await fs.stat(targetPath);

        if (!targetStats.isDirectory()) {
            console.error("The provided path is not a directory");
            process.exit(1);
        }

        console.log(`Scanning directory: ${targetDir}`);

        const files = await findFiles(targetDir);

        if (files.length === 0) {
            console.log("No matching files found.");
            process.exit(0);
        }

        console.log(`Found ${files.length} files.`);
        await updateFiles(files);
        await renameFiles(files);
        console.log("\nDone!");
    } catch (error) {
        console.error("An error occurred:", error.message);
        process.exit(1);
    }
}

main();
