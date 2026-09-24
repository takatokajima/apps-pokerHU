/** Xアカウントへのリンクバッジ */
export function XBadge({ handle, size = 20 }: { handle: string | null; size?: number }) {
  if (!handle) return null;
  return (
    <a
      href={`https://x.com/${encodeURIComponent(handle)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-grid shrink-0 place-items-center rounded-full bg-black font-bold text-white ring-1 ring-white/25"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      aria-label={`X @${handle}`}
      title={`@${handle}`}
    >
      𝕏
    </a>
  );
}
