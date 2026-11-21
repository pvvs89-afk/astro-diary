import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/** Free OpenStreetMap embed (no key, no package) centred on a point with a marker. */
export function osmEmbed(s: DomSanitizer, lat: number, lon: number): SafeResourceUrl {
  const d = 0.01;
  const bbox = [lon - d, lat - d, lon + d, lat + d].map((n) => n.toFixed(5)).join(',');
  return s.bypassSecurityTrustResourceUrl(
    `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)},${lon.toFixed(6)}`,
  );
}
