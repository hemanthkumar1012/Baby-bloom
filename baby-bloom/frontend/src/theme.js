// Colour-coded aisles: every category has its own swatch, used on its products, filters and tiles.
export const AISLES = {
  'Bath & Skin': { bg: 'bg-sky', ink: 'text-sky-ink', hex: '#CFE6F5', inkHex: '#1D4E6E', blurb: 'Washes, lotions and oils for brand-new skin' },
  Diapering: { bg: 'bg-butter', ink: 'text-butter-ink', hex: '#FBE7A1', inkHex: '#6B5410', blurb: 'Soft pants, wipes and rash care' },
  Feeding: { bg: 'bg-mint', ink: 'text-mint-ink', hex: '#CDEBD9', inkHex: '#1F5A3B', blurb: 'Bottles, plates and first foods' },
  Clothing: { bg: 'bg-peach', ink: 'text-peach-ink', hex: '#FAD4C0', inkHex: '#7A3A1C', blurb: 'Organic cotton onesies and swaddles' },
  Toys: { bg: 'bg-lilac', ink: 'text-lilac-ink', hex: '#E1D7F3', inkHex: '#4B3477', blurb: 'Teethers, rattles and stacking play' },
  'Mom Care': { bg: 'bg-rose', ink: 'text-rose-ink', hex: '#F6CFD9', inkHex: '#7C2942', blurb: 'Care for you, through pregnancy and after' },
};
export const DEFAULT_AISLE = { bg: 'bg-mist', ink: 'text-ink', hex: '#EEF0F7', inkHex: '#1F2340', blurb: '' };
export const aisle = (category) => AISLES[category] || DEFAULT_AISLE;
export const AISLE_NAMES = Object.keys(AISLES);
