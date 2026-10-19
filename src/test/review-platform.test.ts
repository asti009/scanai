import { describe, expect, it } from "vitest";

import { categorizeDevice, getSecureRedirectTarget, validateReviewUrl } from "@/lib/review-platform";

describe("review destination safeguards", () => {
  it("requires Routard destinations to use HTTPS on the Routard domain", () => {
    expect(validateReviewUrl("https://www.routard.com/fr/user/avis", "routard")).toBeNull();
    expect(validateReviewUrl("http://www.routard.com/fr/user/avis", "routard")).toContain("HTTPS");
    expect(validateReviewUrl("https://routard.com.attacker.example/review", "routard")).toContain("Routard.fr");
  });

  it("requires Tripadvisor destinations to use the Tripadvisor domain", () => {
    expect(validateReviewUrl("https://www.tripadvisor.com/ShowUserReviews", "tripadvisor")).toBeNull();
    expect(validateReviewUrl("https://fake-tripadvisor.example/review", "tripadvisor")).toContain("Tripadvisor");
  });

  it("accepts public HTTPS custom destinations but rejects credentials", () => {
    expect(validateReviewUrl("https://reviews.example.org/agency", "custom")).toBeNull();
    expect(validateReviewUrl("https://user:pass@reviews.example.org/agency", "custom")).toContain("sign-in");
    expect(validateReviewUrl("", "custom")).toContain("Enter");
  });

  it("categorizes mobile, tablet, and desktop scan events", () => {
    expect(categorizeDevice("Mozilla/5.0 (iPhone; Mobile)" )).toBe("mobile");
    expect(categorizeDevice("Mozilla/5.0 (iPad; Tablet)" )).toBe("tablet");
    expect(categorizeDevice("Mozilla/5.0 (Windows NT 10.0)" )).toBe("desktop");
  });

  it("redirects only to a valid HTTPS destination returned from a saved QR", () => {
    expect(getSecureRedirectTarget("https://www.tripadvisor.com/ShowUserReviews")).toBe("https://www.tripadvisor.com/ShowUserReviews");
    expect(getSecureRedirectTarget("http://reviews.example.org/agency")).toBeNull();
    expect(getSecureRedirectTarget("javascript:alert(1)")).toBeNull();
    expect(getSecureRedirectTarget(null)).toBeNull();
  });
});