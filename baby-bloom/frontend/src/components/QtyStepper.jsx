export default function QtyStepper({ value, onChange, max = 99, small }) {
  const s = small ? 'h-8 w-8 text-sm' : 'h-11 w-11';
  return (
    <div className="inline-flex items-center rounded-full border border-ink/15 bg-white">
      <button className={`${s} rounded-full hover:bg-mist`} onClick={() => onChange(value - 1)} aria-label="Decrease">−</button>
      <span className={`${small ? 'w-6' : 'w-10'} text-center text-sm font-medium`}>{value}</span>
      <button className={`${s} rounded-full hover:bg-mist disabled:opacity-30`} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Increase">+</button>
    </div>
  );
}
