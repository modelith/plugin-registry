# plugin-registry

The index of [Modelith](https://github.com/modelith/modelith) plugins. It holds one JSON file per plugin, not the plugins themselves.

Every change to `main` is combined into one file, the [registry index](https://github.com/modelith/plugin-sdk/blob/dev/schema/registry-index.schema.json),
and published at <https://registry.modelith-studio.org/index.json>.

## Adding a plugin

1. Publish your plugin from its own GitHub repository, and attach the package to a GitHub Release.
2. Open the pull request from the GitHub account (or organization) named in `publisher.github`, and add `plugins/<id>.json`, named after your plugin's ID (for example `plugins/com.example.fmea-check.json`).
   The format is the [registry entry](https://github.com/modelith/plugin-sdk/blob/dev/schema/registry-entry.schema.json)
   from [plugin-sdk](https://github.com/modelith/plugin-sdk); see the
   [example](https://github.com/modelith/plugin-sdk/blob/dev/examples/registry-entry.json).
3. Open a pull request. To release a new version later, add it to `versions` in the same file.
   A version, once merged, cannot be changed or removed: publish a new version instead.

If the plugin belongs to an organization and you open the pull request from your own account, a maintainer checks that
you speak for the organization and adds the label `publisher-verified`.

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
- `repository` is a GitHub repository of `publisher.github`, and every download is a release file of that repository

The `registry` check also compares the pull request with `main`. It runs the checker from `main` and only reads the
files of the pull request. It checks that:

- the pull request is opened by `publisher.github` (or carries `publisher-verified`)
- `publisher.github` of an existing entry does not change
- a published version (its `url`, `sha256` and `signature`) does not change and is not removed
- an entry is removed only with `publisher-verified`

Every pull request also needs a maintainer's review (`.github/CODEOWNERS`).

## Development

```sh
npm ci
npm run typecheck
npm test
npm run check    # checks plugins/
npm run build    # checks plugins/, then writes dist/index.json
PR_AUTHOR=<login> node src/pr-main.ts <main>/plugins <pr>/plugins   # what the registry check runs
```

The rules live in `src/check.ts`, `src/changes.ts` and `src/build.ts`. `src/main.ts`, `src/build-main.ts`,
`src/pr-main.ts` and `src/io.ts` only read and write files.
