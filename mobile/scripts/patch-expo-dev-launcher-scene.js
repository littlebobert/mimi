#!/usr/bin/env node
/**
 * expo-dev-launcher fatals in didFinishLaunching when using UIScene (iOS 27 / SceneDelegate).
 * Patch: defer autoSetupStart until SceneDelegate creates the window.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '../node_modules/expo-dev-launcher/ios/ReactDelegateHandler/ExpoDevLauncherAppDelegateSubscriber.swift',
);

if (!fs.existsSync(file)) {
  console.log('skip patch-expo-dev-launcher-scene: expo-dev-launcher not installed');
  process.exit(0);
}

let src = fs.readFileSync(file, 'utf8');
const oldBlock = `    guard let window = UIApplication.shared.delegate?.window ?? UIApplication.shared.windows.filter { $0.isKeyWindow }.first else {
      fatalError("Cannot find the keyWindow. Make sure to call \`window.makeKeyAndVisible()\`.")
    }`;

const newBlock = `    guard let window = UIApplication.shared.delegate?.window ?? UIApplication.shared.windows.filter { $0.isKeyWindow }.first else {
      // UIScene lifecycle creates the window in SceneDelegate after this callback.
      return false
    }`;

if (src.includes(newBlock)) {
  console.log('patch-expo-dev-launcher-scene: already patched');
  process.exit(0);
}

if (!src.includes(oldBlock)) {
  console.warn('patch-expo-dev-launcher-scene: unexpected file contents, skipping');
  process.exit(0);
}

src = src.replace(oldBlock, newBlock);
fs.writeFileSync(file, src);
console.log('patch-expo-dev-launcher-scene: patched ExpoDevLauncherAppDelegateSubscriber.swift');
