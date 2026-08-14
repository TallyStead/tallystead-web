import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tallystead",
    short_name: "Tallystead",
    description: "Your household finances, under your roof.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F4EE",
    theme_color: "#193A59",
    icons: [
      { src: "/icons/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/pwa-maskable-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
