// Exact raycast visibility math for guard flashlight cones, security cameras, smoke occlusion, and sightline checks.

export function normalizeAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function angleDiff(a, b) {
  return normalizeAngle(a - b);
}

function intersectRayAabb(ox, oy, dx, dy, rect, maxDist) {
  let tmin = 0;
  let tmax = maxDist;
  if (Math.abs(dx) < 1e-8) {
    if (ox < rect.x || ox > rect.x + rect.w) return maxDist;
  } else {
    const invX = 1 / dx;
    let tx1 = (rect.x - ox) * invX;
    let tx2 = (rect.x + rect.w - ox) * invX;
    if (tx1 > tx2) [tx1, tx2] = [tx2, tx1];
    tmin = Math.max(tmin, tx1);
    tmax = Math.min(tmax, tx2);
    if (tmin > tmax) return maxDist;
  }
  if (Math.abs(dy) < 1e-8) {
    if (oy < rect.y || oy > rect.y + rect.h) return maxDist;
  } else {
    const invY = 1 / dy;
    let ty1 = (rect.y - oy) * invY;
    let ty2 = (rect.y + rect.h - oy) * invY;
    if (ty1 > ty2) [ty1, ty2] = [ty2, ty1];
    tmin = Math.max(tmin, ty1);
    tmax = Math.min(tmax, ty2);
    if (tmin > tmax) return maxDist;
  }
  return tmin >= 0 && tmin < maxDist ? tmin : maxDist;
}

function intersectRayCircle(ox, oy, dx, dy, cx, cy, r, maxDist) {
  const fx = ox - cx;
  const fy = oy - cy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  const disc = b * b - 4 * c;
  if (disc < 0) return maxDist;
  const t = (-b - Math.sqrt(disc)) * 0.5;
  return t >= 0 && t < maxDist ? t : maxDist;
}

export function castVisionRay(ox, oy, angle, maxRange, occluders, smokeClouds) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = maxRange;

  for (let i = 0; i < occluders.length; i += 1) {
    const d = intersectRayAabb(ox, oy, dx, dy, occluders[i], best);
    if (d < best) best = d;
  }
  if (smokeClouds) {
    for (let i = 0; i < smokeClouds.length; i += 1) {
      const s = smokeClouds[i];
      if (s.life <= 0) continue;
      const d = intersectRayCircle(ox, oy, dx, dy, s.x, s.y, s.radius * 0.9, best);
      if (d < best) best = d;
    }
  }
  return best;
}

export function computeVisionPolygon(ox, oy, facingAngle, halfFov, maxRange, occluders, smokeClouds, rayCount = 34) {
  const points = [{ x: ox, y: oy }];
  for (let i = 0; i <= rayCount; i += 1) {
    const frac = i / rayCount;
    const angle = facingAngle - halfFov + frac * halfFov * 2;
    const dist = castVisionRay(ox, oy, angle, maxRange, occluders, smokeClouds);
    points.push({
      x: ox + Math.cos(angle) * dist,
      y: oy + Math.sin(angle) * dist,
    });
  }
  return points;
}

export function hasClearSightline(ax, ay, bx, by, occluders, smokeClouds) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-4) return true;
  const ux = dx / dist;
  const uy = dy / dist;

  for (let i = 0; i < occluders.length; i += 1) {
    if (intersectRayAabb(ax, ay, ux, uy, occluders[i], dist) < dist - 1) {
      return false;
    }
  }
  if (smokeClouds) {
    for (let i = 0; i < smokeClouds.length; i += 1) {
      const s = smokeClouds[i];
      if (s.life <= 0) continue;
      if (intersectRayCircle(ax, ay, ux, uy, s.x, s.y, s.radius * 0.9, dist) < dist - 1) {
        return false;
      }
    }
  }
  return true;
}

export function pointInVisionCone(px, py, ox, oy, facingAngle, halfFov, range, occluders, smokeClouds) {
  const dx = px - ox;
  const dy = py - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range || dist < 1e-4) return { visible: false, factor: 0 };

  const angleToTarget = Math.atan2(dy, dx);
  const delta = Math.abs(angleDiff(angleToTarget, facingAngle));
  if (delta > halfFov) return { visible: false, factor: 0 };

  if (!hasClearSightline(ox, oy, px, py, occluders, smokeClouds)) {
    return { visible: false, factor: 0 };
  }

  const distFactor = 1 - (dist / range) * 0.55;
  const angleFactor = 1 - (delta / halfFov) * 0.45;
  return { visible: true, factor: Math.max(0.22, distFactor * angleFactor) };
}
