# Cat Gatekeeper - Iñi & Juani

Portable macOS build of Cat Gatekeeper with only two selectable animals:

- **Iñi the Cat**
- **Juani the Cat**

This fork is packaged as a small gift build for Apple Silicon Macs, especially M-series machines.

## Download

Use the latest file attached in [Releases](../../releases/latest).

The release zip contains:

- `Cat Gatekeeper - Ini Juani.app`
- `LEEME.txt`

## Install On macOS

1. Download the latest release zip.
2. Unzip it.
3. Drag `Cat Gatekeeper - Ini Juani.app` into `Applications`.
4. Open it.

If macOS blocks the first launch, use:

1. Right click the app.
2. Click `Open`.
3. Confirm `Open`.

This happens because the public gift build is ad-hoc signed, not notarized with an Apple Developer ID.

## Accessibility Permission

For app time tracking, macOS must allow Cat Gatekeeper to detect the active app:

`System Settings > Privacy & Security > Accessibility > Cat Gatekeeper`

Enable it there if the active app stays as `unknown` or tracking does not advance.

## Build Locally

Requirements:

- macOS on Apple Silicon
- Node.js and npm

```bash
npm install
npm run build:mac
```

The build script creates a signed local `.app` and a zip under `out/`.

## Notes

- This build intentionally excludes Nika/the panther.
- The release artifact is intended for direct sharing, for example by AirDrop.
- The app is ad-hoc signed. It is not Apple-notarized unless a Developer ID notarization step is added.

## License

Apache-2.0. See [LICENSE](LICENSE).
