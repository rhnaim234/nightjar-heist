// Core visual palette, simulation constants, thief specs, and priced tactical tool definitions.

export const VIEWPORT = {
  width: 1280,
  height: 720,
  hudTop: 62,
  hudBottom: 68,
};

export const FIXED_DT = 1 / 60;

export const PALETTE = {
  backdrop: '#0d1118',
  floorBase: '#222834',
  floorTileAlt: '#262d3b',
  floorGrid: 'rgba(182, 198, 224, 0.06)',
  carpetVault: '#2b2430',
  carpetBorder: 'rgba(218, 178, 94, 0.34)',
  wallShadow: 'rgba(6, 8, 14, 0.55)',
  wallFront: '#384152',
  wallTop: '#56637a',
  wallTrim: '#9fb0cc',
  vitrineGlass: 'rgba(130, 210, 232, 0.18)',
  vitrineEdge: '#7cc6dc',
  coverFill: 'rgba(28, 38, 72, 0.86)',
  coverHatch: 'rgba(56, 212, 198, 0.16)',
  coverBorder: '#3ad4c6',
  ventGlow: '#3ae3d7',
  ventLine: 'rgba(58, 227, 215, 0.42)',
  conduit: 'rgba(245, 166, 66, 0.45)',
  coneSafe: 'rgba(248, 196, 86, 0.24)',
  coneSafeEdge: 'rgba(252, 212, 110, 0.65)',
  coneSuspect: 'rgba(250, 134, 48, 0.34)',
  coneSuspectEdge: 'rgba(255, 162, 72, 0.85)',
  coneAlert: 'rgba(240, 62, 62, 0.38)',
  coneAlertEdge: 'rgba(255, 92, 92, 0.92)',
  cameraCone: 'rgba(242, 102, 78, 0.23)',
  cameraEdge: 'rgba(255, 130, 100, 0.72)',
  laserActive: '#ff4455',
  gold: '#f5c451',
  goldSoft: 'rgba(245, 196, 81, 0.24)',
  emerald: '#3be39b',
  emeraldSoft: 'rgba(59, 227, 155, 0.22)',
  thiefBody: '#e8eef8',
  thiefScarf: '#3ae3d7',
  hudBg: 'rgba(13, 17, 24, 0.92)',
  hudBorder: 'rgba(148, 168, 200, 0.24)',
  textPrimary: '#f2f5fa',
  textMuted: '#9aa6ba',
};

export const THIEF_SPEC = {
  radius: 13,
  walkSpeed: 192,
  sneakSpeed: 112,
  sprintNoiseRadius: 120,
  walkNoiseRadius: 56,
  sneakNoiseRadius: 0,
  interactRadius: 42,
};

export const TOOL_SPECS = [
  {
    id: 'coin',
    key: '1',
    name: 'Decoy Coin',
    shortName: 'COIN',
    cost: 4000,
    charges: 3,
    throwRange: 290,
    hearRadius: 230,
    duration: 5.5,
    color: '#f5c451',
    hint: 'Lures guards',
  },
  {
    id: 'smoke',
    key: '2',
    name: 'Smoke Veil',
    shortName: 'SMOKE',
    cost: 12000,
    charges: 2,
    throwRange: 250,
    cloudRadius: 72,
    duration: 8.5,
    color: '#52dcd0',
    hint: 'Blocks cones',
  },
  {
    id: 'emp',
    key: '3',
    name: 'EMP Jammer',
    shortName: 'EMP',
    cost: 20000,
    charges: 2,
    throwRange: 270,
    empRadius: 165,
    duration: 8.0,
    color: '#6bb8ff',
    hint: 'Kills cams/lasers',
  },
];

export const ALARM_STATES = {
  QUIET: 'QUIET',
  SUSPICIOUS: 'SUSPICIOUS',
  PURSUIT: 'PURSUIT',
  LOCKDOWN: 'LOCKDOWN',
};
