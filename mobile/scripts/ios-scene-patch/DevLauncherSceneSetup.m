#import "DevLauncherSceneSetup.h"
#import <EXDevLauncher/EXDevLauncherController.h>

void MimiStartDevLauncher(UIWindow *window) {
  [[EXDevLauncherController sharedInstance] autoSetupStart:window];
}
