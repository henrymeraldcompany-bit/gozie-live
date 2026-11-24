import { gzipSync } from "node:zlib";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const root = process.argv[2] || "apps/web/dist";
const output = process.argv[3] || "services/api/src/generated-assets.ts";
const files = {};

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile()) {
      const path = "/" + relative(root, full).split(sep).join("/");
      files[path] = await readFile(full, "utf8");
    }
  }
}

await walk(root);
if (!files["/index.html"]) throw new Error("Built app index.html was not found.");
const packed = gzipSync(Buffer.from(JSON.stringify(files), "utf8"), { level: 9 }).toString("base64");
await writeFile(output, "export const STATIC_ASSETS_GZIP_B64 = " + JSON.stringify(packed) + ";\n", "utf8");
process.stdout.write(JSON.stringify({ files: Object.keys(files).length, compressedBytes: Buffer.from(packed, "base64").length, output }) + "\n");
