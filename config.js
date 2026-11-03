/**
 * Global Configuration for WhatsApp MD Bot
 */

module.exports = {
    // Bot Owner Configuration
    ownerNumber: ['94719929872'], // Add your number without + or spaces (e.g., 919876543210)
    ownerName: ["Afnan's Bot", 'Professor'], // Owner names corresponding to ownerNumber array
    
    // Bot Configuration
    botName: "Afnan's Bot",
    prefix: '.',
    sessionName: 'session',
    sessionID: process.env.SESSION_ID || 'KnightBot!H4sIAAAAAAAAA5VU25KiSBT8l3rVGJGLgBEdsSCgNILgXTf2oZoqsAQKhBLECf99A3t6eh52Z3vf6hZ58mTmqe+A5qTCDm7B+DsoSlJDhrslawsMxkC/RhEuQR8gyCAYg8RZrriRYA2WM6lVi2ElzJv2qG0HnMUZywXHZ6Mw4Goa8NULePRBcX1LSfgbwNdX5Bz1Q8V5A2MtHvOR4Q4OQUu2p5No8beA2HORFt6mt1dewKNDhKQkNDaLE85wCVMHtz4k5dfoX2borPj5eaa72LPqhSs6iXktnb1+Q5xJhhP/Hi+mBmS7zdfoI/FtoebY0j3O4g/nWhlcTGu71XeHS/n25hqJeXpLUx/q5/idfkViipGNMGWEtV/WfWrFeNMu7Mk+EaIgnK7PBzWeVo5WzBLeJuHSGsF0e0d6EnyNuKbeDWcliK58SY6jjQ6lw9tgdHUar2XuyHJejYT2vJmRr8RfifvlR1aS/6O7aa/9+9Ua6L3QaLbz6QVFJzofIWEVvrbLFbxRR9TD8CILX6RviUnW3CVfNH33boW844p7P1eHM3qvtzaSjnC32xxwbO3NT/qQXcvfsTzkmRjXfuBLuDXuc13XEJPUHS8FUpDLbL2Zt5XC1D22osl15haTemhzh2UGy73m4/VucAtrXqkrcuOFoJo63oXetObl2VGCWxuB8fDRByWOScVKyEhOn2eq0AcQ1Ssclpg95QVHa3qVEN/4i9uwtwhF93BTtkPZQxMrjAY8t+ZCaVCky926eQF9UJR5iKsKoxmpWF62Lq4qGOMKjP/8qw8ovrF347pywrAPIlJWbEOvRZpD9OHqxyUMw/xK2aql4aRb4BKMuc9jzBihcdXpeKWwDE+kxpMTZBUYRzCt8M8OcYkRGLPyin9O7SRHT+G13d4z5i7og+xpCEFgDFRRHqoqryoyPx4Kf1Tfmg4VFsU3ihnog/T5ipdFnldVSRwKCq8q3cvu4vGTYIeHMIMkrcAYTLx5JimBYXoXm7JwOtXMWJvEGvhs6CMZ78oT21fWxm25we5lZvPIcXbZBC7TC45rCA3YBi2mOz6KbsHLP4B02Uxcvs6mMCav60WzUUeXrcY1+54qVvpJWrSslg03EhpFP6cW1cPwOMh2Oo1SuHw9Swd9z2bFUolxEBwrM9DPZhpPNe2lq4ZwTUL8a7Gmh9xVxJKRozvePZqrmlgrQfm6Ppklb5+pyqeyHBt3r3crZoU8yZOT3kOe5cnMiCFvpunuqEwlt1jqGhkFF2e0bozgPbPPmUl//FXkmabOqm4bEfwcfQo7A//TunfeXcC4R/8XiB9/yb/Mo34gxsBslM12dnZOrUdXJC3iLDlCms/5LOarxKXFkFFB2YDH468+KFLIorzMwBhAisqcINAHZX7tEmvTKP9NsYlu23oQe13jKayY9jkFa5LhisGsAOOhrAqSJEuq8vgbWn9UDzsHAAA=',
    newsletterJid: '', // Newsletter JID for menu forwarding

    // Telegram Bot API token (for .tgsticker / .tginfo) — get one from @BotFather.
    // This is a SEPARATE bot/token from your WhatsApp session; it's only used
    // to call Telegram's getStickerSet/getFile endpoints.
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '8901027396:AAFQKdya5fdtQtBU-ugsvxV13kCUe8un_MI',
    updateZipUrl: 'https://github.com/afnanjanooskan/Afnan-bot/archive/refs/heads/main.zip', // URL to latest code zip for .update command
    
    // Sticker Configuration
    packname: "Afnan's Bot",
    
    // Bot Behavior
    selfMode: false, // Private mode - only owner can use commands
    autoRead: false,
    autoTyping: false,
    autoBio: false,
    autoSticker: false,
    autoReact: false,
    autoReactMode: 'bot', // set bot or all via cmd
    autoDownload: false,
    dmMute: false, // DM Mute - block command execution in private chat (owner/sudo bypass)
    dmAutoReply: false, // DM Auto Reply - auto reply to every incoming private message
    dmAutoReplyMessage: "👋 Hi! I'm currently unavailable. I'll get back to you soon.", // Auto reply message (editable by owner)
    dmOffList: [], // Per-chat exceptions: chats in this list will NOT receive auto reply even when global is ON
    groupAutoReply: false, // Group Auto Reply - global ON/OFF (owner sets from DM)
    groupAutoReplyMessage: "👋 Hey! I noticed you mentioned me. How can I help?", // Group auto reply message (editable by owner)
    groupAutoReplyEditMode: false, // When true: edit previous auto-reply. When false: always send fresh reply.
    
    // Group Settings Defaults
    defaultGroupSettings: {
      antilink: false,
      antilinkAction: 'delete',   // 'delete', 'kick', 'warn'
      antilinkWa: false,          // Blocks only WhatsApp group invite links (mutually exclusive with antilink)
      antilinkWaAction: 'delete', // 'delete', 'kick', 'warn'      antiall: false, // Owner only - blocks all messages from non-admins
      antibot: false,
      anticall: false, // Anti-call feature
      antigroupmention: false, // Anti-group mention feature
      antigroupmentionAction: 'kick',   // always kick for status mention
      welcome: false,
      welcomeMessage: null, // null = use built-in DEFAULT_WELCOME in handler.js
      goodbye: false,
      goodbyeMessage: 'Goodbye @user 👋 We will never miss you!',
      antiSpam: false,
      antidelete: false,
      nsfw: false,
      detect: false,
      chatbot: false,
      autosticker: false, // Auto-convert images/videos to stickers
      antichannel: false,         // Block WhatsApp channel shares
      antichannelAction: 'kick',  // 'delete', 'warn', 'kick'  — kick is the default
      antiviewonce: false,        // Block view-once (one-view) images/videos in group
      antiviewonceAction: 'warn', // 'delete', 'warn', 'kick'
      antimedia: false,           // Block all photos and videos in group
      antimediaAction: 'kick',    // 'delete', 'warn', 'kick'
      antistickerSpam: false,          // Block sticker spam
      antistickerSpamAction: 'delete', // 'delete', 'warn', 'kick'
      antistickerSpamCount: 6,         // Stickers within timeGap before action
      antistickerSpamTimegap: 3,       // Seconds between stickers before counting as spam
      antimessageSpam: false,          // Block message spam
      antimessageSpamAction: 'delete', // 'delete', 'warn', 'kick'
      antimessageSpamCount: 6,         // Messages within timeGap before action
      antimessageSpamTimegap: 3,       // Seconds between messages before counting as spam
      autodelete: false,               // Auto-delete non-admin messages in group
      enabled: true,                   // Whether bot responds to commands in this group
      groupAutoReplyOverride: null,    // null = follow global setting | true = forced ON | false = forced OFF
    },
    
    // API Keys (add your own)
    apiKeys: {
      // Add API keys here if needed
      openai: '',
      deepai: '',
      remove_bg: ''
    },
    
    // Message Configuration
    messages: {
      wait: '⏳ Please wait...',
      success: '✅ Success!',
      error: '❌ Error occurred!',
      ownerOnly: '👑 This command is only for bot owner!',
      adminOnly: '🛡️ This command is only for group admins!',
      groupOnly: '👥 This command can only be used in groups!',
      privateOnly: '💬 This command can only be used in private chat!',
      botAdminNeeded: '🤖 Bot needs to be admin to execute this command!',
      invalidCommand: '❓ Invalid command! Type .menu for help'
    },
    
    // Timezone
    timezone: 'Asia/Kolkata',
    
    // Limits
    maxWarnings: 3,
    
    // Social Links (optional)
    social: {
      github: 'https://github.com/mruniquehacker',
      instagram: 'https://instagram.com/yourusername',
      youtube: 'http://youtube.com/@mr_unique_hacker'
    }
};
  
