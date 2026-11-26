import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { RegistryEntry } from "modelith-plugin-sdk";
import { describe, expect, it } from "vitest";
import {
  checkApiVersion,
  checkEntries,
  checkFileName,
  checkHttps,
  checkLicense,
  checkVersions,
} from "./check.ts";

const schema = JSON.parse(
  readFileSync(createRequire(import.meta.url).resolve("modelith-plugin-sdk/schema/registry-entry.schema.json"), "utf8"),
) as object;

const SHA = "0".repeat(64);

function entry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    id: "com.example.fmea-check",
    name: "FMEA trace check",
    publisher: { name: "Example Inc.", github: "example-inc" },
    repository: "https://github.com/example-inc/modelith-fmea",
    apiVersion: "0",
    runtime: "rules",
    license: "MIT",
    pricing: "free",
    versions: [{ version: "0.1.0", url: "https://github.com/example-inc/modelith-fmea/releases/download/v0.1.0/plugin.zip", sha256: SHA }],
    ...overrides,
  };
}

function file(value: unknown, name = "com.example.fmea-check.json") {
  return { name, text: JSON.stringify(value) };
}

describe("checkEntries", () => {
  it("accepts a valid entry", () => {
    // Arrange
    const files = [file(entry())];
    // Act
    const problems = checkEntries(files, schema);
    // Assert
    expect(problems).toEqual([]);
  });

  it("accepts an empty registry", () => {
    expect(checkEntries([], schema)).toEqual([]);
  });

  it("reports a file that is not JSON", () => {
    const problems = checkEntries([{ name: "com.example.a.json", text: "{" }], schema);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toMatch(/^invalid JSON: /);
  });

  it("reports schema errors and skips the other checks", () => {
    // Arrange: 必須の license が無く、ファイル名も違う
    const { license: _, ...noLicense } = entry();
    // Act
    const problems = checkEntries([file(noLicense, "wrong.json")], schema);
    // Assert: スキーマの誤りだけを出す
    expect(problems.map((p) => p.message)).toEqual(["/ must have required property 'license'"]);
  });

  it("rejects an unknown field", () => {
    const problems = checkEntries([file({ ...entry(), homepage: "https://example.com" })], schema);
    expect(problems.map((p) => p.message)).toEqual(["/ must NOT have additional properties"]);
  });

  it("reports problems per file", () => {
    const files = [file(entry()), file(entry({ id: "com.example.other" }), "com.example.another.json")];
    expect(checkEntries(files, schema)).toEqual([
      { file: "com.example.another.json", message: 'file name must be "com.example.other.json"' },
    ]);
  });
});

describe("checkFileName", () => {
  it("accepts <id>.json", () => {
    expect(checkFileName("com.example.a.json", "com.example.a")).toEqual([]);
  });

  it.each(["com.example.b.json", "com.example.a", "com.example.a.JSON"])("rejects %s", (name) => {
    expect(checkFileName(name, "com.example.a")).toEqual(['file name must be "com.example.a.json"']);
  });
});

describe("checkApiVersion", () => {
  it('accepts "0" while plugin-sdk is 0.x', () => {
    expect(checkApiVersion("0")).toEqual([]);
  });

  it("rejects a version the registry does not support yet", () => {
    expect(checkApiVersion("1")).toEqual(['apiVersion is "1", but the registry accepts "0"']);
  });
});

describe("checkLicense", () => {
  it.each(["MIT", "Apache-2.0", "MIT OR Apache-2.0", "AGPL-3.0-only", "LicenseRef-Example"])("accepts %s", (license) => {
    expect(checkLicense(license)).toEqual([]);
  });

  it.each(["MIT License", "", "mit or"])("rejects %j", (license) => {
    expect(checkLicense(license)).toHaveLength(1);
  });
});

describe("checkHttps", () => {
  it("accepts an https URL", () => {
    expect(checkHttps("repository", "https://github.com/a/b")).toEqual([]);
  });

  it.each(["http://github.com/a/b", "github.com/a/b", "file:///tmp/x", ""])("rejects %j", (url) => {
    expect(checkHttps("repository", url)).toEqual(["repository must be an https URL"]);
  });
});

describe("checkVersions", () => {
  const v = (version: string, url = "https://example.com/p.zip") => ({ version, url, sha256: SHA });

  it("accepts several SemVer versions", () => {
    expect(checkVersions([v("0.1.0"), v("0.2.0-beta.1"), v("1.0.0")])).toEqual([]);
  });

  it("rejects an empty list", () => {
    expect(checkVersions([])).toEqual(["versions must list at least one version"]);
  });

  it.each(["1.0", "v1.0.0", "01.0.0", "1.0.0 "])("rejects the version %j", (version) => {
    expect(checkVersions([v(version)])).toEqual([`versions[0]: "${version}" is not a SemVer version`]);
  });

  it("rejects a version listed twice", () => {
    expect(checkVersions([v("0.1.0"), v("0.1.0")])).toEqual(['versions[1]: "0.1.0" is listed twice']);
  });

  it("rejects a download URL that is not https", () => {
    expect(checkVersions([v("0.1.0", "http://example.com/p.zip")])).toEqual([
      "versions[0].url must be an https URL",
    ]);
  });
});
