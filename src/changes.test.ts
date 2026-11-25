import type { RegistryEntry, RegistryVersion } from "modelith-plugin-sdk";
import { describe, expect, it } from "vitest";
import { VERIFIED_LABEL, checkChanges, checkOwnership } from "./changes.ts";

const FILE = "com.example.fmea-check.json";
const RELEASES = "https://github.com/example-inc/modelith-fmea/releases/download";

function version(v: string, sha = "0"): RegistryVersion {
  return { version: v, url: `${RELEASES}/v${v}/plugin.zip`, sha256: sha.repeat(64) };
}

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
    versions: [version("0.1.0")],
    ...overrides,
  };
}

const map = (e?: RegistryEntry) => new Map(e === undefined ? [] : [[FILE, e]]);
const byPublisher = { author: "example-inc", labels: [] };
const byOther = { author: "mallory", labels: [] };
const verified = { author: "mallory", labels: [VERIFIED_LABEL] };

describe("checkOwnership", () => {
  it("accepts a repository of the publisher and its release files", () => {
    expect(checkOwnership(entry())).toEqual([]);
  });

  it("ignores case in the owner, as GitHub does", () => {
    expect(checkOwnership(entry({ publisher: { name: "Example Inc.", github: "Example-Inc" } }))).toEqual([]);
  });

  it.each([
    ["another owner", "https://github.com/mallory/modelith-fmea"],
    ["another host", "https://gitlab.com/example-inc/modelith-fmea"],
    ["a sub-path", "https://github.com/example-inc/modelith-fmea/tree/main"],
  ])("rejects a repository on %s", (_: string, repository: string) => {
    expect(checkOwnership(entry({ repository }))).toHaveLength(1);
  });

  it.each([
    ["another repository", "https://github.com/example-inc/other/releases/download/v0.1.0/plugin.zip"],
    ["another owner", "https://github.com/mallory/modelith-fmea/releases/download/v0.1.0/plugin.zip"],
    ["not a release file", "https://github.com/example-inc/modelith-fmea/raw/main/plugin.zip"],
    ["another host", "https://example.com/plugin.zip"],
  ])("rejects a download URL on %s", (_: string, url: string) => {
    // Arrange
    const e = entry({ versions: [{ ...version("0.1.0"), url }] });
    // Act
    const messages = checkOwnership(e);
    // Assert
    expect(messages).toEqual([expect.stringMatching(/^versions\[0\]\.url must be a release file of /)]);
  });
});

describe("checkChanges", () => {
  it("accepts no change", () => {
    expect(checkChanges(map(entry()), map(entry()), byOther)).toEqual([]);
  });

  it("treats a different key order as no change", () => {
    // Arrange: 同じ中身をキーの順を変えて書いた
    const { versions, ...rest } = entry();
    const reordered = { versions, ...rest } as RegistryEntry;
    // Act / Assert
    expect(checkChanges(map(entry()), map(reordered), byOther)).toEqual([]);
  });

  describe("a new entry", () => {
    it("accepts it from the publisher", () => {
      expect(checkChanges(map(), map(entry()), byPublisher)).toEqual([]);
    });

    it("rejects it from someone else", () => {
      expect(checkChanges(map(), map(entry()), byOther)).toEqual([
        { file: FILE, message: expect.stringMatching(/^only "example-inc" can add or change this entry/) },
      ]);
    });

    it("accepts it from someone else when a maintainer verified it", () => {
      expect(checkChanges(map(), map(entry()), verified)).toEqual([]);
    });
  });

  describe("a changed entry", () => {
    it("accepts a new version from the publisher", () => {
      const after = entry({ versions: [version("0.1.0"), version("0.2.0", "1")] });
      expect(checkChanges(map(entry()), map(after), byPublisher)).toEqual([]);
    });

    it("rejects a new version from someone else", () => {
      const after = entry({ versions: [version("0.1.0"), version("0.2.0", "1")] });
      expect(checkChanges(map(entry()), map(after), byOther)).toHaveLength(1);
    });

    it.each([
      ["sha256", { sha256: "f".repeat(64) }],
      ["url", { url: `${RELEASES}/v0.1.0/other.zip` }],
      ["signature", { signature: "sig" }],
    ])("rejects a change to the %s of a published version, even from the publisher", (_: string, patch: object) => {
      // Arrange
      const after = entry({ versions: [{ ...version("0.1.0"), ...patch }] });
      // Act
      const problems = checkChanges(map(entry()), map(after), byPublisher);
      // Assert
      expect(problems).toEqual([{ file: FILE, message: 'version "0.1.0" was published and cannot change' }]);
    });

    it("rejects removing a published version, even from the publisher", () => {
      const before = entry({ versions: [version("0.1.0"), version("0.2.0", "1")] });
      expect(checkChanges(map(before), map(entry()), byPublisher)).toEqual([
        { file: FILE, message: 'version "0.2.0" was published and cannot be removed' },
      ]);
    });

    it("rejects a change of publisher.github, even when the new publisher sends it", () => {
      // Arrange: 乗っ取りの形。新しい持ち主が自分の名前に書き換える
      const after = entry({ publisher: { name: "Mallory", github: "mallory" } });
      // Act
      const problems = checkChanges(map(entry()), map(after), { author: "mallory", labels: [] });
      // Assert
      expect(problems.map((p) => p.message)).toEqual([
        'publisher.github cannot change (was "example-inc")',
        expect.stringMatching(/^only "example-inc" can add or change this entry/),
      ]);
    });

    it("keeps published versions fixed even when a maintainer verified the pull request", () => {
      const after = entry({ versions: [{ ...version("0.1.0"), sha256: "f".repeat(64) }] });
      expect(checkChanges(map(entry()), map(after), verified)).toHaveLength(1);
    });
  });

  describe("a removed entry", () => {
    it("rejects it without a maintainer, even from the publisher", () => {
      expect(checkChanges(map(entry()), map(), byPublisher)).toEqual([
        { file: FILE, message: `removing an entry needs a maintainer (label "${VERIFIED_LABEL}")` },
      ]);
    });

    it("accepts it when a maintainer verified it", () => {
      expect(checkChanges(map(entry()), map(), verified)).toEqual([]);
    });
  });
});
