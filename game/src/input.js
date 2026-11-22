// Keyboard and mouse input controller mapped cleanly to logical 1280x720 canvas coordinates.

import { VIEWPORT } from './config.js';

export function createInputController(canvas, handlers) {
  const keys = new Set();
  let pointerX = VIEWPORT.width * 0.5;
  let pointerY = VIEWPORT.height * 0.5;
  let reconHeld = false;
  let interactQueued = false;

  function canvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: pointerX, y: pointerY };
    return {
      x: Math.max(0, Math.min(VIEWPORT.width, ((clientX - rect.left) / rect.width) * VIEWPORT.width)),
      y: Math.max(0, Math.min(VIEWPORT.height, ((clientY - rect.top) / rect.height) * VIEWPORT.height)),
    };
  }

  window.addEventListener('keydown', (e) => {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(code)) {
      e.preventDefault();
    }
    keys.add(code);

    if (code === 'Digit1') handlers.onSelectTool(0);
    else if (code === 'Digit2') handlers.onSelectTool(1);
    else if (code === 'Digit3') handlers.onSelectTool(2);
    else if (code === 'KeyE') interactQueued = true;
    else if (code === 'KeyR') handlers.onRetry();
    else if (code === 'KeyM') handlers.onToggleMute();
    else if (code === 'Tab') handlers.onCycleWing();
    else if (code === 'Space' || code === 'Enter') handlers.onPrimaryAction();
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });

  canvas.addEventListener('mousemove', (e) => {
    const pt = canvasCoords(e.clientX, e.clientY);
    pointerX = pt.x;
    pointerY = pt.y;
  });

  canvas.addEventListener('mousedown', (e) => {
    const pt = canvasCoords(e.clientX, e.clientY);
    pointerX = pt.x;
    pointerY = pt.y;
    if (e.button === 2) {
      reconHeld = true;
    } else if (e.button === 0) {
      handlers.onPrimaryClick(pt.x, pt.y);
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 2) reconHeld = false;
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    handlers.onWheelTool(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  return {
    poll() {
      let moveX = 0;
      let moveY = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) moveY -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) moveY += 1;

      const interactPressed = interactQueued;
      interactQueued = false;

      return {
        moveX,
        moveY,
        sneak: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        recon: reconHeld,
        interactPressed,
        pointerX,
        pointerY,
      };
    },
  };
}
