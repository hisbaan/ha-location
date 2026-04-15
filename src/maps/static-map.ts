import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";

import { env } from "../config/env";

const TILE_SIZE = 256;
const WIDTH = 768;
const HEIGHT = 512;
const TILE_CACHE = new Map<string, Buffer>();

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function lonToWorldX(lon: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  return ((lon + 180) / 360) * scale;
}

function latToWorldY(lat: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const radians = (lat * Math.PI) / 180;
  const mercator = Math.log(Math.tan(Math.PI / 4 + radians / 2));
  return (scale * (1 - mercator / Math.PI)) / 2;
}

function tileUrl(z: number, x: number, y: number) {
  const url = env.mapTileUrlTemplate
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));

  if (url.includes("{apiKey}")) {
    if (!env.mapTileApiKey) {
      throw new Error("MAP_TILE_API_KEY is required by the configured MAP_TILE_URL_TEMPLATE");
    }

    return url.replaceAll("{apiKey}", env.mapTileApiKey);
  }

  if (env.mapTileApiKey) {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname.endsWith("stadiamaps.com") && !parsedUrl.searchParams.has("api_key")) {
      parsedUrl.searchParams.set("api_key", env.mapTileApiKey);
      return parsedUrl.toString();
    }

    if (parsedUrl.hostname === "api.maptiler.com" && !parsedUrl.searchParams.has("key")) {
      parsedUrl.searchParams.set("key", env.mapTileApiKey);
      return parsedUrl.toString();
    }
  }

  return url;
}

async function fetchTile(z: number, x: number, y: number) {
  const cacheKey = `${z}/${x}/${y}`;
  const cached = TILE_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetch(tileUrl(z, x, y), {
    headers: {
      "User-Agent": env.mapTileUserAgent,
    },
  });

  if (!response.ok) {
    throw new Error(`Tile request failed for ${cacheKey}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  TILE_CACHE.set(cacheKey, buffer);
  return buffer;
}

function drawFallbackBackground(ctx: SKRSContext2D, lat: number, lon: number, errorMessage?: string) {
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(1, "#1e293b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  for (let x = 0; x <= WIDTH; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= HEIGHT; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "20px sans-serif";
  ctx.fillText("Map tiles unavailable", 24, 36);
  ctx.font = "16px sans-serif";
  ctx.fillText(`Latitude: ${lat.toFixed(5)}`, 24, 64);
  ctx.fillText(`Longitude: ${lon.toFixed(5)}`, 24, 88);

  if (errorMessage) {
    ctx.font = "14px sans-serif";
    ctx.fillText(errorMessage.slice(0, 88), 24, 120);
  }
}

async function drawBaseMap(ctx: SKRSContext2D, lat: number, lon: number, zoom: number) {
  const worldX = lonToWorldX(lon, zoom);
  const worldY = latToWorldY(lat, zoom);
  const left = worldX - WIDTH / 2;
  const top = worldY - HEIGHT / 2;
  const tilesAcross = 2 ** zoom;
  const minTileX = Math.floor(left / TILE_SIZE);
  const maxTileX = Math.floor((left + WIDTH) / TILE_SIZE);
  const minTileY = clamp(Math.floor(top / TILE_SIZE), 0, tilesAcross - 1);
  const maxTileY = clamp(Math.floor((top + HEIGHT) / TILE_SIZE), 0, tilesAcross - 1);

  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      const wrappedX = ((tileX % tilesAcross) + tilesAcross) % tilesAcross;
      const buffer = await fetchTile(zoom, wrappedX, tileY);
      const image = await loadImage(buffer);
      const drawX = tileX * TILE_SIZE - left;
      const drawY = tileY * TILE_SIZE - top;
      ctx.drawImage(image, drawX, drawY, TILE_SIZE, TILE_SIZE);
    }
  }
}

async function drawAvatarMarker(ctx: SKRSContext2D, avatarUrl: string | null) {
  const markerX = WIDTH / 2;
  const markerY = HEIGHT / 2;
  const avatarRadius = 32;
  const ringRadius = avatarRadius + 6;

  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.18)";
  ctx.beginPath();
  ctx.ellipse(markerX, markerY + ringRadius + 12, 28, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(markerX, markerY, ringRadius + 2, 0, Math.PI * 2);
  const ringGradient = ctx.createLinearGradient(markerX - ringRadius, markerY - ringRadius, markerX + ringRadius, markerY + ringRadius);
  ringGradient.addColorStop(0, "#ffffff");
  ringGradient.addColorStop(1, "#e2e8f0");
  ctx.fillStyle = ringGradient;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.beginPath();
  ctx.arc(markerX, markerY, ringRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (avatarUrl) {
    const avatarResponse = await fetch(avatarUrl);
    if (avatarResponse.ok) {
      const avatar = await loadImage(Buffer.from(await avatarResponse.arrayBuffer()));
      ctx.save();
      ctx.beginPath();
      ctx.arc(markerX, markerY, avatarRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        avatar,
        markerX - avatarRadius,
        markerY - avatarRadius,
        avatarRadius * 2,
        avatarRadius * 2,
      );
      ctx.restore();
    }
  } else {
    const fallbackGradient = ctx.createLinearGradient(
      markerX - avatarRadius,
      markerY - avatarRadius,
      markerX + avatarRadius,
      markerY + avatarRadius,
    );
    fallbackGradient.addColorStop(0, "#cbd5e1");
    fallbackGradient.addColorStop(1, "#94a3b8");
    ctx.fillStyle = fallbackGradient;
    ctx.beginPath();
    ctx.arc(markerX, markerY, avatarRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(markerX, markerY - 6, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(markerX, markerY + 24, 18, Math.PI, 0, false);
    ctx.stroke();
  }

  ctx.lineWidth = 4;
  ctx.strokeStyle = "white";
  ctx.beginPath();
  ctx.arc(markerX, markerY, avatarRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(markerX - 10, markerY - 10, ringRadius - 3, Math.PI * 1.05, Math.PI * 1.5);
  ctx.stroke();
  ctx.restore();
}

export async function renderStaticMap(input: {
  latitude: number;
  longitude: number;
  label: string;
  avatarUrl: string | null;
  zoom?: number;
}) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  const zoom = input.zoom ?? env.mapDefaultZoom;

  try {
    await drawBaseMap(ctx, input.latitude, input.longitude, zoom);
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    drawFallbackBackground(ctx, input.latitude, input.longitude, message);
  }

  await drawAvatarMarker(ctx, input.avatarUrl);

  return canvas.toBuffer("image/png");
}
