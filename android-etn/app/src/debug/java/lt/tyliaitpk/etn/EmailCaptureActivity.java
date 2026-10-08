package lt.tyliaitpk.etn;

/** Debug-only receiver. It has no send action and is absent from release builds. */
public class EmailCaptureActivity extends android.app.Activity {
    @Override public void onCreate(android.os.Bundle state) {
        super.onCreate(state);
        android.content.Intent intent = getIntent();
        String[] recipients = intent.getStringArrayExtra(android.content.Intent.EXTRA_EMAIL);
        android.widget.TextView text = new android.widget.TextView(this);
        text.setTextSize(16);
        text.setPadding(24, 40, 24, 24);
        text.setText("ETN DEBUG EMAIL RECEIVER\n" +
            "Action: " + intent.getAction() + "\n" +
            "To: " + (recipients == null ? "" : String.join(",", recipients)) + "\n" +
            "Subject: " + intent.getStringExtra(android.content.Intent.EXTRA_SUBJECT) + "\n\n" +
            intent.getStringExtra(android.content.Intent.EXTRA_TEXT));
        android.widget.ScrollView scroll = new android.widget.ScrollView(this);
        scroll.addView(text);
        setContentView(scroll);
    }
}
