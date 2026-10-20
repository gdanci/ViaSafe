import fs from "fs";
import path from "path";

const CLUJ_BOUNDS = {
  latMin: 46.72,
  latMax: 46.83,
  lngMin: 23.52,
  lngMax: 23.74
};

type RawPoint = {
  lat: number;
  lng: number;
  mag?: number;
};

export type RiskAreaSeed = {
  latitude: number;
  longitude: number;
  safetyLevel: "SAFE" | "CAUTION" | "WARNING" | "DANGER";
  isNightSensitive: boolean;
};

export type ReportSeed = {
  title: string;
  description: string;
  category: string;
  timeLabel: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  anonymous: boolean;
  upvotes: number;
  verificationStatus: "SINGLE_REPORT" | "VERIFIED";
  locationKey: string;
  createdAt: string;
};

let cachedRiskAreas: RiskAreaSeed[] | null = null;
let cachedReports: ReportSeed[] | null = null;

function readJson<T>(filename: string): T {
  const filePath = path.resolve(process.cwd(), "data", "raw", filename);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

function mapToCluj(points: RawPoint[]): RawPoint[] {
  if (!points.length) return [];

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return points.map((p) => ({
    lat: CLUJ_BOUNDS.latMin + normalize(p.lat, minLat, maxLat) * (CLUJ_BOUNDS.latMax - CLUJ_BOUNDS.latMin),
    lng: CLUJ_BOUNDS.lngMin + normalize(p.lng, minLng, maxLng) * (CLUJ_BOUNDS.lngMax - CLUJ_BOUNDS.lngMin),
    mag: p.mag
  }));
}

function safetyLevelFromMag(mag: number): RiskAreaSeed["safetyLevel"] {
  if (mag >= 4) return "DANGER";
  if (mag >= 3) return "WARNING";
  if (mag >= 2) return "CAUTION";
  return "SAFE";
}

export function getClujRiskAreas(): RiskAreaSeed[] {
  if (cachedRiskAreas) return cachedRiskAreas;

  const geojson = readJson<any>("geojson_file.json");
  const rawPoints: RawPoint[] = (geojson?.features || [])
    .map((feature: any) => {
      const coords = feature?.geometry?.coordinates;
      if (!coords || coords.length < 2) return null;
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      const mag = Number(feature?.properties?.mag ?? 0);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
      return { lat, lng, mag } as RawPoint;
    })
    .filter(Boolean);

  const mapped = mapToCluj(rawPoints).slice(0, 120);

  cachedRiskAreas = mapped.map((p, idx) => {
    const mag = p.mag ?? 0;
    return {
      latitude: p.lat,
      longitude: p.lng,
      safetyLevel: safetyLevelFromMag(mag),
      isNightSensitive: mag >= 2 || idx % 3 === 0
    };
  });

  return cachedRiskAreas;
}

export function getClujSeedReports(): ReportSeed[] {
  if (cachedReports) return cachedReports;

  const stations = readJson<any>("police_stations.json");
  const rawPoints: RawPoint[] = (Array.isArray(stations) ? stations : [])
    .map((item: any) => {
      const lat = Number(item?.lat);
      const lng = Number(item?.lng);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
      return { lat, lng } as RawPoint;
    })
    .filter((p): p is RawPoint => Boolean(p));

  const mapped = mapToCluj(rawPoints).slice(0, 60);
  const nowIso = new Date().toISOString();

  cachedReports = mapped.map((p, idx) => {
    const category = idx % 2 === 0 ? "suspicious" : "general";
    const verificationStatus = idx % 5 === 0 ? "VERIFIED" : "SINGLE_REPORT";
    const title = verificationStatus === "VERIFIED" ? "Community verified report" : "Reported concern";
    const locationKey = `${category}-${Math.round(p.lat * 1000)}-${Math.round(p.lng * 1000)}`;

    return {
      title,
      description: "Imported demo report based on zip data.",
      category,
      timeLabel: "today",
      locationLabel: "Cluj-Napoca",
      latitude: p.lat,
      longitude: p.lng,
      anonymous: true,
      upvotes: idx % 5,
      verificationStatus,
      locationKey,
      createdAt: nowIso
    };
  });

  return cachedReports;
}
