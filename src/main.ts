// 登録簿の検査の入口: `node src/main.ts <フォルダ>`。
// フォルダの `.json` を読み、check.ts で判断し、問題を 1 行ずつ出す。問題があれば終了コード 1。

import { join } from "node:path";
import { checkEntries } from "./check.ts";
import { loadSchema, readEntries } from "./io.ts";

const dir = process.argv[2] ?? "plugins";
const files = readEntries(dir);
const problems = checkEntries(files, loadSchema());
for (const p of problems) console.error(`${join(dir, p.file)}: ${p.message}`);
console.log(`${files.length} entries checked, ${problems.length} problems`);
process.exitCode = problems.length > 0 ? 1 : 0;
