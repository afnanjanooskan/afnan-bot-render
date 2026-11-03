/**
 * Song Downloader - WORKING ON KATABUMP 2026 - No key needed
 */

const yts = require('yt-search');
const axios = require('axios');
const { toAudio } = require('../../utils/converter');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function resolveVideo(text) {
  const res = await yts(text);
  if (!res?.videos?.length) return null;
  return res.videos[0];
}

async function downloadFreeAPI(videoUrl) {
  const apis = [
    // API 1: Ryzendesu - works best on KataBump
    async () => {
      console.log('[song] Trying ryzendesu API...');
      const r = await axios.get(`https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(videoUrl)}`, {
        timeout: 30000,
        headers: { 'User-Agent': UA },
      });
      const link = r.data?.url || r.data?.downloadUrl || r.data?.result?.url || r.data?.data?.url;
      console.log('[song] ryzendesu response:', JSON.stringify(r.data).slice(0,400));
      if (!link) throw new Error('no link');
      const file = await axios.get(link, { responseType: 'arraybuffer', timeout: 120000, headers: { 'User-Agent': UA } });
      return Buffer.from(file.data);
    },
    // API 2: SaveTube
    async () => {
      console.log('[song] Trying savetube API...');
      const r = await axios.post('https://api.savetube.me/api/download', 
        { url: videoUrl, format: 'mp3' },
        { timeout: 30000, headers: { 'User-Agent': UA, 'Content-Type': 'application/json' } }
      );
      const link = r.data?.url || r.data?.downloadUrl;
      if (!link) throw new Error('no link');
      const file = await axios.get(link, { responseType: 'arraybuffer', timeout: 120000 });
      return Buffer.from(file.data);
    },
  ];

  for (const api of apis) {
    try {
      const buf = await api();
      if (buf && buf.length > 5000) {
        console.log(`[song] SUCCESS ${buf.length} bytes`);
        return buf;
      }
    } catch (e) {
      console.log(`[song] API failed: ${e.message} ${e.response?.status || ''}`);
    }
  }
  throw new Error('Free APIs failed');
}

module.exports = {
  name: 'song',
  aliases: ['play', 'music'],
  category: 'media',
  async execute(sock, msg, args) {
    const chatId = msg.key.remoteJid;
    try {
      const text = args.join(' ').trim();
      if (!text) return sock.sendMessage(chatId, { text: 'Usage: .song <name>' }, { quoted: msg });
      
      const video = await resolveVideo(text);
      if (!video) return sock.sendMessage(chatId, { text: 'No results' }, { quoted: msg });
      
      await sock.sendMessage(chatId, { text: `🎵 *${video.title}*\n⏳ Downloading...` }, { quoted: msg });
      
      const buf = await downloadFreeAPI(video.url);
      let finalBuf = buf;
      try { 
        const fmt = buf.toString('ascii',0,4) === 'OggS' ? 'ogg' : 'm4a';
        if (fmt !== 'mp3') finalBuf = await toAudio(buf, fmt); 
      } catch(_) {}
      
      await sock.sendMessage(chatId, { audio: finalBuf, mimetype: 'audio/mpeg', fileName: `${video.title}.mp3` }, { quoted: msg });
      
    } catch (err) {
      console.error('[song] Fatal:', err.message);
      await sock.sendMessage(chatId, { text: `❌ Failed: ${err.message}\n\nKataBump IP is blocked. This free API also failed. Try .song with different song or use RapidAPI key method.` }, { quoted: msg });
    }
  },
};
