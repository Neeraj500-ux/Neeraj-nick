import type { Entity } from "../types";

export function exportCSV(rows: Entity[], title: string): void {
  const keys = ["name", "status", "due", "assignee", "hours", "amount"] as const;
  const csv = [
    keys.join(","),
    ...rows.map((row) => keys.map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`).join(",")),
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
