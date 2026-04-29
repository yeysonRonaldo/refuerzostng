/**
 * Combina Plagas Internas + Externas en un único nombre legible.
 * Ignora placeholders ('-', '---', vacío) y une múltiples plagas con ' / '.
 */
export function buildCombinedPest(
  r: { plaga?: string; plagasExternas?: string },
  getPestName: (raw: string) => string,
): string {
  const clean = (v?: string) => {
    if (!v) return '';
    const n = getPestName(v).trim();
    if (!n || n === '-' || n === '---') return '';
    return n;
  };
  const a = clean(r.plaga);
  const b = clean(r.plagasExternas);
  const parts = Array.from(new Set([a, b].filter(Boolean)));
  return parts.length ? parts.join(' / ') : '---';
}
