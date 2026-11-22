// Deterministic live-engine screenshot staging (?shot=cover|tools|caught|getaway)
// Every screenshot runs the real simulation and controls forward from Wing II's fresh state.

import { FIXED_DT } from './config.js';
import { selectTool, tryInteract, useSelectedTool } from './tools.js';
import { createHeistWorld, stepHeistWorld } from './world.js';

function steerToward(world, tx, ty, maxSteps, opts = {}) {
  for (let i = 0; i < maxSteps; i += 1) {
    if (world.status !== 'playing') break;
    const dx = tx - world.thief.x;
    const dy = ty - world.thief.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= (opts.stopRadius ?? 8)) break;
    stepHeistWorld(
      world,
      {
        moveX: dx / dist,
        moveY: dy / dist,
        sneak: Boolean(opts.sneak),
        recon: Boolean(opts.recon),
        interactPressed: false,
        pointerX: opts.pointerX ?? tx,
        pointerY: opts.pointerY ?? ty,
      },
      FIXED_DT,
    );
  }
}

function waitTicks(world, ticks, pointerX = 640, pointerY = 340, recon = false) {
  for (let i = 0; i < ticks; i += 1) {
    stepHeistWorld(
      world,
      { moveX: 0, moveY: 0, sneak: true, recon, interactPressed: false, pointerX, pointerY },
      FIXED_DT,
    );
  }
}

export function stageScreenshotScene(shotName, wingIndex = 1, seed = 1) {
  const world = createHeistWorld(wingIndex, seed, true);

  if (shotName === 'tools') {
    // Advance through central foyer archway into Horology Hall, deploy Smoke Veil, EMP Jammer, and Decoy Coin
    steerToward(world, 290, 372, 160);
    steerToward(world, 412, 372, 95);
    selectTool(world, 2); // EMP Jammer
    useSelectedTool(world, 642, 296); // Jams CAM-01 while keeping popup clear of wall label
    selectTool(world, 1); // Smoke Veil
    useSelectedTool(world, 488, 368); // Deploys smoke cloud occluding central lane
    selectTool(world, 0); // Decoy Coin
    useSelectedTool(world, 648, 442); // Lures Hall Guard to investigate
    waitTicks(world, 22, 648, 442, true);
    return world;
  }

  if (shotName === 'caught') {
    // Slip into central gallery and stand openly inside center-east Horology Hall until Hall Guard locks on
    steerToward(world, 292, 370, 160);
    steerToward(world, 608, 344, 210);
    waitTicks(world, 420, 608, 250, false);
    if (world.status === 'playing') {
      for (let i = 0; i < 360 && world.status === 'playing'; i += 1) {
        const g = world.guards[0];
        const aimX = Math.min(700, Math.max(550, g.x + Math.cos(g.angle) * 100));
        const aimY = Math.min(460, Math.max(240, g.y + Math.sin(g.angle) * 100));
        const dx = aimX - world.thief.x;
        const dy = aimY - world.thief.y;
        const d = Math.hypot(dx, dy);
        stepHeistWorld(
          world,
          {
            moveX: d > 6 ? dx / d : 0,
            moveY: d > 6 ? dy / d : 0,
            sneak: false,
            recon: false,
            interactPressed: false,
            pointerX: aimX,
            pointerY: aimY,
          },
          FIXED_DT,
        );
      }
    }
    return world;
  }

  if (shotName === 'getaway') {
    // Full authentic run: sneak north to Vent V1 -> warp to North Vault ->
    // Smoke Veil blocks Sentinel north line, EMP jams CAM-02, Decoy Coin pulls Sentinel south ->
    // steal Sapphire & Astral Orrery -> sprint back via Vent V1 -> Skylight Exit!
    steerToward(world, 238, 122, 260, { sneak: true });
    tryInteract(world); // Vent V1 -> (966, 130)
    selectTool(world, 1);
    useSelectedTool(world, 985, 210); // Smoke Veil shields Vent V1 from Sentinel
    selectTool(world, 2);
    useSelectedTool(world, 1185, 250); // EMP jams CAM-02
    selectTool(world, 0);
    useSelectedTool(world, 966, 405); // Decoy Coin inside throw/hear radius pulls Sentinel south
    waitTicks(world, 95, 1095, 358, false);
    steerToward(world, 1146, 148, 160); // Grab Sapphire Pocketwatch (+$45K)
    steerToward(world, 1170, 358, 160); // Flank east around pedestal
    steerToward(world, 1095, 358, 100); // Lift primary Astral Orrery (+$420K)!
    steerToward(world, 1170, 210, 140);
    steerToward(world, 966, 130, 180);
    tryInteract(world); // Vent V1 back to West Foyer (238, 122)
    steerToward(world, 120, 132, 160); // Cross into Extraction Skylight!
    return world;
  }

  // Default: 'cover' — iconic single-frame overview of the entire heist:
  // Thief crossing Horology Hall between cover alcoves toward Astral Orrery, guards & cameras sweeping,
  // alarm meter showing active suspicion from a brief camera brush.
  steerToward(world, 292, 370, 160);
  steerToward(world, 412, 370, 95);
  waitTicks(world, 34, 820, 358, false);
  world.alarm = Math.max(world.alarm, 26);
  world.guards[0].suspicion = Math.max(world.guards[0].suspicion, 0.34);
  world.guards[0].state = 'investigate';
  return world;
}

export function parseShotParams(search) {
  const params = new URLSearchParams(search);
  const shot = params.get('shot');
  if (!shot) return null;
  const wingRaw = Number(params.get('wing') ?? 1);
  const wingIndex = Number.isInteger(wingRaw) ? wingRaw : 1;
  const seedRaw = Number(params.get('seed') ?? 1);
  const seed = Number.isInteger(seedRaw) && seedRaw > 0 ? seedRaw : 1;
  return { shot, wingIndex, seed };
}
