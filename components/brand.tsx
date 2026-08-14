type BrandProps = {
  className?: string;
  dark?: boolean;
  lockup?: boolean;
};

export function BrandIcon({ className = "brand-icon", dark = false }: BrandProps) {
  return <img className={className} src={`/brand/tallystead-icon${dark ? "-dark" : ""}.svg`} alt="" aria-hidden="true" />;
}

export function BrandWordmark({ className = "brand-wordmark", dark = false, lockup = false }: BrandProps) {
  const name = lockup ? "tallystead-lockup" : "tallystead-horizontal";
  return <img className={className} src={`/brand/${name}${dark ? "-dark" : ""}.svg`} alt={lockup ? "Tallystead — Your household finances, under your roof." : "Tallystead"} />;
}
