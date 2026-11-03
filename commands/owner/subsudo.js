/**
 * Sub Sudo Command — Grant / Revoke / List sub sudo users
 *
 * Only the bot OWNER can run these commands.
 *
 * Sub sudo users:
 *   ✅ Can use all general (non-admin, non-owner) commands freely.
 *   🚫 CANNOT use admin commands (adminOnly).
 *   🚫 CANNOT use owner commands (ownerOnly).
 *
 * Mutual exclusion:
 *   • Promoting someone to sub sudo automatically removes their sudo role.
 *   • Promoting someone to sudo automatically removes their sub sudo role.
 *
 * Usage:
 *   .subsudo add @user          — add by mention
 *   .subsudo add 919876543210   — add by phone number
 *   .subsudo del @user          — remove by mention
 *   .subsudo del 919876543210   — remove by phone number
 *   .subsudo list               — list all sub sudo users
 */

'use strict';

const database = require('../../database');
const config   = require('../../config');

module.exports = {
  name: 'subsudo',
  aliases: ['ssu', 'ssudo'],
  category: 'owner',
  description: 'Manage sub sudo users (owner only). Sub sudo users can use general commands only — not admin or owner commands.',
  usage: '.subsudo add @user | .subsudo del @user | .subsudo list',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const { from, sender, reply } = extra;
      const sub = (args[0] || '').toLowerCase();

      // ── HELPERS ─────────────────────────────────────────────────────────────
      const getMentioned = () =>
        msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
        msg.message?.contextInfo?.mentionedJid ||
        [];

      const numToJid = (n) => {
        const clean = n.replace(/[^0-9]/g, '');
        return clean ? `${clean}@s.whatsapp.net` : null;
      };

      const getTargets = () => {
        const mentioned = getMentioned();
        if (mentioned.length > 0) return mentioned;
        const raw = args[1] ? args[1].replace(/[^0-9]/g, '') : '';
        if (raw.length >= 7) return [numToJid(raw)].filter(Boolean);
        return [];
      };

      // ── LIST ────────────────────────────────────────────────────────────────
      if (!sub || sub === 'list' || sub === 'ls') {
        const subSudos = database.getSubSudos();
        if (!subSudos.length) {
          return reply(
            `🔸 *Sub Sudo Users*\n\n` +
            `No sub sudo users added yet.\n\n` +
            `Usage:\n` +
            `• *.subsudo add @user*\n` +
            `• *.subsudo add 919876543210*`
          );
        }

        let text = `🔸 *Sub Sudo Users (${subSudos.length})*\n━━━━━━━━━━━━━━━━\n\n`;
        subSudos.forEach((num, i) => {
          text += `${i + 1}. @${num}  🔸 Sub Sudo\n`;
        });
        text += `\n💡 Sub sudo users can use general commands only.\n🚫 They *cannot* use admin or owner commands.`;

        const mentions = subSudos.map(n => `${n}@s.whatsapp.net`);
        return sock.sendMessage(from, { text, mentions }, { quoted: msg });
      }

      // ── ADD ─────────────────────────────────────────────────────────────────
      if (sub === 'add') {
        const targets = getTargets();
        if (!targets.length) {
          return reply(
            `❌ Please mention someone or provide a number!\n\n` +
            `Examples:\n` +
            `• *.subsudo add @user*\n` +
            `• *.subsudo add 919876543210*`
          );
        }

        const ownerNums = config.ownerNumber.map(n => n.replace(/[^0-9]/g, ''));
        const results = [];

        for (const jid of targets) {
          const num = jid.split('@')[0].replace(/[^0-9]/g, '');

          if (ownerNums.includes(num)) {
            results.push(`⚠️ @${num} is the *Owner* — no need to add as sub sudo!`);
            continue;
          }

          // Check if already a regular sudo — warn that it will be downgraded
          const wasFullSudo = database.isSudo(num);

          if (database.isSubSudo(num)) {
            results.push(`⚠️ @${num} is *already* a sub sudo user.`);
            continue;
          }

          const ok = database.addSubSudo(num);
          if (ok) {
            const note = wasFullSudo ? ` *(sudo role removed automatically)*` : '';
            results.push(`✅ @${num} added as *sub sudo user* successfully!${note}`);
          } else {
            results.push(`❌ Failed to add @${num}.`);
          }
        }

        return sock.sendMessage(from, {
          text: `🔸 *Sub Sudo — Add*\n\n${results.join('\n')}`,
          mentions: targets,
        }, { quoted: msg });
      }

      // ── DEL / DELETE ────────────────────────────────────────────────────────
      if (sub === 'del' || sub === 'delete' || sub === 'remove' || sub === 'rm') {
        const targets = getTargets();
        if (!targets.length) {
          return reply(
            `❌ Please mention someone or provide a number!\n\n` +
            `Examples:\n` +
            `• *.subsudo del @user*\n` +
            `• *.subsudo del 919876543210*`
          );
        }

        const results = [];

        for (const jid of targets) {
          const num = jid.split('@')[0].replace(/[^0-9]/g, '');
          if (!database.isSubSudo(num)) {
            results.push(`⚠️ @${num} is *not* a sub sudo user.`);
            continue;
          }
          const ok = database.removeSubSudo(num);
          results.push(ok
            ? `✅ @${num} has been *removed* from sub sudo.`
            : `❌ Failed to remove @${num}.`
          );
        }

        return sock.sendMessage(from, {
          text: `🔸 *Sub Sudo — Remove*\n\n${results.join('\n')}`,
          mentions: targets,
        }, { quoted: msg });
      }

      // ── DEFAULT ─────────────────────────────────────────────────────────────
      return reply(
        `🔸 *Sub Sudo Command*\n\n` +
        `*Commands (Owner only):*\n` +
        `• *.subsudo add @user* — Add by mention\n` +
        `• *.subsudo add 919876543210* — Add by number\n` +
        `• *.subsudo del @user* — Remove by mention\n` +
        `• *.subsudo del 919876543210* — Remove by number\n` +
        `• *.subsudo list* — Show all sub sudo users\n\n` +
        `💡 Sub sudo users can use all *general* commands.\n` +
        `🚫 They *cannot* use admin commands or owner commands.\n` +
        `🔄 Promoting to sudo *automatically removes* sub sudo (and vice versa).`
      );

    } catch (err) {
      await extra.reply(`❌ Error: ${err.message}`);
    }
  },
};
