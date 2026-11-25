// 登録簿の索引（`plugins/<id>.json`）を検査する（判断だけ。ファイルの読み込みは呼ぶ側が EntryFile で渡す）。
// ADR-0004 の安全原則に従い、投稿されたプラグインのコードは取りに行かず、動かさない。
// ここで見るのは、スキーマ・ファイル名と ID の一致・apiVersion・ライセンスの表記・版の並び・URL の形まで。

import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import { API_VERSION, type RegistryEntry } from "modelith-plugin-sdk";
import semver from "semver";
import parseSpdx from "spdx-expression-parse";

/** 検査する索引のファイル 1 つ。 */
export interface EntryFile {
  /** `plugins/` の中のファイル名（例: `com.example.fmea-check.json`）。 */
  name: string;
  /** ファイルの中身（UTF-8 の文字列）。 */
  text: string;
}

/** 見つかった問題 1 件。 */
export interface Problem {
  /** 問題のあるファイル名。 */
  file: string;
  /** 問題の説明（英語、1 行）。 */
  message: string;
}

/**
 * 索引のファイルをまとめて検査し、見つかった問題を並べる。
 *
 * - 引数 `files`: `plugins/` の中の `.json` のファイル。
 * - 引数 `schema`: plugin-sdk の `registry-entry.schema.json`。
 * - 戻り値: 問題の一覧。問題が無ければ空の配列。
 *
 * 例: `[{ name: "com.example.a.json", text: "{" }]` → `[{ file: "com.example.a.json", message: "invalid JSON: ..." }]`
 */
export function checkEntries(files: readonly EntryFile[], schema: object): Problem[] {
  const ajv = new Ajv2020.default({ strict: false, logger: false, allErrors: true });
  const validate = ajv.compile(schema);
  return files.flatMap((file) => {
    const json = parseJson(file.text);
    if (!json.ok) return [problem(file.name, `invalid JSON: ${json.message}`)];
    if (!validate(json.value)) return schemaMessages(validate.errors).map((m) => problem(file.name, m));
    return checkEntry(file.name, json.value as RegistryEntry).map((m) => problem(file.name, m));
  });
}

/**
 * スキーマに通った 1 件の中身を検査し、問題の説明を並べる。
 *
 * - 引数 `fileName`: ファイル名（`<id>.json` であるべき）。
 * - 引数 `entry`: スキーマに通った索引のエントリ。
 * - 戻り値: 問題の説明の一覧。問題が無ければ空の配列。
 *
 * 例: `checkEntry("b.json", { id: "com.example.a", ... })` → `['file name must be "com.example.a.json"']`
 */
export function checkEntry(fileName: string, entry: RegistryEntry): string[] {
  return [
    ...checkFileName(fileName, entry.id),
    ...checkApiVersion(entry.apiVersion),
    ...checkLicense(entry.license),
    ...checkHttps("repository", entry.repository),
    ...checkVersions(entry.versions),
  ];
}

/**
 * ファイル名が `<id>.json` かを確かめる（ファイル名で ID の重複を防ぐ）。
 *
 * 例: `checkFileName("com.example.a.json", "com.example.a")` → `[]`
 */
export function checkFileName(fileName: string, id: string): string[] {
  const expected = `${id}.json`;
  return fileName === expected ? [] : [`file name must be "${expected}"`];
}

/**
 * apiVersion が、この登録簿の使う plugin-sdk の版と合うかを確かめる。
 *
 * 例: `checkApiVersion("0")` → `[]`（plugin-sdk 0.x のとき）、`checkApiVersion("1")` → `['apiVersion is "1", ...']`
 */
export function checkApiVersion(apiVersion: string): string[] {
  return apiVersion === API_VERSION
    ? []
    : [`apiVersion is "${apiVersion}", but the registry accepts "${API_VERSION}"`];
}

/**
 * ライセンスが SPDX の式として読めるかを確かめる。
 *
 * 例: `checkLicense("MIT OR Apache-2.0")` → `[]`、`checkLicense("MIT License")` → `['license "MIT License" is not ...']`
 */
export function checkLicense(license: string): string[] {
  try {
    parseSpdx(license);
    return [];
  } catch {
    return [`license "${license}" is not an SPDX expression (e.g. "MIT", "Apache-2.0", "MIT OR Apache-2.0")`];
  }
}

/**
 * URL が https で始まる絶対 URL かを確かめる。
 *
 * 例: `checkHttps("repository", "https://github.com/a/b")` → `[]`、`checkHttps("repository", "http://x")` → `["repository must be an https URL"]`
 */
export function checkHttps(field: string, value: string): string[] {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return [`${field} must be an https URL`];
  }
  return url.protocol === "https:" ? [] : [`${field} must be an https URL`];
}

/**
 * 版の並びを確かめる（1 つ以上・SemVer・重複なし・配布物の URL が https）。
 *
 * 例: `checkVersions([{ version: "1.0", ... }])` → `['versions[0]: "1.0" is not a SemVer version']`
 */
export function checkVersions(versions: RegistryEntry["versions"]): string[] {
  if (versions.length === 0) return ["versions must list at least one version"];
  const seen = new Set<string>();
  return versions.flatMap((v, i) => {
    const at = `versions[${i}]`;
    const messages: string[] = [];
    if (semver.valid(v.version) !== v.version) messages.push(`${at}: "${v.version}" is not a SemVer version`);
    if (seen.has(v.version)) messages.push(`${at}: "${v.version}" is listed twice`);
    seen.add(v.version);
    messages.push(...checkHttps(`${at}.url`, v.url));
    return messages;
  });
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

function schemaMessages(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "is invalid"}`);
}

function problem(file: string, message: string): Problem {
  return { file, message };
}
