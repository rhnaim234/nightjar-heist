// High-craft 2.5D architectural cutaway renderer: marble floors, indigo cover, cyan vents,
// raycast vision cones, wall cameras, gold relics, tactical HUD, and compact debrief cards.

import { ALARM_STATES, PALETTE, THIEF_SPEC, VIEWPORT } from './config.js';
import { getAlarmLabel } from './world.js';

const FONT_UI = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_MONO = 'ui-monospace, "Cascadia Mono", Consolas, monospace';

function fmtMoney(amount) {
  return `$${amount.toLocaleString('en-US')}`;
}

function fmtMoneyShort(amount) {
  return `$${Math.round(amount / 1000)}K`;
}

function fmtClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawArchitecturalFloor(ctx, world) {
  ctx.fillStyle = PALETTE.backdrop;
  ctx.fillRect(0, 0, VIEWPORT.width, VIEWPORT.height);

  const { blueprint } = world;
  for (const room of blueprint.rooms) {
    ctx.save();
    ctx.fillStyle = room.accent === 'vault' ? PALETTE.carpetVault : PALETTE.floorBase;
    ctx.fillRect(room.x, room.y, room.w, room.h);

    // Alternating terrazzo tiles
    ctx.fillStyle = room.accent === 'vault' ? 'rgba(255, 224, 150, 0.03)' : PALETTE.floorTileAlt;
    const tile = 36;
    for (let tx = room.x; tx < room.x + room.w; tx += tile) {
      for (let ty = room.y; ty < room.y + room.h; ty += tile) {
        if (((Math.floor(tx / tile) + Math.floor(ty / tile)) & 1) === 0) {
          ctx.fillRect(tx, ty, Math.min(tile, room.x + room.w - tx), Math.min(tile, room.y + room.h - ty));
        }
      }
    }

    // Subtle tile grid lines
    ctx.strokeStyle = PALETTE.floorGrid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let tx = room.x; tx <= room.x + room.w; tx += tile) {
      ctx.moveTo(tx, room.y);
      ctx.lineTo(tx, room.y + room.h);
    }
    for (let ty = room.y; ty <= room.y + room.h; ty += tile) {
      ctx.moveTo(room.x, ty);
      ctx.lineTo(room.x + room.w, ty);
    }
    ctx.stroke();

    // Ornate vault inlaid rug & horology compass medallion
    if (room.accent === 'vault') {
      ctx.strokeStyle = PALETTE.carpetBorder;
      ctx.lineWidth = 2;
      ctx.strokeRect(room.x + 18, room.y + 18, room.w - 36, room.h - 36);
    } else if (room.accent === 'terrazzo') {
      const cx = room.x + room.w * 0.5;
      const cy = room.y + room.h * 0.5;
      ctx.strokeStyle = 'rgba(218, 178, 94, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 86, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 62, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Architectural room label
    ctx.fillStyle = 'rgba(198, 214, 240, 0.36)';
    ctx.font = `700 12px ${FONT_UI}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(room.label, room.x + 14, room.y + 10);
    ctx.restore();
  }
}

function drawCoverZonesAndVents(ctx, world) {
  // Deep indigo stealth cover alcoves with crisp teal diagonal hatch
  for (const cov of world.covers) {
    ctx.save();
    roundRectPath(ctx, cov.x, cov.y, cov.w, cov.h, 6);
    ctx.fillStyle = PALETTE.coverFill;
    ctx.fill();
    ctx.clip();

    ctx.strokeStyle = PALETTE.coverHatch;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let d = -cov.h; d < cov.w + cov.h; d += 12) {
      ctx.moveTo(cov.x + d, cov.y);
      ctx.lineTo(cov.x + d - cov.h, cov.y + cov.h);
    }
    ctx.stroke();
    ctx.restore();

    ctx.save();
    roundRectPath(ctx, cov.x, cov.y, cov.w, cov.h, 6);
    ctx.strokeStyle = PALETTE.coverBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = 'rgba(58, 212, 198, 0.78)';
    ctx.font = `700 10px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('COVER', cov.x + cov.w * 0.5, cov.y + cov.h - 11);
    ctx.restore();
  }

  // Vent duct routing paths connecting paired grates
  const drawnPairs = new Set();
  for (const v of world.vents) {
    const pairKey = [v.id, v.pair].sort().join(':');
    if (!drawnPairs.has(pairKey)) {
      drawnPairs.add(pairKey);
      const other = world.vents.find((item) => item.id === v.pair);
      if (other) {
        ctx.save();
        ctx.strokeStyle = v.color;
        ctx.globalAlpha = 0.34;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([7, 7]);
        ctx.beginPath();
        const midY = v.y < 240 ? 77 : 616;
        ctx.moveTo(v.x, v.y);
        ctx.lineTo(v.x, midY);
        ctx.lineTo(other.x, midY);
        ctx.lineTo(other.x, other.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Power conduits linking breakers to cameras & lasers
  for (const brk of world.breakers) {
    const activeBreaker = brk.cooldown <= 0;
    ctx.save();
    ctx.strokeStyle = activeBreaker ? 'rgba(245, 166, 66, 0.4)' : 'rgba(58, 227, 215, 0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    for (const camId of brk.targetCameras) {
      const cam = world.cameras.find((c) => c.id === camId);
      if (cam) {
        ctx.beginPath();
        ctx.moveTo(brk.x, brk.y);
        ctx.lineTo(cam.x, brk.y);
        ctx.lineTo(cam.x, cam.y);
        ctx.stroke();
      }
    }
    for (const lasId of brk.targetLasers) {
      const las = world.lasers.find((l) => l.id === lasId);
      if (las) {
        ctx.beginPath();
        ctx.moveTo(brk.x, brk.y);
        ctx.lineTo(las.x1, (las.y1 + las.y2) * 0.5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Render vent grates
  for (const v of world.vents) {
    ctx.save();
    roundRectPath(ctx, v.x - 16, v.y - 14, 32, 28, 5);
    ctx.fillStyle = '#122632';
    ctx.fill();
    ctx.strokeStyle = v.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = v.color;
    ctx.lineWidth = 1.5;
    for (let gy = -6; gy <= 6; gy += 6) {
      ctx.beginPath();
      ctx.moveTo(v.x - 10, v.y + gy);
      ctx.lineTo(v.x + 10, v.y + gy);
      ctx.stroke();
    }

    ctx.fillStyle = v.color;
    ctx.font = `700 9px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`VENT ${v.tag}`, v.x, v.y + 17);
    ctx.restore();
  }

  // Render security breaker panels
  for (const brk of world.breakers) {
    const off = brk.cooldown > 0;
    ctx.save();
    roundRectPath(ctx, brk.x - 17, brk.y - 15, 34, 30, 5);
    ctx.fillStyle = off ? '#153433' : '#352218';
    ctx.fill();
    ctx.strokeStyle = off ? '#3ae3d7' : '#f5a642';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bolt symbol
    ctx.fillStyle = off ? '#3ae3d7' : '#ffd166';
    ctx.beginPath();
    ctx.moveTo(brk.x + 2, brk.y - 9);
    ctx.lineTo(brk.x - 5, brk.y + 1);
    ctx.lineTo(brk.x + 1, brk.y + 1);
    ctx.lineTo(brk.x - 2, brk.y + 9);
    ctx.lineTo(brk.x + 6, brk.y - 1);
    ctx.lineTo(brk.x, brk.y - 1);
    ctx.closePath();
    ctx.fill();

    ctx.font = `700 10px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = off ? '#3ae3d7' : '#ffd166';
    ctx.fillText(off ? `HACKED ${brk.cooldown.toFixed(0)}s` : '[E] BREAKER', brk.x, brk.y - 18);
    ctx.restore();
  }
}

function drawExtrudedWalls(ctx, world) {
  const depth = 8;
  // Soft drop shadows
  ctx.save();
  ctx.fillStyle = PALETTE.wallShadow;
  for (const w of world.walls) {
    ctx.fillRect(w.x + 6, w.y + 8, w.w, w.h);
  }
  ctx.restore();

  for (const w of world.walls) {
    if (w.kind === 'vitrine') {
      ctx.save();
      ctx.fillStyle = PALETTE.vitrineGlass;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = PALETTE.vitrineEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
      ctx.fillStyle = 'rgba(200, 240, 255, 0.28)';
      ctx.fillRect(w.x + 6, w.y + 6, w.w - 12, 4);
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = PALETTE.wallFront;
      ctx.fillRect(w.x, w.y + 3, w.w, w.h + depth * 0.5);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = PALETTE.wallTrim;
      ctx.lineWidth = 1;
      ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
      ctx.restore();
    }
  }
}

function drawLasersAndCameras(ctx, world) {
  // Lasers
  for (const las of world.lasers) {
    const active = las.disabledTimer <= 0;
    ctx.save();
    // Emitters
    ctx.fillStyle = '#242b38';
    ctx.fillRect(las.x1 - 5, las.y1 - 4, 10, 8);
    ctx.fillRect(las.x2 - 5, las.y2 - 4, 10, 8);

    if (active) {
      ctx.strokeStyle = 'rgba(255, 68, 85, 0.36)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(las.x1, las.y1);
      ctx.lineTo(las.x2, las.y2);
      ctx.stroke();

      ctx.strokeStyle = PALETTE.laserActive;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(las.x1, las.y1);
      ctx.lineTo(las.x2, las.y2);
      ctx.stroke();

      ctx.fillStyle = '#ff8592';
      ctx.font = `700 10px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText('LASER', las.x1 + 26, (las.y1 + las.y2) * 0.5);
    } else {
      ctx.strokeStyle = 'rgba(58, 227, 215, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(las.x1, las.y1);
      ctx.lineTo(las.x2, las.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Cameras & raycast cones
  for (const cam of world.cameras) {
    const disabled = cam.jamTimer > 0 || cam.breakerOffTimer > 0;
    if (!disabled && cam.conePoints.length >= 3) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cam.conePoints[0].x, cam.conePoints[0].y);
      for (let i = 1; i < cam.conePoints.length; i += 1) {
        ctx.lineTo(cam.conePoints[i].x, cam.conePoints[i].y);
      }
      ctx.closePath();

      const grad = ctx.createRadialGradient(cam.x, cam.y, 12, cam.x, cam.y, cam.range);
      if (cam.suspicion > 0.25) {
        grad.addColorStop(0, 'rgba(255, 62, 62, 0.45)');
        grad.addColorStop(1, 'rgba(255, 62, 62, 0.08)');
        ctx.strokeStyle = PALETTE.coneAlertEdge;
      } else {
        grad.addColorStop(0, 'rgba(248, 114, 86, 0.34)');
        grad.addColorStop(1, 'rgba(248, 114, 86, 0.05)');
        ctx.strokeStyle = PALETTE.cameraEdge;
      }
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }

    // Camera wall housing
    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.rotate(cam.angle);
    ctx.fillStyle = '#1b2230';
    ctx.strokeStyle = disabled ? '#6bb8ff' : '#e2e8f4';
    ctx.lineWidth = 1.8;
    roundRectPath(ctx, -10, -8, 22, 16, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = disabled ? '#6bb8ff' : Math.floor(world.elapsed * 4) % 2 === 0 ? '#ff4d5a' : '#ff9f43';
    ctx.beginPath();
    ctx.arc(8, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Camera label pill
    ctx.save();
    const labelText = disabled
      ? `${cam.label} OFF ${Math.max(cam.jamTimer, cam.breakerOffTimer).toFixed(1)}s`
      : cam.label;
    ctx.font = `700 10px ${FONT_MONO}`;
    const labelW = ctx.measureText(labelText).width + 12;
    const lx = Math.min(VIEWPORT.width - labelW - 58, Math.max(58, cam.x - labelW * 0.5));
    const ly = cam.y < 140 ? cam.y + 14 : cam.y - 28;
    roundRectPath(ctx, lx, ly, labelW, 18, 4);
    ctx.fillStyle = disabled ? 'rgba(21, 52, 78, 0.92)' : 'rgba(26, 20, 26, 0.88)';
    ctx.fill();
    ctx.strokeStyle = disabled ? '#6bb8ff' : '#ff7b66';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = disabled ? '#9cd4ff' : '#ffb4a6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, lx + labelW * 0.5, ly + 9);
    ctx.restore();
  }
}

function drawGuardVisionConesAndGuards(ctx, world) {
  // Patrol paths first (stronger during recon right-click)
  for (const g of world.guards) {
    if (g.waypoints.length < 2) continue;
    ctx.save();
    ctx.strokeStyle = world.reconActive ? 'rgba(245, 196, 81, 0.5)' : 'rgba(245, 196, 81, 0.2)';
    ctx.lineWidth = world.reconActive ? 2.2 : 1.4;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(g.waypoints[0].x, g.waypoints[0].y);
    for (let i = 1; i < g.waypoints.length; i += 1) {
      ctx.lineTo(g.waypoints[i].x, g.waypoints[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // Raycast vision polygons
  for (const g of world.guards) {
    if (g.conePoints.length < 3) continue;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(g.conePoints[0].x, g.conePoints[0].y);
    for (let i = 1; i < g.conePoints.length; i += 1) {
      ctx.lineTo(g.conePoints[i].x, g.conePoints[i].y);
    }
    ctx.closePath();

    const grad = ctx.createRadialGradient(g.x, g.y, 10, g.x, g.y, g.range);
    if (g.state === 'alert' || g.suspicion >= 0.72) {
      grad.addColorStop(0, 'rgba(255, 72, 72, 0.5)');
      grad.addColorStop(1, 'rgba(255, 72, 72, 0.12)');
      ctx.strokeStyle = PALETTE.coneAlertEdge;
    } else if (g.state === 'investigate' || g.suspicion >= 0.2) {
      grad.addColorStop(0, 'rgba(255, 152, 56, 0.44)');
      grad.addColorStop(1, 'rgba(255, 152, 56, 0.09)');
      ctx.strokeStyle = PALETTE.coneSuspectEdge;
    } else {
      grad.addColorStop(0, 'rgba(248, 206, 98, 0.36)');
      grad.addColorStop(1, 'rgba(248, 206, 98, 0.06)');
      ctx.strokeStyle = PALETTE.coneSafeEdge;
    }
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }

  // Guard avatars
  for (const g of world.guards) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.angle);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.arc(2, 3, 15, 0, Math.PI * 2);
    ctx.fill();

    // Shoulders
    ctx.fillStyle = g.state === 'alert' ? '#8c2328' : '#26344d';
    ctx.strokeStyle = g.state === 'alert' ? '#ff8080' : '#b7c7e2';
    ctx.lineWidth = 1.8;
    roundRectPath(ctx, -10, -14, 19, 28, 7);
    ctx.fill();
    ctx.stroke();

    // Flashlight barrel
    ctx.fillStyle = '#d4af5c';
    ctx.fillRect(8, 3, 10, 5);
    ctx.fillStyle = '#fff5c8';
    ctx.beginPath();
    ctx.arc(18, 5.5, 3, 0, Math.PI * 2);
    ctx.fill();

    // Cap
    ctx.fillStyle = g.state === 'alert' ? '#ef4444' : '#d4af5c';
    ctx.beginPath();
    ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#182132';
    ctx.fillRect(3, -5, 6, 10);
    ctx.restore();

    // Suspicion arc & state icon
    if (g.suspicion > 0.05 || g.state !== 'patrol') {
      ctx.save();
      if (g.suspicion > 0.05) {
        ctx.strokeStyle = g.state === 'alert' ? '#ff4d5a' : '#ffaa44';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(g.x, g.y, 20, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * g.suspicion);
        ctx.stroke();
      }
      const badge = g.state === 'alert' ? '!' : '?';
      ctx.fillStyle = g.state === 'alert' ? '#ff4455' : '#ffb84d';
      ctx.beginPath();
      ctx.arc(g.x, g.y - 26, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0c1018';
      ctx.font = `900 13px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badge, g.x, g.y - 25.5);
      ctx.restore();
    }
  }
}

function drawLootAndExtraction(ctx, world) {
  const ext = world.blueprint.extraction;
  const open = world.primaryLootTaken;
  const pulse = 0.5 + 0.5 * Math.sin(world.elapsed * 4.5);

  // Extraction Skylight
  ctx.save();
  ctx.fillStyle = open ? `rgba(59, 227, 155, ${0.18 + pulse * 0.14})` : 'rgba(59, 227, 155, 0.07)';
  ctx.beginPath();
  ctx.arc(ext.x, ext.y, ext.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = open ? PALETTE.emerald : 'rgba(59, 227, 155, 0.45)';
  ctx.lineWidth = open ? 3 : 1.5;
  ctx.setLineDash(open ? [] : [5, 5]);
  ctx.beginPath();
  ctx.arc(ext.x, ext.y, ext.r, 0, Math.PI * 2);
  ctx.stroke();

  // Skylight architectural lattice
  ctx.setLineDash([]);
  ctx.strokeStyle = open ? 'rgba(59, 227, 155, 0.55)' : 'rgba(59, 227, 155, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(ext.x - 16, ext.y - 16, 32, 32);
  ctx.beginPath();
  ctx.moveTo(ext.x - 16, ext.y);
  ctx.lineTo(ext.x + 16, ext.y);
  ctx.moveTo(ext.x, ext.y - 16);
  ctx.lineTo(ext.x, ext.y + 16);
  ctx.stroke();

  ctx.fillStyle = open ? PALETTE.emerald : 'rgba(154, 232, 198, 0.72)';
  ctx.font = `800 10px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(open ? 'ESCAPE HERE!' : ext.label, ext.x, ext.y + ext.r + 5);
  ctx.restore();

  // Loot items & Astral Orrery pedestal
  for (const item of world.loot) {
    ctx.save();
    if (item.primary) {
      // Ornate clockwork floor medallion beneath primary relic
      ctx.strokeStyle = item.collected ? 'rgba(245, 196, 81, 0.22)' : 'rgba(245, 196, 81, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(item.x, item.y, 44, 0, Math.PI * 2);
      ctx.stroke();

      // Pedestal
      ctx.fillStyle = '#2d2536';
      ctx.strokeStyle = '#d4af5c';
      ctx.lineWidth = 2;
      roundRectPath(ctx, item.x - 20, item.y - 20, 40, 40, 8);
      ctx.fill();
      ctx.stroke();

      if (!item.collected) {
        const glow = ctx.createRadialGradient(item.x, item.y, 4, item.x, item.y, 58);
        glow.addColorStop(0, 'rgba(245, 196, 81, 0.42)');
        glow.addColorStop(1, 'rgba(245, 196, 81, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(item.x, item.y, 58, 0, Math.PI * 2);
        ctx.fill();

        // Bespoke geometric relic art
        ctx.strokeStyle = '#ffe082';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(item.x, item.y, 13, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(item.x, item.y, 17, 6, world.elapsed * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#4de8d8';
        ctx.beginPath();
        ctx.arc(item.x, item.y, 5.5, 0, Math.PI * 2);
        ctx.fill();

        // Crisp value badge
        const tag = `${item.name.toUpperCase()} ${fmtMoneyShort(item.value)}`;
        ctx.font = `800 11px ${FONT_MONO}`;
        const tw = ctx.measureText(tag).width + 14;
        roundRectPath(ctx, item.x - tw * 0.5, item.y + 26, tw, 20, 4);
        ctx.fillStyle = 'rgba(28, 22, 12, 0.92)';
        ctx.fill();
        ctx.strokeStyle = PALETTE.gold;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.fillStyle = '#ffe28a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tag, item.x, item.y + 36);
      } else {
        ctx.fillStyle = 'rgba(245, 196, 81, 0.65)';
        ctx.font = `700 10px ${FONT_MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText('STOLEN', item.x, item.y + 30);
      }
    } else if (!item.collected) {
      // Bonus side relic
      ctx.fillStyle = 'rgba(245, 196, 81, 0.22)';
      ctx.beginPath();
      ctx.arc(item.x, item.y, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f5c451';
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(item.x, item.y - 11);
      ctx.lineTo(item.x + 10, item.y);
      ctx.lineTo(item.x, item.y + 11);
      ctx.lineTo(item.x - 10, item.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffe28a';
      ctx.font = `700 10px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText(`+${fmtMoneyShort(item.value)}`, item.x, item.y + 21);
    }
    ctx.restore();
  }
}

function drawGadgetsAndThief(ctx, world) {
  // Decoy sound ripples
  for (const r of world.soundRipples) {
    const alpha = Math.max(0, r.life / r.maxLife);
    ctx.save();
    ctx.strokeStyle = r.color;
    ctx.globalAlpha = alpha * 0.85;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.4;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius * 0.62, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = Math.min(1, alpha * 1.3);
    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `800 10px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(r.label, r.x, r.y - 12);
    ctx.restore();
  }

  // EMP electric pulses
  for (const emp of world.empPulses) {
    const alpha = Math.max(0, emp.life / emp.maxLife);
    ctx.save();
    ctx.fillStyle = `rgba(107, 184, 255, ${0.14 * alpha})`;
    ctx.strokeStyle = `rgba(107, 184, 255, ${0.88 * alpha})`;
    ctx.lineWidth = 2.4;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.arc(emp.x, emp.y, emp.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(196, 232, 255, ${alpha})`;
    ctx.font = `800 11px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('EMP JAMMING', emp.x, emp.y - emp.radius * 0.45);
    ctx.restore();
  }

  // Smoke Veil clouds (physical raycast blockers!)
  for (const s of world.smokeClouds) {
    const alpha = Math.min(1, s.life / 1.5);
    ctx.save();
    ctx.globalAlpha = 0.86 * alpha;
    const puffs = [
      { ox: 0, oy: 0, r: s.radius },
      { ox: -22, oy: -12, r: s.radius * 0.65 },
      { ox: 24, oy: 10, r: s.radius * 0.62 },
      { ox: 8, oy: -24, r: s.radius * 0.56 },
    ];
    for (const p of puffs) {
      const grad = ctx.createRadialGradient(s.x + p.ox, s.y + p.oy, 6, s.x + p.ox, s.y + p.oy, p.r);
      grad.addColorStop(0, 'rgba(64, 190, 186, 0.72)');
      grad.addColorStop(0.65, 'rgba(30, 62, 86, 0.58)');
      grad.addColorStop(1, 'rgba(20, 32, 48, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(s.x + p.ox, s.y + p.oy, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(82, 220, 208, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b4fff7';
    ctx.font = `800 10px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(`SMOKE ${s.life.toFixed(1)}s`, s.x, s.y - 4);
    ctx.restore();
  }

  // Thief breadcrumb trail
  const { thief } = world;
  if (thief.trail.length > 1) {
    ctx.save();
    for (let i = 0; i < thief.trail.length; i += 1) {
      const pt = thief.trail[i];
      ctx.fillStyle = `rgba(58, 227, 215, ${pt.alpha * 0.35})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Thief operative
  ctx.save();
  ctx.translate(thief.x, thief.y);

  // Loot aura once stolen
  if (world.primaryLootTaken) {
    ctx.strokeStyle = 'rgba(245, 196, 81, 0.85)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Stealth cover halo
  if (thief.inCover || thief.sneaking) {
    ctx.strokeStyle = thief.inCover ? '#3ad4c6' : 'rgba(58, 227, 215, 0.55)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.rotate(thief.angle);
  // Flowing nightjar scarf
  ctx.fillStyle = PALETTE.thiefScarf;
  ctx.beginPath();
  ctx.moveTo(-4, -3);
  ctx.lineTo(-20, -7);
  ctx.lineTo(-16, 2);
  ctx.closePath();
  ctx.fill();

  // Operative hood & shoulders
  ctx.fillStyle = '#192234';
  ctx.strokeStyle = PALETTE.thiefBody;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, THIEF_SPEC.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Goggles visor
  ctx.fillStyle = '#52f2e4';
  ctx.fillRect(5, -5, 5, 3.5);
  ctx.fillRect(5, 1.5, 5, 3.5);
  ctx.restore();

  // Clear THIEF status tag above operative
  ctx.save();
  const tag = world.status === 'caught'
    ? 'EXPOSED!'
    : thief.inCover
      ? 'HIDDEN'
      : world.primaryLootTaken
        ? 'CARRYING LOOT'
        : 'THIEF';
  ctx.font = `800 10px ${FONT_MONO}`;
  const tw = ctx.measureText(tag).width + 10;
  const tagY = world.status === 'caught' ? thief.y + 24 : thief.y - 34;
  roundRectPath(ctx, thief.x - tw * 0.5, tagY, tw, 16, 4);
  ctx.fillStyle = world.status === 'caught'
    ? 'rgba(54, 12, 18, 0.94)'
    : thief.inCover
      ? 'rgba(18, 52, 54, 0.92)'
      : 'rgba(13, 18, 28, 0.9)';
  ctx.fill();
  ctx.strokeStyle = world.status === 'caught'
    ? '#ff5566'
    : thief.inCover
      ? '#3ae3d7'
      : world.primaryLootTaken
        ? PALETTE.gold
        : '#9fb8de';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = world.status === 'caught'
    ? '#ffb8c0'
    : thief.inCover
      ? '#7ffcf0'
      : world.primaryLootTaken
        ? '#ffe28a'
        : '#e8eef8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tag, thief.x, tagY + 8);
  ctx.restore();

  // Fair caught spotlight & exact line-of-sight beam
  if (world.status === 'caught' && world.caughtReport) {
    const rep = world.caughtReport;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 68, 85, 0.42)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(rep.sourcePos.x, rep.sourcePos.y);
    ctx.lineTo(rep.thiefPos.x, rep.thiefPos.y);
    ctx.stroke();

    ctx.strokeStyle = '#ff4455';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(rep.sourcePos.x, rep.sourcePos.y);
    ctx.lineTo(rep.thiefPos.x, rep.thiefPos.y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = '#ff5566';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(rep.thiefPos.x, rep.thiefPos.y, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Tool aiming reticle while playing
  if (world.status === 'playing' && world.pointer) {
    const tool = world.tools[world.selectedTool];
    if (tool && tool.remaining > 0) {
      const dx = world.pointer.x - thief.x;
      const dy = world.pointer.y - thief.y;
      const dist = Math.hypot(dx, dy);
      const scale = dist > tool.throwRange && dist > 1 ? tool.throwRange / dist : 1;
      const tx = thief.x + dx * scale;
      const ty = thief.y + dy * scale;
      ctx.save();
      ctx.strokeStyle = tool.color;
      ctx.globalAlpha = 0.48;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(thief.x, thief.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx, ty, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Floating event popups
  for (const f of world.floatingTexts) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, (f.life / f.maxLife) * 1.4);
    ctx.font = `800 12px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#080b10';
    ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}

function drawTacticalHud(ctx, world) {
  // Top HUD bar
  ctx.save();
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, VIEWPORT.width, VIEWPORT.hudTop);
  ctx.strokeStyle = PALETTE.hudBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, VIEWPORT.hudTop);
  ctx.lineTo(VIEWPORT.width, VIEWPORT.hudTop);
  ctx.stroke();

  // Prominent ALARM METER (Top-Left)
  const alarmPct = Math.round(world.alarm);
  const alarmLabel = getAlarmLabel(world.alarm, world.primaryLootTaken, world.status);
  const alarmColor =
    alarmLabel === ALARM_STATES.LOCKDOWN ? '#ff4455' :
    alarmLabel === ALARM_STATES.PURSUIT ? '#ff7b42' :
    alarmLabel === ALARM_STATES.SUSPICIOUS ? '#f5b841' : '#3be39b';

  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = `800 11px ${FONT_MONO}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('ALARM METER', 28, 10);

  ctx.fillStyle = alarmColor;
  ctx.font = `800 12px ${FONT_MONO}`;
  ctx.fillText(`${alarmPct}% · ${alarmLabel}`, 124, 10);

  // Segmented alarm bar
  const barX = 28;
  const barY = 30;
  const segCount = 12;
  const segW = 20;
  const segGap = 4;
  for (let i = 0; i < segCount; i += 1) {
    const threshold = ((i + 1) / segCount) * 100;
    const filled = world.alarm >= threshold - 4;
    roundRectPath(ctx, barX + i * (segW + segGap), barY, segW, 18, 3);
    ctx.fillStyle = filled ? alarmColor : 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
  }

  // Center Objective & Net Haul
  const netNow = Math.max(0, world.lootTotal - world.toolSpend);
  const primaryItem = world.loot.find((l) => l.primary);
  const objText = world.primaryLootTaken
    ? `GETAWAY: REACH ${world.blueprint.extraction.label}  ·  HAUL ${fmtMoney(netNow)}`
    : `TARGET: ${primaryItem ? primaryItem.name.toUpperCase() : 'RELIC'} (${fmtMoney(world.primaryValue)})`;

  ctx.textAlign = 'center';
  ctx.fillStyle = world.primaryLootTaken ? PALETTE.emerald : PALETTE.gold;
  ctx.font = `800 14px ${FONT_UI}`;
  ctx.fillText(objText, VIEWPORT.width * 0.54, 13);

  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = `600 12px ${FONT_MONO}`;
  ctx.fillText(
    `LOOT ${fmtMoney(world.lootTotal)}   TOOLS -${fmtMoney(world.toolSpend)}   NET ${fmtMoney(netNow)}`,
    VIEWPORT.width * 0.54,
    35,
  );

  // Top-Right Wing & Clock
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.textPrimary;
  ctx.font = `800 13px ${FONT_UI}`;
  ctx.fillText(`NIGHTJAR · ${world.blueprint.code}: ${world.blueprint.name.toUpperCase()}`, VIEWPORT.width - 28, 13);
  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = `700 12px ${FONT_MONO}`;
  ctx.fillText(`TIME ${fmtClock(world.elapsed)}  ·  [TAB] WING  [R] RETRY`, VIEWPORT.width - 28, 35);

  // Bottom Tactical Tool Bar
  const botY = VIEWPORT.height - VIEWPORT.hudBottom;
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, botY, VIEWPORT.width, VIEWPORT.hudBottom);
  ctx.strokeStyle = PALETTE.hudBorder;
  ctx.beginPath();
  ctx.moveTo(0, botY);
  ctx.lineTo(VIEWPORT.width, botY);
  ctx.stroke();

  let tx = 28;
  for (let i = 0; i < world.tools.length; i += 1) {
    const t = world.tools[i];
    const selected = i === world.selectedTool;
    const cardW = 205;
    roundRectPath(ctx, tx, botY + 10, cardW, 48, 7);
    ctx.fillStyle = selected ? 'rgba(42, 54, 78, 0.96)' : 'rgba(20, 26, 36, 0.9)';
    ctx.fill();
    ctx.strokeStyle = selected ? t.color : 'rgba(130, 148, 180, 0.25)';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = t.remaining > 0 ? t.color : '#687387';
    ctx.font = `800 12px ${FONT_MONO}`;
    ctx.fillText(`[${t.key}] ${t.shortName}  -${fmtMoneyShort(t.cost)}`, tx + 10, botY + 17);

    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = `600 11px ${FONT_UI}`;
    ctx.fillText(`${t.hint} · x${t.remaining}`, tx + 10, botY + 36);
    tx += cardW + 14;
  }

  // Bottom-Right Controls Legend
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.textPrimary;
  ctx.font = `700 12px ${FONT_UI}`;
  ctx.fillText('WASD Move · SHIFT Sneak · LEFT CLICK Deploy Tool · RIGHT HOLD Recon · E Hack / Vent', VIEWPORT.width - 28, botY + 19);
  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = `600 11px ${FONT_MONO}`;
  ctx.fillText('COVER = Slow Detection · SMOKE = Blocks Vision · EMP = Kills Cameras & Lasers', VIEWPORT.width - 28, botY + 38);
  ctx.restore();
}

function wrapTextLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawOutcomeCards(ctx, world) {
  if (world.status === 'title') {
    ctx.save();
    roundRectPath(ctx, 56, 368, 396, 238, 12);
    ctx.fillStyle = 'rgba(12, 16, 24, 0.92)';
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 12px ${FONT_MONO}`;
    ctx.fillText(`${world.blueprint.code} · ARCHITECTURAL HEIST`, 78, 390);

    ctx.fillStyle = PALETTE.textPrimary;
    ctx.font = `900 32px ${FONT_UI}`;
    ctx.fillText('NIGHTJAR', 78, 412);

    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = `600 13px ${FONT_UI}`;
    ctx.fillText(world.blueprint.name, 78, 452);
    ctx.fillText('Read the cones. Pick a route. Watch your spend.', 78, 474);
    ctx.fillText('• Vents & Cover Alcoves bypass open sightlines', 78, 502);
    ctx.fillText('• Coin, Smoke & EMP deduct from final payout', 78, 522);

    roundRectPath(ctx, 78, 548, 250, 40, 8);
    ctx.fillStyle = PALETTE.gold;
    ctx.fill();
    ctx.fillStyle = '#11151d';
    ctx.font = `900 14px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPACE / CLICK TO BEGIN HEIST', 203, 568);
    ctx.restore();
    return;
  }

  if (world.status === 'caught' && world.caughtReport) {
    const rep = world.caughtReport;
    ctx.save();
    roundRectPath(ctx, 56, 376, 336, 232, 12);
    ctx.fillStyle = 'rgba(20, 12, 16, 0.94)';
    ctx.fill();
    ctx.strokeStyle = '#ff4d5a';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ff5a67';
    ctx.font = `800 12px ${FONT_MONO}`;
    ctx.fillText('LOCKDOWN TRIGGERED · EXPOSED 100%', 74, 396);

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 28px ${FONT_UI}`;
    ctx.fillText('CAUGHT', 74, 416);

    ctx.fillStyle = '#ffb4bc';
    ctx.font = `700 13px ${FONT_UI}`;
    ctx.fillText(`Detected by: ${rep.sourceName} (${rep.exposureSec.toFixed(1)}s exposure)`, 74, 456);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = `600 12px ${FONT_UI}`;
    const wrapped = wrapTextLines(ctx, rep.reason, 298);
    wrapped.slice(0, 2).forEach((ln, idx) => {
      ctx.fillText(ln, 74, 482 + idx * 18);
    });
    ctx.fillStyle = '#9aa6ba';
    ctx.fillText('Tip: Use Cover, Smoke Veil [2], or Decoy Coin [1].', 74, 526);

    roundRectPath(ctx, 74, 554, 210, 38, 7);
    ctx.fillStyle = '#ff4d5a';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 13px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('[R] OR SPACE · RETRY WING', 179, 573);
    ctx.restore();
    return;
  }

  if (world.status === 'extracted' && world.summary) {
    const s = world.summary;
    ctx.save();
    roundRectPath(ctx, 58, 352, 366, 258, 12);
    ctx.fillStyle = 'rgba(11, 22, 20, 0.94)';
    ctx.fill();
    ctx.strokeStyle = PALETTE.emerald;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = PALETTE.emerald;
    ctx.font = `800 12px ${FONT_MONO}`;
    ctx.fillText(`EXTRACTION COMPLETE · ${fmtClock(world.elapsed)}`, 80, 372);

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 26px ${FONT_UI}`;
    ctx.fillText('HEIST CLEARED', 80, 392);

    // Rank badge
    roundRectPath(ctx, 354, 372, 48, 48, 8);
    ctx.fillStyle = PALETTE.gold;
    ctx.fill();
    ctx.fillStyle = '#11151d';
    ctx.font = `900 26px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.rank, 378, 396);

    // Itemized ledger
    const rows = [
      ['Stolen Loot', fmtMoney(s.grossLoot), '#f5c451'],
      ['Tool Expenses', `-${fmtMoney(s.toolCost)}`, '#ff9b70'],
      ['Stealth Bonus', `+${fmtMoney(s.stealthBonus)}`, '#3ae3d7'],
      ['Speed Bonus', `+${fmtMoney(s.speedBonus)}`, '#7dd3fc'],
    ];
    ctx.textBaseline = 'top';
    let ry = 434;
    for (const [label, val, col] of rows) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `600 13px ${FONT_UI}`;
      ctx.fillText(label, 80, ry);
      ctx.textAlign = 'right';
      ctx.fillStyle = col;
      ctx.font = `700 13px ${FONT_MONO}`;
      ctx.fillText(val, 402, ry);
      ry += 22;
    }

    ctx.strokeStyle = 'rgba(59, 227, 155, 0.35)';
    ctx.beginPath();
    ctx.moveTo(80, ry + 4);
    ctx.lineTo(402, ry + 4);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 15px ${FONT_UI}`;
    ctx.fillText('NET PAYOUT', 80, ry + 12);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.emerald;
    ctx.font = `900 16px ${FONT_MONO}`;
    ctx.fillText(fmtMoney(s.netPayout), 402, ry + 12);

    roundRectPath(ctx, 80, 560, 236, 36, 7);
    ctx.fillStyle = PALETTE.emerald;
    ctx.fill();
    ctx.fillStyle = '#091511';
    ctx.font = `900 13px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPACE · NEXT WING  |  [R] REPLAY', 198, 578);
    ctx.restore();
  }
}

export function renderHeistFrame(ctx, world) {
  drawArchitecturalFloor(ctx, world);
  drawCoverZonesAndVents(ctx, world);
  drawExtrudedWalls(ctx, world);
  drawLootAndExtraction(ctx, world);
  drawLasersAndCameras(ctx, world);
  drawGuardVisionConesAndGuards(ctx, world);
  drawGadgetsAndThief(ctx, world);
  drawTacticalHud(ctx, world);
  drawOutcomeCards(ctx, world);
}
