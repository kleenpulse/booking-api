import { cacheLife } from "next/cache";

// Instrument Sans for generated images. Satori needs TTF/OTF, which Google Fonts
// serves to clients that don't announce woff2 support. Falls back to the
// built-in font if the network is unavailable at build time.
export async function displayFont(weight: 400 | 500, text: string): Promise<ArrayBuffer | null> {
  "use cache";
  cacheLife("max");
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@${weight}&text=${encodeURIComponent(text)}`,
    ).then((res) => res.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((res) => res.arrayBuffer());
  } catch {
    return null;
  }
}
