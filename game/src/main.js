// Entry module: wires deterministic simulation loop, input controller, Web Audio, and canvas renderer.

import { createHeistAudio } from './audio.js';
import { FIXED_DT, VIEWPORT } from './config.js';
import { createInputController } from './input.js';
import { WINGS } from './levels.js';
import { renderHeistFrame } from './render.js';
import { parseShotParams, stageScreenshotScene } from './shots.js';
import { selectTool, useSelectedTool } from './tools.js';
import { createHeistWorld, stepHeistWorld } from './world.js';

const canvas = document.getElementById('heist-canvas');
const ctx = canvas.getContext('2d');
const audio = createHeistAudio();

const shotRequest = parseShotParams(window.location.search);
let currentWing = shotRequest ? shotRequest.wingIndex : 1;
let world = shotRequest
  ? stageScreenshotScene(shotRequest.shot, shotRequest.wingIndex, shotRequest.seed)
  : createHeistWorld(currentWing, 1, false);

function restartWing(startPlaying = true) {
  world = createHeistWorld(currentWing, 1, startPlaying);
}

const input = createInputController(canvas, {
  onSelectTool(idx) {
    audio.unlock();
    selectTool(world, idx);
  },
  onWheelTool(delta) {
    const next = (world.selectedTool + delta + world.tools.length) % world.tools.length;
    selectTool(world, next);
  },
  onRetry() {
    audio.unlock();
    restartWing(true);
  },
  onToggleMute() {
    audio.toggleMute();
  },
  onCycleWing() {
    audio.unlock();
    currentWing = (currentWing + 1) % WINGS.length;
    restartWing(world.status !== 'title');
  },
  onPrimaryAction() {
    audio.unlock();
    if (world.status === 'title') {
      world.status = 'playing';
    } else if (world.status === 'caught') {
      restartWing(true);
    } else if (world.status === 'extracted') {
      currentWing = (currentWing + 1) % WINGS.length;
      restartWing(true);
    }
  },
  onPrimaryClick(x, y) {
    audio.unlock();
    if (world.status === 'title') {
      world.status = 'playing';
      return;
    }
    if (world.status === 'caught') {
      restartWing(true);
      return;
    }
    if (world.status === 'extracted') {
      currentWing = (currentWing + 1) % WINGS.length;
      restartWing(true);
      return;
    }
    if (useSelectedTool(world, x, y)) {
      for (const ev of world.events) audio.emit(ev);
    }
  },
});

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = VIEWPORT.width * dpr;
  canvas.height = VIEWPORT.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

if (shotRequest) {
  renderHeistFrame(ctx, world);
  window.__HEIST_SHOT_STATUS__ = world.status;
  window.__HEIST_SHOT_READY__ = true;
} else {
  let lastTime = performance.now();
  let accumulator = 0;

  function frameLoop(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    accumulator += dt;

    while (accumulator >= FIXED_DT) {
      const state = input.poll();
      stepHeistWorld(world, state, FIXED_DT);
      for (const ev of world.events) audio.emit(ev);
      accumulator -= FIXED_DT;
    }

    renderHeistFrame(ctx, world);
    requestAnimationFrame(frameLoop);
  }

  requestAnimationFrame(frameLoop);
}
