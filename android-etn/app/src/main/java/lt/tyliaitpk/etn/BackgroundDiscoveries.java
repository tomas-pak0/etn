package lt.tyliaitpk.etn;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.GZIPInputStream;

/** Processes fixes in the foreground service, even when the WebView is suspended. */
final class BackgroundDiscoveries {
    private static final String CHANNEL = "etn-discoveries";
    private final Context context;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private JSONObject boundaries, centers;
    private final Map<String, JSONArray> cache = new LinkedHashMap<String, JSONArray>(16, .75f, true) {
        @Override protected boolean removeEldestEntry(Map.Entry<String, JSONArray> entry) { return size() > 12; }
    };
    private final Set<String> seen;

    BackgroundDiscoveries(Context context) {
        this.context = context.getApplicationContext();
        seen = new HashSet<>(context.getSharedPreferences("etn-native-discoveries", 0)
            .getStringSet("seen", new HashSet<>()));
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        manager.createNotificationChannel(new NotificationChannel(CHANNEL, "ETN atradimai", NotificationManager.IMPORTANCE_DEFAULT));
    }
    void accept(double lat, double lon) { worker.execute(() -> { try { inspect(lat, lon); } catch (Exception ignored) {} }); }
    void close() { worker.shutdown(); }

    private JSONObject read(String path) throws Exception { return new JSONObject(new String(readBytes(path), java.nio.charset.StandardCharsets.UTF_8)); }
    private JSONArray readArray(String path) throws Exception { return new JSONArray(new String(readBytes(path), java.nio.charset.StandardCharsets.UTF_8)); }
    private byte[] readBytes(String path) throws Exception {
        try (InputStream input = new GZIPInputStream(context.getAssets().open(path));
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192]; int length;
            while ((length = input.read(buf)) != -1) output.write(buf, 0, length);
            return output.toByteArray();
        }
    }
    private JSONArray tile(String id) {
        if (cache.containsKey(id)) return cache.get(id);
        try { JSONArray rows = readArray("data/places/" + id + ".bin"); cache.put(id, rows); return rows; }
        catch (Exception ignored) { cache.put(id, new JSONArray()); return cache.get(id); }
    }
    private static String tileId(double lat, double lon) {
        int y = Math.min(89, Math.max(0, (int) Math.floor((lat + 90) / 2)));
        int x = Math.min(179, Math.max(0, (int) Math.floor((lon + 180) / 2)));
        return String.format(java.util.Locale.ROOT, "%02d-%03d", y, x);
    }
    private static boolean ring(JSONArray points, double lat, double lon) {
        boolean inside = false;
        for (int i = 0, j = points.length() - 1; i < points.length(); j = i++) {
            JSONArray a = points.optJSONArray(i), b = points.optJSONArray(j);
            if (a == null || b == null) continue;
            double yi = a.optDouble(1), yj = b.optDouble(1), xi = a.optDouble(0), xj = b.optDouble(0);
            if ((yi > lat) != (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
    }
    private static boolean polygon(JSONArray rings, double lat, double lon) {
        if (rings == null || rings.length() == 0 || !ring(rings.optJSONArray(0), lat, lon)) return false;
        for (int i = 1; i < rings.length(); i++) if (ring(rings.optJSONArray(i), lat, lon)) return false;
        return true;
    }
    private String country(double lat, double lon) throws Exception {
        if (boundaries == null) boundaries = read("data/countries-50m.bin");
        JSONArray features = boundaries.getJSONArray("features");
        for (int i = 0; i < features.length(); i++) {
            JSONObject feature = features.getJSONObject(i);
            JSONArray bbox = feature.optJSONArray("bbox");
            if (bbox != null && (lon < bbox.optDouble(0) || lat < bbox.optDouble(1) || lon > bbox.optDouble(2) || lat > bbox.optDouble(3))) continue;
            JSONObject geom = feature.optJSONObject("geometry"); if (geom == null) continue;
            JSONArray coords = geom.optJSONArray("coordinates"); if (coords == null) continue;
            boolean match = false;
            if ("Polygon".equals(geom.optString("type"))) match = polygon(coords, lat, lon);
            else for (int k = 0; k < coords.length(); k++) if (polygon(coords.optJSONArray(k), lat, lon)) { match = true; break; }
            if (match) return feature.getJSONObject("properties").optString("code");
        }
        return "";
    }
    private static double distance(double lat, double lon, double y, double x) {
        return Math.hypot((lon - x) * 111320 * Math.cos(Math.toRadians(lat)), (lat - y) * 111320);
    }
    private static double radius(JSONArray row) {
        String feature = row.optString(5); int population = row.optInt(8);
        if (feature.equals("PPLC") || feature.equals("PPLA") || population >= 100000) return 1000;
        if (feature.startsWith("PPLA") || population >= 10000) return 700;
        return population >= 1000 ? 500 : 350;
    }
    private void inspect(double lat, double lon) throws Exception {
        String code = country(lat, lon); if (code.length() != 2) return;
        discover("c:" + code, "country", code, code);
        if (centers == null) centers = read("data/centers-index.bin");
        JSONObject centerTiles = centers.getJSONObject("tiles");
        Set<String> ids = new HashSet<>();
        for (double dy : new double[]{-.015, 0, .015}) for (double dx : new double[]{-.04, 0, .04}) ids.add(tileId(lat + dy, lon + dx));
        for (String id : ids) {
            JSONArray places = tile(id);
            for (int i = 0; i < places.length(); i++) {
                JSONArray row = places.optJSONArray(i);
                if (row != null && code.equals(row.optString(4))
                    && distance(lat, lon, row.optDouble(2), row.optDouble(3)) <= radius(row))
                    discover("p:" + code + ":" + row.optLong(0), "settlement", row.optString(1), code);
            }
            JSONArray localCenters = centerTiles.optJSONArray(id);
            if (localCenters == null) continue;
            for (int i = 0; i < localCenters.length(); i++) {
                JSONArray row = localCenters.optJSONArray(i);
                if (row != null && code.equals(row.optString(5))
                    && distance(lat, lon, row.optDouble(3), row.optDouble(4)) <= 1000)
                    discover("m:" + row.optString(0), "center", row.optString(2), code);
            }
        }
    }
    private void discover(String key, String type, String name, String code) {
        if (!seen.add(key)) return;
        context.getSharedPreferences("etn-native-discoveries", 0).edit().putStringSet("seen", new HashSet<>(seen)).apply();
        if (MainActivity.visible || (Build.VERSION.SDK_INT >= 33 &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)) return;
        String language = TrackingService.language(context);
        String title = "lt".equals(language) ? type.equals("country") ? "Atrasta nauja šalis" : type.equals("center") ? "Atrastas savivaldybės centras" : "Atrasta gyvenvietė"
            : "ru".equals(language) ? type.equals("country") ? "Открыта новая страна" : type.equals("center") ? "Открыт административный центр" : "Открыт населённый пункт"
            : type.equals("country") ? "New country discovered" : type.equals("center") ? "Administrative center discovered" : "Settlement discovered";
        PendingIntent open = PendingIntent.getActivity(context, 0, new Intent(context, MainActivity.class),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification note = new Notification.Builder(context, CHANNEL).setSmallIcon(R.drawable.ic_stat_etn)
            .setContentTitle(title).setContentText(name + " · " + code).setContentIntent(open)
            .setAutoCancel(true).build();
        ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).notify(key.hashCode(), note);
    }
}
