// 公開する索引を作る入口: `node src/build-main.ts <フォルダ> <出力先のフォルダ>`。
// 先に検査を通し、問題があれば何も書かずに終了コード 1。通れば `<出力先>/index.json` を書く。

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RegistryEntry } from "modelith-plugin-sdk";
import { buildIndex, serializeIndex } from "./build.ts";
import { checkEntries } from "./check.ts";
import { loadSchema, readEntries } from "./io.ts";

const dir = process.argv[2] ?? "plugins";
const out = process.argv[3] ?? "dist";
const files = readEntries(dir);
const problems = checkEntries(files, loadSchema());
if (problems.length > 0) {
  for (const p of problems) console.error(`${join(dir, p.file)}: ${p.message}`);
  process.exitCode = 1;
} else {
  const index = buildIndex(files.map((f) => JSON.parse(f.text) as RegistryEntry));
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "index.json"), serializeIndex(index));
  console.log(`${join(out, "index.json")}: ${index.plugins.length} plugins`);
}
