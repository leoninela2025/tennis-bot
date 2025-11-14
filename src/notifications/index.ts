export interface NotificationPayload {
  title: string;
  message: string;
}

export async function sendNotification(payload: NotificationPayload) {
  // TODO: integrate email, Pushcut, or macOS notifications.
  console.log(`[Notify] ${payload.title}: ${payload.message}`);
}
