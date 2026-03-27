import { dataPath, nowIso, readJsonArray, uid, writeJsonArray } from "@/lib/json";

const notificationsPath = dataPath("notifications.json");

export function createNotification(payload: { targetRole: string; targetId: string; title: string; message: string; }) {
  const notifications = readJsonArray<any>(notificationsPath);
  const notification = { id: uid("notif"), ...payload, read: false, created_at: nowIso() };
  notifications.unshift(notification);
  writeJsonArray(notificationsPath, notifications);
  return notification;
}
