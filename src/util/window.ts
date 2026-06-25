import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi';

const appWindow = getCurrentWindow();

export async function updateWindowSize(elem: HTMLElement) {
  const rect = elem.getBoundingClientRect();

  const newWidth = Math.ceil(rect.width);
  const newHeight = Math.ceil(rect.height);

  const scaleFactor = await appWindow.scaleFactor();

  const oldPhysicalSize = await appWindow.innerSize();
  const oldSize = oldPhysicalSize.toLogical(scaleFactor);

  // Only care about size changes
  const deltaHeight = newHeight - oldSize.height;
  const deltaWidth = newWidth - oldSize.width;

  if (deltaHeight !== 0 || deltaWidth !== 0) {
    const physicalPosition = await appWindow.innerPosition();

    // Convert to logical position
    const logicalPosition = physicalPosition.toLogical(scaleFactor);

    // Move the window up when growing,
    // down when shrinking, keeping the bottom fixed.
    await appWindow.setPosition(
      new LogicalPosition(logicalPosition.x - deltaWidth / 2, logicalPosition.y - deltaHeight)
    );
  }

  await appWindow.setSize(new LogicalSize(newWidth, newHeight));
}
