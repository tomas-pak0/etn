package lt.tyliaitpk.etn;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final int LOCATION_REQUEST = 11;
    private static final int TRACK_REQUEST = 12;
    private static final int NOTIFICATION_REQUEST = 13;
    private static final int EXPORT_REQUEST = 14;
    private String pendingExport;
    static volatile boolean visible;
    private WebView webView;
    private GeolocationPermissions.Callback pendingGeolocation;
    private String pendingOrigin;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(0xff090d11);
        getWindow().setNavigationBarColor(0xff090d11);
        webView = new WebView(this);
        webView.setBackgroundColor(0xff090d11);
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(0xff090d11);
        frame.addView(webView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        if (Build.VERSION.SDK_INT >= 35) {
            frame.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        setContentView(frame);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface public String deviceLanguage() { return Locale.getDefault().getLanguage(); }
            @JavascriptInterface public boolean isTracking() { return TrackingService.isRunning(MainActivity.this); }
            @JavascriptInterface public String pendingFixes() { return TrackingService.pendingFixes(MainActivity.this); }
            @JavascriptInterface public void ackFixes(long lastId) { TrackingService.ackFixes(MainActivity.this, lastId); }
            @JavascriptInterface public void startTracking() { runOnUiThread(() -> requestTracking()); }
            @JavascriptInterface public void stopTracking() {
                runOnUiThread(() -> startService(new Intent(MainActivity.this, TrackingService.class)
                    .setAction(TrackingService.ACTION_STOP)));
            }
            @JavascriptInterface public void exportCsv(String name, String csv) {
                exportFile(name, csv, "text/csv");
            }
            @JavascriptInterface public void exportFile(String name, String content, String mime) {
                runOnUiThread(() -> {
                    pendingExport = content;
                    Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    save.addCategory(Intent.CATEGORY_OPENABLE);
                    save.setType("text/plain".equals(mime) ? "text/plain" : "text/csv");
                    save.putExtra(Intent.EXTRA_TITLE, name);
                    startActivityForResult(save, EXPORT_REQUEST);
                });
            }
        }, "ETNNative");
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!ORIGIN.equals(uri.getScheme() + "://" + uri.getHost())) return null;
                String path = uri.getPath();
                if (path == null || path.contains("..") || !path.startsWith("/")) return missing();
                if (path.equals("/")) path = "/index.html";
                try {
                    InputStream file = getAssets().open(path.substring(1));
                    String mime = path.endsWith(".html") ? "text/html"
                        : path.endsWith(".css") ? "text/css"
                        : path.endsWith(".js") ? "text/javascript"
                        : path.endsWith(".svg") ? "image/svg+xml"
                        : path.endsWith(".png") ? "image/png" : "application/octet-stream";
                    return new WebResourceResponse(mime, "UTF-8", file);
                } catch (IOException ex) { return missing(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (ORIGIN.equals(uri.getScheme() + "://" + uri.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(String origin,
                    GeolocationPermissions.Callback callback) {
                if (!ORIGIN.equals(origin) && !(ORIGIN + "/").equals(origin)) {
                    callback.invoke(origin, false, false);
                    return;
                }
                if (hasLocation()) callback.invoke(origin, true, false);
                else {
                    pendingGeolocation = callback;
                    pendingOrigin = origin;
                    requestPermissions(new String[]{
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    }, LOCATION_REQUEST);
                }
            }
        });
        webView.loadUrl(ORIGIN + "/index.html");
    }

    private WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
            java.util.Collections.emptyMap(),
            new java.io.ByteArrayInputStream("Not found".getBytes(StandardCharsets.UTF_8)));
    }

    private boolean hasLocation() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestTracking() {
        if (!hasLocation()) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION}, TRACK_REQUEST);
        } else if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_REQUEST);
        } else startTrackingService();
    }
    private void startTrackingService() {
        try {
            startForegroundService(new Intent(this, TrackingService.class));
            webView.evaluateJavascript("window.ETNTrackingStarted&&window.ETNTrackingStarted()", null);
        } catch (Exception ex) {
            webView.evaluateJavascript("window.ETNTrackingDenied&&window.ETNTrackingDenied()", null);
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == LOCATION_REQUEST && pendingGeolocation != null) {
            pendingGeolocation.invoke(pendingOrigin, hasLocation(), false);
            pendingGeolocation = null;
            pendingOrigin = null;
        }
        if (requestCode == TRACK_REQUEST) {
            if (hasLocation()) requestTracking();
            else webView.evaluateJavascript("window.ETNTrackingDenied&&window.ETNTrackingDenied()", null);
        }
        if (requestCode == NOTIFICATION_REQUEST) {
            startTrackingService();
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                webView.evaluateJavascript("window.ETNNotificationDenied&&window.ETNNotificationDenied()", null);
        }
    }

    @Override protected void onResume() {
        super.onResume();
        visible = true;
        if (webView != null) webView.evaluateJavascript("window.ETNSyncNative&&window.ETNSyncNative()", null);
    }
    @Override protected void onPause() {
        visible = false;
        super.onPause();
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != EXPORT_REQUEST) return;
        if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingExport != null) {
            try (java.io.OutputStream output = getContentResolver().openOutputStream(data.getData())) {
                if (output != null) output.write(pendingExport.getBytes(StandardCharsets.UTF_8));
            } catch (IOException ignored) {}
        }
        pendingExport = null;
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
