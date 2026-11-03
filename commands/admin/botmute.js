'use strict';

/**
 * Bot Mute
 * When enabled, only admins, owner, and sudo users can use bot commands
 * in the group. Regular members are silently ignored.
 * When disabled, all members can use the bot normally.
 *
 * Does NOT work if the bot is in global private (self) mode —
 * in that case private mode already restricts usage bot-wide.
 *
 * Commands:
 *   .bot mute on
 *   .bot mute off
 *   .bot mute status
 */

const database = require('../../database');

module.exports = {
  name: 'bot',
  aliases: ['botmute'],
  category: 'admin',
  description: 'Restrict bot usage to admins/owner/sudo only in this group.',
  usage: '.bot mute on | off | status',
  groupOnly: true,
  adminOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const { from, reply } = extra;

      const settings = database.getGroupSettings(from);
      const opt = (args[0] || '').toLowerCase();
      const sub = (args[1] || '').toLowerCase();

      // Support both ".bot mute on/off" and ".botmute on/off"
      // When called as ".bot mute on", args = ['mute', 'on']
      // When called as ".botmute on",  args = ['on']
      let action;
      if (opt === 'mute') {
        action = sub;           // .bot mute on/off/status
      } else {
        action = opt;           // .botmute on/off/status
      }

      // ── STATUS ──────────────────────────────────────────────────────────
      if (!action || action === 'status') {
        const state = settings.botMute ? '✅ ON' : '❌ OFF';
        return reply(
          `_*Bot Mute Status*_\n\n` +
          `_*System :*_ _*${state}*_\n\n` +
          `_*When ON  :*_ _*Only admins, owner, and sudo users can use the bot.*_\n` +
          `_*When OFF :*_ _*All members can use the bot.*_\n\n` +
          `_*Commands:*_\n` +
          `  _*.bot mute on*_\n` +
          `  _*.bot mute off*_\n` +
          `  _*.bot mute status*_`
        );
      }

      // ── ON ───────────────────────────────────────────────────────────────
      if (action === 'on') {
        database.updateGroupSettings(from, { botMute: true });
        return reply(
          `_*🔇 Bot Mute has been successfully enabled.*_\n\n` +
          `_*Only admins, owner, and sudo users can now use the bot in this group.*_`
        );
      }

      // ── OFF ──────────────────────────────────────────────────────────────
      if (action === 'off') {
        database.updateGroupSettings(from, { botMute: false });
        return reply(
          `_*🔊 Bot Mute has been successfully disabled.*_\n\n` +
          `_*All members can now use the bot in this group.*_`
        );
      }

      return reply(
        `_*❌ Unknown option.*_\n\n` +
        `_*Usage: .bot mute on | off | status*_`
      );

    } catch (error) {
      await extra.reply(`_*❌ Error: ${error.message}*_`);
    }
  },
};
