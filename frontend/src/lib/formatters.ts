export function formatTimestamp(isoStr: string | null | undefined): string {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "-";
    
    // Format: YYYY-MM-DD HH:mm:ss UTC
    const pad = (n: number) => n.toString().padStart(2, "0");
    const y = d.getUTCFullYear();
    const mo = pad(d.getUTCMonth() + 1);
    const day = pad(d.getUTCDate());
    const h = pad(d.getUTCHours());
    const min = pad(d.getUTCMinutes());
    const s = pad(d.getUTCSeconds());
    
    return `${y}-${mo}-${day} ${h}:${min}:${s} UTC`;
  } catch {
    return "-";
  }
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function truncateId(uuid: string | null | undefined): string {
  if (!uuid) return "-";
  if (uuid.length <= 8) return uuid;
  return `${uuid.substring(0, 8)}...`;
}

export function formatJson(obj: any): string {
  if (obj === null || obj === undefined) return "{}";
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return "{}";
  }
}
