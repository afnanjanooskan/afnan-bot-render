'use strict';

/**
 * AntiLink WA
 *
 * Detects and acts on WhatsApp group invite links ONLY
 * (https://chat.whatsapp.com/...).  All other link types are ignored.
 *
 * MUTUAL EXCLUSIVITY:
 *   Enabling .antilinkWa automatically disables .antilink (they overlap).
 *   Enabling .antilink automatically disables .antilinkWa (handled in antilink.js + handler.js).
 *
 * Commands:
 *   .antilinkWa on
 *   .antilinkWa off
 *   .antilinkWa set [kick | warn | delete]
 *   .antilinkWa limit [number]
 *   .antilinkWa warnings @user
 *   .antilinkWa warn reset @user
 *   .antilinkWa status
 */

const database = require('../../database');

module.exports = {
  name: 'antilinkwa',
  aliases: ['alwa', 'antilinkWa'],
  category: 'admin',
  description: 'AntiLink WA — blocks WhatsApp group invite links only',
  usage: '.antilinkWa on | off | set [kick|warn|delete] | limit [n] | warnings @user | warn reset @user | status',
  groupOnly: true,
  adminOnly: true,
  botAdminNeeded: true,

  async execute(sock, msg, args, extra) {
    try {
      const { from, reply } = extra;
      const settings = database.getGroupSettings(from);
      const opt = (args[0] || '').toLowerCase();
      const sub = (args[1] || '').toLowerCase();

      // ── STATUS ────────────────────────────────────────────────────────────
      if (!opt || opt === 'status') {
        const state    = settings.antilinkWa ? '✅ ON' : '❌ OFF';
        const mode     = settings.antilinkWaAction || 'delete';
        const maxWarns = database.getAntiWarnLimit(from, 'antilinkWa');
        return reply(
          '_*AntiLink WA Status*_\n\n' +
          '_*System    :*_ _*' + state + '*_\n' +
          '_*Scope     :*_ _*WhatsApp group invite links only*_\n' +
          '_*Mode      :*_ _*' + mode.charAt(0).toUpperCase() + mode.slice(1) + '*_\n' +
          '_*Warn Limit:*_ _*' + maxWarns + ' warnings before kick*_\n\n' +
          '_*Commands:*_\n' +
          '  _*.antilinkWa on | off | status*_\n' +
          '  _*.antilinkWa set kick | warn | delete*_\n' +
          '  _*.antilinkWa limit <number>*_\n' +
          '  _*.antilinkWa warnings @user*_\n' +
          '  _*.antilinkWa warn reset @user*_\n\n' +
          '_*⚠️ Note: .antilinkWa and .antilink cannot be active at the same time.*_'
        );
      }

      // ── ON ────────────────────────────────────────────────────────────────
      if (opt === 'on') {
        // Mutual exclusion: disable .antilink if it was on
        const disabledAntilink = !!settings.antilink;
        database.updateGroupSettings(from, {
          antilinkWa: true,
          antilinkWaAction: settings.antilinkWaAction || 'delete',
          antilink: false,   // ← mutual exclusion
        });
        let msg2 = '_*AntiLink WA has been successfully enabled ⚠️*_\n' +
                   '_*(WhatsApp group invite links only)*_';
        if (disabledAntilink) {
          msg2 += '\n\n_*ℹ️ Antilink (all links) has been automatically disabled.*_';
        }
        return reply(msg2);
      }

      // ── OFF ───────────────────────────────────────────────────────────────
      if (opt === 'off') {
        database.updateGroupSettings(from, { antilinkWa: false });
        return reply('_*AntiLink WA has been successfully disabled 🥲*_');
      }

      // ── SET [kick | warn | delete] ────────────────────────────────────────
      if (opt === 'set') {
        const validModes = ['kick', 'warn', 'delete'];
        if (!sub || !validModes.includes(sub)) {
          return reply('_*❌ Please specify a valid mode.*_\n\n_*Usage: .antilinkWa set kick | warn | delete*_');
        }
        database.updateGroupSettings(from, { antilinkWaAction: sub });
        const responses = {
          kick:   '_*AntiLink WA action set to Kick 🥵*_',
          delete: '_*AntiLink WA action set to Delete 😳*_',
          warn:   '_*AntiLink WA action set to Warn ⚡*_',
        };
        return reply(responses[sub]);
      }

      // ── LIMIT [n] ─────────────────────────────────────────────────────────
      if (opt === 'limit') {
        const current = database.getAntiWarnLimit(from, 'antilinkWa');

        if (!sub) {
          return reply(
            '_*⚠️ AntiLink WA — Warn Limit*_\n\n' +
            '_*Current limit :*_ _*' + current + ' warnings before kick*_\n\n' +
            '_*To change:*_ _*.antilinkWa limit <number>*_\n' +
            '_*Example   :*_ _*.antilinkWa limit 2*_'
          );
        }

        const newLimit = parseInt(sub, 10);
        if (isNaN(newLimit) || newLimit < 1 || newLimit > 20) {
          return reply('_*❌ Invalid limit. Enter a number between 1 and 20.*_');
        }

        database.setAntiWarnLimit(from, 'antilinkWa', newLimit);
        return reply(
          '_*✅ AntiLink WA Warn Limit Updated*_\n\n' +
          '_*New limit :*_ _*' + newLimit + ' warnings before kick*_\n' +
          '_*Scope     :*_ _*This group only*_'
        );
      }

      // ── WARNINGS @user ────────────────────────────────────────────────────
      if (opt === 'warnings') {
        const mentioned = (
          msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
          msg.message?.contextInfo?.mentionedJid || []
        );
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
        const target = mentioned[0] || quoted;

        if (!target) {
          return reply('_*❌ Please mention a user to check their warnings.*_\n\n_*Usage: .antilinkWa warnings @user*_');
        }

        const maxWarns  = database.getAntiWarnLimit(from, 'antilinkWa');
        const warnData  = database.getAntiWarnings(from, target, 'antilinkWa');
        const count     = warnData.count || 0;
        const remaining = maxWarns - count;
        const userTag   = '@' + target.split('@')[0];

        return sock.sendMessage(from, {
          text:
            '_*⚠️ AntiLink WA — Warning Check*_\n\n' +
            '_*👤 User      :*_ _*' + userTag + '*_\n' +
            '_*⚠️ Warnings  :*_ _*' + count + '/' + maxWarns + '*_\n' +
            (count < maxWarns
              ? '_*📊 Remaining : ' + remaining + ' warning' + (remaining === 1 ? '' : 's') + ' before kick*_'
              : '_*🚫 This user will be kicked on next offence!*_'),
          mentions: [target],
        }, { quoted: msg });
      }

      // ── WARN RESET @user ──────────────────────────────────────────────────
      if (opt === 'warn' && sub === 'reset') {
        const mentioned = (
          msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
          msg.message?.contextInfo?.mentionedJid || []
        );
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
        const target = mentioned[0] || quoted;

        if (!target) {
          return reply('_*❌ Please mention a user to reset their warnings.*_\n\n_*Usage: .antilinkWa warn reset @user*_');
        }

        const maxWarns = database.getAntiWarnLimit(from, 'antilinkWa');
        database.clearAntiWarnings(from, target, 'antilinkWa');
        const userTag = '@' + target.split('@')[0];

        return sock.sendMessage(from, {
          text:
            '_*✅ Warnings Reset*_\n\n' +
            "_*" + userTag + "'s AntiLink WA warnings have been reset to 0/" + maxWarns + ".*_",
          mentions: [target],
        }, { quoted: msg });
      }

      // ── Unknown ───────────────────────────────────────────────────────────
      return reply(
        '_*❌ Unknown option.*_\n\n' +
        '_*Usage:*_\n' +
        '  _*.antilinkWa on | off | status*_\n' +
        '  _*.antilinkWa set kick | warn | delete*_\n' +
        '  _*.antilinkWa limit <number>*_\n' +
        '  _*.antilinkWa warnings @user*_\n' +
        '  _*.antilinkWa warn reset @user*_'
      );

    } catch (error) {
      await extra.reply('_*❌ Error: ' + error.message + '*_');
    }
  },
};
