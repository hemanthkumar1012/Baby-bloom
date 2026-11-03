// Wordmark: three stacked toy blocks + "baby bloom"
export default function Logo({ light = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
        <rect x="1" y="15" width="13" height="13" rx="3.5" fill="#FBE7A1" transform="rotate(-4 7.5 21.5)" />
        <rect x="16" y="15" width="13" height="13" rx="3.5" fill="#F6CFD9" transform="rotate(3 22.5 21.5)" />
        <rect x="8.5" y="2" width="13" height="13" rx="3.5" fill="#CFE6F5" transform="rotate(-2 15 8.5)" />
      </svg>
      <span className={`font-display text-[19px] font-medium tracking-[-0.04em] ${light ? 'text-white' : 'text-ink'}`}>baby bloom</span>
    </span>
  );
}
