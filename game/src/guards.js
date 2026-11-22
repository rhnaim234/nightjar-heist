// Guard patrol, investigation, pursuit AI and swivel CCTV camera detection logic.

import { angleDiff, computeVisionPolygon, hasClearSightline, normalizeAngle, pointInVisionCone } from './vision.js';

function turnToward(current, target, maxStep) {
  const diff = angleDiff(target, current);
  if (Math.abs(diff) <= maxStep) return normalizeAngle(target);
  return normalizeAngle(current + Math.sign(diff) * maxStep);
}

function pointBlockedByWalls(x, y, radius, walls) {
  for (let i = 0; i < walls.length; i += 1) {
    const w = walls[i];
    const cx = Math.max(w.x, Math.min(x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(y, w.y + w.h));
    if (Math.hypot(x - cx, y - cy) < radius) return true;
  }
  return false;
}

function moveGuardToward(guard, tx, ty, speed, dt, walls) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return true;

  const angle = Math.atan2(dy, dx);
  guard.angle = turnToward(guard.angle, angle, 5.2 * dt);

  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  if (!pointBlockedByWalls(nx, guard.y, 13, walls)) guard.x = nx;
  if (!pointBlockedByWalls(guard.x, ny, 13, walls)) guard.y = ny;
  return dist <= step + 4;
}

export function initializeGuards(blueprint) {
  return blueprint.guards.map((g) => {
    const i0 = g.startWp % g.waypoints.length;
    const i1 = (i0 + 1) % g.waypoints.length;
    const a = g.waypoints[i0];
    const b = g.waypoints[i1];
    const p = g.startProgress ?? 0;
    const x = a.x + (b.x - a.x) * p;
    const y = a.y + (b.y - a.y) * p;
    return {
      id: g.id,
      name: g.name,
      x,
      y,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      speed: g.speed,
      range: g.range,
      halfFov: g.halfFov,
      waypoints: g.waypoints,
      wpIndex: i1,
      state: 'patrol',
      suspicion: 0,
      pauseTimer: 0,
      investigateTarget: null,
      investigateTimer: 0,
      alertTimer: 0,
      exposureSec: 0,
      conePoints: [],
    };
  });
}

export function initializeCameras(blueprint) {
  return blueprint.cameras.map((c) => ({
    id: c.id,
    label: c.label,
    x: c.x,
    y: c.y,
    baseAngle: c.baseAngle,
    angle: c.baseAngle + Math.sin(c.phase ?? 0) * c.sweepHalf,
    sweepHalf: c.sweepHalf,
    speed: c.speed,
    phase: c.phase ?? 0,
    range: c.range,
    halfFov: c.halfFov,
    jamTimer: 0,
    breakerOffTimer: 0,
    suspicion: 0,
    conePoints: [],
  }));
}

export function alertNearestGuard(world, tx, ty) {
  let closest = null;
  let bestDist = Infinity;
  for (let i = 0; i < world.guards.length; i += 1) {
    const g = world.guards[i];
    const d = Math.hypot(g.x - tx, g.y - ty);
    if (d < bestDist) {
      bestDist = d;
      closest = g;
    }
  }
  if (closest) {
    closest.investigateTarget = { x: tx, y: ty };
    closest.investigateTimer = Math.max(closest.investigateTimer, 5.5);
    if (closest.state === 'patrol') closest.state = 'investigate';
  }
}

export function updateGuards(world, dt) {
  const { thief, walls, smokeClouds } = world;
  const getawayBoost = world.primaryLootTaken ? 1.18 : 1.0;

  for (let i = 0; i < world.guards.length; i += 1) {
    const g = world.guards[i];
    const effectiveRange = thief.inCover ? g.range * 0.72 : g.range;
    const sight = pointInVisionCone(thief.x, thief.y, g.x, g.y, g.angle, g.halfFov, effectiveRange, walls, smokeClouds);

    // Direct close-range touch or un-smoked proximity alert
    const distToThief = Math.hypot(thief.x - g.x, thief.y - g.y);
    const bodyContact = distToThief < 25 && hasClearSightline(g.x, g.y, thief.x, thief.y, walls, smokeClouds);

    if (sight.visible || bodyContact) {
      const coverScale = thief.inCover ? 0.56 : 1.0;
      const gainRate = (bodyContact ? 3.2 : 1.35 * sight.factor * coverScale) * getawayBoost;
      g.suspicion = Math.min(1, g.suspicion + gainRate * dt);
      g.exposureSec += dt;
      g.investigateTarget = { x: thief.x, y: thief.y };
      g.investigateTimer = 4.5;

      if (g.suspicion >= 0.99 || bodyContact) {
        g.state = 'alert';
        g.alertTimer = 6.0;
        world.alarm = Math.min(100, world.alarm + 42 * dt);
        if (world.alarm >= 99.5 || distToThief < 32) {
          world.alarm = 100;
          world.status = 'caught';
          world.caughtReport = {
            sourceName: g.name,
            sourcePos: { x: g.x, y: g.y },
            thiefPos: { x: thief.x, y: thief.y },
            reason: bodyContact
              ? `Walked directly into ${g.name}'s line of sight at close quarters.`
              : `Spotted crossing open floor inside ${g.name}'s vision cone until alarm hit 100%.`,
            exposureSec: Math.max(0.4, g.exposureSec),
          };
        }
      } else if (g.suspicion >= 0.25 && g.state === 'patrol') {
        g.state = 'investigate';
      }
      world.alarm = Math.max(world.alarm, Math.min(95, g.suspicion * 72));
    } else {
      g.suspicion = Math.max(0, g.suspicion - 0.34 * dt);
      if (g.state === 'alert') {
        g.alertTimer -= dt;
        if (g.alertTimer <= 0) {
          g.state = 'investigate';
          g.investigateTimer = 4.0;
        }
      }
    }

    // Movement behavior
    if (g.state === 'alert' && g.investigateTarget) {
      moveGuardToward(g, g.investigateTarget.x, g.investigateTarget.y, g.speed * 1.42 * getawayBoost, dt, walls);
    } else if (g.state === 'investigate' && g.investigateTarget) {
      const arrived = moveGuardToward(g, g.investigateTarget.x, g.investigateTarget.y, g.speed * 1.12, dt, walls);
      if (arrived) {
        g.angle = normalizeAngle(g.angle + Math.sin(world.elapsed * 3.1 + i) * 1.8 * dt);
      }
      g.investigateTimer -= dt;
      if (g.investigateTimer <= 0) {
        g.state = 'patrol';
        g.investigateTarget = null;
      }
    } else {
      if (g.pauseTimer > 0) {
        g.pauseTimer -= dt;
        g.angle = normalizeAngle(g.angle + Math.sin(world.elapsed * 2.2 + i) * 0.9 * dt);
      } else {
        const wp = g.waypoints[g.wpIndex];
        const arrived = moveGuardToward(g, wp.x, wp.y, g.speed * getawayBoost, dt, walls);
        if (arrived) {
          g.wpIndex = (g.wpIndex + 1) % g.waypoints.length;
          g.pauseTimer = 0.45;
        }
      }
    }

    g.conePoints = computeVisionPolygon(g.x, g.y, g.angle, g.halfFov, g.range, walls, smokeClouds, 34);
  }
}

export function updateCameras(world, dt) {
  const { thief, walls, smokeClouds } = world;
  for (let i = 0; i < world.cameras.length; i += 1) {
    const cam = world.cameras[i];
    if (cam.jamTimer > 0) cam.jamTimer = Math.max(0, cam.jamTimer - dt);
    if (cam.breakerOffTimer > 0) cam.breakerOffTimer = Math.max(0, cam.breakerOffTimer - dt);

    const active = cam.jamTimer <= 0 && cam.breakerOffTimer <= 0;
    if (!active) {
      cam.suspicion = Math.max(0, cam.suspicion - 0.8 * dt);
      cam.conePoints = [];
      continue;
    }

    cam.phase += cam.speed * dt;
    cam.angle = cam.baseAngle + Math.sin(cam.phase) * cam.sweepHalf;
    cam.conePoints = computeVisionPolygon(cam.x, cam.y, cam.angle, cam.halfFov, cam.range, walls, smokeClouds, 26);

    const sight = pointInVisionCone(thief.x, thief.y, cam.x, cam.y, cam.angle, cam.halfFov, cam.range, walls, smokeClouds);
    if (sight.visible) {
      const coverScale = thief.inCover ? 0.5 : 1.0;
      cam.suspicion = Math.min(1, cam.suspicion + 1.15 * sight.factor * coverScale * dt);
      world.alarm = Math.min(100, world.alarm + 28 * sight.factor * coverScale * dt);
      if (cam.suspicion > 0.45) {
        alertNearestGuard(world, thief.x, thief.y);
      }
      if (world.alarm >= 99.5) {
        world.alarm = 100;
        world.status = 'caught';
        world.caughtReport = {
          sourceName: cam.label,
          sourcePos: { x: cam.x, y: cam.y },
          thiefPos: { x: thief.x, y: thief.y },
          reason: `${cam.label} tracked you across the gallery floor and triggered building lockdown.`,
          exposureSec: 1.1,
        };
      }
    } else {
      cam.suspicion = Math.max(0, cam.suspicion - 0.45 * dt);
    }
  }
}
