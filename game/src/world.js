// Core deterministic heist simulation: thief movement, cover, lasers, interactions, alarm, and scoring.

import { ALARM_STATES, THIEF_SPEC } from './config.js';
import { createWingBlueprint } from './levels.js';
import { initializeCameras, initializeGuards, updateCameras, updateGuards } from './guards.js';
import { collectLootItem, createToolInventory, tryInteract, updateToolEffects } from './tools.js';

function createRng(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function resolveCircleAabb(cx, cy, r, rect) {
  const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= r * r) return { x: cx, y: cy };
  const dist = Math.sqrt(distSq);
  if (dist > 1e-5) {
    const push = r - dist;
    return { x: cx + (dx / dist) * push, y: cy + (dy / dist) * push };
  }
  const left = cx - rect.x;
  const right = rect.x + rect.w - cx;
  const top = cy - rect.y;
  const bottom = rect.y + rect.h - cy;
  const minPen = Math.min(left, right, top, bottom);
  if (minPen === left) return { x: rect.x - r, y: cy };
  if (minPen === right) return { x: rect.x + rect.w + r, y: cy };
  if (minPen === top) return { x: cx, y: rect.y - r };
  return { x: cx, y: rect.y + rect.h + r };
}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy;
  if (lenSq < 1e-6) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / lenSq));
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

function isInAnyCover(x, y, covers) {
  for (let i = 0; i < covers.length; i += 1) {
    const c = covers[i];
    if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return true;
  }
  return false;
}

export function getAlarmLabel(alarm, primaryLootTaken, status) {
  if (status === 'caught' || alarm >= 99.5) return ALARM_STATES.LOCKDOWN;
  if (primaryLootTaken && alarm >= 35) return ALARM_STATES.PURSUIT;
  if (alarm >= 15) return ALARM_STATES.SUSPICIOUS;
  return ALARM_STATES.QUIET;
}

export function computeHeistScore(world) {
  const grossLoot = world.lootTotal;
  const toolCost = world.toolSpend;
  const stealthBonus = world.peakAlarm < 15 ? 45000 : world.peakAlarm < 50 ? 20000 : 0;
  const speedBonus = world.elapsed <= world.blueprint.parTimeSec ? 30000 : Math.max(0, Math.round((world.blueprint.parTimeSec + 30 - world.elapsed) * 500));
  const netPayout = Math.max(0, grossLoot - toolCost + stealthBonus + speedBonus);
  let rank = 'C';
  if (netPayout >= world.primaryValue + 40000 && world.peakAlarm < 60) rank = 'S';
  else if (netPayout >= world.primaryValue) rank = 'A';
  else if (netPayout >= world.primaryValue * 0.8) rank = 'B';
  return { grossLoot, toolCost, stealthBonus, speedBonus, netPayout, rank };
}

export function createHeistWorld(wingIndex = 1, seed = 1, startPlaying = false) {
  const blueprint = createWingBlueprint(wingIndex);
  const primaryItem = blueprint.loot.find((l) => l.primary);
  const world = {
    wingIndex,
    seed,
    rng: createRng(seed),
    blueprint,
    status: startPlaying ? 'playing' : 'title',
    elapsed: 0,
    alarm: 0,
    peakAlarm: 0,
    lootTotal: 0,
    primaryValue: primaryItem ? primaryItem.value : 250000,
    primaryLootTaken: false,
    toolSpend: 0,
    toolsUsedCount: 0,
    selectedTool: 0,
    reconActive: false,
    pointer: { x: 520, y: 340 },
    thief: {
      x: blueprint.spawn.x,
      y: blueprint.spawn.y,
      angle: -0.35,
      sneaking: false,
      inCover: false,
      moving: false,
      ventCooldown: 0,
      trail: [{ x: blueprint.spawn.x, y: blueprint.spawn.y, alpha: 1 }],
      trailTimer: 0,
    },
    walls: blueprint.walls,
    covers: blueprint.covers,
    vents: blueprint.vents,
    breakers: blueprint.breakers.map((b) => ({ ...b, tripped: false, cooldown: 0 })),
    lasers: blueprint.lasers.map((l) => ({ ...l })),
    loot: blueprint.loot.map((l) => ({ ...l, collected: false })),
    guards: initializeGuards(blueprint),
    cameras: initializeCameras(blueprint),
    tools: createToolInventory(),
    smokeClouds: [],
    soundRipples: [],
    empPulses: [],
    floatingTexts: [],
    caughtReport: null,
    summary: null,
    events: [],
  };

  // Compute initial vision cones so frame 0 renders cleanly
  updateGuards(world, 0);
  updateCameras(world, 0);
  return world;
}

export function stepHeistWorld(world, input, dt) {
  world.events.length = 0;

  if (input && typeof input.pointerX === 'number') {
    world.pointer.x = input.pointerX;
    world.pointer.y = input.pointerY;
  }
  world.reconActive = Boolean(input && input.recon);

  if (world.status === 'title') {
    world.elapsed += dt;
    updateGuards(world, dt);
    updateCameras(world, dt);
    return;
  }

  if (world.status !== 'playing') {
    updateToolEffects(world, dt);
    return;
  }

  world.elapsed += dt;
  const { thief, walls } = world;
  if (thief.ventCooldown > 0) thief.ventCooldown = Math.max(0, thief.ventCooldown - dt);

  const mx = input ? input.moveX : 0;
  const my = input ? input.moveY : 0;
  thief.sneaking = Boolean(input && input.sneak);

  const mag = Math.hypot(mx, my);
  thief.moving = mag > 0.05;
  if (thief.moving) {
    const ux = mx / mag;
    const uy = my / mag;
    const speed = thief.sneaking ? THIEF_SPEC.sneakSpeed : THIEF_SPEC.walkSpeed;
    thief.x += ux * speed * dt;
    thief.y += uy * speed * dt;
    thief.angle = Math.atan2(uy, ux);
    for (let i = 0; i < walls.length; i += 1) {
      const resolved = resolveCircleAabb(thief.x, thief.y, THIEF_SPEC.radius, walls[i]);
      thief.x = resolved.x;
      thief.y = resolved.y;
    }
    thief.trailTimer += dt;
    if (thief.trailTimer >= 0.11) {
      thief.trailTimer = 0;
      thief.trail.push({ x: thief.x, y: thief.y, alpha: 1 });
      if (thief.trail.length > 26) thief.trail.shift();
    }
  }

  for (let i = 0; i < thief.trail.length; i += 1) {
    thief.trail[i].alpha = Math.max(0.18, thief.trail[i].alpha - dt * 0.25);
  }

  thief.inCover = isInAnyCover(thief.x, thief.y, world.covers);

  if (input && input.interactPressed) {
    tryInteract(world);
  }

  // Auto-collect loot when stepping onto pedestal
  for (let i = 0; i < world.loot.length; i += 1) {
    const item = world.loot[i];
    if (!item.collected && Math.hypot(thief.x - item.x, thief.y - item.y) <= THIEF_SPEC.radius + 16) {
      collectLootItem(world, item);
    }
  }

  // Laser tripwires
  for (let i = 0; i < world.lasers.length; i += 1) {
    const las = world.lasers[i];
    if (las.disabledTimer > 0) continue;
    if (pointToSegmentDist(thief.x, thief.y, las.x1, las.y1, las.x2, las.y2) <= THIEF_SPEC.radius + 2) {
      world.alarm = 100;
      world.status = 'caught';
      world.caughtReport = {
        sourceName: 'VAULT LASER',
        sourcePos: { x: (las.x1 + las.x2) * 0.5, y: (las.y1 + las.y2) * 0.5 },
        thiefPos: { x: thief.x, y: thief.y },
        reason: 'Tripped active vault security laser beam; hack the Breaker Room or use EMP.',
        exposureSec: 0.1,
      };
      world.events.push('caught');
      return;
    }
  }

  const prevStatus = world.status;
  updateGuards(world, dt);
  if (world.status === 'playing') {
    updateCameras(world, dt);
  }
  updateToolEffects(world, dt);

  if (world.status === 'caught' && prevStatus !== 'caught') {
    world.events.push('caught');
  }

  // Natural alarm decay when hidden & unspotted (stays elevated once primary loot is lifted)
  const anyoneSpotting = world.guards.some((g) => g.suspicion > 0.12) || world.cameras.some((c) => c.suspicion > 0.12);
  if (world.status === 'playing' && !anyoneSpotting) {
    const minFloor = world.primaryLootTaken ? 42 : 0;
    world.alarm = Math.max(minFloor, world.alarm - 6.5 * dt);
  }
  world.peakAlarm = Math.max(world.peakAlarm, world.alarm);

  // Check extraction once primary relic is secured
  if (world.status === 'playing' && world.primaryLootTaken) {
    const ext = world.blueprint.extraction;
    if (Math.hypot(thief.x - ext.x, thief.y - ext.y) <= ext.r - 4) {
      world.status = 'extracted';
      world.summary = computeHeistScore(world);
      world.events.push('extracted');
    }
  }
}
