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

/**
 * Search YouTube Music using Data API v3 (category 10 + contentDetails Shorts filter)
 * with zero-quota yt-search fallback.
 */
const youtubeSearch = async (query, { maxResults = 10, videoCategoryId = '10' } = {}) => {
  const keys = getApiKeys();

  for (const key of keys) {
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
        timeout: 8000,
      });

      const rawItems = res.data.items || [];
      const ids = rawItems.map((i) => i.id?.videoId).filter(Boolean);

      // Fetch exact durations (1 quota unit total) to strip all <60s Shorts
      const durations = {};
      if (ids.length > 0) {
        try {
          const vRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
            params: { part: 'contentDetails', id: ids.join(','), key },
            timeout: 8000,
          });
          for (const v of vRes.data.items || []) {
            durations[v.id] = parseIsoDuration(v.contentDetails?.duration || '');
          }
        } catch {}
      }

      const filtered = rawItems
        .filter((item) => isMusicCandidate(item.snippet?.title, durations[item.id?.videoId] || 0))
        .slice(0, maxResults)
        .map((item) => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        }));

      if (filtered.length > 0) return filtered;
    } catch (err) {
      const status = err.response?.status;
      console.warn(`[YT API] Key failed (${status || err.message}), trying next/fallback...`);
    }
  }

  // Zero-quota fallback via yt-search: bias toward songs when query has no music keyword
  const searchTerm = HAS_MUSIC_WORD_RE.test(query) ? query : `${query} song`;
  const r = await yts(searchTerm);
  return (r.videos || [])
    .filter((v) => isMusicCandidate(v.title, v.seconds || 0))
    .slice(0, maxResults)
    .map((v) => ({
      videoId: v.videoId,
      title: v.title,
      channel: v.author?.name || 'YouTube',
      thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    }));
};

module.exports = { youtubeSearch };
