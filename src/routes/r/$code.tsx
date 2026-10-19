import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  LoaderCircle, 
  Mail, 
  Pencil, 
  Phone, 
  ScanLine, 
  Send, 
  Star,
  MessageSquare,
  User,
  AtSign
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { categorizeDevice } from "@/lib/review-platform";

type AgencyInfo = {
  id: string;
  name: string;
  email: string;
  phone: string;
  website: string | null;
  logo_url: string | null;
};

type QrInfo = {
  qr_id: string;
  qr_name: string;
  agency: AgencyInfo;
  category_id: string | null;
  category_name: string | null;
};

type ReviewTemplate = {
  id: string;
  title: string;
  content: string;
  rating: number;
};

export const Route = createFileRoute("/r/$code")({
  head: () => ({
    meta: [
      { title: "Share Your Review" },
      { name: "description", content: "Share your experience with a quick review." },
      { property: "og:title", content: "Share Your Review" },
      { property: "og:description", content: "Share your experience with a quick review." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewPage,
});

type ViewMode = "main" | "custom" | "confirm";

// Styled input component for this page
function StyledInput({ 
  id, 
  type = "text", 
  placeholder, 
  value, 
  onChange, 
  required,
  icon: Icon
}: { 
  id: string; 
  type?: string; 
  placeholder: string; 
  value: string; 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
  required?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="relative">
      {Icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          <Icon className="size-5" />
        </div>
      )}
      <input
        id={id}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full h-14 ${Icon ? 'pl-12' : 'pl-4'} pr-4 rounded-2xl border-2 border-gray-200 bg-gray-50 text-gray-900 text-base font-medium placeholder:text-gray-400 placeholder:font-normal transition-all duration-200 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10`}
      />
    </div>
  );
}

// Styled textarea component for this page
function StyledTextarea({ 
  id, 
  placeholder, 
  value, 
  onChange, 
  required,
  rows = 4
}: { 
  id: string; 
  placeholder: string; 
  value: string; 
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; 
  required?: boolean;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      rows={rows}
      required={required}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="w-full px-4 py-4 rounded-2xl border-2 border-gray-200 bg-gray-50 text-gray-900 text-base font-medium placeholder:text-gray-400 placeholder:font-normal resize-none transition-all duration-200 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
    />
  );
}

function ReviewPage() {
  const { code } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [qrInfo, setQrInfo] = useState<QrInfo | null>(null);
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<ReviewTemplate | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("main");
  
  // Form state
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerEmail, setReviewerEmail] = useState("");

  useEffect(() => {
    let active = true;

    async function loadReviewPage() {
      try {
        // Get QR code info with agency details
        const { data: qrData, error: qrError } = await supabase
          .from("qr_codes")
          .select(`
            id,
            name,
            agency_id,
            category_id,
            agencies!inner(id, name, email, phone, website),
            categories(name)
          `)
          .eq("unique_code", code)
          .eq("status", "active")
          .single();
        
        if (qrError || !qrData) {
          if (active) setUnavailable(true);
          return;
        }

        const agencyData = qrData.agencies as { id: string; name: string; email: string; phone: string; website: string | null };
        
        const info: QrInfo = {
          qr_id: qrData.id,
          qr_name: qrData.name,
          agency: {
            id: agencyData.id,
            name: agencyData.name || "",
            email: agencyData.email || "",
            phone: agencyData.phone || "",
            website: agencyData.website,
            logo_url: null,
          },
          category_id: qrData.category_id,
          category_name: (qrData.categories as { name: string } | null)?.name || null,
        };
        
        if (active) setQrInfo(info);

        // Record scan event using the database function
        const deviceCategory = categorizeDevice(navigator.userAgent);
        let referrerHost: string | null = null;
        try {
          if (document.referrer) {
            referrerHost = new URL(document.referrer).hostname;
          }
        } catch {
          // Invalid referrer URL, leave as null
        }
        await supabase.rpc("record_review_scan", {
          _code: code,
          _device_category: deviceCategory,
          _referrer_host: referrerHost,
        });

        // Get random templates if category exists
        if (info.category_id) {
          const { data: templateData } = await supabase
            .from("review_templates")
            .select("id, title, content, rating")
            .eq("category_id", info.category_id)
            .eq("is_active", true)
            .limit(10);
          
          if (active && templateData && templateData.length > 0) {
            const shuffled = templateData.sort(() => Math.random() - 0.5).slice(0, 5);
            setTemplates(shuffled as ReviewTemplate[]);
          }
        }
      } catch {
        if (active) setUnavailable(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadReviewPage();
    return () => { active = false; };
  }, [code]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewText.trim() || !qrInfo || !reviewerName.trim() || !reviewerEmail.trim()) return;

    setSubmitting(true);
    const deviceCategory = categorizeDevice(navigator.userAgent);

    try {
      const { error } = await supabase.from("submitted_reviews").insert({
        agency_id: qrInfo.agency.id,
        qr_code_id: qrInfo.qr_id,
        category_id: qrInfo.category_id,
        template_id: selectedTemplate?.id ?? null,
        reviewer_name: reviewerName.trim(),
        reviewer_email: reviewerEmail.trim(),
        rating: rating,
        review_text: reviewText.trim(),
        is_custom: selectedTemplate === null,
        device_category: deviceCategory,
      });

      if (error) throw new Error("Failed to submit review");
      setSubmitted(true);
    } catch {
      alert("Sorry, your review could not be submitted. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function selectTemplate(template: ReviewTemplate) {
    setSelectedTemplate(template);
    setRating(template.rating);
    setReviewText(template.content);
    setViewMode("confirm");
  }

  function startCustomReview() {
    setSelectedTemplate(null);
    setRating(5);
    setReviewText("");
    setViewMode("custom");
  }

  function nextSlide() {
    setCurrentSlide((prev) => (prev + 1) % templates.length);
  }

  function prevSlide() {
    setCurrentSlide((prev) => (prev - 1 + templates.length) % templates.length);
  }

  // Loading state
  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-4 py-10">
        <div className="text-center">
          <LoaderCircle className="mx-auto size-12 animate-spin text-white" />
          <p className="mt-4 text-blue-100 font-medium">Loading...</p>
        </div>
      </main>
    );
  }

  // Unavailable state
  if (unavailable) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-gray-700 to-gray-900 px-4 py-10">
        <section className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-red-50 text-red-500">
            <ScanLine className="size-10" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Link Unavailable</h1>
          <p className="mt-3 text-gray-500 text-sm leading-relaxed">
            This review link may have expired or been deactivated.
          </p>
        </section>
      </main>
    );
  }

  // Success state
  if (submitted) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 px-4 py-10">
        <section className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-green-50 text-green-500">
            <Check className="size-10" strokeWidth={3} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Thank You!</h1>
          <p className="mt-3 text-gray-500 text-sm leading-relaxed">
            Your review has been submitted successfully. We appreciate your feedback!
          </p>
          {qrInfo?.agency.name && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-900">{qrInfo.agency.name}</p>
              {qrInfo.agency.email && (
                <p className="mt-1 text-xs text-gray-500">{qrInfo.agency.email}</p>
              )}
            </div>
          )}
        </section>
      </main>
    );
  }

  // Header component (reused across views)
  const Header = () => (
    <header className="text-center text-white mb-8">
      {/* Logo placeholder - circle with first letter */}
      <div className="mx-auto mb-4 grid size-24 place-items-center rounded-full bg-white/20 backdrop-blur-md border-2 border-white/40 shadow-lg">
        {qrInfo?.agency.logo_url ? (
          <img src={qrInfo.agency.logo_url} alt="Logo" className="size-20 rounded-full object-cover" />
        ) : (
          <span className="text-4xl font-bold text-white drop-shadow-sm">
            {qrInfo?.agency.name?.charAt(0).toUpperCase() || "R"}
          </span>
        )}
      </div>
      <h1 className="text-2xl font-bold drop-shadow-sm">{qrInfo?.agency.name || "Leave a Review"}</h1>
      {qrInfo?.category_name && (
        <span className="mt-3 inline-block rounded-full bg-white/20 backdrop-blur-sm px-5 py-1.5 text-sm font-medium border border-white/20">
          {qrInfo.category_name}
        </span>
      )}
    </header>
  );

  // Company contact footer
  const CompanyFooter = () => (
    <footer className="mt-8 text-center">
      <div className="inline-flex flex-wrap items-center justify-center gap-4 text-white/80 text-xs">
        {qrInfo?.agency.email && (
          <a href={`mailto:${qrInfo.agency.email}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
            <Mail className="size-3.5" />
            {qrInfo.agency.email}
          </a>
        )}
        {qrInfo?.agency.phone && (
          <a href={`tel:${qrInfo.agency.phone}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
            <Phone className="size-3.5" />
            {qrInfo.agency.phone}
          </a>
        )}
      </div>
      <p className="mt-4 text-white/50 text-[11px]">Your feedback helps us improve</p>
    </footer>
  );

  // Star Rating Component
  const StarRating = ({ editable = true, size = "large" }: { editable?: boolean; size?: "large" | "medium" }) => (
    <div className={`flex items-center justify-center ${size === "large" ? "gap-2" : "gap-1"}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => editable && setRating(star)}
          disabled={!editable}
          className={`transition-all duration-150 ${editable ? "hover:scale-110 active:scale-95 cursor-pointer" : "cursor-default"}`}
        >
          <Star
            className={`${size === "large" ? "size-12" : "size-9"} transition-colors ${
              star <= rating 
                ? "fill-amber-400 text-amber-400 drop-shadow-sm" 
                : "text-gray-200 hover:text-amber-200"
            }`}
          />
        </button>
      ))}
    </div>
  );

  // MAIN VIEW: Show suggestion cards directly + write own option
  if (viewMode === "main") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-4 py-8">
        <div className="mx-auto max-w-md">
          <Header />

          {/* Suggestion Cards - Show directly if templates exist */}
          {templates.length > 0 && (
            <section className="mb-6">
              <p className="mb-5 text-center text-sm text-blue-100 font-medium">
                Choose a review that matches your experience
              </p>

              {/* Slider */}
              <div className="relative">
                {/* Navigation Buttons */}
                {templates.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={prevSlide}
                      className="absolute -left-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white shadow-xl transition-all hover:bg-gray-50 hover:shadow-2xl active:scale-95"
                    >
                      <ChevronLeft className="size-5 text-gray-700" />
                    </button>
                    <button
                      type="button"
                      onClick={nextSlide}
                      className="absolute -right-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white shadow-xl transition-all hover:bg-gray-50 hover:shadow-2xl active:scale-95"
                    >
                      <ChevronRight className="size-5 text-gray-700" />
                    </button>
                  </>
                )}

                {/* Review Card */}
                <div className="rounded-3xl bg-white p-7 shadow-2xl">
                  {/* Slide Counter */}
                  {templates.length > 1 && (
                    <div className="mb-5 text-center">
                      <span className="rounded-full bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-700">
                        {currentSlide + 1} of {templates.length}
                      </span>
                    </div>
                  )}

                  {/* Rating Stars */}
                  <div className="mb-5 flex justify-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`size-9 ${star <= templates[currentSlide].rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
                      />
                    ))}
                  </div>

                  {/* Title */}
                  <h3 className="mb-3 text-center text-lg font-bold text-gray-900">
                    "{templates[currentSlide].title}"
                  </h3>

                  {/* Content */}
                  <p className="mb-7 text-center text-gray-600 leading-relaxed text-sm">
                    {templates[currentSlide].content}
                  </p>

                  {/* Select Button */}
                  <Button
                    onClick={() => selectTemplate(templates[currentSlide])}
                    className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-base font-semibold shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl hover:shadow-blue-600/30"
                  >
                    <Check className="mr-2 size-5" />
                    Select This Review
                  </Button>
                </div>

                {/* Dots Indicator */}
                {templates.length > 1 && (
                  <div className="mt-5 flex justify-center gap-2">
                    {templates.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setCurrentSlide(index)}
                        className={`h-2.5 rounded-full transition-all duration-200 ${
                          index === currentSlide ? "bg-white w-7" : "bg-white/40 w-2.5 hover:bg-white/60"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Write Your Own Review Option */}
          <section className="mt-6">
            {templates.length > 0 && (
              <div className="relative flex items-center justify-center mb-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20"></div>
                </div>
                <span className="relative bg-transparent px-4 text-sm text-white/70 font-medium">
                  or
                </span>
              </div>
            )}

            <button
              onClick={startCustomReview}
              className="w-full rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 p-5 text-left transition-all duration-200 hover:bg-white/25 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
            >
              <div className="flex items-center gap-4">
                <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/20 text-white">
                  <Pencil className="size-7" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-bold text-white">Write Your Own Review</h2>
                  <p className="mt-1 text-sm text-blue-100">
                    Share your personal experience
                  </p>
                </div>
                <ChevronRight className="size-6 text-white/60" />
              </div>
            </button>
          </section>

          <CompanyFooter />
        </div>
      </main>
    );
  }

  // CUSTOM REVIEW VIEW
  if (viewMode === "custom") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-4 py-6">
        <div className="mx-auto max-w-md">
          {/* Back button */}
          <button
            onClick={() => setViewMode("main")}
            className="mb-5 flex items-center gap-1.5 text-white/90 hover:text-white transition-colors text-sm font-medium"
          >
            <ChevronLeft className="size-5" />
            Back
          </button>

          <div className="rounded-3xl bg-white p-7 shadow-2xl">
            {/* Header */}
            <div className="mb-7 text-center">
              <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                <MessageSquare className="size-8" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Write Your Review</h2>
              <p className="mt-1.5 text-sm text-gray-500">for {qrInfo?.agency.name}</p>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
              {/* Rating */}
              <div className="text-center pb-2">
                <label className="text-sm font-semibold text-gray-700 block mb-4">
                  How would you rate your experience?
                </label>
                <StarRating />
              </div>

              {/* Review Text */}
              <div>
                <label htmlFor="review" className="text-sm font-semibold text-gray-700 block mb-2">
                  Your Review <span className="text-red-500">*</span>
                </label>
                <StyledTextarea
                  id="review"
                  rows={4}
                  required
                  placeholder="Tell us about your experience..."
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                />
              </div>

              {/* Name */}
              <div>
                <label htmlFor="name" className="text-sm font-semibold text-gray-700 block mb-2">
                  Your Name <span className="text-red-500">*</span>
                </label>
                <StyledInput
                  id="name"
                  required
                  placeholder="Enter your name"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  icon={User}
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="text-sm font-semibold text-gray-700 block mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <StyledInput
                  id="email"
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={reviewerEmail}
                  onChange={(e) => setReviewerEmail(e.target.value)}
                  icon={AtSign}
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-base font-semibold shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl hover:shadow-blue-600/30 mt-2"
                disabled={submitting || !reviewText.trim() || !reviewerName.trim() || !reviewerEmail.trim()}
              >
                {submitting ? (
                  <LoaderCircle className="size-5 animate-spin" />
                ) : (
                  <>
                    <Send className="mr-2 size-5" />
                    Submit Review
                  </>
                )}
              </Button>
            </form>
          </div>

          <CompanyFooter />
        </div>
      </main>
    );
  }

  // CONFIRM SELECTED TEMPLATE VIEW
  if (viewMode === "confirm" && selectedTemplate) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-4 py-6">
        <div className="mx-auto max-w-md">
          {/* Back button */}
          <button
            onClick={() => {
              setSelectedTemplate(null);
              setViewMode("main");
            }}
            className="mb-5 flex items-center gap-1.5 text-white/90 hover:text-white transition-colors text-sm font-medium"
          >
            <ChevronLeft className="size-5" />
            Choose different
          </button>

          <div className="rounded-3xl bg-white p-7 shadow-2xl">
            {/* Header */}
            <div className="mb-7 text-center">
              <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-green-50 text-green-600">
                <Check className="size-8" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Confirm Your Review</h2>
              <p className="mt-1.5 text-sm text-gray-500">for {qrInfo?.agency.name}</p>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
              {/* Editable Rating */}
              <div className="text-center pb-2">
                <label className="text-sm font-semibold text-gray-700 block mb-4">
                  Your Rating
                </label>
                <StarRating size="medium" />
                <p className="mt-2 text-xs text-gray-400">Tap to change</p>
              </div>

              {/* Selected Review Preview */}
              <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-5 border border-blue-100">
                <p className="text-sm font-bold text-blue-800 mb-2">"{selectedTemplate.title}"</p>
                <p className="text-sm text-gray-700 leading-relaxed">{selectedTemplate.content}</p>
              </div>

              {/* Name */}
              <div>
                <label htmlFor="name" className="text-sm font-semibold text-gray-700 block mb-2">
                  Your Name <span className="text-red-500">*</span>
                </label>
                <StyledInput
                  id="name"
                  required
                  placeholder="Enter your name"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  icon={User}
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="text-sm font-semibold text-gray-700 block mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <StyledInput
                  id="email"
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={reviewerEmail}
                  onChange={(e) => setReviewerEmail(e.target.value)}
                  icon={AtSign}
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-14 rounded-2xl bg-green-600 hover:bg-green-700 text-base font-semibold shadow-lg shadow-green-600/25 transition-all hover:shadow-xl hover:shadow-green-600/30 mt-2"
                disabled={submitting || !reviewerName.trim() || !reviewerEmail.trim()}
              >
                {submitting ? (
                  <LoaderCircle className="size-5 animate-spin" />
                ) : (
                  <>
                    <Send className="mr-2 size-5" />
                    Submit Review
                  </>
                )}
              </Button>
            </form>
          </div>

          <CompanyFooter />
        </div>
      </main>
    );
  }

  // Fallback (shouldn't reach here)
  return null;
}
