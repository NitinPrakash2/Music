package com.relaxify.app;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Environment;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.schabi.newpipe.extractor.NewPipe;
import org.schabi.newpipe.extractor.ServiceList;
import org.schabi.newpipe.extractor.downloader.Downloader;
import org.schabi.newpipe.extractor.downloader.Request;
import org.schabi.newpipe.extractor.downloader.Response;
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException;
import org.schabi.newpipe.extractor.stream.AudioStream;
import org.schabi.newpipe.extractor.stream.StreamInfo;

import java.io.IOException;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.RequestBody;
import okhttp3.ResponseBody;

@CapacitorPlugin(name = "RelaxifyAudio")
public class RelaxifyAudioPlugin extends Plugin {
    private static final ExecutorService executor = Executors.newCachedThreadPool();
    private static volatile boolean initialized = false;

    private static synchronized void ensureInit() {
        if (initialized) return;
        NewPipe.init(new OkHttpDownloader());
        initialized = true;
    }

    private AudioStream pickBestAudio(List<AudioStream> streams) {
        if (streams == null || streams.isEmpty()) return null;
        return streams.stream()
            .filter(s -> s.getContent() != null && !s.getContent().isEmpty())
            .max(Comparator
                .comparingInt((AudioStream s) -> (s.getFormat() != null && "m4a".equalsIgnoreCase(s.getFormat().getSuffix())) ? 1 : 0)
                .thenComparingInt(AudioStream::getAverageBitrate))
            .orElse(streams.get(0));
    }

    @PluginMethod
    public void getStreamUrl(PluginCall call) {
        String videoId = call.getString("videoId");
        if (videoId == null || videoId.trim().isEmpty()) {
            call.reject("videoId is required");
            return;
        }
        executor.execute(() -> {
            try {
                ensureInit();
                String ytUrl = "https://www.youtube.com/watch?v=" + videoId.trim();
                StreamInfo info = StreamInfo.getInfo(ServiceList.YouTube, ytUrl);
                AudioStream best = pickBestAudio(info.getAudioStreams());
                if (best == null || best.getContent() == null) {
                    call.reject("No audio stream found");
                    return;
                }
                JSObject ret = new JSObject();
                ret.put("url", best.getContent());
                ret.put("mimeType", best.getFormat() != null ? best.getFormat().getMimeType() : "audio/mp4");
                ret.put("duration", info.getDuration());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Extraction failed: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void downloadAudio(PluginCall call) {
        String videoId = call.getString("videoId");
        String title = call.getString("title", "relaxify-track");
        if (videoId == null || videoId.trim().isEmpty()) {
            call.reject("videoId is required");
            return;
        }
        executor.execute(() -> {
            try {
                ensureInit();
                String ytUrl = "https://www.youtube.com/watch?v=" + videoId.trim();
                StreamInfo info = StreamInfo.getInfo(ServiceList.YouTube, ytUrl);
                AudioStream best = pickBestAudio(info.getAudioStreams());
                if (best == null || best.getContent() == null) {
                    call.reject("No audio stream found");
                    return;
                }

                String ext = best.getFormat() != null ? best.getFormat().getSuffix() : "m4a";
                String safeTitle = title.replaceAll("[\\\\/:*?\"<>|]", "").trim();
                if (safeTitle.isEmpty()) safeTitle = "relaxify-track";
                if (safeTitle.length() > 80) safeTitle = safeTitle.substring(0, 80);

                DownloadManager.Request req = new DownloadManager.Request(Uri.parse(best.getContent()));
                req.setTitle(safeTitle);
                req.setDescription("Downloading audio via Relaxify");
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, safeTitle + "." + ext);

                DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm == null) {
                    call.reject("DownloadManager unavailable");
                    return;
                }
                long id = dm.enqueue(req);
                JSObject ret = new JSObject();
                ret.put("downloadId", id);
                ret.put("filename", safeTitle + "." + ext);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Download failed: " + e.getMessage(), e);
            }
        });
    }

    private static class OkHttpDownloader extends Downloader {
        private static final String USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
        private final OkHttpClient client = new OkHttpClient.Builder().build();

        @Override
        public Response execute(Request request) throws IOException, ReCaptchaException {
            okhttp3.Request.Builder builder = new okhttp3.Request.Builder()
                .url(request.url())
                .header("User-Agent", USER_AGENT);

            for (Map.Entry<String, List<String>> entry : request.headers().entrySet()) {
                for (String val : entry.getValue()) {
                    builder.addHeader(entry.getKey(), val);
                }
            }

            if (request.dataToSend() != null) {
                builder.method(request.httpMethod(), RequestBody.create(request.dataToSend(), MediaType.parse("application/json")));
            } else if ("POST".equalsIgnoreCase(request.httpMethod())) {
                builder.post(RequestBody.create(new byte[0], null));
            } else {
                builder.method(request.httpMethod(), null);
            }

            try (okhttp3.Response res = client.newCall(builder.build()).execute()) {
                if (res.code() == 429) {
                    throw new ReCaptchaException("reCaptcha Challenge requested", request.url());
                }
                ResponseBody body = res.body();
                String bodyStr = body != null ? body.string() : "";
                return new Response(
                    res.code(),
                    res.message(),
                    res.headers().toMultimap(),
                    bodyStr,
                    res.request().url().toString()
                );
            }
        }
    }
}
