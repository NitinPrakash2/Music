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

/**
 * Search YouTube using Data API v3 keys with automatic zero-quota yt-search fallback.
 */
const youtubeSearch = async (query, { maxResults = 10, videoCategoryId } = {}) => {
  const keys = getApiKeys();

  for (const key of keys) {
    try {
      const params = {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults,
        key,
      };
      if (videoCategoryId) params.videoCategoryId = videoCategoryId;

      const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params,
        timeout: 8000,
      });

      return res.data.items.map((item) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      }));
    } catch (err) {
      const status = err.response?.status;
      console.warn(`[YT API] Key failed (${status || err.message}), trying next/fallback...`);
    }
  }

  // Zero-quota fallback via yt-search
  const r = await yts(query);
  return (r.videos || []).slice(0, maxResults).map((v) => ({
    videoId: v.videoId,
    title: v.title,
    channel: v.author?.name || 'YouTube',
    thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
  }));
};

module.exports = { youtubeSearch };
