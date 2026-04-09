// UUID v4 — crypto.randomUUID() is not available in QuickJS
export function uuid(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const s = () => Array.from({ length: 8 }, hex).join("");
  const t = () => Array.from({ length: 4 }, hex).join("");
  return `${s()}-${t()}-4${t().slice(1)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${t().slice(1)}-${s()}${t()}`;
}

export function now(): number {
  return Date.now();
}
