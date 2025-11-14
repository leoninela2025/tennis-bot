import nodemailer from 'nodemailer';

export interface NotificationPayload {
  title: string;
  message: string;
}

export async function sendNotification(payload: NotificationPayload) {
  // TODO: integrate email, Pushcut, or macOS notifications.
  console.log(`[Notify] ${payload.title}: ${payload.message}`);

  const { NOTIFICATION_EMAIL_HOST, NOTIFICATION_EMAIL_PORT, NOTIFICATION_EMAIL_USER, NOTIFICATION_EMAIL_PASS, NOTIFICATION_RECIPIENT_EMAIL } = process.env;

  if (!NOTIFICATION_EMAIL_HOST || !NOTIFICATION_EMAIL_USER || !NOTIFICATION_EMAIL_PASS || !NOTIFICATION_RECIPIENT_EMAIL) {
    console.warn('Missing email notification environment variables. Skipping email.');
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: NOTIFICATION_EMAIL_HOST,
      port: parseInt(NOTIFICATION_EMAIL_PORT || '587'), // Default to 587 if not set
      secure: parseInt(NOTIFICATION_EMAIL_PORT || '587') === 465, // Use `true` for port 465, `false` for all other ports
      auth: {
        user: NOTIFICATION_EMAIL_USER,
        pass: NOTIFICATION_EMAIL_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"Tennis Bot" <${NOTIFICATION_EMAIL_USER}>`,
      to: NOTIFICATION_RECIPIENT_EMAIL,
      subject: payload.title,
      html: `<p>${payload.message}</p>`,
    });

    console.log("✉️ Email sent: %s", info.messageId);
  } catch (error) {
    console.error("❌ Error sending email:", error);
  }
}
