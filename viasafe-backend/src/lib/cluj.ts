// ViaSafe covers Cluj-Napoca only.
export const CLUJ_BOUNDS = { latMin: 46.70, latMax: 46.85, lngMin: 23.45, lngMax: 23.78 };

export function inCluj(lat: unknown, lng: unknown): boolean {
  const la = Number(lat), lo = Number(lng);
  return (
    Number.isFinite(la) && Number.isFinite(lo) &&
    la >= CLUJ_BOUNDS.latMin && la <= CLUJ_BOUNDS.latMax &&
    lo >= CLUJ_BOUNDS.lngMin && lo <= CLUJ_BOUNDS.lngMax
  );
}
