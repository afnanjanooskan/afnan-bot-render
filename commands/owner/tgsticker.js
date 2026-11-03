/**
 * Telegram Sticker Pack Downloader
 *
 * Usage:
 *   .tgsticker <telegram_pack_link>
 *
 * Examples:
 *   .tgsticker https://t.me/addstickers/FunnyCats
 *   .tgsticker https://telegram.me/addstickers/FunnyCats
 *
 * Permission: OWNER ONLY (enforced both by `ownerOnly: true` below, which
 * handler.js checks before execute() ever runs, and by the explicit
 * extra.isOwner guard inside execute() as defense-in-depth).
 *
 * v1 LIMITATION: animated (.tgs / Lottie) stickers are detected but not
 * rendered — they are skipped with a notice. Static (.webp) and video
 * (.webm) stickers are fully supported.
 */

'use strict';

const {
  extractPackName,
  getStickerPack,
  convertStatic,
  convertVideo,
} = require('../../utils/telegramStickers');

module.exports = {
  name: 'tgsticker',
  aliases: ['tgpack', 'tgs'],
  description: 'Download a Telegram sticker pack and send it to WhatsApp.',
  usage: '.tgsticker <telegram_pack_link>',
  category: 'owner',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    // Defense-in-depth: handler.js already blocks ownerOnly commands before
    // execute() runs, but the spec calls for an explicit check too.
    if (!extra.isOwner) {
      return extra.reply('🚫 This command is restricted to the bot owner.');
    }

    const { from, reply } = extra;
    const link = (args[0] || '').trim();

    if (!link) {
      return reply(
        '📦 *Telegram Sticker Pack Downloader*\n\n' +
        'Usage:\n' +
        '`.tgsticker <telegram_pack_link>`\n\n' +
        'Example:\n' +
        '`.tgsticker https://t.me/addstickers/FunnyCats`'
      );
    }

    const packName = extractPackName(link);
    if (!packName) {
      return reply(
        '❌ Invalid Telegram sticker pack link.\n\n' +
        'Expected format:\n' +
        '`https://t.me/addstickers/PackName`'
      );
    }

    try {
      await reply('⏳ Fetching sticker pack...');

      let pack;
      try {
        pack = await getStickerPack(packName);
      } catch (e) {
        console.error('[tgsticker] fetch error:', JSON.stringify(e, null, 2));
        return reply(`❌ ${e.message || 'Failed to fetch sticker pack.'}`);
      }

      if (!pack.stickers || !pack.stickers.length) {
        return reply('❌ This sticker pack appears to be empty.');
      }

      if (pack.fromCache) {
        await reply(`📦 Loaded *${pack.title}* from cache (${pack.stickers.length} stickers).`);
      } else {
        await reply('⏳ Downloading stickers...');
      }

      await reply('⏳ Converting stickers...');

      const skippedAnimated = pack.stickers.filter(s => s.type === 'tgs').length;
      const failedDownloads = pack.stickers.filter(s => s.type === 'error').length;

      let sentCount = 0;
      let convertFailCount = 0;

      await reply('✅ Sending stickers...');

      for (const sticker of pack.stickers) {
        if (sticker.type === 'tgs' || sticker.type === 'error' || !sticker.base64) {
          continue;
        }

        try {
          const buffer = Buffer.from(sticker.base64, 'base64');
          let waWebp;

          if (sticker.type === 'static') {
            waWebp = await convertStatic(buffer, pack.title);
          } else if (sticker.type === 'video') {
            waWebp = await convertVideo(buffer, pack.title);
          } else {
            continue;
          }

          await sock.sendMessage(from, { sticker: waWebp });
          sentCount++;
        } catch (e) {
          convertFailCount++;
          console.error('[tgsticker] conversion/send error:', JSON.stringify(e, null, 2));
        }
      }

      // ── Summary ─────────────────────────────────────────────────────────
      let summary = `✅ Sent *${sentCount}/${pack.stickers.length}* stickers from *${pack.title}*.`;
      if (skippedAnimated > 0) {
        summary += `\n⚠️ Skipped ${skippedAnimated} animated (.tgs) sticker(s) — not supported yet.`;
      }
      if (failedDownloads > 0) {
        summary += `\n⚠️ ${failedDownloads} sticker(s) failed to download from Telegram.`;
      }
      if (convertFailCount > 0) {
        summary += `\n⚠️ ${convertFailCount} sticker(s) failed during conversion/send.`;
      }

      return reply(summary);

    } catch (e) {
      console.error('[tgsticker] outer error:', JSON.stringify(e, null, 2));
      return reply(`❌ Error: ${e.message || 'Something went wrong.'}`);
    }
  },
};
