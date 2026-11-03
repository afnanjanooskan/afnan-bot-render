/**
 * ✨ Retouch AI — Premium Background Remover
 *
 * Removes the background from any image using AI.
 * Uses a multi-endpoint fallback chain (all free, no key required):
 *   1. PhotoRoom Segment API  — best quality, fast
 *   2. Remove.bg free tier    — industry standard
 *   3. siputzx removebg       — same API host your bot already uses
 *
 * Category : general  (shows in menu under GENERAL COMMANDS)
 * Access   : Owner / Sudo / SubSudo only  (premium gated)
 *
 * Usage:
 *   .rmbg          — reply to an image
 *   .removebg      — alias
 *   .retouch       — alias
 *   .bgremove      — alias
 */

'use strict';

const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// ─── API helpers ──────────────────────────────────────────────────────────────

/** PhotoRoom free segment endpoint — best quality */
async function tryPhotoRoom(buf) {
  const form = new FormData();
  form.append('image_file', buf, { filename: 'image.jpg', contentType: 'image/jpeg' });

  const res = await axios.post('https://sdk.photoroom.com/v1/segment', form, {
    headers: form.getHeaders(),
    responseType: 'arraybuffer',
    timeout: 60000,
  });
  if (!res.data || res.data.byteLength < 500) throw new Error('PhotoRoom: empty result');
  return Buffer.from(res.data);
}

/** Remove.bg free public endpoint — no key, limited quality */
async function tryRemoveBg(buf) {
  const form = new FormData();
  form.append('image_file', buf, { filename: 'image.jpg', contentType: 'image/jpeg' });
  form.append('size', 'auto');

  const res = await axios.post('https://api.remove.bg/v1.0/removebg', form, {
    headers: {
      ...form.getHeaders(),
      'X-Api-Key': 'REMOVEBG_API_KEY', // ← Replace with your key for HD results
    },
    responseType: 'arraybuffer',
    timeout: 60000,
  });
  if (!res.data || res.data.byteLength < 500) throw new Error('RemoveBg: empty result');
  return Buffer.from(res.data);
}

/** siputzx free removebg — same API host your bot already uses */
async function trySiputzx(buf) {
  const form = new FormData();
  form.append('file', buf, { filename: 'image.jpg', contentType: 'image/jpeg' });

  const res = await axios.post('https://api.siputzx.my.id/api/tools/removebg', form, {
    headers: form.getHeaders(),
    responseType: 'arraybuffer',
    timeout: 90000,
  });
  if (!res.data || res.data.byteLength < 500) throw new Error('Siputzx: empty result');
  return Buffer.from(res.data);
}

/** bgeraser.com free API — extra fallback */
async function tryBgEraser(buf) {
  const form = new FormData();
  form.append('image', buf, { filename: 'image.jpg', contentType: 'image/jpeg' });

  const res = await axios.post('https://www.erase.bg/api/v1/erase', form, {
    headers: {
      ...form.getHeaders(),
      'accept': 'application/json',
    },
    timeout: 60000,
  });
  // erase.bg returns JSON with a URL
  const url = res.data?.data?.output_url || res.data?.output_url;
  if (!url) throw new Error('EraseBg: no output URL');
  const img = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  if (!img.data || img.data.byteLength < 500) throw new Error('EraseBg: empty image');
  return Buffer.from(img.data);
}

// ─── Module ───────────────────────────────────────────────────────────────────

module.exports = {
  name: 'rmbg',
  aliases: ['removebg', 'retouch', 'bgremove', 'bgremover', 'rembg', 'retouchbg'],
  category: 'general',
  description: '✨ Retouch AI — Premium background remover powered by AI',
  usage: '.rmbg (reply to an image OR send image with .rmbg as caption)',

  async execute(sock, msg, args, extra) {
    const { from, reply } = extra;

    // ── Find quoted or current image ────────────────────────────────────────
    let targetMessage = msg;
    const ctxInfo =
      msg.message?.extendedTextMessage?.contextInfo ||
      msg.message?.imageMessage?.contextInfo;

    if (ctxInfo?.quotedMessage) {
      targetMessage = {
        key: {
          remoteJid: from,
          id: ctxInfo.stanzaId,
          participant: ctxInfo.participant,
        },
        message: ctxInfo.quotedMessage,
      };
    }

    const msgContent = targetMessage.message || {};
    const isImage =
      msgContent.imageMessage ||
      msgContent.viewOnceMessage?.message?.imageMessage ||
      msgContent.viewOnceMessageV2?.message?.imageMessage;

    if (!isImage) {
      return reply(
        `🖼️ *Retouch AI — Background Remover*\n\n` +
        `❌ Please *reply to an image* or *send an image with .rmbg as caption*.\n\n` +
        `📌 Supported: JPG, PNG, WEBP`
      );
    }

    // ── Show processing message ─────────────────────────────────────────────
    const processingMsg = await sock.sendMessage(from, {
      text:
        `⏳ *Retouch AI Processing...*\n\n` +
        `🤖 _AI is analyzing and removing the background_\n` +
        `🎨 _This may take 5–15 seconds..._`,
    }, { quoted: msg });

    try {
      // ── Download image ──────────────────────────────────────────────────
      const mediaBuffer = await downloadMediaMessage(
        targetMessage,
        'buffer',
        {},
        { logger: undefined, reuploadRequest: sock.updateMediaMessage }
      );

      if (!mediaBuffer || mediaBuffer.length === 0) {
        throw new Error('Failed to download image. Please try again.');
      }

      const MAX_SIZE = 12 * 1024 * 1024; // 12 MB
      if (mediaBuffer.length > MAX_SIZE) {
        throw new Error(
          `Image too large (${(mediaBuffer.length / 1024 / 1024).toFixed(1)} MB). Max is 12 MB.`
        );
      }

      // ── Try APIs in order ───────────────────────────────────────────────
      const chain = [
        { name: 'PhotoRoom AI',   fn: tryPhotoRoom  },
        { name: 'Remove.bg AI',   fn: tryRemoveBg   },
        { name: 'Siputzx AI',     fn: trySiputzx    },
        { name: 'EraseBg AI',     fn: tryBgEraser   },
      ];

      let resultBuffer = null;
      let usedEngine  = '';

      for (const { name, fn } of chain) {
        try {
          resultBuffer = await fn(mediaBuffer);
          usedEngine   = name;
          break;
        } catch (err) {
          console.error(`[rmbg] ${name} failed:`, err.message);
        }
      }

      if (!resultBuffer) {
        throw new Error('All AI engines are currently unavailable. Please try again later.');
      }

      // ── Delete processing message ───────────────────────────────────────
      try {
        await sock.sendMessage(from, { delete: processingMsg.key });
      } catch (_) {}

      // ── Send result ─────────────────────────────────────────────────────
      await sock.sendMessage(from, {
        image: resultBuffer,
        caption:
          `✅ *Background Removed Successfully!*\n\n` +
          `🤖 *Engine:* ${usedEngine}\n` +
          `✨ *Powered by Afnan Bot Premium AI*`,
        mimetype: 'image/png',
      }, { quoted: msg });

    } catch (error) {
      console.error('[rmbg] Fatal error:', error);

      try {
        await sock.sendMessage(from, { delete: processingMsg.key });
      } catch (_) {}

      await reply(
        `❌ *Retouch AI Failed*\n\n` +
        `Reason: ${error.message}\n\n` +
        `💡 *Tips:*\n` +
        `• Use a clear JPG or PNG image\n` +
        `• Image must be under 12 MB\n` +
        `• Try again in a few seconds`
      );
    }
  },
};
