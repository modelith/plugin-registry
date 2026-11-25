import type { RegistryEntry } from "modelith-plugin-sdk";
import { describe, expect, it } from "vitest";
import { buildIndex, serializeIndex } from "./build.ts";

function entry(id: string): RegistryEntry {
  return {
    id,
    name: id,
    publisher: { name: "Example Inc.", github: "example-inc" },
    repository: "https://github.com/example-inc/plugin",
    apiVersion: "0",
    runtime: "rules",
    license: "MIT",
    pricing: "free",
    versions: [{ version: "0.1.0", url: "https://example.com/p.zip", sha256: "0".repeat(64) }],
  };
}

describe("buildIndex", () => {
  it("makes an empty index from no entries", () => {
    expect(buildIndex([])).toEqual({ plugins: [] });
  });

  it("sorts the entries by id", () => {
    // Arrange: "com.example.a-b" は "com.example.a" より後、"com.example.b" より前
    const entries = [entry("com.example.b"), entry("com.example.a-b"), entry("com.example.a")];
    // Act
    const index = buildIndex(entries);
    // Assert
    expect(index.plugins.map((p) => p.id)).toEqual(["com.example.a", "com.example.a-b", "com.example.b"]);
  });

  it("does not change the input", () => {
    const entries = [entry("com.example.b"), entry("com.example.a")];
    buildIndex(entries);
    expect(entries.map((p) => p.id)).toEqual(["com.example.b", "com.example.a"]);
  });
});

describe("serializeIndex", () => {
  it("writes pretty JSON with a final newline", () => {
    expect(serializeIndex({ plugins: [] })).toBe('{\n  "plugins": []\n}\n');
  });

  it("round-trips through JSON", () => {
    const index = buildIndex([entry("com.example.a")]);
    expect(JSON.parse(serializeIndex(index))).toEqual(index);
  });
});
