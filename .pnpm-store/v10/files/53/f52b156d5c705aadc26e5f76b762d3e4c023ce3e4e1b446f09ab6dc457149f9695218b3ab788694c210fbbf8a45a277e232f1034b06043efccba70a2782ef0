import { statSync, readFileSync } from "fs";
export function parseArgs(params, args, help) {
    const result = {};
    if (help) {
        let index = args.indexOf("--help");
        if (index === -1) {
            index = args.indexOf("-h");
        }
        if (index !== -1) {
            printParams({
                ...params,
                help: {
                    shorthand: "h",
                    description: typeof help === "string" ? help : "Display this message :)",
                },
            });
            process.exit(0);
        }
    }
    for (const name in params) {
        const { shorthand, required, value } = params[name];
        let index = args.indexOf("--" + name);
        if (index === -1 && shorthand) {
            index = args.indexOf("-" + shorthand);
        }
        if (index === -1) {
            if (required || required === "") {
                throw new Error(typeof required === "string" && required !== ""
                    ? required
                    : `Missing required argument ${name}`);
            }
            result[name] = false;
            continue;
        }
        if (value) {
            const val = args[index + 1];
            if (val === undefined) {
                throw new Error(`Expected a value for argument ${name}`);
            }
            if (value === "number") {
                const asNumber = Number(val);
                if (isNaN(asNumber)) {
                    throw new Error(`Value of argument ${name} must be a valid number`);
                }
                result[name] = asNumber;
                continue;
            }
            if (Array.isArray(value) && !value.includes(val)) {
                throw new Error(`Value of argument ${name} must be one of ${value}`);
            }
            result[name] = val;
        }
        else {
            result[name] = true;
        }
    }
    return result;
}
export function parseOrReadJSON(jsonOrPath) {
    jsonOrPath = jsonOrPath.trim();
    if (jsonOrPath.length < 255 &&
        statSync(jsonOrPath, { throwIfNoEntry: false })?.isFile()) {
        jsonOrPath = readFileSync(jsonOrPath, "utf-8");
    }
    return JSON.parse(jsonOrPath);
}
export function readPipe() {
    return new Promise((resolve, reject) => {
        let buf = "";
        process.stdin
            .setEncoding("utf-8")
            .on("end", () => resolve(buf))
            .on("error", reject)
            .on("readable", () => {
            let chunk;
            while ((chunk = process.stdin.read()) != null) {
                buf += chunk;
            }
        });
    });
}
export function printParams(params) {
    const longest = Object.keys(params).reduce((l, c) => (c.length > l ? c.length : l), 5);
    const header = "Name " + " ".repeat(longest - 2) + "Short Description";
    console.log(header);
    for (const name in params) {
        let { shorthand, description } = params[name];
        if (shorthand) {
            shorthand = " -" + shorthand;
        }
        else {
            shorthand = "   ";
        }
        if (description) {
            description = "    " + description;
        }
        else {
            description = "";
        }
        console.log("--" + name + " ".repeat(longest - name.length) + shorthand + description);
    }
}
