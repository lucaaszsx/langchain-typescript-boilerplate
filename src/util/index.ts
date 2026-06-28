export function toLocalISOString(date = new Date()): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const mm = String(Math.abs(offset) % 60).padStart(2, "0");

  return (
    date.getFullYear() +
    "-" + String(date.getMonth() + 1).padStart(2, "0") +
    "-" + String(date.getDate()).padStart(2, "0") +
    "T" + String(date.getHours()).padStart(2, "0") +
    ":" + String(date.getMinutes()).padStart(2, "0") +
    ":" + String(date.getSeconds()).padStart(2, "0") +
    sign + hh + ":" + mm
  );
}