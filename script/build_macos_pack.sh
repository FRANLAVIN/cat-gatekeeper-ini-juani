#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
ROOT="${SCRIPT_DIR:h}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BUILD_ROOT="$ROOT/out/gift-pack-$STAMP"
PACK_NAME="Cat Gatekeeper Ini Juani M4"
PACK_DIR="$BUILD_ROOT/$PACK_NAME"
APP_NAME="Cat Gatekeeper - Ini Juani.app"
APP_PATH="$PACK_DIR/$APP_NAME"
ELECTRON_APP="$ROOT/node_modules/electron/dist/Electron.app"
ZIP_PATH="$ROOT/out/CatGatekeeper_Ini_Juani_M4_$STAMP.zip"
TAR_XZ_PATH="$ROOT/out/CatGatekeeper_Ini_Juani_M4_$STAMP.tar.xz"

if [[ ! -d "$ELECTRON_APP" ]]; then
  printf 'Missing Electron runtime at %s\nRun npm install first.\n' "$ELECTRON_APP" >&2
  exit 1
fi

for asset in neko1.webm neko2.webm blue_cat.webm nekoicon128.png; do
  if [[ ! -f "$ROOT/assets/$asset" ]]; then
    printf 'Missing asset: %s\n' "$ROOT/assets/$asset" >&2
    exit 1
  fi
done

mkdir -p "$PACK_DIR" "$APP_PATH/Contents/Resources/app/assets" "$ROOT/out"
ditto "$ELECTRON_APP" "$APP_PATH"

for file in package.json main.js preload.js index.html styles.css renderer.js overlay.html LEEME.txt LICENSE NOTICE.md README.md; do
  ditto "$ROOT/$file" "$APP_PATH/Contents/Resources/app/$file"
done

for asset in neko1.webm neko2.webm blue_cat.webm nekoicon128.png; do
  ditto "$ROOT/assets/$asset" "$APP_PATH/Contents/Resources/app/assets/$asset"
done

ditto "$ROOT/LEEME.txt" "$PACK_DIR/LEEME.txt"

INFO="$APP_PATH/Contents/Info.plist"
sips -s format icns "$ROOT/assets/nekoicon128.png" --out "$APP_PATH/Contents/Resources/catgatekeeper.icns" >/dev/null

plutil -replace CFBundleName -string "Cat Gatekeeper" "$INFO"
plutil -replace CFBundleDisplayName -string "Cat Gatekeeper" "$INFO"
plutil -replace CFBundleIdentifier -string "gift.catgatekeeper.inijuani" "$INFO"
plutil -replace CFBundleShortVersionString -string "0.2.0" "$INFO"
plutil -replace CFBundleVersion -string "2" "$INFO"
plutil -replace CFBundleIconFile -string "catgatekeeper.icns" "$INFO"
plutil -replace LSApplicationCategoryType -string "public.app-category.productivity" "$INFO"
plutil -remove ElectronAsarIntegrity "$INFO" 2>/dev/null || true
plutil -remove NSAudioCaptureUsageDescription "$INFO" 2>/dev/null || true
plutil -remove NSBluetoothAlwaysUsageDescription "$INFO" 2>/dev/null || true
plutil -remove NSBluetoothPeripheralUsageDescription "$INFO" 2>/dev/null || true
plutil -remove NSCameraUsageDescription "$INFO" 2>/dev/null || true
plutil -remove NSMicrophoneUsageDescription "$INFO" 2>/dev/null || true

codesign --force --deep --sign - "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

(
  cd "$BUILD_ROOT"
  ditto -c -k --sequesterRsrc --keepParent "$PACK_NAME" "$ZIP_PATH"
  tar -cJf "$TAR_XZ_PATH" "$PACK_NAME"
)

printf 'APP_PATH=%s\n' "$APP_PATH"
printf 'PACK_DIR=%s\n' "$PACK_DIR"
printf 'ZIP_PATH=%s\n' "$ZIP_PATH"
printf 'TAR_XZ_PATH=%s\n' "$TAR_XZ_PATH"
