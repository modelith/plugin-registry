// 索引のエントリを 1 つの索引（`index.json`）にまとめる（判断だけ。読み書きは build-main.ts）。
// 形は plugin-sdk の RegistryIndex（modelith/plugin-sdk#53）。npm に出たら、この型をそちらに置き換える。

import type { RegistryEntry } from "modelith-plugin-sdk";

/** アプリが取りに行く索引。plugin-sdk の RegistryIndex と同じ形。 */
export interface RegistryIndex {
  /** 登録されたプラグイン。ID の順。 */
  plugins: RegistryEntry[];
}

/**
 * エントリを ID の順に並べて、索引にまとめる。
 *
 * - 引数 `entries`: 検査に通ったエントリ（順は問わない）。
 * - 戻り値: ID の順に並んだ索引。入力の配列は変えない。
 *
 * 例: `buildIndex([{ id: "com.b", ... }, { id: "com.a", ... }])` → `{ plugins: [{ id: "com.a", ... }, { id: "com.b", ... }] }`
 */
export function buildIndex(entries: readonly RegistryEntry[]): RegistryIndex {
  const plugins = [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { plugins };
}

/**
 * 索引を、公開するファイルの中身（整形した JSON、末尾に改行）にする。
 *
 * 例: `serializeIndex({ plugins: [] })` → `'{\n  "plugins": []\n}\n'`
 */
export function serializeIndex(index: RegistryIndex): string {
  return `${JSON.stringify(index, null, 2)}\n`;
}
