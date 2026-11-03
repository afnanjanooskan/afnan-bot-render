/**
 * Telegram Sticker Pack Info
 *
 * Usage:
 *   .tginfo <telegram_pack_link>
 *
 * Returns pack name, title, sticker count, and whether it contains
 * animated (.tgs) or video (.webm) stickers — without sending anything
 * to the chat. Uses the same 24h cache as .tgsticker.
 *
 * Permission: OWNER ONLY.
 */

'use strict';

const { extractPackName, getStickerPack } = require('../../utils/telegramStickers');

module.exports = {
  name: 'tginfo',
  aliases: [],
  description: 'Show info about a Telegram sticker pack (owner only).',
  usage: '.tginfo <telegram_pack_link>',
  category: 'owner',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    if (!extra.isOwner) {
      return extra.reply('🚫 This command is restricted to the bot owner.');
    }

    const { reply } = extra;
    const link = (args[0] || '').trim();

    if (!link) {
      return reply(
        '📦 *Telegram Pack Info*\n\n' +
        'Usage:\n' +
        '`.tginfo <telegram_pack_link>`'
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
        console.error('[tginfo] fetch error:', JSON.stringify(e, null, 2));
        return reply(`❌ ${e.message || 'Failed to fetch sticker pack.'}`);
      }

      const total = pack.stickers.length;
      const hasAnimated = (pack.animatedCount || 0) > 0;
      const hasVideo = (pack.videoCount || 0) > 0;

      const text =
        `📦 *Pack Name:* ${pack.name}\n` +
        `📝 *Pack Title:* ${pack.title}\n` +
        `🖼 *Total Stickers:* ${total}\n` +
        `🎬 *Animated:* ${hasAnimated ? `Yes (${pack.animatedCount})` : 'No'}\n` +
        `🎥 *Video:* ${hasVideo ? `Yes (${pack.videoCount})` : 'No'}` +
        (pack.fromCache ? `\n\n💾 _Loaded from cache_` : '');

      return reply(text);

    } catch (e) {
      console.error('[tginfo] outer error:', JSON.stringify(e, null, 2));
      return reply(`❌ Error: ${e.message || 'Something went wrong.'}`);
    }
  },
};
