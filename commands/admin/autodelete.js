/**
 * Auto Delete System — Per Group
 *
 * Commands:
 *   .autodelete on               → enable group-wide: delete all non-admin messages
 *   .autodelete off              → disable group-wide autodelete completely
 *   .autodelete on @user         → enable autodelete for one or more specific users (even admins)
 *   .autodelete off @user        → disable autodelete for one or more specific users only
 *
 * Permission: Group admins only (+ bot owner)
 * Scope: Group only
 *
 * Priority Rules:
 *   • Group-wide ON  → deletes messages from normal (non-admin) members.
 *                      Admin messages are preserved UNLESS that admin is also
 *                      in the mention-specific list.
 *   • Mention-specific list → always deletes that user's messages,
 *                             regardless of whether they are an admin.
 *   • Turning off a mention-specific user only removes them from the list —
 *     it does NOT affect group-wide autodelete or other targeted users.
 *   • .autodelete off (no mentions) disables ONLY the group-wide flag,
 *     but does NOT clear the mention-specific list.
 *
 * Storage (in groups.json via database):
 *   groupSettings.autodelete          → boolean  — group-wide mode
 *   groupSettings.autodeleteUsers     → string[] — JID list of targeted users
 */

const database = require('../../database');

module.exports = {
  name: 'autodelete',
  aliases: ['autodel', 'auto-delete'],
  category: 'admin',
  description: 'Auto-delete messages — group-wide for non-admins, or per-user (even admins)',
  usage: '.autodelete on | .autodelete off | .autodelete on @user | .autodelete off @user',
  groupOnly: true,
  adminOnly: true,

  async execute(sock, msg, args, extra) {
    const { from, reply } = extra;

    // ── Parse sub-command ─────────────────────────────────────────────────
    const sub = (args[0] || '').toLowerCase();

    // ── Resolve mentioned JIDs ────────────────────────────────────────────
    // Mentions are carried in msg.message.extendedTextMessage.contextInfo.mentionedJid
    // Baileys also sets them directly on some message types.
    const mentionedJids = (
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
      msg.message?.contextInfo?.mentionedJid ||
      []
    );

    const hasMentions = mentionedJids.length > 0;

    // ── Status display (no valid sub-command) ─────────────────────────────
    if (!['on', 'off'].includes(sub)) {
      const settings = database.getGroupSettings(from);
      const groupOn  = settings.autodelete ? '🟢 ON' : '🔴 OFF';
      const targeted = (settings.autodeleteUsers || []);
      const targetedLine = targeted.length
        ? `\n📋 *Targeted users:* ${targeted.map(j => '@' + j.split('@')[0]).join(', ')}`
        : '';

      return reply(
        `╭━━『 *Auto Delete* 』━━╮\n\n` +
        `📌 *Group-wide:* ${groupOn}${targetedLine}\n\n` +
        `📖 *Usage:*\n` +
        `• *.autodelete on* — delete all non-admin messages\n` +
        `• *.autodelete off* — disable group-wide autodelete\n` +
        `• *.autodelete on @user* — always delete that user's messages\n` +
        `• *.autodelete off @user* — stop targeting that user\n\n` +
        `ℹ️ Mention-specific settings override the admin exemption.\n\n` +
        `╰━━━━━━━━━━━━━━━╯`
      );
    }

    // ── Fetch current settings ────────────────────────────────────────────
    const settings  = database.getGroupSettings(from);
    // Ensure autodeleteUsers is always an array
    const currentTargeted = Array.isArray(settings.autodeleteUsers)
      ? [...settings.autodeleteUsers]
      : [];

    // ═══════════════════════════════════════════════════════════════════════
    //  .autodelete on
    // ═══════════════════════════════════════════════════════════════════════
    if (sub === 'on') {
      if (hasMentions) {
        // ── Mention-specific mode ──────────────────────────────────────────
        // Add each mentioned JID to the targeted list (deduplicate)
        const added = [];
        for (const jid of mentionedJids) {
          if (!currentTargeted.includes(jid)) {
            currentTargeted.push(jid);
            added.push(jid);
          }
        }

        database.updateGroupSettings(from, { autodeleteUsers: currentTargeted });

        const names = mentionedJids.map(j => '@' + j.split('@')[0]).join(', ');
        return reply(
          `✅ *Mention-specific Auto Delete enabled!*\n\n` +
          `🎯 *Targeted users:* ${names}\n` +
          `🗑️ Their messages will always be deleted, even if they are admins.\n\n` +
          `Use *.autodelete off ${mentionedJids.map(j => '@' + j.split('@')[0]).join(' ')}* to remove them.`
        );
      } else {
        // ── Group-wide mode ────────────────────────────────────────────────
        database.updateGroupSettings(from, { autodelete: true });

        return reply(
          `✅ *Auto Delete enabled!*\n\n` +
          `🗑️ All non-admin messages will now be automatically deleted.\n` +
          `👮 Admin messages are safe (unless specifically targeted).\n\n` +
          `Use *.autodelete off* to disable.`
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  .autodelete off
    // ═══════════════════════════════════════════════════════════════════════
    if (sub === 'off') {
      if (hasMentions) {
        // ── Remove specific users from the targeted list ───────────────────
        const removed = [];
        const notFound = [];

        for (const jid of mentionedJids) {
          const idx = currentTargeted.indexOf(jid);
          if (idx !== -1) {
            currentTargeted.splice(idx, 1);
            removed.push(jid);
          } else {
            notFound.push(jid);
          }
        }

        database.updateGroupSettings(from, { autodeleteUsers: currentTargeted });

        const names = mentionedJids.map(j => '@' + j.split('@')[0]).join(', ');
        let msg_ = `✅ *Mention-specific Auto Delete updated!*\n\n`;

        if (removed.length) {
          msg_ += `🔓 *Removed:* ${removed.map(j => '@' + j.split('@')[0]).join(', ')}\n`;
          msg_ += `💬 Their messages will no longer be automatically deleted.\n`;
        }
        if (notFound.length) {
          msg_ += `\nℹ️ *Not in list:* ${notFound.map(j => '@' + j.split('@')[0]).join(', ')}`;
        }
        if (currentTargeted.length) {
          msg_ += `\n\n📋 *Still targeted:* ${currentTargeted.map(j => '@' + j.split('@')[0]).join(', ')}`;
        }

        return reply(msg_);
      } else {
        // ── Disable group-wide autodelete only ────────────────────────────
        database.updateGroupSettings(from, { autodelete: false });

        const stillTargeted = currentTargeted.length
          ? `\n\nℹ️ *Note:* ${currentTargeted.length} user(s) are still in the mention-specific list.\nUse *.autodelete off @user* to remove them individually.`
          : '';

        return reply(
          `✅ *Auto Delete disabled!*\n\n` +
          `💬 Group-wide message auto-deletion has been turned off.${stillTargeted}`
        );
      }
    }
  }
};
