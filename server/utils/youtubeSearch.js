const axios = require('axios');
const yts = require('yt-search');

const getApiKeys = () => {
  const multi = (process.env.YOUTUBE_API_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const single = (process.env.YOUTUBE_API_KEY || '').trim();
  if (single && !multi.includes(single)) multi.unshift(single);
  return multi;
};

const NON_MUSIC_RE = /(#shorts|\bshorts\b|\byoutube shorts\b|\broast\b|\bvlog\b|\bpodcast\b|\binterview\b|\breaction\b|\bgameplay\b|\bwalkthrough\b|\btrailer\b|\bteaser\b|\bfull movie\b|\bepisode\b|\bunboxing\b|\breview\b|\bwhatsapp status\b|\bstatus video\b)/i;
const HAS_MUSIC_WORD_RE = /\b(song|songs|music|audio|lyrics|lyrical|lofi|remix|rap|track|album|ost|qawwali|ghazal|bhajan|mashup|jukebox|cover)\b/i;

// Cooldown exhausted YT API keys for 15 min so searches don't stall on 403s
const keyCooldowns = new Map();
const KEY_COOLDOWN_MS = 15 * 60 * 1000;

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)),
  ]);

const parseIsoDuration = (iso = '') => {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0, 10) * 3600) + (parseInt(m[2] || 0, 10) * 60) + parseInt(m[3] || 0, 10);
};

const isMusicCandidate = (title = '', seconds = 0) => {
  if (NON_MUSIC_RE.test(title)) return false;
  // Filter out all YouTube Shorts (< 60s) without capping legitimate long songs
  if (seconds > 0 && seconds < 60) return false;
  return true;
};

// Strongly prefer Studio / Official Audio / Topic tracks so duration & timestamps match Spotify/LRCLIB
const audioPriorityScore = (title = '', channel = '') => {
  let s = 0;
  if (/\s*-\s*Topic$/i.test(channel)) s += 5;
  if (/\b(official\s*audio|audio\s*only|provided\s*to\s*youtube)\b/i.test(title)) s += 4;
  if (/\b(lyrical|lyric\s*video|lyrics\s*video|official\s*music\s*video|video\s*song|4k|8k)\b/i.test(title)) s -= 2;
  return s;
};

/**
 * Search YouTube Music using Data API v3 (category 10 + contentDetails Shorts filter)
 * with zero-quota yt-search fallback.
 */
const youtubeSearch = async (query, { maxResults = 10, videoCategoryId = '10' } = {}) => {
  const keys = getApiKeys();

  for (const key of keys) {
    if ((keyCooldowns.get(key) || 0) > Date.now()) continue;
    try {
      const params = {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: Math.min(25, maxResults * 2),
        key,
      };
      if (videoCategoryId) params.videoCategoryId = videoCategoryId;

      const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params,
        timeout: 4000,
      });

      const rawItems = res.data.items || [];
      const ids = rawItems.map((i) => i.id?.videoId).filter(Boolean);

      // Fetch exact durations (1 quota unit total) to strip all <60s Shorts
      const durations = {};
      if (ids.length > 0) {
        try {
          const vRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
            params: { part: 'contentDetails', id: ids.join(','), key },
            timeout: 3500,
          });
          for (const v of vRes.data.items || []) {
            durations[v.id] = parseIsoDuration(v.contentDetails?.duration || '');
          }
        } catch {}
      }

      const filtered = rawItems
        .filter((item) => isMusicCandidate(item.snippet?.title, durations[item.id?.videoId] || 0))
        .map((item, idx) => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
          duration: durations[item.id?.videoId] || 0,
          thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
          _rank: idx - audioPriorityScore(item.snippet.title, item.snippet.channelTitle) * 1.5,
        }))
        .sort((a, b) => a._rank - b._rank)
        .slice(0, maxResults)
        .map(({ _rank, ...rest }) => rest);

      if (filtered.length > 0) return filtered;
    } catch (err) {
      const status = err.response?.status;
      if (status === 403 || status === 429) {
        keyCooldowns.set(key, Date.now() + KEY_COOLDOWN_MS);
      }
      console.warn(`[YT API] Key failed (${status || err.message}), trying next/fallback...`);
    }
  }

  // Zero-quota fallback via yt-search with timeout + retry
  const searchTerm = HAS_MUSIC_WORD_RE.test(query) ? query : `${query} song`;
  let videos = [];
  try {
    const r = await withTimeout(yts(searchTerm), 6500);
    videos = r?.videos || [];
  } catch {
    if (searchTerm !== query) {
      try {
        const r2 = await withTimeout(yts(query), 6500);
        videos = r2?.videos || [];
      } catch {}
    }
  }
  return videos
    .filter((v) => isMusicCandidate(v.title, v.seconds || 0))
    .map((v, idx) => ({
      videoId: v.videoId,
      title: v.title,
      channel: v.author?.name || 'YouTube',
      duration: v.seconds || 0,
      thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
      _rank: idx - audioPriorityScore(v.title, v.author?.name || '') * 1.5,
    }))
    .sort((a, b) => a._rank - b._rank)
    .slice(0, maxResults)
    .map(({ _rank, ...rest }) => rest);
};

module.exports = { youtubeSearch };
