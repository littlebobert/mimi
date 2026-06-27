#!/usr/bin/env node
/**
 * iOS 27 (Xcode 27) requires UIScene lifecycle — Expo SDK 54 prebuild doesn't include it.
 * Run after `npx expo prebuild -p ios` if the app crashes instantly on launch.
 *
 * Usage: node scripts/patch-ios-scene-lifecycle.js
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const iosDir = path.join(root, 'ios');
const patchDir = path.join(__dirname, 'ios-scene-patch');

if (!fs.existsSync(iosDir)) {
  console.error('No ios/ folder — run: npx expo prebuild -p ios');
  process.exit(1);
}

const appName = 'Mimi';
const infoPlistPath = path.join(iosDir, appName, 'Info.plist');
const pbxPath = path.join(iosDir, `${appName}.xcodeproj`, 'project.pbxproj');

for (const file of ['SceneDelegate.swift', 'AppDelegate.swift']) {
  fs.copyFileSync(path.join(patchDir, file), path.join(iosDir, appName, file));
  console.log(`patched ios/${appName}/${file}`);
}

const sceneManifest = `
    <key>UIApplicationSceneManifest</key>
    <dict>
      <key>UIApplicationSupportsMultipleScenes</key>
      <false/>
      <key>UISceneConfigurations</key>
      <dict>
        <key>UIWindowSceneSessionRoleApplication</key>
        <array>
          <dict>
            <key>UISceneConfigurationName</key>
            <string>Default Configuration</string>
            <key>UISceneDelegateClassName</key>
            <string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>
          </dict>
        </array>
      </dict>
    </dict>`;

let plist = fs.readFileSync(infoPlistPath, 'utf8');
if (!plist.includes('UIApplicationSceneManifest')) {
  plist = plist.replace(
    /(<key>RCTNewArchEnabled<\/key>)/,
    `${sceneManifest}\n    $1`,
  );
  fs.writeFileSync(infoPlistPath, plist);
  console.log(`patched ios/${appName}/Info.plist`);
}

let pbx = fs.readFileSync(pbxPath, 'utf8');
if (!pbx.includes('SceneDelegate.swift')) {
  pbx = pbx.replace(
    '/* End PBXBuildFile section */',
    `\t\tF11748452D0307B40044C1D9 /* SceneDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = F11748442D0307B50044C1D9 /* SceneDelegate.swift */; };\n/* End PBXBuildFile section */`,
  );
  pbx = pbx.replace(
    '/* End PBXFileReference section */',
    `\t\tF11748442D0307B50044C1D9 /* SceneDelegate.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = SceneDelegate.swift; path = ${appName}/SceneDelegate.swift; sourceTree = "<group>"; };\n/* End PBXFileReference section */`,
  );
  pbx = pbx.replace(
    `\t\t\t\tF11748412D0307B40044C1D9 /* AppDelegate.swift */,`,
    `\t\t\t\tF11748412D0307B40044C1D9 /* AppDelegate.swift */,\n\t\t\t\tF11748442D0307B50044C1D9 /* SceneDelegate.swift */,`,
  );
  pbx = pbx.replace(
    `\t\t\t\tF11748422D0307B40044C1D9 /* AppDelegate.swift in Sources */,`,
    `\t\t\t\tF11748422D0307B40044C1D9 /* AppDelegate.swift in Sources */,\n\t\t\t\tF11748452D0307B40044C1D9 /* SceneDelegate.swift in Sources */,`,
  );
  fs.writeFileSync(pbxPath, pbx);
  console.log(`patched ios/${appName}.xcodeproj/project.pbxproj`);
}

console.log('Done. Rebuild: npm run ios:device:install');

require('./patch-expo-dev-launcher-scene.js');
