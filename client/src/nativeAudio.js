import { Capacitor, registerPlugin } from '@capacitor/core';

const RelaxifyAudio = registerPlugin('RelaxifyAudio');

export const isNativeAndroid = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export const resolveStreamUrl = async (videoId, apiBase = '') => {
  if (isNativeAndroid()) {
    const res = await RelaxifyAudio.getStreamUrl({ videoId });
    return res.url;
  }
  return `${apiBase}/api/stream?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
};

export const triggerTrackDownload = async (item, apiBase = '') => {
  if (isNativeAndroid()) {
    return RelaxifyAudio.downloadAudio({
      videoId: item.videoId,
      title: item.title || 'relaxify-track',
    });
  }
  const url = `${apiBase}/api/stream/download?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${item.videoId}`)}&title=${encodeURIComponent(item.title || 'relaxify-track')}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `${item.title || 'relaxify-track'}.mp3`;
  document.body.appendChild(a);
  a.click();
  a.remove();
};
