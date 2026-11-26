// PR の検査の入口: `node src/pr-main.ts <main のフォルダ> <PR の後のフォルダ>`。
// PR を出した人とラベルは環境変数 PR_AUTHOR と PR_LABELS（JSON の文字列の配列）で受け取る。
// このファイルは main から動かし、PR の側のファイルはデータとして読むだけにする（PR の中のコードは動かさない）。

import { join } from "node:path";
import type { RegistryEntry } from "modelith-plugin-sdk";
import { checkChanges } from "./changes.ts";
import { checkEntries, type EntryFile } from "./check.ts";
import { loadSchema, readEntries } from "./io.ts";

/**
 * 読んだファイルを、ファイル名 → エントリの表にする（JSON として読めないものは飛ばす。それは checkEntries が知らせる）。
 *
 * 例: `toMap([{ name: "com.example.a.json", text: '{"id":"com.example.a",...}' }])` → `Map { "com.example.a.json" => {...} }`
 */
export function toMap(files: readonly EntryFile[]): Map<string, RegistryEntry> {
  const map = new Map<string, RegistryEntry>();
  for (const f of files) {
    try {
      map.set(f.name, JSON.parse(f.text) as RegistryEntry);
    } catch {
      // 形の誤りは checkEntries が知らせる
    }
  }
  return map;
}

const [beforeDir = "plugins", afterDir = "pr/plugins"] = process.argv.slice(2);
const author = process.env.PR_AUTHOR ?? "";
const labels = JSON.parse(process.env.PR_LABELS ?? "[]") as string[];
const after = readEntries(afterDir);
const problems = checkEntries(after, loadSchema());
const changes = problems.length > 0 ? [] : checkChanges(toMap(readEntries(beforeDir)), toMap(after), { author, labels });
for (const p of [...problems, ...changes]) console.error(`${join("plugins", p.file)}: ${p.message}`);
console.log(`${after.length} entries checked against main, ${problems.length + changes.length} problems`);
process.exitCode = problems.length + changes.length > 0 ? 1 : 0;
