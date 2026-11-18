/**
 * QR code SVG (librairie uqr, sans dépendance). Fond blanc et marge : lisible par tous les appareils photo,
 * même en lumière tamisée.
 */
import { useMemo } from 'preact/hooks';
import { renderSVG } from 'uqr';

export function QrCode(props: { value: string; label: string; size?: number }) {
  const svg = useMemo(
    () => renderSVG(props.value, { ecc: 'M', border: 2, whiteColor: '#ffffff', blackColor: '#0d0a17' }),
    [props.value],
  );
  return (
    <div
      class="qr"
      role="img"
      aria-label={props.label}
      style={{ width: `${props.size ?? 260}px` }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
