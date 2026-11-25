// 索引のフォルダと plugin-sdk のスキーマを読む（入出力だけ）。

import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { EntryFile } from "./check.ts";

/**
 * フォルダの `.json` のファイルを名前の順に読む。
 *
 * - 引数 `dir`: 索引のフォルダ（例: `plugins`）。
 * - 戻り値: ファイル名と中身の一覧。
 *
 * 例: `readEntries("plugins")` → `[{ name: "com.example.a.json", text: "{...}" }]`
 */
export function readEntries(dir: string): EntryFile[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({ name, text: readFileSync(join(dir, name), "utf8") }));
}

/**
 * plugin-sdk の索引のスキーマを読む。
 *
 * - 戻り値: `registry-entry.schema.json` の中身。
 *
 * 例: `loadSchema().title` → `"Modelith plugin registry entry"`
 */
export function loadSchema(): object {
  const require = createRequire(import.meta.url);
  const path = require.resolve("modelith-plugin-sdk/schema/registry-entry.schema.json");
  return JSON.parse(readFileSync(path, "utf8")) as object;
}
