package lt.tyliaitpk.etn;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.IOException;
import java.io.OutputStream;

final class PdfExporter {
    private static final int WIDTH = 595, HEIGHT = 842, PER_PAGE = 9;
    private static final int DARK = Color.rgb(17, 19, 24);
    private static final int RED = Color.rgb(237, 57, 72);
    private static final int MUTED = Color.rgb(101, 110, 116);
    private PdfExporter() {}

    static void write(Context context, String json, OutputStream output) throws Exception {
        JSONObject report = new JSONObject(json);
        JSONArray entries = report.getJSONArray("entries");
        int pages = Math.max(1, (entries.length() + PER_PAGE - 1) / PER_PAGE);
        Bitmap etn = bitmap(context, "branding/etn.png");
        Bitmap brand = bitmap(context, "branding/tyliaitpk.png");
        PdfDocument pdf = new PdfDocument();
        try {
            for (int pageNumber = 0; pageNumber < pages; pageNumber++) {
                PdfDocument.Page page = pdf.startPage(new PdfDocument.PageInfo.Builder(
                    WIDTH, HEIGHT, pageNumber + 1).create());
                Canvas canvas = page.getCanvas();
                header(canvas, etn, brand, report, entries.length());
                Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
                int start = pageNumber * PER_PAGE;
                int end = Math.min(entries.length(), start + PER_PAGE);
                if (start == end) {
                    text(canvas, p, report.optString("empty"), 42, 300, 14, MUTED, false);
                }
                for (int i = start; i < end; i++) {
                    JSONObject entry = entries.getJSONObject(i);
                    int y = 266 + (i - start) * 54;
                    p.setColor(i % 2 == 0 ? Color.rgb(244, 246, 245) : Color.WHITE);
                    canvas.drawRoundRect(new RectF(42, y, 553, y + 49), 8, 8, p);
                    p.setColor(RED);
                    canvas.drawRoundRect(new RectF(42, y, 46, y + 49), 2, 2, p);
                    text(canvas, p, (i + 1) + ". " + entry.optString("name", "–"),
                        57, y + 20, 12, DARK, true, 480);
                    text(canvas, p, report.optString("districtLabel") + ": " +
                        entry.optString("district", "–"), 57, y + 39, 9, MUTED, false, 290);
                    p.setTextAlign(Paint.Align.RIGHT);
                    text(canvas, p, entry.optString("date", "–"), 539, y + 39, 9, MUTED, false, 175);
                    p.setTextAlign(Paint.Align.LEFT);
                }
                p.setColor(Color.rgb(218, 224, 221));
                canvas.drawRect(42, 789, 553, 790, p);
                text(canvas, p, "ETN  •  © TyliaiTPk " + report.optString("year"),
                    42, 813, 9, MUTED, false);
                p.setTextAlign(Paint.Align.RIGHT);
                text(canvas, p, (pageNumber + 1) + " / " + pages, 553, 813, 9, MUTED, false);
                pdf.finishPage(page);
            }
            pdf.writeTo(output);
        } finally {
            pdf.close();
            if (etn != null) etn.recycle();
            if (brand != null) brand.recycle();
        }
    }

    private static Bitmap bitmap(Context context, String asset) {
        try (java.io.InputStream input = context.getAssets().open(asset)) {
            return BitmapFactory.decodeStream(input);
        } catch (IOException ex) {
            return null;
        }
    }

    private static void header(Canvas c, Bitmap etn, Bitmap brand, JSONObject report, int count) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        p.setColor(Color.rgb(250, 251, 249));
        c.drawColor(p.getColor());
        p.setColor(DARK);
        c.drawRect(0, 0, WIDTH, 155, p);
        p.setColor(RED);
        c.drawRect(0, 150, WIDTH, 155, p);
        if (etn != null) c.drawBitmap(etn, null, new RectF(42, 31, 106, 95), p);
        if (brand != null) c.drawBitmap(brand, null, new RectF(505, 34, 551, 80), p);
        text(c, p, "ETN", 118, 63, 26, Color.WHITE, true);
        text(c, p, "Explore the Neighborhood", 118, 83, 10,
            Color.rgb(185, 196, 192), false);
        p.setTextAlign(Paint.Align.RIGHT);
        text(c, p, "TyliaiTPk", 551, 111, 13, Color.WHITE, true);
        p.setTextAlign(Paint.Align.LEFT);
        text(c, p, report.optString("title"), 42, 195, 20, DARK, true, 510);
        text(c, p, report.optString("generated"), 42, 220, 10, MUTED, false, 510);
        text(c, p, report.optString("countLabel") + ": " + count, 42, 242, 11, RED, true);
    }

    private static void text(Canvas c, Paint p, String value, float x, float y,
                             float size, int color, boolean bold) {
        text(c, p, value, x, y, size, color, bold, 0);
    }
    private static void text(Canvas c, Paint p, String value, float x, float y,
                             float size, int color, boolean bold, float maxWidth) {
        p.setColor(color);
        p.setTextSize(size);
        p.setTypeface(Typeface.create("sans-serif", bold ? Typeface.BOLD : Typeface.NORMAL));
        String shown = value == null ? "" : value;
        if (maxWidth > 0 && p.measureText(shown) > maxWidth) {
            while (shown.length() > 1 && p.measureText(shown + "…") > maxWidth)
                shown = shown.substring(0, shown.length() - 1);
            shown += "…";
        }
        c.drawText(shown, x, y, p);
    }
}
