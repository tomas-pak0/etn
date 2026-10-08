package lt.tyliaitpk.etn;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.util.Locale;

public class TrackingService extends Service implements LocationListener {
    public static final String ACTION_STOP = "lt.tyliaitpk.etn.STOP_TRACKING";
    private static final String ACTION_LANGUAGE = "lt.tyliaitpk.etn.UPDATE_LANGUAGE";
    private static final String CHANNEL = "etn-location";
    private static final String FILENAME = "pending-locations.jsonl";
    private static final String PREFS = "etn-native";
    private static final Object FILE_LOCK = new Object();
    private static FixDatabase fixDatabase;
    private LocationManager locations;
    private long lastGpsAt;
    private float lastGpsAccuracy = Float.MAX_VALUE;
    private BackgroundDiscoveries discoveries;

    static boolean isRunning(Context context) {
        return context.getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean("running", false);
    }
    private void setRunning(boolean value) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("running", value).apply();
    }
    private static File queue(Context context) { return new File(context.getFilesDir(), FILENAME); }
    private static class FixDatabase extends SQLiteOpenHelper {
        FixDatabase(Context context) { super(context.getApplicationContext(), "etn-fixes.db", null, 1); }
        @Override public void onCreate(SQLiteDatabase db) {
            db.execSQL("CREATE TABLE fixes (id INTEGER PRIMARY KEY, data TEXT NOT NULL)");
        }
        @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {}
    }
    private static SQLiteDatabase database(Context context) {
        if (fixDatabase == null) fixDatabase = new FixDatabase(context);
        SQLiteDatabase db = fixDatabase.getWritableDatabase();
        // The previous version used a capped JSONL queue. Import its remaining
        // fixes before deleting it, so pending background trips survive updates.
        File old = queue(context);
        if (old.exists()) {
            db.beginTransaction();
            try (BufferedReader input = new BufferedReader(new FileReader(old))) {
                String line;
                while ((line = input.readLine()) != null) {
                    try {
                        JSONObject fix = new JSONObject(line);
                        android.content.ContentValues values = new android.content.ContentValues();
                        values.put("id", fix.getLong("id"));
                        values.put("data", line);
                        db.insertWithOnConflict("fixes", null, values, SQLiteDatabase.CONFLICT_IGNORE);
                    } catch (Exception ignored) {}
                }
                db.setTransactionSuccessful();
            } catch (Exception ignored) {
                return db;
            } finally { db.endTransaction(); }
            old.delete();
        }
        return db;
    }
    static String pendingFixes(Context context) {
        synchronized (FILE_LOCK) {
            JSONArray result = new JSONArray();
            try (Cursor cursor = database(context).rawQuery(
                "SELECT data FROM fixes ORDER BY id LIMIT 1000", null)) {
                while (cursor.moveToNext()) result.put(new JSONObject(cursor.getString(0)));
            } catch (Exception ignored) {
            }
            return result.toString();
        }
    }
    static void ackFixes(Context context, long lastId) {
        synchronized (FILE_LOCK) {
            try {
                database(context).execSQL("DELETE FROM fixes WHERE id <= ?", new Object[]{lastId});
            } catch (Exception ignored) {}
        }
    }
    static String language(Context context) {
        return context.getSharedPreferences(PREFS, MODE_PRIVATE)
            .getString("language", Locale.getDefault().getLanguage());
    }
    static void setLanguage(Context context, String language) {
        if (language == null || !language.matches("de|en|es|fr|it|lt|lv|pl|ru|uk")
            || language.equals(language(context))) return;
        context.getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("language", language).apply();
        if (isRunning(context)) context.startService(new Intent(context, TrackingService.class).setAction(ACTION_LANGUAGE));
    }
    private String label(String key) {
        String language = language(this);
        switch (language) {
            case "lt": return key.equals("title") ? "ETN tyrinėja aplinką" : key.equals("stop") ? "Stabdyti" : "Vieta fiksuojama fone";
            case "lv": return key.equals("title") ? "ETN pēta apkārtni" : key.equals("stop") ? "Apturēt" : "Atrašanās vieta tiek saglabāta fonā";
            case "pl": return key.equals("title") ? "ETN odkrywa okolicę" : key.equals("stop") ? "Zatrzymaj" : "Lokalizacja jest zapisywana w tle";
            case "de": return key.equals("title") ? "ETN erkundet die Umgebung" : key.equals("stop") ? "Stoppen" : "Standort wird im Hintergrund erfasst";
            case "es": return key.equals("title") ? "ETN explora el entorno" : key.equals("stop") ? "Detener" : "La ubicación se guarda en segundo plano";
            case "fr": return key.equals("title") ? "ETN explore les environs" : key.equals("stop") ? "Arrêter" : "Position enregistrée en arrière-plan";
            case "it": return key.equals("title") ? "ETN esplora i dintorni" : key.equals("stop") ? "Ferma" : "Posizione registrata in background";
            case "ru": return key.equals("title") ? "ETN исследует окрестности" : key.equals("stop") ? "Остановить" : "Местоположение записывается в фоновом режиме";
            default: return key.equals("title") ? "ETN is exploring" : key.equals("stop") ? "Stop" : "Location is recorded in the background";
        }
    }
    private Notification notification() {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.createNotificationChannel(new NotificationChannel(CHANNEL, "ETN GPS", NotificationManager.IMPORTANCE_LOW));
        PendingIntent open = PendingIntent.getActivity(this, 0,
            new Intent(this, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this, 1,
            new Intent(this, TrackingService.class).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL).setSmallIcon(R.drawable.ic_stat_etn)
            .setContentTitle(label("title")).setContentText(label("body"))
            .setContentIntent(open).setOngoing(true).setCategory(Notification.CATEGORY_SERVICE)
            .addAction(R.drawable.ic_stat_etn, label("stop"), stop).build();
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopTracking(); return START_NOT_STICKY;
        }
        if (intent != null && ACTION_LANGUAGE.equals(intent.getAction())) {
            if (isRunning(this)) ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(1001, notification());
            return START_STICKY;
        }
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
            && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            stopTracking(); return START_NOT_STICKY;
        }
        try {
            if (Build.VERSION.SDK_INT >= 29)
                startForeground(1001, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            else startForeground(1001, notification());
            if (discoveries == null) discoveries = new BackgroundDiscoveries(this);
            if (locations == null) {
                locations = (LocationManager) getSystemService(LOCATION_SERVICE);
                for (String provider : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
                    try {
                        if (locations.isProviderEnabled(provider))
                            locations.requestLocationUpdates(provider, 0L, 0f, this, Looper.getMainLooper());
                    } catch (IllegalArgumentException | SecurityException ignored) {}
                }
                for (String provider : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
                    try {
                        Location last = locations.getLastKnownLocation(provider);
                        if (last != null && System.currentTimeMillis() - last.getTime() < 120000
                            && last.hasAccuracy() && last.getAccuracy() <= 100f) onLocationChanged(last);
                    } catch (SecurityException ignored) {}
                }
            }
            setRunning(true);
        } catch (SecurityException ex) { stopTracking(); return START_NOT_STICKY; }
        return START_STICKY;
    }
    @Override public void onLocationChanged(Location location) {
        if (!location.hasAccuracy() || location.getAccuracy() > 100f) return;
        long now = SystemClock.elapsedRealtime();
        if (LocationManager.GPS_PROVIDER.equals(location.getProvider())) {
            lastGpsAt = now; lastGpsAccuracy = location.getAccuracy();
        } else if (now - lastGpsAt < 5000 && location.getAccuracy() >= lastGpsAccuracy) return;
        if (discoveries != null) discoveries.accept(location.getLatitude(), location.getLongitude());
        synchronized (FILE_LOCK) {
            try {
                long previous = getSharedPreferences(PREFS, MODE_PRIVATE).getLong("lastId", 0);
                long id = Math.max(System.currentTimeMillis() * 1000, previous + 1);
                getSharedPreferences(PREFS, MODE_PRIVATE).edit().putLong("lastId", id).apply();
                JSONObject fix = new JSONObject();
                fix.put("id", id); fix.put("lat", location.getLatitude());
                fix.put("lon", location.getLongitude()); fix.put("accuracy", location.getAccuracy());
                fix.put("time", location.getTime());
                if (location.hasSpeed()) fix.put("speed", location.getSpeed());
                if (location.hasBearing()) fix.put("bearing", location.getBearing());
                if (location.hasBearingAccuracy()) fix.put("bearingAccuracy", location.getBearingAccuracyDegrees());
                android.content.ContentValues values = new android.content.ContentValues();
                values.put("id", id); values.put("data", fix.toString());
                database(this).insertOrThrow("fixes", null, values);
            } catch (Exception ignored) {}
        }
    }
    private void stopTracking() {
        setRunning(false);
        if (locations != null) { locations.removeUpdates(this); locations = null; }
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf();
    }
    @Override public void onDestroy() {
        if (discoveries != null) discoveries.close();
        if (locations != null) locations.removeUpdates(this);
        setRunning(false);
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
