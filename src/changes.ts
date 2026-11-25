// 登録簿の書き換えの検査（判断だけ）。PR の前（main）と後のエントリを比べ、作者以外の書き換えと、公開済みの版の変更を見つける。
// 読み込みは呼ぶ側（pr-main.ts）が行い、PR の中のコードは動かさない。

import type { RegistryEntry, RegistryVersion } from "modelith-plugin-sdk";
import type { Problem } from "./check.ts";

/** 作者でない人の追加・変更を、メンテナが確かめて通すときに付けるラベル（付けられるのはリポジトリの共同作業者だけ）。 */
export const VERIFIED_LABEL = "publisher-verified";

/** 書き換えを出した PR の情報。 */
export interface PullRequest {
  /** PR を出した GitHub のユーザー名。 */
  author: string;
  /** PR に付いているラベル。 */
  labels: readonly string[];
}

/**
 * エントリの持ち主の決まりを確かめる（`repository` は `publisher.github` のリポジトリ、配布物はその GitHub Releases）。
 *
 * - 引数 `entry`: スキーマに通ったエントリ。
 * - 戻り値: 問題の説明の一覧。問題が無ければ空の配列。
 *
 * 例: publisher.github が `example-inc` で repository が `https://github.com/other/x` → `['repository must be a repository of "example-inc" ...']`
 */
export function checkOwnership(entry: RegistryEntry): string[] {
  const owner = entry.publisher.github.toLowerCase();
  const repo = parseRepository(entry.repository);
  if (repo === undefined || repo.owner !== owner) {
    return [`repository must be a repository of "${entry.publisher.github}" on GitHub (https://github.com/${entry.publisher.github}/<name>)`];
  }
  const prefix = `https://github.com/${repo.owner}/${repo.name}/releases/download/`;
  return entry.versions.flatMap((v, i) =>
    v.url.toLowerCase().startsWith(prefix) ? [] : [`versions[${i}].url must be a release file of ${entry.repository} (${prefix}...)`],
  );
}

/**
 * PR の前と後のエントリを比べ、許されない書き換えを並べる。
 *
 * - 引数 `before`: main のエントリ（ファイル名 → エントリ）。
 * - 引数 `after`: PR の後のエントリ（ファイル名 → エントリ）。スキーマなどの検査には通っていること。
 * - 引数 `pr`: PR を出した人とラベル。
 * - 戻り値: 問題の一覧。問題が無ければ空の配列。
 *
 * 例: 公開済みの 0.1.0 の sha256 を変える → `[{ file, message: 'versions "0.1.0" was published and cannot change' }]`
 */
export function checkChanges(
  before: ReadonlyMap<string, RegistryEntry>,
  after: ReadonlyMap<string, RegistryEntry>,
  pr: PullRequest,
): Problem[] {
  const verified = pr.labels.includes(VERIFIED_LABEL);
  const problems: Problem[] = [];
  for (const [file, old] of before) {
    const now = after.get(file);
    if (now === undefined) {
      if (!verified) problems.push({ file, message: `removing an entry needs a maintainer (label "${VERIFIED_LABEL}")` });
      continue;
    }
    if (sameEntry(old, now)) continue;
    problems.push(...changedEntry(old, now, pr.author, verified).map((message) => ({ file, message })));
  }
  for (const [file, entry] of after) {
    if (before.has(file)) continue;
    problems.push(...byPublisher(entry, pr.author, verified).map((message) => ({ file, message })));
  }
  return problems;
}

/** 既存のエントリの変更を確かめる（持ち主は変えない・公開済みの版は変えない・出したのは持ち主）。 */
function changedEntry(old: RegistryEntry, now: RegistryEntry, author: string, verified: boolean): string[] {
  const messages: string[] = [];
  if (old.publisher.github.toLowerCase() !== now.publisher.github.toLowerCase()) {
    messages.push(`publisher.github cannot change (was "${old.publisher.github}")`);
  }
  messages.push(...publishedVersions(old.versions, now.versions));
  messages.push(...byPublisher(old, author, verified));
  return messages;
}

/** 公開済みの版が、消されず、中身も変わっていないかを確かめる。 */
function publishedVersions(old: readonly RegistryVersion[], now: readonly RegistryVersion[]): string[] {
  return old.flatMap((v) => {
    const same = now.find((n) => n.version === v.version);
    if (same === undefined) return [`version "${v.version}" was published and cannot be removed`];
    const unchanged = same.url === v.url && same.sha256 === v.sha256 && same.signature === v.signature;
    return unchanged ? [] : [`version "${v.version}" was published and cannot change`];
  });
}

/** PR を出したのがエントリの持ち主か（またはメンテナが確かめたか）を確かめる。 */
function byPublisher(entry: RegistryEntry, author: string, verified: boolean): string[] {
  if (verified || author.toLowerCase() === entry.publisher.github.toLowerCase()) return [];
  return [
    `only "${entry.publisher.github}" can add or change this entry (this pull request is by "${author}"); ` +
      `for an organization, a maintainer adds the label "${VERIFIED_LABEL}"`,
  ];
}

/** 2 つのエントリが同じ中身か（JSON として比べる。キーの順はスキーマで決まらないので並べ替える）。 */
function sameEntry(a: RegistryEntry, b: RegistryEntry): boolean {
  return canonical(a) === canonical(b);
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_, v: unknown) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([x], [y]) => (x < y ? -1 : 1)))
      : v,
  );
}

/** `https://github.com/<owner>/<name>` を持ち主と名前に分ける（小文字にする）。形が違えば undefined。 */
function parseRepository(url: string): { owner: string; name: string } | undefined {
  const m = /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(url);
  if (m === null || m[1] === undefined || m[2] === undefined) return undefined;
  return { owner: m[1].toLowerCase(), name: m[2].toLowerCase() };
}
