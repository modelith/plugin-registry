# plugin-registry

The index of [Modelith](https://github.com/modelith/modelith) plugins. It holds one JSON file per plugin, not the plugins themselves.

## Adding a plugin

1. Publish your plugin from its own repository, and attach the package to a release.
2. Add `plugins/<id>.json`, named after your plugin's ID (for example `plugins/com.example.fmea-check.json`).
   The format is the [registry entry](https://github.com/modelith/plugin-sdk/blob/dev/schema/registry-entry.schema.json)
   from [plugin-sdk](https://github.com/modelith/plugin-sdk); see the
   [example](https://github.com/modelith/plugin-sdk/blob/dev/examples/registry-entry.json).
3. Open a pull request. To release a new version later, add it to `versions` in the same file.

```json
{
  "id": "com.example.fmea-check",
  "name": "FMEA trace check",
  "publisher": { "name": "Example Inc.", "github": "example-inc" },
  "repository": "https://github.com/example-inc/modelith-fmea",
  "apiVersion": "0",
  "runtime": "rules",
  "license": "MIT",
  "pricing": "free",
  "versions": [
    {
      "version": "0.1.0",
      "url": "https://github.com/example-inc/modelith-fmea/releases/download/v0.1.0/plugin.zip",
      "sha256": "<SHA-256 of plugin.zip, lowercase hex>"
    }
  ]
}
```

## What the check looks at

Each pull request runs `npm run check`. It never downloads or runs your plugin's code. It checks that:

- the file matches the registry entry schema of plugin-sdk (no unknown fields)
- the file name is `<id>.json`, so two plugins cannot share an ID
- `apiVersion` is one the registry accepts (`"0"` while plugin-sdk is 0.x)
- `license` is an [SPDX expression](https://spdx.org/licenses/) such as `MIT` or `MIT OR Apache-2.0`
- every version is SemVer and listed once, and every URL is `https`

## Development

```sh
npm ci
npm run typecheck
npm test
npm run check    # checks plugins/
```

The rules live in `src/check.ts`, and `src/main.ts` only reads the files and prints the problems.
