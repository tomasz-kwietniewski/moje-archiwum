// One esbuild configuration for the extension (dist/) and the Android asset,
// so both run exactly the same extraction code. tests/android-asset.mjs checks they match.
export const captureBuild = {
 entryPoints: ['src/capture.js'],
 bundle: true,
 format: 'iife',
 platform: 'browser',
 target: 'chrome120',
 legalComments: 'eof'
};
