/**
 * Telegram Sticker Pack Utility
 *
 * Fetches a Telegram sticker pack via the Bot API (getStickerSet + getFile),
 * caches the raw pack metadata + file bytes on disk for 24h, and converts
 * each sticker into a WhatsApp-ready .webp buffer.
 *
 * SUPPORTED STICKER TYPES (v1):
 *   - Static  (.webp)  → sent directly (re-packed with WA EXIF metadata)
 *   - Video   (.webm)  → converted to animated .webp via ffmpeg
 *   - Animated (.tgs)  → NOT supported yet (Lottie rendering not implemented).
 *                        These are detected and skipped with a clear notice
 *                        rather than silently failing.
 *
 * REQUIRES:
 *   config.telegramBotToken (or process.env.TELEGRAM_BOT_TOKEN)
 *   Get one from @BotFather on Telegram — this is unrelated to the WhatsApp bot.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { exec } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const webp = require('node-webpmux');
const config = require('../config');
const { getTempDir, deleteTempFile } = require('./tempManager');

const CACHE_DIR = path.join(__dirname, '..', 'cache', 'telegram_stickers');
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const TELEGRAM_API = 'https://api.telegram.org';

const execPromise = (cmd) =>
  new Promise((resolve, reject) => exec(cmd, (err) => (err ? reject(err) : resolve())));

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getBotToken() {
  return config.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '';
}

/**
 * Extract the sticker pack short-name from any accepted link format.
 *   https://t.me/addstickers/FunnyCats        → FunnyCats
 *   https://telegram.me/addstickers/FunnyCats → FunnyCats
 *   t.me/addstickers/FunnyCats                → FunnyCats
 *   FunnyCats (bare name)                     → FunnyCats
 */
function extractPackName(input) {
  if (!input) return null;
  const trimmed = input.trim();

  const linkMatch = trimmed.match(
    /(?:https?:\/\/)?(?:t(?:elegram)?\.me)\/addstickers\/([A-Za-z0-9_]+)/i
  );
  if (linkMatch) return linkMatch[1];

  // Bare pack name (no slashes/protocol) — allow direct usage too
  if (/^[A-Za-z0-9_]+$/.test(trimmed)) return trimmed;

  return null;
}

function cachePathFor(packName) {
  // Pack names are already restricted to [A-Za-z0-9_] by extractPackName,
  // but normalize again here in case this is ever called directly.
  const safe = packName.replace(/[^A-Za-z0-9_]/g, '');
  return path.join(CACHE_DIR, `${safe}.json`);
}

function readCache(packName) {
  ensureCacheDir();
  const file = cachePathFor(packName);
  if (!fs.existsSync(file)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw.cachedAt || Date.now() - raw.cachedAt > CACHE_DURATION_MS) {
      return null; // expired
    }
    return raw;
  } catch (e) {
    console.error('[telegramStickers] cache read error:', JSON.stringify(e, null, 2));
    return null;
  }
}

function writeCache(packName, data) {
  ensureCacheDir();
  const file = cachePathFor(packName);
  const payload = { ...data, cachedAt: Date.now() };
  fs.writeFileSync(file, JSON.stringify(payload));
  return payload;
}

/**
 * Call getStickerSet on the Telegram Bot API.
 * Throws with a human-readable message for the common failure cases.
 */
async function fetchStickerSet(packName) {
  const token = getBotToken();
  if (!token) {
    throw new Error(
      'No Telegram bot token configured. Set config.telegramBotToken or the ' +
      'TELEGRAM_BOT_TOKEN environment variable (get one from @BotFather).'
    );
  }

  let res;
  try {
    res = await axios.get(`${TELEGRAM_API}/bot${token}/getStickerSet`, {
      params: { name: packName },
      timeout: 15000,
    });
  } catch (e) {
    if (e.code === 'ECONNABORTED') {
      throw new Error('Telegram API timed out. Please try again.');
    }
    // Telegram returns 400 with a description for bad/private/missing packs
    const desc = e.response?.data?.description;
    if (desc) {
      if (/not found/i.test(desc)) {
        throw new Error('Sticker pack not found. Check the link and try again.');
      }
      throw new Error(`Telegram API error: ${desc}`);
    }
    throw new Error(`Telegram API request failed: ${e.message}`);
  }

  if (!res.data?.ok || !res.data?.result) {
    throw new Error('Sticker pack not found or is private.');
  }

  return res.data.result; // { name, title, stickers: [...], ... }
}

/**
 * Download a single Telegram file (by file_id) as a Buffer, via getFile
 * to resolve the file_path, then fetching the CDN URL.
 */
async function downloadTelegramFile(fileId) {
  const token = getBotToken();

  const fileInfo = await axios.get(`${TELEGRAM_API}/bot${token}/getFile`, {
    params: { file_id: fileId },
    timeout: 15000,
  });

  const filePath = fileInfo.data?.result?.file_path;
  if (!filePath) {
    throw new Error('Telegram did not return a file path for this sticker.');
  }

  const fileUrl = `${TELEGRAM_API}/file/bot${token}/${filePath}`;
  const fileRes = await axios.get(fileUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });

  return { buffer: Buffer.from(fileRes.data), filePath };
}

/**
 * Classify a Telegram sticker object into one of: 'static' | 'video' | 'tgs'
 */
function classifySticker(sticker, filePath) {
  if (sticker.is_video) return 'video';
  if (sticker.is_animated) return 'tgs';
  if (filePath && filePath.endsWith('.webm')) return 'video';
  if (filePath && filePath.endsWith('.tgs')) return 'tgs';
  return 'static';
}

/**
 * Build the WA EXIF metadata blob (same approach as commands/general/sticker.js)
 */
function buildExif(packname, author) {
  const json = {
    'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
    'sticker-pack-name': packname || 'Telegram Import',
    'sticker-pack-publisher': author || "Afnan's Bot",
    emojis: ['🤖'],
  };

  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
  ]);
  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
  const exif = Buffer.concat([exifAttr, jsonBuffer]);
  exif.writeUIntLE(jsonBuffer.length, 14, 4);
  return exif;
}

async function packWaExif(webpBuffer, packname) {
  const img = new webp.Image();
  await img.load(webpBuffer);
  img.exif = buildExif(packname, config.botName);
  return img.save(null);
}

/**
 * Convert a static .webp Telegram sticker → WA-ready .webp (just re-stamps EXIF;
 * Telegram static stickers are already webp).
 */
async function convertStatic(buffer, packname) {
  return packWaExif(buffer, packname);
}

/**
 * Convert a .webm video sticker → animated WA-ready .webp via ffmpeg.
 */
async function convertVideo(buffer, packname) {
  const tempDir = getTempDir();
  const ts = Date.now() + '_' + crypto.randomBytes(3).toString('hex');
  const inputPath = path.join(tempDir, `tg_in_${ts}.webm`);
  const outputPath = path.join(tempDir, `tg_out_${ts}.webp`);
  const tempFiles = [inputPath, outputPath];

  try {
    fs.writeFileSync(inputPath, buffer);

    const cmd =
      `"${ffmpegPath}" -i "${inputPath}" -vf ` +
      `"scale=512:512:force_original_aspect_ratio=decrease,fps=15,` +
      `pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" ` +
      `-c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p ` +
      `-quality 75 -compression_level 6 "${outputPath}"`;

    await execPromise(cmd);

    const rawWebp = fs.readFileSync(outputPath);
    return await packWaExif(rawWebp, packname);
  } finally {
    tempFiles.forEach(deleteTempFile);
  }
}

/**
 * Fetch (or load from cache) a full sticker pack: metadata + raw file bytes
 * for every sticker, base64-encoded for JSON cache storage.
 *
 * Returns: { fromCache: bool, name, title, stickers: [{fileId, type, base64}] }
 */
async function getStickerPack(packName) {
  const cached = readCache(packName);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const set = await fetchStickerSet(packName);
  const stickers = [];

  for (const sticker of set.stickers) {
    try {
      const { buffer, filePath } = await downloadTelegramFile(sticker.file_id);
      const type = classifySticker(sticker, filePath);
      stickers.push({
        fileId: sticker.file_id,
        type,
        base64: buffer.toString('base64'),
      });
    } catch (e) {
      console.error('[telegramStickers] sticker download error:', JSON.stringify(e, null, 2));
      stickers.push({ fileId: sticker.file_id, type: 'error', base64: null });
    }
  }

  const payload = {
    name: set.name,
    title: set.title,
    stickers,
    animatedCount: stickers.filter(s => s.type === 'tgs').length,
    videoCount: stickers.filter(s => s.type === 'video').length,
    staticCount: stickers.filter(s => s.type === 'static').length,
  };

  writeCache(packName, payload);
  return { ...payload, fromCache: false };
}

module.exports = {
  extractPackName,
  getStickerPack,
  convertStatic,
  convertVideo,
  classifySticker,
  CACHE_DURATION_MS,
};
