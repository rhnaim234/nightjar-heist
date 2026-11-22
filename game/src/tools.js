// Priced tactical tools (Decoy Coin, Smoke Veil, EMP Jammer) plus breaker/vent/loot interactions.

import { TOOL_SPECS, THIEF_SPEC } from './config.js';
import { alertNearestGuard } from './guards.js';

export function createToolInventory() {
  return TOOL_SPECS.map((spec) => ({
    ...spec,
    remaining: spec.charges,
  }));
}

export function selectTool(world, index) {
  if (index >= 0 && index < world.tools.length) {
    world.selectedTool = index;
  }
}

function clampTarget(tx, ty, ox, oy, maxRange) {
  const dx = tx - ox;
  const dy = ty - oy;
  const dist = Math.hypot(dx, dy);
  if (dist <= maxRange || dist < 1e-4) return { x: tx, y: ty };
  const s = maxRange / dist;
  return { x: ox + dx * s, y: oy + dy * s };
}

export function useSelectedTool(world, targetX, targetY) {
  if (world.status !== 'playing') return false;
  const tool = world.tools[world.selectedTool];
  if (!tool || tool.remaining <= 0) return false;

  const { thief } = world;
  const pt = clampTarget(targetX, targetY, thief.x, thief.y, tool.throwRange);
  const clampedX = Math.max(58, Math.min(1222, pt.x));
  const clampedY = Math.max(94, Math.min(618, pt.y));

  tool.remaining -= 1;
  world.toolSpend += tool.cost;
  world.toolsUsedCount += 1;

  world.floatingTexts.push({
    x: clampedX,
    y: clampedY - 22,
    text: `-$${(tool.cost / 1000).toFixed(0)}K ${tool.shortName}`,
    color: tool.color,
    life: 1.5,
    maxLife: 1.5,
  });

  if (tool.id === 'coin') {
    world.soundRipples.push({
      x: clampedX,
      y: clampedY,
      radius: 14,
      maxRadius: tool.hearRadius,
      life: 1.4,
      maxLife: 1.4,
      color: tool.color,
      label: 'COIN CLINK',
    });
    for (let i = 0; i < world.guards.length; i += 1) {
      const g = world.guards[i];
      if (Math.hypot(g.x - clampedX, g.y - clampedY) <= tool.hearRadius) {
        g.investigateTarget = { x: clampedX, y: clampedY };
        g.investigateTimer = tool.duration;
        if (g.state === 'patrol') g.state = 'investigate';
      }
    }
    world.events.push('coin');
    return true;
  }

  if (tool.id === 'smoke') {
    world.smokeClouds.push({
      x: clampedX,
      y: clampedY,
      radius: tool.cloudRadius,
      life: tool.duration,
      maxLife: tool.duration,
    });
    world.events.push('smoke');
    return true;
  }

  if (tool.id === 'emp') {
    world.empPulses.push({
      x: clampedX,
      y: clampedY,
      radius: tool.empRadius,
      life: 1.15,
      maxLife: 1.15,
    });
    for (let i = 0; i < world.cameras.length; i += 1) {
      const c = world.cameras[i];
      if (Math.hypot(c.x - clampedX, c.y - clampedY) <= tool.empRadius) {
        c.jamTimer = Math.max(c.jamTimer, tool.duration);
        c.suspicion = 0;
      }
    }
    for (let i = 0; i < world.lasers.length; i += 1) {
      const l = world.lasers[i];
      const mx = (l.x1 + l.x2) * 0.5;
      const my = (l.y1 + l.y2) * 0.5;
      if (Math.hypot(mx - clampedX, my - clampedY) <= tool.empRadius) {
        l.disabledTimer = Math.max(l.disabledTimer, tool.duration);
      }
    }
    world.events.push('emp');
    return true;
  }
  return false;
}

export function tryInteract(world) {
  if (world.status !== 'playing') return false;
  const { thief } = world;

  // 1. Check nearby uncollected loot first
  for (let i = 0; i < world.loot.length; i += 1) {
    const item = world.loot[i];
    if (!item.collected && Math.hypot(item.x - thief.x, item.y - thief.y) <= THIEF_SPEC.interactRadius + 8) {
      collectLootItem(world, item);
      return true;
    }
  }

  // 2. Check security breaker panels
  for (let i = 0; i < world.breakers.length; i += 1) {
    const brk = world.breakers[i];
    if (Math.hypot(brk.x - thief.x, brk.y - thief.y) <= THIEF_SPEC.interactRadius + 6) {
      brk.tripped = true;
      brk.cooldown = brk.duration;
      for (const cam of world.cameras) {
        if (brk.targetCameras.includes(cam.id)) {
          cam.breakerOffTimer = brk.duration;
          cam.suspicion = 0;
        }
      }
      for (const las of world.lasers) {
        if (brk.targetLasers.includes(las.id)) {
          las.disabledTimer = brk.duration;
        }
      }
      world.floatingTexts.push({
        x: brk.x,
        y: brk.y - 22,
        text: `BREAKER HACKED (${brk.duration}s)`,
        color: '#3ae3d7',
        life: 1.8,
        maxLife: 1.8,
      });
      world.events.push('hack');
      return true;
    }
  }

  // 3. Check linked ventilation grates
  if (thief.ventCooldown <= 0) {
    for (let i = 0; i < world.vents.length; i += 1) {
      const vent = world.vents[i];
      if (Math.hypot(vent.x - thief.x, vent.y - thief.y) <= THIEF_SPEC.interactRadius) {
        const dest = world.vents.find((v) => v.id === vent.pair);
        if (dest) {
          thief.x = dest.x;
          thief.y = dest.y;
          thief.ventCooldown = 1.0;
          thief.trail.push({ x: dest.x, y: dest.y, alpha: 1 });
          world.floatingTexts.push({
            x: dest.x,
            y: dest.y - 22,
            text: `VENT ${vent.tag}`,
            color: vent.color,
            life: 1.2,
            maxLife: 1.2,
          });
          world.events.push('vent');
          return true;
        }
      }
    }
  }
  return false;
}

export function collectLootItem(world, item) {
  if (item.collected) return;
  item.collected = true;
  world.lootTotal += item.value;
  if (item.primary) {
    world.primaryLootTaken = true;
    world.alarm = Math.max(world.alarm, 38);
    alertNearestGuard(world, item.x, item.y);
    world.floatingTexts.push({
      x: item.x,
      y: item.y - 28,
      text: `ESCAPE OPEN! +$${(item.value / 1000).toFixed(0)}K`,
      color: '#3be39b',
      life: 2.2,
      maxLife: 2.2,
    });
  } else {
    world.floatingTexts.push({
      x: item.x,
      y: item.y - 24,
      text: `+$${(item.value / 1000).toFixed(0)}K`,
      color: '#f5c451',
      life: 1.6,
      maxLife: 1.6,
    });
  }
  world.events.push('loot');
}

export function updateToolEffects(world, dt) {
  for (let i = world.smokeClouds.length - 1; i >= 0; i -= 1) {
    world.smokeClouds[i].life -= dt;
    if (world.smokeClouds[i].life <= 0) world.smokeClouds.splice(i, 1);
  }
  for (let i = world.soundRipples.length - 1; i >= 0; i -= 1) {
    const r = world.soundRipples[i];
    r.life -= dt;
    const progress = 1 - r.life / r.maxLife;
    r.radius = 14 + (r.maxRadius - 14) * Math.min(1, progress * 1.45);
    if (r.life <= 0) world.soundRipples.splice(i, 1);
  }
  for (let i = world.empPulses.length - 1; i >= 0; i -= 1) {
    world.empPulses[i].life -= dt;
    if (world.empPulses[i].life <= 0) world.empPulses.splice(i, 1);
  }
  for (let i = world.floatingTexts.length - 1; i >= 0; i -= 1) {
    const f = world.floatingTexts[i];
    f.life -= dt;
    f.y -= 18 * dt;
    if (f.life <= 0) world.floatingTexts.splice(i, 1);
  }
  for (let i = 0; i < world.breakers.length; i += 1) {
    if (world.breakers[i].cooldown > 0) {
      world.breakers[i].cooldown = Math.max(0, world.breakers[i].cooldown - dt);
    }
  }
  for (let i = 0; i < world.lasers.length; i += 1) {
    if (world.lasers[i].disabledTimer > 0) {
      world.lasers[i].disabledTimer = Math.max(0, world.lasers[i].disabledTimer - dt);
    }
  }
}
