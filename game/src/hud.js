// The HUD: money, health, wanted stars, speed, mission objective, a message
// feed, a live minimap and the full-screen menus (title, pause, busted,
// wasted). All DOM, drawn over the WebGL canvas; the minimap is a 2D canvas
// that redraws the road grid, buildings, cars, police and the mission marker.

import { CITY } from './config.js';

const MAP_SIZE = 180;

export function createHud(doc, city) {
  const el = (id) => doc.getElementById(id);
  const moneyEl = el('money');
  const healthFill = el('health-fill');
  const healthText = el('health-text');
  const starsEl = el('stars');
  const speedEl = el('speed');
  const objectiveEl = el('objective');
  const feedEl = el('feed');
  const bannerEl = el('banner');
  const bustEl = el('bust');
  const bustFill = el('bust-fill');
  const mapCanvas = el('minimap');
  const mapCtx = mapCanvas.getContext('2d');
  const screens = {
    title: el('screen-title'),
    paused: el('screen-pause'),
    busted: el('screen-busted'),
    wasted: el('screen-wasted'),
  };
  const titleBest = el('title-best');

  const messages = [];
  let lastMoney = -1;
  let lastHealth = -1;
  let lastStars = -1;

  function pushMessage(text) {
    messages.unshift({ text, at: Date.now() });
    while (messages.length > 4) messages.pop();
    feedEl.innerHTML = messages.map((m) => `<div>${m.text}</div>`).join('');
  }

  function showScreen(name, data) {
    for (const key of Object.keys(screens)) {
      if (screens[key]) screens[key].style.display = key === name ? 'flex' : 'none';
    }
    if (name === 'title' && titleBest && data) {
      titleBest.textContent = data.bestMoney > 0 ? `Best fortune: $${data.bestMoney}` : 'Your first job in Solmar Bay starts now.';
    }
  }

  function drawMinimap(G) {
    const ctx = mapCtx;
    const scale = MAP_SIZE / (CITY.bound * 2 + 20);
    const toMap = (x, z) => [(x + CITY.bound + 10) * scale, (z + CITY.bound + 10) * scale];
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    ctx.fillStyle = '#10151c';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    // Roads.
    ctx.strokeStyle = '#3d454f';
    ctx.lineWidth = Math.max(2, CITY.roadHalf * 2 * scale);
    for (let k = -CITY.blocks; k <= CITY.blocks; k += 1) {
      const [x0, y0] = toMap(k * CITY.pitch, -CITY.bound);
      const [x1, y1] = toMap(k * CITY.pitch, CITY.bound);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      const [ax0, ay0] = toMap(-CITY.bound, k * CITY.pitch);
      const [ax1, ay1] = toMap(CITY.bound, k * CITY.pitch);
      ctx.beginPath();
      ctx.moveTo(ax0, ay0);
      ctx.lineTo(ax1, ay1);
      ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#6b7683';
    for (const b of city.buildings) {
      const [x, y] = toMap(b.minX, b.minZ);
      ctx.fillRect(x, y, (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
    }
    // Mission target.
    const target = G.missions.state.target;
    if (target) {
      const [x, y] = toMap(target.x, target.z);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 5, y);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - 5, y);
      ctx.closePath();
      ctx.fill();
    }
    // Traffic.
    ctx.fillStyle = '#9aa5b1';
    for (const car of G.vehicles.traffic) {
      if (!car.active) continue;
      const [x, y] = toMap(car.x, car.z);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Police.
    ctx.fillStyle = '#3b82f6';
    for (const car of G.police.cars) {
      const [x, y] = toMap(car.x, car.z);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const p = G.player.state;
    const px = p.inCar ? p.inCar.x : p.x;
    const pz = p.inCar ? p.inCar.z : p.z;
    const heading = p.inCar ? p.inCar.heading : p.heading;
    const [mx, my] = toMap(px, pz);
    ctx.fillStyle = '#ffffff';
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)) + Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Refresh every HUD readout from the shared game object G. */
  function update(G) {
    if (G.money !== lastMoney) {
      lastMoney = G.money;
      moneyEl.textContent = `$${G.money}`;
    }
    const health = Math.round(G.player.state.health);
    if (health !== lastHealth) {
      lastHealth = health;
      healthFill.style.width = `${health}%`;
      healthFill.style.background = health > 50 ? '#22c55e' : health > 25 ? '#f59e0b' : '#ef4444';
      healthText.textContent = `HP ${health}`;
    }
    if (G.police.wanted !== lastStars) {
      lastStars = G.police.wanted;
      starsEl.textContent = '★'.repeat(G.police.wanted) + '☆'.repeat(5 - G.police.wanted);
      starsEl.style.color = G.police.wanted > 0 ? '#ffd23f' : '#5b6672';
    }
    const speed = G.player.state.inCar
      ? Math.round(Math.abs(G.player.state.inCar.speed) * 3.6)
      : Math.round(G.player.state.speed * 3.6);
    speedEl.textContent = G.player.state.inCar ? `${speed} km/h` : 'On foot';
    objectiveEl.textContent = G.missions.objectiveText(G);
    const banner = G.missions.state.banner;
    if (banner && G.time < G.missions.state.bannerUntil) {
      bannerEl.textContent = banner;
      bannerEl.style.display = 'block';
    } else {
      bannerEl.style.display = 'none';
    }
    if (G.police.bustProgress > 0.05 && G.police.wanted > 0) {
      bustEl.style.display = 'block';
      bustFill.style.width = `${Math.round(G.police.bustProgress * 100)}%`;
    } else {
      bustEl.style.display = 'none';
    }
    drawMinimap(G);
  }

  return { update, pushMessage, showScreen };
}
