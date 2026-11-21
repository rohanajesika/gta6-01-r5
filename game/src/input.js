// Keyboard, mouse and pointer input. Held keys give movement and driving axes;
// one-shot presses (start, pause, enter car, punch) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost or counted
// twice. Dragging the mouse orbits the camera; the wheel zooms it.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER_CAR = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let orbitDX = 0;
  let orbitDY = 0;
  let zoomDelta = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code)
      || RIGHT.has(event.code) || RUN.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER_CAR.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER_CAR;
    } else if (PUNCH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.clear();
    dragging = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    orbitDX += event.clientX - lastX;
    orbitDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });
  canvas.addEventListener('wheel', (event) => {
    zoomDelta += event.deltaY;
    event.preventDefault();
  }, { passive: false });

  function hasAny(codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Forward axis: +1 for W/up, -1 for S/down. */
    forward() {
      return (hasAny(FORWARD) ? 1 : 0) - (hasAny(BACK) ? 1 : 0);
    },
    /** Strafe/steer axis: +1 for D/right, -1 for A/left. */
    strafe() {
      return (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
    },
    run() {
      return hasAny(RUN);
    },
    /** Mouse drag since the last call, in pixels: {dx, dy}. */
    takeOrbit() {
      const taken = { dx: orbitDX, dy: orbitDY };
      orbitDX = 0;
      orbitDY = 0;
      return taken;
    },
    /** Wheel scroll since the last call, in pixels (positive zooms out). */
    takeZoom() {
      const taken = zoomDelta;
      zoomDelta = 0;
      return taken;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
