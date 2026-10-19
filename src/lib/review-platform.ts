export type PlatformType = "routard" | "tripadvisor" | "custom";

export const PLATFORM_META: Record<PlatformType, { label: string; site: string }> = {
  routard: { label: "Routard.fr", site: "routard.com" },
  tripadvisor: { label: "Tripadvisor", site: "tripadvisor.com" },
  custom: { label: "Custom URL", site: "your chosen website" },
};

export function validateReviewUrl(value: string, platform: PlatformType): string | null {
  const candidate = value.trim();
  if (!candidate) return "Enter the exact review destination URL.";

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return "Enter a complete web address, including https://.";
  }

  if (url.protocol !== "https:") return "Only secure HTTPS links can be used.";
  if (url.username || url.password) return "Links with embedded sign-in details are not allowed.";
  if (!url.hostname.includes(".") || url.hostname === "localhost") {
    return "Enter a public website address.";
  }

  if (platform !== "custom") {
    const allowedDomain = PLATFORM_META[platform].site;
    if (url.hostname !== allowedDomain && !url.hostname.endsWith(`.${allowedDomain}`)) {
      return `Use a real ${PLATFORM_META[platform].label} website link.`;
    }
  }

  return null;
}

export function getSecureRedirectTarget(value: unknown): string | null {
  if (typeof value !== "string") return null;

  try {
    const destination = new URL(value);
    return destination.protocol === "https:" && destination.hostname ? destination.toString() : null;
  } catch {
    return null;
  }
}

export function createQrCode(): string {
  const bytes = new Uint8Array(15);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 20);
}

export function categorizeDevice(userAgent: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet/i.test(userAgent)) return "tablet";
  if (/mobile|android|iphone|ipod/i.test(userAgent)) return "mobile";
  return "desktop";
}