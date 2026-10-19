import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Eye,
  FileImage,
  Globe2,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  LogOut,
  Mail,
  Menu,
  MoreHorizontal,
  MousePointer2,
  Pencil,
  Phone,
  Plus,
  Printer,
  QrCode,
  Save,
  ScanLine,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  SquareArrowOutUpRight,
  Trash2,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  categorizeDevice,
  createQrCode,
  getSecureRedirectTarget,
  PLATFORM_META,
  validateReviewUrl,
  type PlatformType,
} from "@/lib/review-platform";
import {
  validateCredentials,
  login as simpleLogin,
  logout as simpleLogout,
  getCurrentUser,
  type SimpleUser,
} from "@/lib/simple-auth";
import type { Database } from "@/integrations/supabase/types";

type Agency = Database["public"]["Tables"]["agencies"]["Row"];
type Platform = Database["public"]["Tables"]["review_platforms"]["Row"];
type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
type QrRow = Database["public"]["Tables"]["qr_codes"]["Row"];
type Scan = Database["public"]["Tables"]["scan_events"]["Row"];
type CardTemplate = Database["public"]["Tables"]["review_card_templates"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];
type ReviewTemplate = Database["public"]["Tables"]["review_templates"]["Row"];
type SubmittedReview = Database["public"]["Tables"]["submitted_reviews"]["Row"];

type ViewId = "overview" | "agencies" | "platforms" | "categories" | "templates" | "qr" | "cards" | "campaigns" | "reviews" | "analytics" | "settings";
type IconComponent = typeof LayoutDashboard;

const NAV_ITEMS: { id: ViewId; label: string; icon: IconComponent }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "agencies", label: "Agency details", icon: BriefcaseBusiness },
  { id: "categories", label: "Categories", icon: ClipboardCheck },
  { id: "templates", label: "Review Templates", icon: FileImage },
  { id: "qr", label: "QR codes", icon: QrCode },
  { id: "reviews", label: "Submitted Reviews", icon: Users },
  { id: "campaigns", label: "Campaigns", icon: Sparkles },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings2 },
];

const CARD_COPY = {
  headline: "Thank you for travelling with us!",
  body: "We hope you enjoyed your trip.\n\nYour feedback helps other travellers discover great experiences.\n\nScan the QR code below to share your honest experience.\n\nThank you for your support!",
};

const inputClass = "h-11 rounded-md border-border bg-background/60 text-foreground placeholder:text-muted-foreground";
const buttonQuiet = "border-border bg-secondary/70 text-foreground hover:bg-accent hover:text-accent-foreground";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Review QR Workspace" },
      { name: "description", content: "Manage genuine travel reviews, agency destinations, QR codes, print cards, campaigns, and scan analytics." },
      { property: "og:title", content: "Review QR Workspace" },
      { property: "og:description", content: "A private workspace for agency review destinations, QR codes and real scan analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewWorkspace,
});

function ReviewWorkspace() {
  const [sessionUser, setSessionUser] = useState<SimpleUser | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceLoadFailed, setWorkspaceLoadFailed] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [view, setView] = useState<ViewId>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [qrs, setQrs] = useState<QrRow[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [cardTemplate, setCardTemplate] = useState<CardTemplate | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reviewTemplates, setReviewTemplates] = useState<ReviewTemplate[]>([]);
  const [submittedReviews, setSubmittedReviews] = useState<SubmittedReview[]>([]);
  const [agencyForm, setAgencyForm] = useState({ name: "", email: "", phone: "", website: "" });
  const [platformForm, setPlatformForm] = useState<Record<string, { profile: string; review: string }>>({});
  const [qrForm, setQrForm] = useState({ name: "", platformId: "", campaignId: "", categoryId: "", type: "tracked", expiresAt: "" });
  const [editingQrId, setEditingQrId] = useState<string | null>(null);
  const [qrCardForm, setQrCardForm] = useState({ headline: "", subtitle: "", businessName: "", footerText: "" });
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", icon: "store" });
  const [templateForm, setTemplateForm] = useState({ categoryId: "", title: "", content: "", rating: 5 });
  const [campaignName, setCampaignName] = useState("");
  const [qrSearch, setQrSearch] = useState("");
  const [qrPlatformFilter, setQrPlatformFilter] = useState("all");
  const [cardHeadline, setCardHeadline] = useState(CARD_COPY.headline);
  const [cardBody, setCardBody] = useState(CARD_COPY.body);
  const [cardQrId, setCardQrId] = useState("");
  const [cardOrientation, setCardOrientation] = useState("portrait");
  const [cardQrPng, setCardQrPng] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Check for existing session from localStorage
    const user = getCurrentUser();
    setSessionUser(user);
    setLoadingSession(false);
  }, []);

  useEffect(() => {
    if (!sessionUser) return;
    let cancelled = false;
    setWorkspaceLoading(true);
    setWorkspaceLoadFailed(false);
    void loadWorkspace().then(() => {
      if (!cancelled) {
        setBusy(false);
        setWorkspaceLoading(false);
      }
    }).catch((error: unknown) => {
      if (!cancelled) {
        setBusy(false);
        setWorkspaceLoading(false);
        setWorkspaceLoadFailed(true);
        setMessage(error instanceof Error ? error.message : "Your workspace could not be loaded.");
      }
    });
    return () => { cancelled = true; };
  }, [sessionUser?.id]);

  useEffect(() => {
    if (!agency) return;
    setAgencyForm({ name: agency.name, email: agency.email, phone: agency.phone, website: agency.website ?? "" });
  }, [agency]);

  useEffect(() => {
    const settings = Object.fromEntries(platforms.map((item) => [item.id, { profile: item.profile_url ?? "", review: item.review_url ?? "" }]));
    setPlatformForm(settings);
  }, [platforms]);

  useEffect(() => {
    if (cardTemplate) {
      setCardHeadline(cardTemplate.headline);
      setCardBody(cardTemplate.body_text);
      setCardOrientation(cardTemplate.orientation);
    }
  }, [cardTemplate]);

  useEffect(() => {
    let cancelled = false;
    const chosen = qrs.find((item) => item.id === cardQrId) ?? qrs.find((item) => item.status === "active");
    const platform = platforms.find((item) => item.id === chosen?.platform_id);
    if (!chosen || !platform) {
      setCardQrPng("");
      return;
    }
    void qrTarget(chosen, platform).then((url) => QRCode.toDataURL(url, { width: 360, margin: 2, errorCorrectionLevel: "H", color: { dark: "#173056", light: "#ffffff" } })).then((png) => {
      if (!cancelled) setCardQrPng(png);
    }).catch(() => { if (!cancelled) setCardQrPng(""); });
    return () => { cancelled = true; };
  }, [cardQrId, qrs, platforms]);

  async function loadWorkspace() {
    const { data: agencies, error: agencyError } = await supabase.from("agencies").select("*").order("created_at").limit(1);
    if (agencyError) throw agencyError;
    const ownAgency = agencies[0] ?? null;
    setAgency(ownAgency);
    if (!ownAgency) return;
    const [platformRes, campaignRes, qrRes, cardRes, categoryRes, templateRes, reviewRes] = await Promise.all([
      supabase.from("review_platforms").select("*").eq("agency_id", ownAgency.id).order("created_at"),
      supabase.from("campaigns").select("*").eq("agency_id", ownAgency.id).order("created_at", { ascending: false }),
      supabase.from("qr_codes").select("*").eq("agency_id", ownAgency.id).order("created_at", { ascending: false }),
      supabase.from("review_card_templates").select("*").eq("agency_id", ownAgency.id).order("created_at").limit(1),
      supabase.from("categories").select("*").eq("agency_id", ownAgency.id).order("created_at"),
      supabase.from("review_templates").select("*").eq("agency_id", ownAgency.id).order("created_at", { ascending: false }),
      supabase.from("submitted_reviews").select("*").eq("agency_id", ownAgency.id).order("created_at", { ascending: false }).limit(500),
    ]);
    if (platformRes.error) throw platformRes.error;
    if (campaignRes.error) throw campaignRes.error;
    if (qrRes.error) throw qrRes.error;
    if (cardRes.error) throw cardRes.error;
    if (categoryRes.error) throw categoryRes.error;
    if (templateRes.error) throw templateRes.error;
    if (reviewRes.error) throw reviewRes.error;
    setPlatforms(platformRes.data);
    setCampaigns(campaignRes.data);
    setQrs(qrRes.data);
    setCardTemplate(cardRes.data[0] ?? null);
    setCategories(categoryRes.data);
    setReviewTemplates(templateRes.data);
    setSubmittedReviews(reviewRes.data);
    if (qrRes.data[0]) setCardQrId((current) => current || qrRes.data[0].id);
    if (qrRes.data.length > 0) {
      const { data: eventData, error: eventError } = await supabase.from("scan_events").select("*").order("created_at", { ascending: false }).limit(1000);
      if (eventError) throw eventError;
      setScans(eventData.filter((event) => qrRes.data.some((qr) => qr.id === event.qr_code_id)));
    } else {
      setScans([]);
    }
  }

  async function refreshWorkspace() {
    setBusy(true);
    try {
      await loadWorkspace();
      setWorkspaceLoadFailed(false);
      setMessage("");
    } catch (error) {
      setWorkspaceLoadFailed(true);
      setMessage(error instanceof Error ? error.message : "Your changes could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function createWorkspace() {
    if (!sessionUser) return;
    setBusy(true);
    setWorkspaceLoading(true);
    setMessage("");
    let createdAgencyId: string | null = null;
    try {
      // Use a fixed UUID for the hardcoded admin user since we're not using Supabase auth
      const adminOwnerId = "00000000-0000-0000-0000-000000000001";
      const { data: createdAgency, error: agencyError } = await supabase.from("agencies").insert({ owner_id: adminOwnerId }).select("*").single();
      if (agencyError) throw agencyError;
      createdAgencyId = createdAgency.id;

      const { data: createdPlatforms, error: platformError } = await supabase.from("review_platforms").insert([
        { agency_id: createdAgency.id, platform_type: "custom", display_name: "Custom review URL" },
      ]).select("*");
      if (platformError) throw platformError;

      const { data: createdTemplate, error: templateError } = await supabase.from("review_card_templates").insert({ agency_id: createdAgency.id }).select("*").single();
      if (templateError) throw templateError;

      setAgency(createdAgency);
      setPlatforms(createdPlatforms);
      setCampaigns([]);
      setQrs([]);
      setScans([]);
      setCardTemplate(createdTemplate);
      setWorkspaceLoadFailed(false);
      toast.success("Your agency workspace is ready.");
    } catch (error) {
      if (createdAgencyId) {
        await supabase.from("agencies").delete().eq("id", createdAgencyId);
      }
      setWorkspaceLoadFailed(false);
      setMessage(error instanceof Error ? error.message : "Your agency workspace could not be created.");
    } finally {
      setBusy(false);
      setWorkspaceLoading(false);
    }
  }

  async function handleAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setMessage("");
    try {
      if (!validateCredentials(authUsername.trim(), authPassword)) {
        throw new Error("Invalid username or password");
      }
      const user = simpleLogin(authUsername.trim());
      setSessionUser(user);
      toast.success("Welcome back.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your sign-in could not be completed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    simpleLogout();
    setSessionUser(null);
    setAgency(null);
    setPlatforms([]);
    setCampaigns([]);
    setQrs([]);
    setScans([]);
    setView("overview");
    toast.success("You have signed out.");
  }

  async function saveAgency(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agency) return;
    setBusy(true);
    const { error } = await supabase.from("agencies").update({ ...agencyForm, website: agencyForm.website.trim() || null, updated_at: new Date().toISOString() }).eq("id", agency.id);
    if (error) toast.error("Agency details could not be saved.");
    else { toast.success("Agency details saved."); await refreshWorkspace(); }
    setBusy(false);
  }

  async function savePlatform(platform: Platform) {
    const form = platformForm[platform.id] ?? { profile: "", review: "" };
    if (form.review.trim()) {
      const urlError = validateReviewUrl(form.review, platform.platform_type as PlatformType);
      if (urlError) { toast.error(urlError); return; }
    }
    if (form.profile.trim()) {
      const profileError = validateReviewUrl(form.profile, platform.platform_type as PlatformType);
      if (profileError) { toast.error(`Profile link: ${profileError}`); return; }
    }
    setBusy(true);
    const { error } = await supabase.from("review_platforms").update({ profile_url: form.profile.trim() || null, review_url: form.review.trim() || null, enabled: false, verification_status: "unverified", updated_at: new Date().toISOString() }).eq("id", platform.id);
    if (error) toast.error("Platform settings could not be saved.");
    else { toast.success("Destination saved. Review it before marking as verified."); await refreshWorkspace(); }
    setBusy(false);
  }

  async function verifyPlatform(platform: Platform) {
    if (!platform.review_url) { toast.error("Save an exact review destination first."); return; }
    const warning = "I opened and confirmed this is the correct public review destination for my agency. Continue?";
    if (!window.confirm(warning)) return;
    setBusy(true);
    const { error } = await supabase.from("review_platforms").update({ enabled: true, verification_status: "verified", updated_at: new Date().toISOString() }).eq("id", platform.id);
    if (error) toast.error("The destination could not be verified.");
    else { toast.success("Destination verified and enabled."); await refreshWorkspace(); }
    setBusy(false);
  }

  async function togglePlatform(platform: Platform) {
    const { error } = await supabase.from("review_platforms").update({ enabled: !platform.enabled, updated_at: new Date().toISOString() }).eq("id", platform.id);
    if (error) toast.error("Platform status could not be changed.");
    else await refreshWorkspace();
  }

  async function createCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agency || !campaignName.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("campaigns").insert({ agency_id: agency.id, name: campaignName.trim() });
    if (error) toast.error("Campaign could not be created.");
    else { setCampaignName(""); toast.success("Campaign created."); await refreshWorkspace(); }
    setBusy(false);
  }

  async function setCampaignStatus(campaign: Campaign) {
    const { error } = await supabase.from("campaigns").update({ status: campaign.status === "active" ? "inactive" : "active", updated_at: new Date().toISOString() }).eq("id", campaign.id);
    if (error) toast.error("Campaign status could not be changed.");
    else await refreshWorkspace();
  }

  async function createQr(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agency) return;
    const platform = platforms.find((item) => item.id === qrForm.platformId);
    if (!platform || !platform.enabled || platform.verification_status !== "verified" || !platform.review_url) {
      toast.error("Choose a verified, enabled review destination first.");
      return;
    }
    if (qrForm.type === "direct") {
      const destinationError = validateReviewUrl(platform.review_url, platform.platform_type as PlatformType);
      if (destinationError) {
        toast.error(destinationError);
        return;
      }
    }
    if (!qrForm.name.trim()) { toast.error("Give this QR code a name."); return; }
    setBusy(true);
    const { error } = await supabase.from("qr_codes").insert({
      agency_id: agency.id,
      platform_id: platform.id,
      campaign_id: qrForm.campaignId || null,
      category_id: qrForm.categoryId || null,
      name: qrForm.name.trim(),
      unique_code: createQrCode(),
      qr_type: qrForm.type,
      status: "active",
      expires_at: qrForm.expiresAt ? new Date(`${qrForm.expiresAt}T23:59:59`).toISOString() : null,
    });
    if (error) toast.error("QR code could not be created. Please try again.");
    else {
      setQrForm({ name: "", platformId: "", campaignId: "", categoryId: "", type: "tracked", expiresAt: "" });
      toast.success("QR code created from your verified review link.");
      await refreshWorkspace();
    }
    setBusy(false);
  }

  async function toggleQr(qr: QrRow) {
    const { error } = await supabase.from("qr_codes").update({ status: qr.status === "active" ? "inactive" : "active", updated_at: new Date().toISOString() }).eq("id", qr.id);
    if (error) toast.error("QR code status could not be changed.");
    else { toast.success(qr.status === "active" ? "QR code deactivated." : "QR code activated."); await refreshWorkspace(); }
  }

  async function deleteQr(qr: QrRow) {
    if (!window.confirm(`Delete “${qr.name}” and its scan events? This cannot be undone.`)) return;
    const { error } = await supabase.from("qr_codes").delete().eq("id", qr.id);
    if (error) toast.error("QR code could not be deleted.");
    else { toast.success("QR code deleted."); await refreshWorkspace(); }
  }

  function startEditQrCard(qr: QrRow) {
    setEditingQrId(qr.id);
    // Read card text from QR data - columns now exist in database
    console.log("Editing QR:", qr.id, "card_headline:", qr.card_headline);
    setQrCardForm({
      headline: qr.card_headline || "Happy with our service?",
      subtitle: qr.card_subtitle || "Help spread the word. Review us on Google or Cloutly.",
      businessName: qr.card_business_name || agency?.name || "",
      footerText: qr.card_footer_text || "Scan QR code to review us",
    });
  }

  function cancelEditQrCard() {
    setEditingQrId(null);
    setQrCardForm({ headline: "", subtitle: "", businessName: "", footerText: "" });
  }

  async function saveQrCardText() {
    if (!editingQrId) return;
    setBusy(true);
    const { error } = await supabase.from("qr_codes").update({
      card_headline: qrCardForm.headline.trim(),
      card_subtitle: qrCardForm.subtitle.trim(),
      card_business_name: qrCardForm.businessName.trim() || null,
      card_footer_text: qrCardForm.footerText.trim(),
      updated_at: new Date().toISOString(),
    }).eq("id", editingQrId);
    if (error) {
      console.error("Save error:", error);
      toast.error(`QR card text could not be saved: ${error.message}`);
    }
    else {
      toast.success("QR card text saved!");
      setEditingQrId(null);
      setQrCardForm({ headline: "", subtitle: "", businessName: "", footerText: "" });
      await refreshWorkspace();
    }
    setBusy(false);
  }

  async function saveCard() {
    if (!cardTemplate) return;
    const { error } = await supabase.from("review_card_templates").update({ headline: cardHeadline, body_text: cardBody, platform_id: qrs.find((qr) => qr.id === cardQrId)?.platform_id ?? cardTemplate.platform_id, orientation: cardOrientation, updated_at: new Date().toISOString() }).eq("id", cardTemplate.id);
    if (error) toast.error("Review card text could not be saved.");
    else toast.success("Review card saved.");
  }

  // Category management
  async function createCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agency || !categoryForm.name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("categories").insert({
      agency_id: agency.id,
      name: categoryForm.name.trim(),
      description: categoryForm.description.trim(),
      icon: categoryForm.icon,
    });
    if (error) toast.error("Category could not be created.");
    else {
      setCategoryForm({ name: "", description: "", icon: "store" });
      toast.success("Category created.");
      await refreshWorkspace();
    }
    setBusy(false);
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(`Delete "${category.name}"? This will also delete all review templates in this category.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", category.id);
    if (error) toast.error("Category could not be deleted.");
    else { toast.success("Category deleted."); await refreshWorkspace(); }
  }

  // Review template management
  async function createTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agency || !templateForm.categoryId || !templateForm.title.trim() || !templateForm.content.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("review_templates").insert({
      agency_id: agency.id,
      category_id: templateForm.categoryId,
      title: templateForm.title.trim(),
      content: templateForm.content.trim(),
      rating: templateForm.rating,
    });
    if (error) toast.error("Template could not be created.");
    else {
      setTemplateForm({ categoryId: "", title: "", content: "", rating: 5 });
      toast.success("Review template created.");
      await refreshWorkspace();
    }
    setBusy(false);
  }

  async function createMultipleTemplates(categoryId: string, templates: Array<{ title: string; content: string; rating: number }>) {
    if (!agency || !categoryId || templates.length === 0) return;
    setBusy(true);
    const insertData = templates.map((t) => ({
      agency_id: agency.id,
      category_id: categoryId,
      title: t.title.trim(),
      content: t.content.trim(),
      rating: t.rating,
    }));
    const { error } = await supabase.from("review_templates").insert(insertData);
    if (error) toast.error("Templates could not be created.");
    else {
      toast.success(`${templates.length} templates created successfully!`);
      await refreshWorkspace();
    }
    setBusy(false);
  }

  async function toggleTemplate(template: ReviewTemplate) {
    const { error } = await supabase.from("review_templates").update({ is_active: !template.is_active, updated_at: new Date().toISOString() }).eq("id", template.id);
    if (error) toast.error("Template status could not be changed.");
    else { toast.success(template.is_active ? "Template disabled." : "Template enabled."); await refreshWorkspace(); }
  }

  async function deleteTemplate(template: ReviewTemplate) {
    if (!window.confirm(`Delete this template?`)) return;
    const { error } = await supabase.from("review_templates").delete().eq("id", template.id);
    if (error) toast.error("Template could not be deleted.");
    else { toast.success("Template deleted."); await refreshWorkspace(); }
  }

  // Review management
  async function updateReviewStatus(review: SubmittedReview, status: "approved" | "rejected") {
    const { error } = await supabase.from("submitted_reviews").update({ status }).eq("id", review.id);
    if (error) toast.error("Review status could not be updated.");
    else { toast.success(`Review ${status}.`); await refreshWorkspace(); }
  }

  async function deleteReview(review: SubmittedReview) {
    if (!window.confirm(`Delete this review?`)) return;
    const { error } = await supabase.from("submitted_reviews").delete().eq("id", review.id);
    if (error) toast.error("Review could not be deleted.");
    else { toast.success("Review deleted."); await refreshWorkspace(); }
  }

  async function qrTarget(qr: QrRow, platform: Platform) {
    if (qr.qr_type === "direct") return platform.review_url ?? "";
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}/r/${encodeURIComponent(qr.unique_code)}`;
  }

  async function downloadQr(qr: QrRow, kind: "png" | "svg") {
    const platform = platforms.find((item) => item.id === qr.platform_id);
    if (!platform?.review_url || qr.status !== "active") { toast.error("Only active QR codes with a configured destination can be downloaded."); return; }
    try {
      // Fetch the latest QR data directly from database to ensure we have the most recent card text
      const { data: freshQrData, error: fetchError } = await supabase.from("qr_codes").select("*").eq("id", qr.id).single();
      if (fetchError || !freshQrData) {
        console.error("Error fetching QR data:", fetchError);
        toast.error("Could not fetch QR code data.");
        return;
      }
      
      const target = await qrTarget(freshQrData, platform);
      
      if (kind === "svg") {
        // Simple SVG download
        const svgContent = await QRCode.toString(target, { type: "svg", width: 900, margin: 4, errorCorrectionLevel: "H" });
        const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = `${safeFilename(freshQrData.name)}.svg`;
        anchor.click();
        URL.revokeObjectURL(objectUrl);
      } else {
        // Create styled PNG card matching the reference design exactly
        const qrDataUrl = await QRCode.toDataURL(target, { width: 500, margin: 1, errorCorrectionLevel: "H", color: { dark: "#000000", light: "#ffffff" } });
        
        // Create canvas for styled QR card
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas not supported");
        
        // Card dimensions (A5-ish portrait ratio)
        const cardWidth = 600;
        const cardHeight = 900;
        canvas.width = cardWidth;
        canvas.height = cardHeight;
        
        // White background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cardWidth, cardHeight);
        
        // Get customizable text from freshly fetched QR data
        // Debug: log the QR data to see what's coming from database
        console.log("QR data for download (fresh from DB):", {
          id: freshQrData.id,
          name: freshQrData.name,
          card_headline: freshQrData.card_headline,
          card_subtitle: freshQrData.card_subtitle,
          card_business_name: freshQrData.card_business_name,
          card_footer_text: freshQrData.card_footer_text,
        });
        
        // Use saved values, fall back to defaults only if undefined/null/empty
        const headline = freshQrData.card_headline || "Happy with our service?";
        const subtitle = freshQrData.card_subtitle || "Help spread the word. Review us on Google or Cloutly.";
        const businessName = freshQrData.card_business_name || agency?.name || "Your Business Name Here";
        const footerText = freshQrData.card_footer_text || "Scan QR code to review us";
        
        ctx.textAlign = "center";
        
        // ===== HEADLINE =====
        // Bold, large black text at top (like the reference)
        ctx.fillStyle = "#000000";
        ctx.font = "bold 38px Georgia, 'Times New Roman', serif";
        
        // Word wrap headline
        const headlineLines = wrapText(ctx, headline, cardWidth - 100);
        let yPos = 70;
        headlineLines.forEach((line) => {
          ctx.fillText(line, cardWidth / 2, yPos);
          yPos += 48;
        });
        
        // ===== SUBTITLE =====
        // Italic, gray text below headline
        ctx.fillStyle = "#666666";
        ctx.font = "italic 20px Georgia, 'Times New Roman', serif";
        yPos += 15;
        const subtitleLines = wrapText(ctx, subtitle, cardWidth - 100);
        subtitleLines.forEach((line) => {
          ctx.fillText(line, cardWidth / 2, yPos);
          yPos += 30;
        });
        
        // ===== QR CODE =====
        // Centered QR code
        const qrImage = new Image();
        await new Promise<void>((resolve, reject) => {
          qrImage.onload = () => resolve();
          qrImage.onerror = reject;
          qrImage.src = qrDataUrl;
        });
        const qrSize = 320;
        const qrY = yPos + 40;
        ctx.drawImage(qrImage, (cardWidth - qrSize) / 2, qrY, qrSize, qrSize);
        
        // ===== 5 GOLD STARS =====
        // Yellow/gold stars below QR code
        const starY = qrY + qrSize + 60;
        const starSize = 50;
        const starGap = 8;
        const totalStarWidth = 5 * starSize + 4 * starGap;
        const starStartX = (cardWidth - totalStarWidth) / 2;
        
        ctx.fillStyle = "#f5b800"; // Bright gold/yellow color matching reference
        for (let i = 0; i < 5; i++) {
          drawStar(ctx, starStartX + i * (starSize + starGap) + starSize / 2, starY, starSize / 2, 5, 0.5);
        }
        
        // ===== BUSINESS NAME =====
        // Bold black text below stars
        ctx.fillStyle = "#000000";
        ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
        ctx.fillText(businessName, cardWidth / 2, starY + 80);
        
        // ===== FOOTER TEXT =====
        // Gray text at bottom
        ctx.fillStyle = "#666666";
        ctx.font = "20px system-ui, -apple-system, sans-serif";
        ctx.fillText(footerText, cardWidth / 2, starY + 125);
        
        // Download
        canvas.toBlob((blob) => {
          if (!blob) return;
          const objectUrl = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = objectUrl;
          anchor.download = `${safeFilename(freshQrData.name)}-qr-card.png`;
          anchor.click();
          URL.revokeObjectURL(objectUrl);
        }, "image/png");
      }
      
      toast.success(`QR card downloaded!`);
    } catch {
      toast.error("QR image could not be generated.");
    }
  }
  
  // Helper function to wrap text
  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) lines.push(currentLine);
    return lines;
  }
  
  // Helper function to draw a star
  function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerRadius: number, points: number, innerRadiusRatio: number) {
    const innerRadius = outerRadius * innerRadiusRatio;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  
  // Helper function to draw rounded rectangles
  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  async function downloadCardPdf() {
    if (!cardQrPng || !agency) { toast.error("Create an active QR code before exporting a card."); return; }
    const pdf = new jsPDF(cardOrientation === "landscape" ? "landscape" : "portrait", "mm", "a5");
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    pdf.setFillColor(13, 27, 47);
    pdf.rect(0, 0, width, height, "F");
    pdf.setTextColor(233, 241, 249);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    const heading = pdf.splitTextToSize(cardHeadline || "Thank you for travelling with us!", width - 32);
    pdf.text(heading, width / 2, 24, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    const bodyLines = pdf.splitTextToSize(cardBody, width - 34);
    const bodyTop = 28 + heading.length * 9;
    pdf.text(bodyLines, width / 2, bodyTop, { align: "center", lineHeightFactor: 1.5 });
    const qrSize = Math.min(58, height * 0.33);
    const qrY = Math.min(height - qrSize - 35, bodyTop + bodyLines.length * 5 + 8);
    pdf.addImage(cardQrPng, "PNG", (width - qrSize) / 2, qrY, qrSize, qrSize);
    pdf.setFontSize(9);
    pdf.text(agency.name || "Your travel agency", width / 2, height - 26, { align: "center" });
    pdf.text([agency.email, agency.phone].filter(Boolean).join("  ·  "), width / 2, height - 19, { align: "center" });
    pdf.save("travel-review-card.pdf");
  }

  const visibleQrs = useMemo(() => qrs.filter((qr) => {
    const platform = platforms.find((item) => item.id === qr.platform_id);
    return qr.name.toLowerCase().includes(qrSearch.toLowerCase()) && (qrPlatformFilter === "all" || platform?.platform_type === qrPlatformFilter);
  }), [qrs, platforms, qrSearch, qrPlatformFilter]);

  const activeQrCount = qrs.filter((qr) => qr.status === "active" && (!qr.expires_at || new Date(qr.expires_at) > new Date())).length;
  const lastSevenDays = useMemo(() => {
    const days: { key: string; label: string; count: number }[] = [];
    const now = new Date();
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      const key = day.toISOString().slice(0, 10);
      days.push({ key, label: day.toLocaleDateString(undefined, { weekday: "short" }), count: scans.filter((scan) => scan.created_at.slice(0, 10) === key).length });
    }
    return days;
  }, [scans]);
  const maxDailyScans = Math.max(1, ...lastSevenDays.map((day) => day.count));
  const platformCards = platforms.map((platform) => ({ platform, qrCount: qrs.filter((qr) => qr.platform_id === platform.id).length, scanCount: scans.filter((scan) => qrs.some((qr) => qr.id === scan.qr_code_id && qr.platform_id === platform.id)).length }));
  const currentNav = NAV_ITEMS.find((item) => item.id === view) ?? NAV_ITEMS[0];

  if (loadingSession) {
    return <main className="grid min-h-screen place-items-center"><LoaderCircle className="size-6 animate-spin text-primary" aria-label="Loading" /></main>;
  }

  if (!sessionUser) {
    return <AuthScreen authUsername={authUsername} setAuthUsername={setAuthUsername} authPassword={authPassword} setAuthPassword={setAuthPassword} authBusy={authBusy} message={message} onSubmit={handleAuth} />;
  }

  if (workspaceLoading) {
    return <main className="grid min-h-screen place-items-center bg-background px-4"><div className="flex items-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin text-primary" /> Setting up your workspace…</div></main>;
  }

  if (!agency) {
    return <main className="grid min-h-screen place-items-center bg-background px-4 py-10"><section className="w-full max-w-[440px] border border-border bg-card p-6 sm:p-8"><div className="mb-4 grid size-11 place-items-center rounded-md bg-accent text-accent-foreground"><BriefcaseBusiness className="size-5" /></div><h1 className="font-display text-xl font-semibold">{workspaceLoadFailed ? "Workspace unavailable" : "Set up your agency workspace"}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{workspaceLoadFailed ? "Your saved workspace could not be loaded. Try again, or sign out and return later." : "No agency workspace is linked to this account yet. Create one to save your destinations, QR codes, and scan activity."}</p>{message && <p role="alert" className="mt-4 break-words rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{message}</p>}<div className="mt-6 flex flex-col gap-2"><Button type="button" disabled={busy} onClick={() => workspaceLoadFailed ? void refreshWorkspace() : void createWorkspace()}>{busy ? <LoaderCircle className="animate-spin" /> : null}{workspaceLoadFailed ? "Retry loading" : "Create agency workspace"}</Button><Button type="button" variant="ghost" onClick={() => void signOut()}>Sign out</Button></div></section></main>;
  }

  function openView(next: ViewId) {
    setView(next);
    setMobileMenuOpen(false);
    setMessage("");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {mobileMenuOpen && <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 bg-background/75 backdrop-blur-sm md:hidden" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-border bg-card transition-transform md:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[74px] items-center gap-3 border-b border-border px-5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground"><ScanLine className="size-[18px]" /></div>
          <div><div className="text-[14px] font-semibold tracking-[0]">Review Desk</div><div className="mt-0.5 text-[11px] text-muted-foreground">TRAVEL AGENCY WORKSPACE</div></div>
          <Button type="button" variant="ghost" size="icon" className="ml-auto md:hidden" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)}><X /></Button>
        </div>
        <div className="px-4 pt-5">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Workspace</p>
          <nav className="space-y-0.5" aria-label="Main navigation">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => openView(id)} className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-[13px] transition-colors ${view === id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`} aria-current={view === id ? "page" : undefined}>
                <Icon className="size-[17px] shrink-0" /><span className="flex-1">{label}</span>{view === id && <ChevronRight className="size-3.5 opacity-60" />}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto border-t border-border p-4">
          <div className="mb-3 flex items-center gap-3 rounded-md bg-secondary/50 px-3 py-2.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/15 text-[12px] font-semibold text-primary">{agency.name.trim() ? agency.name.trim().slice(0, 1).toUpperCase() : "A"}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium">{agency.name || "Agency workspace"}</p><p className="truncate text-[10px] text-muted-foreground">{sessionUser.email}</p></div>
            <MoreHorizontal className="size-4 text-muted-foreground" />
          </div>
          <Button variant="ghost" className="h-9 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => void signOut()}><LogOut className="size-4" />Sign out</Button>
        </div>
      </aside>

      <main className="min-h-screen md:pl-[260px]">
        <header className="sticky top-0 z-20 flex h-[66px] items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-xl sm:px-7 lg:px-9">
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation" onClick={() => setMobileMenuOpen(true)}><Menu /></Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground"><span>Workspace</span><ChevronRight className="size-3" /><span className="text-foreground">{currentNav.label}</span></div>
          </div>
          <div className="hidden items-center gap-2 border-r border-border pr-4 text-[11px] text-muted-foreground sm:flex"><ShieldCheck className="size-3.5 text-success" />Private workspace</div>
          <Button variant="ghost" size="icon" className="relative" title="Notifications" aria-label="Notifications"><Bell className="size-4" /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-success" /></Button>
          <div className="grid size-8 place-items-center rounded-full border border-border bg-secondary text-[11px] font-medium">{(sessionUser.email[0] ?? "A").toUpperCase()}</div>
        </header>
        <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-7 sm:py-8 lg:px-9">
          {message && <div role="alert" className="mb-5 flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"><span>{message}</span><Button variant="ghost" size="icon" aria-label="Dismiss message" onClick={() => setMessage("")}><X /></Button></div>}
          {view === "overview" && <Overview agency={agency} qrs={qrs} scans={scans} campaigns={campaigns} activeQrCount={activeQrCount} lastSevenDays={lastSevenDays} maxDailyScans={maxDailyScans} platforms={platforms} openView={openView} onRefresh={() => void refreshWorkspace()} />}
          {view === "agencies" && <AgencyPage agency={agency} form={agencyForm} setForm={setAgencyForm} onSubmit={saveAgency} busy={busy} />}
          {view === "categories" && <CategoriesPage categories={categories} form={categoryForm} setForm={setCategoryForm} onSubmit={createCategory} onDelete={deleteCategory} busy={busy} />}
          {view === "templates" && <TemplatesPage templates={reviewTemplates} categories={categories} form={templateForm} setForm={setTemplateForm} onSubmit={createTemplate} onBulkCreate={createMultipleTemplates} onToggle={toggleTemplate} onDelete={deleteTemplate} busy={busy} />}
          {view === "qr" && <QrPage qrs={visibleQrs} allQrs={qrs} platforms={platforms} campaigns={campaigns} categories={categories} form={qrForm} setForm={setQrForm} onSubmit={createQr} onToggle={toggleQr} onDelete={deleteQr} onDownload={downloadQr} search={qrSearch} setSearch={setQrSearch} platformFilter={qrPlatformFilter} setPlatformFilter={setQrPlatformFilter} busy={busy} editingQrId={editingQrId} qrCardForm={qrCardForm} setQrCardForm={setQrCardForm} onStartEdit={startEditQrCard} onCancelEdit={cancelEditQrCard} onSaveCardText={saveQrCardText} />}
          {view === "reviews" && <SubmittedReviewsPage reviews={submittedReviews} categories={categories} qrs={qrs} onUpdateStatus={updateReviewStatus} onDelete={deleteReview} />}
          {view === "campaigns" && <CampaignsPage campaigns={campaigns} qrs={qrs} scans={scans} name={campaignName} setName={setCampaignName} onSubmit={createCampaign} onToggle={setCampaignStatus} busy={busy} />}
          {view === "analytics" && <AnalyticsPage qrs={qrs} scans={scans} platforms={platforms} campaigns={campaigns} days={lastSevenDays} max={maxDailyScans} />}
          {view === "settings" && <SettingsPage agency={agency} onSignOut={() => void signOut()} openPlatforms={() => openView("categories")} />}
        </div>
        <footer className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 pb-7 pt-1 text-[10px] text-muted-foreground sm:px-7 lg:px-9">
          <span>Review Desk · {new Date().getFullYear()}</span><span className="flex items-center gap-1.5"><ShieldCheck className="size-3 text-success" />Scans are not confirmed reviews</span>
        </footer>
      </main>
    </div>
  );
}

function AuthScreen({ authUsername, setAuthUsername, authPassword, setAuthPassword, authBusy, message, onSubmit }: {
  authUsername: string;
  setAuthUsername: (username: string) => void;
  authPassword: string;
  setAuthPassword: (password: string) => void;
  authBusy: boolean;
  message: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-[1180px] lg:grid-cols-[1fr_430px]">
        <section className="relative hidden flex-col justify-between overflow-hidden border-r border-border px-14 py-12 lg:flex">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground"><ScanLine className="size-5" /></div><span className="text-sm font-semibold">Review Desk</span></div>
          <div className="relative max-w-[530px] pb-16">
            <div className="mb-8 flex size-[76px] items-center justify-center rounded-xl border border-border bg-card"><QrCode className="size-9 text-primary" /></div>
            <h1 className="font-display text-[42px] font-semibold leading-[1.12]">Make it easy to share <span className="text-primary">an honest review.</span></h1>
            <p className="mt-5 max-w-[420px] text-[14px] leading-7 text-muted-foreground">One workspace for agency destinations, travel review QR codes, print cards and real scan activity.</p>
            <div className="mt-10 grid max-w-[430px] grid-cols-3 gap-5 border-t border-border pt-5">
              {[{ label: "TRUST", icon: ShieldCheck }, { label: "QR", icon: ScanLine }, { label: "INSIGHTS", icon: Activity }].map(({ label, icon: Icon }) => <div key={label} className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground"><Icon className="size-3.5 text-success" />{label}</div>)}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Your review links stay under your control.</p>
        </section>
        <section className="flex min-h-screen flex-col justify-center px-5 py-12 sm:px-10">
          <div className="mx-auto w-full max-w-[368px]">
            <div className="mb-8 flex items-center gap-3 lg:hidden"><div className="grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground"><ScanLine className="size-[18px]" /></div><span className="text-sm font-semibold">Review Desk</span></div>
            <div className="mb-8"><p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-primary">Travel review workspace</p><h2 className="font-display text-[28px] font-semibold">Welcome back</h2><p className="mt-2 text-[13px] leading-6 text-muted-foreground">Sign in to manage your agency's review links.</p></div>
            {message && <div role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-[12px] text-destructive">{message}</div>}
            <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="auth-username">Username</Label><Input id="auth-username" type="text" autoComplete="username" required className={inputClass} placeholder="Enter username" value={authUsername} onChange={(event) => setAuthUsername(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="auth-password">Password</Label><Input id="auth-password" type="password" autoComplete="current-password" required className={inputClass} placeholder="Enter password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} /></div>
              <Button className="h-11 w-full" type="submit" disabled={authBusy}>{authBusy ? <LoaderCircle className="animate-spin" /> : null}Sign in<ArrowRight className="ml-auto size-4" /></Button>
            </form>
            <p className="mt-8 text-center text-[10px] leading-5 text-muted-foreground">Genuine reviews are written and submitted by your customers on their chosen review platform.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">{eyebrow ?? "WORKSPACE"}</p><h1 className="font-display text-[25px] font-semibold sm:text-[28px]">{title}</h1><p className="mt-2 max-w-[680px] text-[13px] leading-6 text-muted-foreground">{description}</p></div>{action}</div>;
}

function Metric({ label, value, detail, icon: Icon, tone = "blue" }: { label: string; value: string | number; detail: string; icon: IconComponent; tone?: "blue" | "teal" | "green" }) {
  const toneClass = tone === "teal" ? "bg-accent text-accent-foreground" : tone === "green" ? "bg-success/15 text-success" : "bg-primary/15 text-primary";
  return <div className="border border-border bg-card p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><p className="text-[11px] text-muted-foreground">{label}</p><div className={`grid size-8 shrink-0 place-items-center rounded-md ${toneClass}`}><Icon className="size-4" /></div></div><p className="mt-4 font-display text-[26px] font-semibold tabular-nums">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">{detail}</p></div>;
}

function PanelHeading({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5"><div><h2 className="text-[13px] font-semibold">{title}</h2>{detail && <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>}</div>{action}</div>;
}

function EmptyState({ icon: Icon, title, description, action }: { icon: IconComponent; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex min-h-[210px] flex-col items-center justify-center px-6 py-9 text-center"><div className="mb-4 grid size-11 place-items-center rounded-lg bg-secondary text-muted-foreground"><Icon className="size-5" /></div><h3 className="text-[13px] font-medium">{title}</h3><p className="mt-1.5 max-w-[320px] text-[11px] leading-5 text-muted-foreground">{description}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

function Overview({ agency, qrs, scans, campaigns, activeQrCount, lastSevenDays, maxDailyScans, platforms, openView, onRefresh }: {
  agency: Agency;
  qrs: QrRow[];
  scans: Scan[];
  campaigns: Campaign[];
  activeQrCount: number;
  lastSevenDays: { key: string; label: string; count: number }[];
  maxDailyScans: number;
  platforms: Platform[];
  openView: (view: ViewId) => void;
  onRefresh: () => void;
}) {
  const topQrs = [...qrs].sort((a, b) => countScans(scans, b.id) - countScans(scans, a.id)).slice(0, 4);
  return <>
    <PageIntro eyebrow="AGENCY OVERVIEW" title={`Welcome${agency.name ? `, ${agency.name}` : " to your workspace"}`} description="A clear view of the review links, QR codes and customer scans you've collected." action={<Button variant="outline" className={buttonQuiet} onClick={onRefresh}><Activity className="size-4" />Refresh activity</Button>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric label="Total QR codes" value={qrs.length} detail="All QR codes created" icon={QrCode} />
      <Metric label="Total scans" value={scans.length} detail="Recorded redirect visits" icon={ScanLine} tone="teal" />
      <Metric label="Estimated visitors" value={scans.length} detail="Scan events; not verified people" icon={Users} tone="green" />
      <Metric label="Currently active" value={activeQrCount} detail="Active and not expired" icon={Activity} />
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
      <section className="border border-border bg-card">
        <PanelHeading title="Scan activity" detail="Recorded scans · last 7 days" action={<span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className="size-1.5 rounded-full bg-success" />LIVE TOTALS</span>} />
        {scans.length === 0 ? <EmptyState icon={BarChart3} title="Scan activity starts with your first QR code" description="Once customers scan an active tracked code, actual visit totals will appear here." action={<Button variant="outline" className={buttonQuiet} onClick={() => openView("qr")}><Plus className="size-4" />Create a QR code</Button>} /> : <div className="p-4 sm:p-5"><div className="mb-5 flex items-end justify-between"><div><div className="font-display text-[29px] font-semibold tabular-nums">{scans.length}</div><p className="mt-1 text-[10px] text-muted-foreground">Recorded scan events</p></div><span className="text-[10px] text-muted-foreground">Last seven days</span></div><div className="flex h-[132px] items-end gap-2 border-b border-border pb-0 sm:gap-3">{lastSevenDays.map((day) => <div key={day.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[9px] tabular-nums text-muted-foreground">{day.count || ""}</span><div className="w-full max-w-[30px] rounded-t-sm bg-primary/80 transition-all" style={{ height: `${Math.max(day.count ? 15 : 3, (day.count / maxDailyScans) * 83)}%` }} /><span className="pb-2 text-[9px] text-muted-foreground">{day.label}</span></div>)}</div></div>}
      </section>
      <section className="border border-border bg-card">
        <PanelHeading title="Review platforms" detail="Your configured destinations" action={<Button variant="ghost" size="sm" className="h-7 text-[10px] text-primary" onClick={() => openView("platforms")}>Manage<ArrowRight className="size-3" /></Button>} />
        <div className="divide-y divide-border">
          {platforms.map((platform) => <div key={platform.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5"><PlatformMark platform={platform.platform_type as PlatformType} /><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium">{platform.display_name}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{platform.review_url ? truncateUrl(platform.review_url) : "Destination not set"}</p></div><StatusPill status={platform.enabled ? "verified" : platform.verification_status} /></div>)}
        </div>
        {platforms.length === 0 && <EmptyState icon={Globe2} title="No destinations configured" description="Add the exact profile or review links for your agency." />}
      </section>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
      <section className="border border-border bg-card">
        <PanelHeading title="Top performing QR codes" detail="Sorted by recorded scans" action={<Button variant="ghost" size="sm" className="h-7 text-[10px] text-primary" onClick={() => openView("qr")}>View all<ArrowRight className="size-3" /></Button>} />
        {topQrs.length === 0 ? <EmptyState icon={QrCode} title="Your QR codes will appear here" description="Choose a verified destination to create your first code." action={<Button size="sm" onClick={() => openView("qr")}><Plus className="size-4" />New QR code</Button>} /> : <div className="divide-y divide-border">{topQrs.map((qr) => { const platform = platforms.find((item) => item.id === qr.platform_id); return <div key={qr.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5"><div className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-primary"><QrCode className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium">{qr.name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{platform?.display_name ?? "Unassigned"} · {qr.qr_type === "tracked" ? "Tracked" : "Direct"}</p></div><div className="text-right"><p className="text-[14px] font-semibold tabular-nums">{countScans(scans, qr.id)}</p><p className="text-[9px] text-muted-foreground">scans</p></div><StatusPill status={qr.status} /></div>; })}</div>}
      </section>
      <section className="border border-border bg-card">
        <PanelHeading title="Campaign activity" detail={`${campaigns.length} total campaigns`} action={<Button variant="ghost" size="sm" className="h-7 text-[10px] text-primary" onClick={() => openView("campaigns")}>Manage<ArrowRight className="size-3" /></Button>} />
        {campaigns.length === 0 ? <EmptyState icon={Sparkles} title="No campaigns yet" description="Group your QR codes by handout, tour, or follow-up channel." action={<Button variant="outline" className={buttonQuiet} size="sm" onClick={() => openView("campaigns")}><Plus className="size-4" />Create campaign</Button>} /> : <div className="divide-y divide-border">{campaigns.slice(0, 5).map((campaign) => { const campaignQrs = qrs.filter((qr) => qr.campaign_id === campaign.id); const campaignScans = scans.filter((scan) => campaignQrs.some((qr) => qr.id === scan.qr_code_id)); return <div key={campaign.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5"><div className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground"><Sparkles className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium">{campaign.name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{campaignQrs.length} QR codes · {campaignScans.length} scans</p></div><StatusPill status={campaign.status} /></div>; })}</div>}
      </section>
    </div>
    <p className="mt-5 flex items-start gap-2 border-l-2 border-success pl-3 text-[10px] leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />A QR scan is a visit, not a confirmed review. Customers write and submit feedback on the platform themselves.</p>
  </>;
}

function AgencyPage({ agency, form, setForm, onSubmit, busy }: { agency: Agency; form: { name: string; email: string; phone: string; website: string }; setForm: React.Dispatch<React.SetStateAction<{ name: string; email: string; phone: string; website: string }>>; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <><PageIntro eyebrow="YOUR BUSINESS" title="Agency details" description="The contact details shown to customers on their review card and inactive-link page." /><div className="max-w-[760px] border border-border bg-card"><PanelHeading title="Agency profile" detail="Keep your public contact information up to date" /><form className="space-y-5 p-5 sm:p-7" onSubmit={(event) => void onSubmit(event)}><div className="grid gap-5 sm:grid-cols-2"><Field label="Agency name" htmlFor="agency-name"><Input id="agency-name" maxLength={120} className={inputClass} placeholder="Your agency name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field><Field label="Contact email" htmlFor="agency-email"><Input id="agency-email" type="email" required className={inputClass} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></Field><Field label="Phone number" htmlFor="agency-phone"><Input id="agency-phone" type="tel" className={inputClass} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></Field><Field label="Website" htmlFor="agency-website"><Input id="agency-website" type="url" className={inputClass} placeholder="https://your-agency.com" value={form.website} onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))} /></Field></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5"><p className="text-[10px] text-muted-foreground">Workspace created {formatDate(agency.created_at)}</p><Button type="submit" disabled={busy}><Save className="size-4" />Save agency details</Button></div></form></div></>;
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={htmlFor}>{label}</Label>{children}{hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}</div>;
}

function PlatformPage({ platforms, form, setForm, onSave, onVerify, onToggle, busy }: {
  platforms: Platform[];
  form: Record<string, { profile: string; review: string }>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, { profile: string; review: string }>>>;
  onSave: (platform: Platform) => void;
  onVerify: (platform: Platform) => void;
  onToggle: (platform: Platform) => void;
  busy: boolean;
}) {
  return <><PageIntro eyebrow="DESTINATIONS" title="Review platforms" description="Add your actual profile and review links. Destinations remain private until you verify and enable them." /><div className="mb-5 flex items-start gap-2.5 border border-border bg-card p-4"><CircleHelp className="mt-0.5 size-4 shrink-0 text-primary" /><div><p className="text-[11px] font-medium">No review links are prefilled</p><p className="mt-1 text-[10px] leading-5 text-muted-foreground">Use the exact URL for your agency listing. Routard.fr and Tripadvisor destinations must be checked by you; this workspace does not assume either platform offers a direct submission link or official QR integration.</p></div></div><div className="space-y-4">{platforms.map((platform) => { const values = form[platform.id] ?? { profile: "", review: "" }; return <article key={platform.id} className="border border-border bg-card"><div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-4 sm:px-5"><PlatformMark platform={platform.platform_type as PlatformType} /><div className="min-w-0 flex-1"><h2 className="text-[13px] font-semibold">{platform.display_name}</h2><p className="mt-0.5 text-[10px] text-muted-foreground">{platform.platform_type === "custom" ? "Any public HTTPS review page" : `Official ${PLATFORM_META[platform.platform_type as PlatformType].label} website`}</p></div><StatusPill status={platform.enabled ? "verified" : platform.verification_status} /></div><div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5"><Field label="Agency profile URL" htmlFor={`${platform.id}-profile`} hint="Optional public listing page"><Input id={`${platform.id}-profile`} type="url" className={inputClass} placeholder="https://" value={values.profile} onChange={(event) => setForm((current) => ({ ...current, [platform.id]: { ...current[platform.id], profile: event.target.value } }))} /></Field><Field label="Review destination URL" htmlFor={`${platform.id}-review`} hint="Required before you can create a QR code"><Input id={`${platform.id}-review`} type="url" className={inputClass} placeholder="https://" value={values.review} onChange={(event) => setForm((current) => ({ ...current, [platform.id]: { ...current[platform.id], review: event.target.value } }))} /></Field></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/20 px-4 py-3 sm:px-5"><p className="text-[10px] text-muted-foreground">{platform.verification_status === "verified" ? "Owner confirmed destination" : "Not yet checked"}</p><div className="flex flex-wrap items-center gap-2">{platform.review_url && <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-[11px]" onClick={() => window.open(platform.review_url ?? undefined, "_blank", "noopener,noreferrer")}><ExternalLink className="size-3.5" />Open destination</Button>}<Button type="button" variant="outline" size="sm" className={`${buttonQuiet} h-8 text-[11px]`} disabled={busy} onClick={() => onSave(platform)}><Save className="size-3.5" />Save</Button>{platform.verification_status !== "verified" ? <Button type="button" size="sm" className="h-8 text-[11px]" disabled={busy || !platform.review_url} onClick={() => onVerify(platform)}><CheckCircle2 className="size-3.5" />Confirm verified</Button> : <Button type="button" variant={platform.enabled ? "secondary" : "outline"} size="sm" className={`h-8 ${!platform.enabled ? buttonQuiet : ""}`} onClick={() => onToggle(platform)}>{platform.enabled ? "Disable" : "Enable"}</Button>}</div></div></article>; })}</div></>;
}

function QrPage({ qrs, allQrs, platforms, campaigns, categories, form, setForm, onSubmit, onToggle, onDelete, onDownload, search, setSearch, platformFilter, setPlatformFilter, busy, editingQrId, qrCardForm, setQrCardForm, onStartEdit, onCancelEdit, onSaveCardText }: {
  qrs: QrRow[]; allQrs: QrRow[]; platforms: Platform[]; campaigns: Campaign[]; categories: Category[];
  form: { name: string; platformId: string; campaignId: string; categoryId: string; type: string; expiresAt: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; platformId: string; campaignId: string; categoryId: string; type: string; expiresAt: string }>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onToggle: (qr: QrRow) => void; onDelete: (qr: QrRow) => void; onDownload: (qr: QrRow, type: "png" | "svg") => void;
  search: string; setSearch: (value: string) => void; platformFilter: string; setPlatformFilter: (value: string) => void; busy: boolean;
  editingQrId: string | null;
  qrCardForm: { headline: string; subtitle: string; businessName: string; footerText: string };
  setQrCardForm: React.Dispatch<React.SetStateAction<{ headline: string; subtitle: string; businessName: string; footerText: string }>>;
  onStartEdit: (qr: QrRow) => void; onCancelEdit: () => void; onSaveCardText: () => void;
}) {
  const selectablePlatforms = platforms.filter((item) => item.enabled && item.verification_status === "verified" && Boolean(item.review_url));
  return <><PageIntro eyebrow="PRINT AND SHARE" title="QR codes" description="Create a QR code linked to a category. When scanned, customers see review templates from that category." /><div className="grid gap-5 xl:grid-cols-[0.85fr_1.6fr]"><section className="h-fit border border-border bg-card"><PanelHeading title="Create a QR code" detail="Link to a category for review templates" /><form className="space-y-4 p-4 sm:p-5" onSubmit={(event) => void onSubmit(event)}><Field label="QR code name" htmlFor="qr-name"><Input id="qr-name" className={inputClass} required maxLength={120} placeholder="e.g. Table 5, Room 101" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field><Field label="Category" htmlFor="qr-category"><select id="qr-category" required className={`${inputClass} w-full rounded-md border px-3 text-[13px]`} value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}><option value="">Select a category</option>{categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></Field><Field label="Review platform" htmlFor="qr-platform"><select id="qr-platform" required className={`${inputClass} w-full rounded-md border px-3 text-[13px]`} value={form.platformId} onChange={(event) => setForm((current) => ({ ...current, platformId: event.target.value }))}><option value="">Choose a verified platform</option>{selectablePlatforms.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></Field><Field label="Campaign (optional)" htmlFor="qr-campaign"><select id="qr-campaign" className={`${inputClass} w-full rounded-md border px-3 text-[13px]`} value={form.campaignId} onChange={(event) => setForm((current) => ({ ...current, campaignId: event.target.value }))}><option value="">No campaign</option>{campaigns.filter((campaign) => campaign.status === "active").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Optional expiry date" htmlFor="qr-expiry"><Input id="qr-expiry" className={inputClass} type="date" min={new Date().toISOString().slice(0, 10)} value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} /></Field><Button type="submit" className="w-full" disabled={busy || selectablePlatforms.length === 0 || categories.length === 0}><Plus className="size-4" />Create QR code</Button>{selectablePlatforms.length === 0 && <p className="text-[10px] leading-5 text-muted-foreground">Verify and enable a destination in Review platforms first.</p>}{categories.length === 0 && <p className="text-[10px] leading-5 text-muted-foreground">Create a category first to link QR codes.</p>}</form></section>
    <section className="border border-border bg-card"><PanelHeading title="Your QR codes" detail={`${allQrs.length} created`} /><div className="flex flex-wrap gap-2 border-b border-border p-3"><div className="relative min-w-[175px] flex-1"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search QR codes" className={`${inputClass} h-9 pl-9 text-[11px]`} placeholder="Search names" value={search} onChange={(event) => setSearch(event.target.value)} /></div><select aria-label="Filter by platform" className="h-9 rounded-md border border-input bg-background px-3 text-[11px]" value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)}><option value="all">All platforms</option>{platforms.map((item) => <option key={item.id} value={item.platform_type}>{item.display_name}</option>)}</select></div>{qrs.length === 0 ? <EmptyState icon={QrCode} title={allQrs.length ? "No QR codes match these filters" : "No QR codes created yet"} description={allQrs.length ? "Try another search term or platform." : "Create a code after setting up categories and platforms."} /> : <div className="divide-y divide-border">{qrs.map((qr) => <QrListItem key={qr.id} qr={qr} platforms={platforms} campaigns={campaigns} onToggle={() => onToggle(qr)} onDelete={() => onDelete(qr)} onDownload={onDownload} isEditing={editingQrId === qr.id} editForm={qrCardForm} setEditForm={setQrCardForm} onStartEdit={() => onStartEdit(qr)} onCancelEdit={onCancelEdit} onSaveEdit={onSaveCardText} busy={busy} />)}</div>}</section></div></>;
}

function QrListItem({ qr, platforms, campaigns, onToggle, onDelete, onDownload, isEditing, editForm, setEditForm, onStartEdit, onCancelEdit, onSaveEdit, busy }: { 
  qr: QrRow; platforms: Platform[]; campaigns: Campaign[]; onToggle: () => void; onDelete: () => void; onDownload: (qr: QrRow, type: "png" | "svg") => void;
  isEditing: boolean; editForm: { headline: string; subtitle: string; businessName: string; footerText: string };
  setEditForm: React.Dispatch<React.SetStateAction<{ headline: string; subtitle: string; businessName: string; footerText: string }>>;
  onStartEdit: () => void; onCancelEdit: () => void; onSaveEdit: () => void; busy: boolean;
}) {
  const [preview, setPreview] = useState("");
  useEffect(() => { 
    let cancelled = false; 
    const platform = platforms.find((item) => item.id === qr.platform_id); 
    if (!platform?.review_url || qr.status !== "active") return; 
    // Generate QR target URL
    const target = qr.qr_type === "direct" 
      ? platform.review_url 
      : `${typeof window === "undefined" ? "" : window.location.origin}/r/${encodeURIComponent(qr.unique_code)}`;
    void QRCode.toDataURL(target, { width: 160, margin: 2, errorCorrectionLevel: "H" })
      .then((png: string) => { if (!cancelled) setPreview(png); })
      .catch(() => {}); 
    return () => { cancelled = true; }; 
  }, [qr, platforms]);
  const platform = platforms.find((item) => item.id === qr.platform_id);
  const campaign = campaigns.find((item) => item.id === qr.campaign_id);
  const expired = Boolean(qr.expires_at && new Date(qr.expires_at) <= new Date());
  const enabled = qr.status === "active" && !expired;
  
  if (isEditing) {
    return (
      <div className="border-l-4 border-primary bg-secondary/30 px-4 py-4 sm:px-5">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-[13px] font-semibold">Edit QR Card Text for "{qr.name}"</h4>
          <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit}><X className="size-4" /></Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Headline" htmlFor={`edit-headline-${qr.id}`}>
            <Input id={`edit-headline-${qr.id}`} className={inputClass} maxLength={100} placeholder="Happy with our service?" value={editForm.headline} onChange={(e) => setEditForm((c) => ({ ...c, headline: e.target.value }))} />
          </Field>
          <Field label="Subtitle" htmlFor={`edit-subtitle-${qr.id}`}>
            <Input id={`edit-subtitle-${qr.id}`} className={inputClass} maxLength={150} placeholder="Help spread the word..." value={editForm.subtitle} onChange={(e) => setEditForm((c) => ({ ...c, subtitle: e.target.value }))} />
          </Field>
          <Field label="Business Name" htmlFor={`edit-business-${qr.id}`}>
            <Input id={`edit-business-${qr.id}`} className={inputClass} maxLength={100} placeholder="Your Business Name Here" value={editForm.businessName} onChange={(e) => setEditForm((c) => ({ ...c, businessName: e.target.value }))} />
          </Field>
          <Field label="Footer Text" htmlFor={`edit-footer-${qr.id}`}>
            <Input id={`edit-footer-${qr.id}`} className={inputClass} maxLength={100} placeholder="Scan QR code to review us" value={editForm.footerText} onChange={(e) => setEditForm((c) => ({ ...c, footerText: e.target.value }))} />
          </Field>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="button" onClick={onSaveEdit} disabled={busy}><Save className="size-4" />Save Card Text</Button>
          <Button type="button" variant="outline" className={buttonQuiet} onClick={onCancelEdit}>Cancel</Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
      <div className="grid size-[54px] shrink-0 place-items-center border border-border bg-secondary/70">
        {preview ? <img src={preview} alt={`QR preview for ${qr.name}`} className="size-12" /> : <QrCode className="size-5 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold">{qr.name}</p>
        <p className="mt-1 truncate text-[10px] text-muted-foreground">{platform?.display_name ?? "Unknown platform"}{campaign ? ` · ${campaign.name}` : ""} · {qr.qr_type === "tracked" ? "Tracked" : "Direct"}</p>
        <p className="mt-1 text-[9px] text-muted-foreground">{formatDate(qr.created_at)} · {expired ? "Expired" : qr.expires_at ? `Expires ${formatDate(qr.expires_at)}` : "No expiry"}</p>
      </div>
      <StatusPill status={expired ? "expired" : qr.status} />
      <div className="flex w-full items-center justify-end gap-1 sm:w-auto">
        {enabled && (
          <>
            <Button type="button" variant="ghost" size="icon" aria-label={`Edit card text for ${qr.name}`} title="Edit Card Text" onClick={onStartEdit}><Pencil className="size-4" /></Button>
            <Button type="button" variant="ghost" size="icon" aria-label={`Download ${qr.name} PNG`} title="Download PNG" onClick={() => onDownload(qr, "png")}><FileImage /></Button>
            <Button type="button" variant="ghost" size="icon" aria-label={`Download ${qr.name} SVG`} title="Download SVG" onClick={() => onDownload(qr, "svg")}><ArrowDownToLine /></Button>
          </>
        )}
        <Button type="button" variant="ghost" size="icon" aria-label={enabled ? `Deactivate ${qr.name}` : `Activate ${qr.name}`} title={enabled ? "Deactivate" : "Activate"} onClick={onToggle}><Activity /></Button>
        <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${qr.name}`} title="Delete" onClick={onDelete}><Trash2 className="text-destructive" /></Button>
      </div>
    </div>
  );
}

function ReviewCardPage({ agency, qrs, platforms, qrId, setQrId, headline, setHeadline, body, setBody, orientation, setOrientation, qrPng, onSave, onPdf }: {
  agency: Agency; qrs: QrRow[]; platforms: Platform[]; qrId: string; setQrId: (id: string) => void; headline: string; setHeadline: (value: string) => void; body: string; setBody: (value: string) => void; orientation: string; setOrientation: (value: string) => void; qrPng: string; onSave: () => void; onPdf: () => void;
}) {
  const activeQrs = qrs.filter((qr) => qr.status === "active" && (!qr.expires_at || new Date(qr.expires_at) > new Date()) && platforms.some((platform) => platform.id === qr.platform_id && platform.enabled && platform.review_url));
  return <><PageIntro eyebrow="PRINT DESIGN" title="Review card" description="Create a personal thank-you card with your configured contact details and a working QR code." action={<Button variant="outline" className={buttonQuiet} onClick={() => window.print()} disabled={!qrPng}><Printer className="size-4" />Print card</Button>} /><div className="grid gap-5 xl:grid-cols-[0.85fr_1.25fr]"><section className="h-fit border border-border bg-card"><PanelHeading title="Card content" detail="The message is editable; customers submit reviews themselves" /><div className="space-y-4 p-4 sm:p-5"><Field label="Card headline" htmlFor="card-headline"><Input id="card-headline" maxLength={140} className={inputClass} value={headline} onChange={(event) => setHeadline(event.target.value)} /></Field><Field label="Message" htmlFor="card-body"><Textarea id="card-body" rows={8} maxLength={800} className="min-h-[180px] resize-y rounded-md border-border bg-background/60 text-[13px] leading-6" value={body} onChange={(event) => setBody(event.target.value)} /></Field><Field label="Review QR code" htmlFor="card-qr"><select id="card-qr" className={`${inputClass} w-full rounded-md border px-3 text-[13px]`} value={qrId} onChange={(event) => setQrId(event.target.value)}><option value="">Choose an active code</option>{activeQrs.map((qr) => <option key={qr.id} value={qr.id}>{qr.name} · {platforms.find((item) => item.id === qr.platform_id)?.display_name}</option>)}</select></Field><div><Label>Card orientation</Label><div className="mt-2 grid grid-cols-2 gap-2">{["portrait", "landscape"].map((item) => <Button key={item} type="button" variant={orientation === item ? "secondary" : "outline"} className={orientation === item ? "" : buttonQuiet} onClick={() => setOrientation(item)}>{orientation === item && <Check className="size-3.5" />}{capitalize(item)}</Button>)}</div></div><div className="grid grid-cols-2 gap-2 border-t border-border pt-4"><Button type="button" variant="outline" className={buttonQuiet} onClick={onSave}><Save className="size-4" />Save text</Button><Button type="button" onClick={onPdf} disabled={!qrPng}><ArrowDownToLine className="size-4" />Download PDF</Button></div></div></section><section className="border border-border bg-card"><PanelHeading title="Print preview" detail="Your contact details are loaded from your agency settings" /><div className="flex min-h-[480px] items-center justify-center bg-secondary/35 p-5 sm:p-8"><article className={`review-card-print relative flex w-full max-w-[460px] flex-col items-center overflow-hidden border border-border bg-background px-8 py-8 text-center shadow-xl ${orientation === "landscape" ? "aspect-[1.42/1]" : "aspect-[0.72/1]"}`}><div className="absolute inset-x-0 top-0 h-1 bg-primary" /><div className="mt-4 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground"><ScanLine className="size-5" /></div><h2 className="mt-5 max-w-[340px] font-display text-[21px] font-semibold leading-7">{headline}</h2><p className="mt-4 max-w-[340px] whitespace-pre-line text-[11px] leading-6 text-muted-foreground">{body}</p><div className="my-5 grid min-h-[152px] w-[152px] place-items-center border border-border bg-card p-2">{qrPng ? <img src={qrPng} alt="Review destination QR code" className="size-[136px]" /> : <div className="flex flex-col items-center gap-2 text-muted-foreground"><QrCode className="size-8" /><span className="text-[10px]">Choose a valid QR code</span></div>}</div><p className="text-[12px] font-medium">{agency.name || "Your travel agency"}</p><p className="mt-1.5 max-w-full break-all text-[9px] text-muted-foreground">{agency.email} · {agency.phone}</p><p className="mt-4 flex items-center gap-1 text-[9px] text-success"><ShieldCheck className="size-3" />Share your honest experience</p></article></div></section></div></>;
}

function CampaignsPage({ campaigns, qrs, scans, name, setName, onSubmit, onToggle, busy }: { campaigns: Campaign[]; qrs: QrRow[]; scans: Scan[]; name: string; setName: (name: string) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onToggle: (campaign: Campaign) => void; busy: boolean }) {
  return <><PageIntro eyebrow="ORGANIZE OUTREACH" title="Campaigns" description="Group QR codes by where customers receive them. No follow-up messages are sent automatically." /><div className="grid gap-5 lg:grid-cols-[0.75fr_1.5fr]"><section className="h-fit border border-border bg-card"><PanelHeading title="Create campaign" detail="Add a reusable group for QR codes" /><form className="space-y-4 p-4 sm:p-5" onSubmit={(event) => void onSubmit(event)}><Field label="Campaign name" htmlFor="campaign-name"><Input id="campaign-name" className={inputClass} required maxLength={120} placeholder="e.g. After Tour" value={name} onChange={(event) => setName(event.target.value)} /></Field><Button className="w-full" type="submit" disabled={busy}><Plus className="size-4" />Create campaign</Button><p className="text-[10px] leading-5 text-muted-foreground">Examples: tour guide handout, hotel reception, printed brochure, WhatsApp or email follow-up.</p></form></section><section className="border border-border bg-card"><PanelHeading title="Campaign performance" detail={`${campaigns.length} campaigns · based on recorded scan events`} />{campaigns.length === 0 ? <EmptyState icon={Sparkles} title="No campaigns to report" description="Create a campaign to begin organizing your QR codes." /> : <div className="divide-y divide-border">{campaigns.map((campaign) => { const related = qrs.filter((qr) => qr.campaign_id === campaign.id); const totalScans = scans.filter((scan) => related.some((qr) => qr.id === scan.qr_code_id)).length; return <div key={campaign.id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5"><div className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground"><Sparkles className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold">{campaign.name}</p><p className="mt-1 text-[10px] text-muted-foreground">Created {formatDate(campaign.created_at)} · {related.length} QR codes · {totalScans} scans</p></div><div className="flex items-center gap-2"><StatusPill status={campaign.status} /><Button type="button" variant="outline" size="sm" className={`${buttonQuiet} h-8 text-[10px]`} onClick={() => onToggle(campaign)}>{campaign.status === "active" ? "Pause" : "Resume"}</Button></div></div>; })}</div>}</section></div><p className="mt-5 text-[10px] leading-5 text-muted-foreground">Campaign scan counts reflect QR redirects only. This workspace does not send marketing or messaging campaigns.</p></>;
}

function AnalyticsPage({ qrs, scans, platforms, campaigns, days, max }: { qrs: QrRow[]; scans: Scan[]; platforms: Platform[]; campaigns: Campaign[]; days: { key: string; label: string; count: number }[]; max: number }) {
  const uniqueCodeCount = new Set(scans.map((scan) => scan.qr_code_id)).size;
  return <><PageIntro eyebrow="REAL ACTIVITY ONLY" title="Analytics" description="See recorded QR redirects. Counts are scan events, not unique people or confirmed reviews." /><div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric label="Recorded scans" value={scans.length} detail="Tracked redirect events" icon={ScanLine} tone="teal" /><Metric label="QR codes scanned" value={uniqueCodeCount} detail={`Of ${qrs.length} total codes`} icon={QrCode} /><Metric label="Active campaigns" value={campaigns.filter((campaign) => campaign.status === "active").length} detail={`${campaigns.length} total campaigns`} icon={Sparkles} tone="green" /><Metric label="Review platforms" value={platforms.filter((platform) => platform.enabled).length} detail="Verified and enabled" icon={Globe2} /></div><section className="mt-5 border border-border bg-card"><PanelHeading title="Daily scan trend" detail="Last 7 calendar days · actual redirect events" />{scans.length === 0 ? <EmptyState icon={BarChart3} title="No scan events yet" description="Tracked QR codes will start appearing after a customer scans them." /> : <div className="p-5"><div className="grid h-[240px] grid-cols-7 gap-3 border-b border-l border-border pl-3 pt-4 sm:gap-6">{days.map((day) => <div key={day.key} className="flex flex-col items-center justify-end gap-2"><span className="text-[10px] tabular-nums text-muted-foreground">{day.count}</span><div className="w-full max-w-[48px] rounded-t-sm bg-primary transition-all" style={{ height: `${Math.max(day.count ? 8 : 2, (day.count / max) * 78)}%` }} /><span className="pb-3 text-[9px] text-muted-foreground">{day.label}</span></div>)}</div></div>}</section><div className="mt-5 grid gap-5 lg:grid-cols-2"><section className="border border-border bg-card"><PanelHeading title="Scans by platform" detail="Grouped by QR code's saved platform" />{platforms.length === 0 ? <EmptyState icon={Globe2} title="No platforms configured" description="Add a destination to begin." /> : <div className="divide-y divide-border">{platforms.map((platform) => { const related = qrs.filter((qr) => qr.platform_id === platform.id); const count = scans.filter((scan) => related.some((qr) => qr.id === scan.qr_code_id)).length; return <div key={platform.id} className="flex items-center gap-3 px-4 py-3.5"><PlatformMark platform={platform.platform_type as PlatformType} /><span className="flex-1 text-[12px]">{platform.display_name}</span><span className="text-[12px] font-semibold tabular-nums">{count}</span><span className="text-[9px] text-muted-foreground">scans</span></div>; })}</div>}</section><section className="border border-border bg-card"><PanelHeading title="Scans by campaign" detail="Recorded events grouped by campaign" />{campaigns.length === 0 ? <EmptyState icon={Sparkles} title="No campaigns created" description="Organize QR codes to compare campaigns." /> : <div className="divide-y divide-border">{campaigns.map((campaign) => { const ids = qrs.filter((qr) => qr.campaign_id === campaign.id).map((qr) => qr.id); const count = scans.filter((scan) => ids.includes(scan.qr_code_id)).length; return <div key={campaign.id} className="flex items-center gap-3 px-4 py-3.5"><Sparkles className="size-4 text-accent-foreground" /><span className="flex-1 text-[12px]">{campaign.name}</span><span className="text-[12px] font-semibold tabular-nums">{count}</span><span className="text-[9px] text-muted-foreground">scans</span></div>; })}</div>}</section></div><p className="mt-5 flex items-start gap-2 border-l-2 border-primary pl-3 text-[10px] leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />Scan events store only the QR code, time, device category, and referrer domain. No customer name, review text, full IP address, or platform credentials are collected. Events are retained until the QR code is removed.</p></>;
}

function SettingsPage({ agency, onSignOut, openPlatforms }: { agency: Agency; onSignOut: () => void; openPlatforms: () => void }) {
  return <><PageIntro eyebrow="WORKSPACE PREFERENCES" title="Settings" description="Review access, saved contact details and destination controls." /><div className="grid gap-5 lg:grid-cols-2"><section className="border border-border bg-card"><PanelHeading title="Workspace access" detail="Administrator account" /><div className="flex items-center gap-3 p-5"><div className="grid size-10 place-items-center rounded-full bg-primary/15 text-sm font-medium text-primary"><Users className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium">Administrator</p><p className="mt-1 text-[10px] text-muted-foreground">Your sign-in email is managed securely.</p></div><Button variant="outline" className={buttonQuiet} onClick={onSignOut}><LogOut className="size-4" />Sign out</Button></div></section><section className="border border-border bg-card"><PanelHeading title="Agency contact" detail="Shown on customer-facing cards and inactive codes" /><div className="space-y-3 p-5"><SettingsLine icon={BriefcaseBusiness} label="Agency name" value={agency.name || "Not set"} /><SettingsLine icon={Mail} label="Contact email" value={agency.email} /><SettingsLine icon={Phone} label="Phone" value={agency.phone} /><Button variant="outline" className={`${buttonQuiet} mt-1`} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><Pencil className="size-4" />Edit details from Agency details</Button></div></section><section className="border border-border bg-card lg:col-span-2"><PanelHeading title="Review destinations" detail="HTTPS destinations are confirmed by the agency owner before QR creation." /><div className="flex flex-wrap items-center justify-between gap-3 p-5"><div className="max-w-[620px] text-[11px] leading-5 text-muted-foreground">Destination URLs are checked for HTTPS and the supported platform domain. Redirect destinations come only from the saved review platform, never from a visitor-supplied URL.</div><Button variant="outline" className={buttonQuiet} onClick={openPlatforms}><Globe2 className="size-4" />Manage destinations</Button></div></section><section className="border border-border bg-card lg:col-span-2"><PanelHeading title="Privacy and analytics" detail="Minimal scan tracking" /><div className="p-5 text-[11px] leading-6 text-muted-foreground">Analytics record the QR code, scan time, coarse device category, and referrer host. Scan events are retained until their QR code is deleted. QR scans and outbound redirects are not reported as completed reviews.</div></section></div></>;
}

function SettingsLine({ icon: Icon, label, value }: { icon: IconComponent; label: string; value: string }) {
  return <div className="flex items-center gap-3 border-b border-border pb-3"><Icon className="size-4 text-muted-foreground" /><span className="w-28 text-[10px] text-muted-foreground">{label}</span><span className="min-w-0 truncate text-[11px]">{value}</span></div>;
}

function PlatformMark({ platform }: { platform: PlatformType }) {
  const className = platform === "routard" ? "bg-primary/15 text-primary" : platform === "tripadvisor" ? "bg-success/15 text-success" : "bg-accent text-accent-foreground";
  const label = platform === "routard" ? "R" : platform === "tripadvisor" ? "T" : "↗";
  return <div className={`grid size-8 shrink-0 place-items-center rounded-md text-[12px] font-semibold ${className}`} aria-hidden="true">{label}</div>;
}

function StatusPill({ status }: { status: string }) {
  const positive = status === "verified" || status === "active";
  const negative = status === "expired" || status === "inactive";
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-sm px-2 py-1 text-[9px] font-medium ${positive ? "bg-success/15 text-success" : negative ? "bg-secondary text-muted-foreground" : "bg-primary/10 text-primary"}`}><span className={`size-1 rounded-full ${positive ? "bg-success" : negative ? "bg-muted-foreground" : "bg-primary"}`} />{status === "verified" ? "Enabled" : status === "unverified" ? "Unverified" : capitalize(status)}</span>;
}

function safeFilename(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "review-qr";
}

function truncateUrl(value: string) {
  try { const url = new URL(value); return `${url.hostname}${url.pathname.length > 20 ? `${url.pathname.slice(0, 19)}…` : url.pathname}`; } catch { return value; }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function countScans(scans: Scan[], qrId: string) {
  return scans.reduce((total, scan) => total + (scan.qr_code_id === qrId ? 1 : 0), 0);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Categories Page
function CategoriesPage({ categories, form, setForm, onSubmit, onDelete, busy }: {
  categories: Category[];
  form: { name: string; description: string; icon: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; description: string; icon: string }>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onDelete: (category: Category) => void;
  busy: boolean;
}) {
  const icons = ["store", "hotel", "restaurant", "cafe", "shopping", "spa", "travel", "entertainment"];
  return (
    <>
      <PageIntro eyebrow="BUSINESS TYPES" title="Categories" description="Define categories for your business (hotel, restaurant, cafe, shop). Each QR code can be linked to a category to show relevant review templates." />
      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.5fr]">
        <section className="h-fit border border-border bg-card">
          <PanelHeading title="Create category" detail="Add a business type for review templates" />
          <form className="space-y-4 p-4 sm:p-5" onSubmit={(event) => void onSubmit(event)}>
            <Field label="Category name" htmlFor="category-name">
              <Input id="category-name" className={inputClass} required maxLength={100} placeholder="e.g. Hotel, Restaurant, Cafe" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="Description" htmlFor="category-desc">
              <Input id="category-desc" className={inputClass} maxLength={200} placeholder="Optional description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </Field>
            <Field label="Icon" htmlFor="category-icon">
              <select id="category-icon" className={`${inputClass} w-full rounded-md border px-3 text-[13px]`} value={form.icon} onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))}>
                {icons.map((icon) => <option key={icon} value={icon}>{capitalize(icon)}</option>)}
              </select>
            </Field>
            <Button className="w-full" type="submit" disabled={busy}><Plus className="size-4" />Create category</Button>
          </form>
        </section>
        <section className="border border-border bg-card">
          <PanelHeading title="Your categories" detail={`${categories.length} categories`} />
          {categories.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="No categories yet" description="Create categories like Hotel, Restaurant, or Cafe to organize your review templates." />
          ) : (
            <div className="divide-y divide-border">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center gap-3 px-4 py-4 sm:px-5">
                  <div className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
                    <ClipboardCheck className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold">{category.name}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{category.description || "No description"} · Created {formatDate(category.created_at)}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${category.name}`} onClick={() => onDelete(category)}>
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

// Pre-made template suggestions by category type
const TEMPLATE_SUGGESTIONS: Record<string, Array<{ title: string; content: string; rating: number }>> = {
  hotel: [
    { title: "Excellent Stay!", rating: 5, content: "Our stay was absolutely wonderful. The rooms were spotless, staff was incredibly friendly, and the location was perfect. Highly recommend!" },
    { title: "Great Experience", rating: 5, content: "Beautiful hotel with amazing amenities. The bed was so comfortable and the breakfast was delicious. Will definitely come back!" },
    { title: "Perfect Getaway", rating: 5, content: "Everything exceeded our expectations. From check-in to check-out, the service was impeccable. A truly memorable experience." },
    { title: "Wonderful Service", rating: 5, content: "The staff went above and beyond to make our stay special. Room was clean and modern. Great value for money!" },
    { title: "Highly Recommended", rating: 5, content: "One of the best hotels we've stayed at. Quiet, comfortable, and well-located. The pool area was fantastic." },
    { title: "Amazing Hotel", rating: 4, content: "Really enjoyed our time here. Nice rooms, good breakfast, and helpful concierge. Would happily return." },
    { title: "Comfortable & Clean", rating: 4, content: "Very clean rooms with modern amenities. Staff was professional and helpful. Great location near attractions." },
    { title: "Great Value", rating: 4, content: "Excellent hotel for the price. Rooms are well-maintained and the breakfast buffet had lots of options." },
    { title: "Pleasant Stay", rating: 4, content: "Had a lovely time. The hotel is well-kept and the staff made us feel welcome. Good restaurant on-site too." },
    { title: "Nice Hotel", rating: 4, content: "Clean and comfortable with friendly staff. Convenient location and good facilities. Would recommend to others." },
  ],
  restaurant: [
    { title: "Absolutely Delicious!", rating: 5, content: "The food was incredible! Every dish was perfectly prepared and beautifully presented. Service was top-notch. A must-visit!" },
    { title: "Best Meal Ever", rating: 5, content: "Outstanding dining experience from start to finish. The chef really knows their craft. We'll be back for sure!" },
    { title: "Amazing Food", rating: 5, content: "Fresh ingredients, amazing flavors, and wonderful atmosphere. The staff was attentive and friendly. Highly recommend!" },
    { title: "Fantastic Experience", rating: 5, content: "We had the most wonderful evening. The food was exquisite and the wine selection was impressive. 5 stars!" },
    { title: "Culinary Excellence", rating: 5, content: "Every bite was a delight. Creative dishes, warm service, and a beautiful setting. This place is a gem!" },
    { title: "Great Restaurant", rating: 4, content: "Really enjoyed our meal here. Good variety on the menu and everything tasted fresh. Nice ambiance too." },
    { title: "Tasty Food", rating: 4, content: "Delicious dishes with generous portions. The staff was friendly and the prices were reasonable. Would return!" },
    { title: "Lovely Dinner", rating: 4, content: "Had a wonderful dinner. The pasta was homemade and you could taste the quality. Great wine list as well." },
    { title: "Enjoyable Meal", rating: 4, content: "Good food, pleasant atmosphere, and attentive service. A solid choice for a nice meal out." },
    { title: "Worth a Visit", rating: 4, content: "We had a great time. The food was tasty, service was quick, and the prices were fair. Recommended!" },
  ],
  cafe: [
    { title: "Perfect Coffee Spot", rating: 5, content: "Best coffee in town! Cozy atmosphere, friendly baristas, and delicious pastries. My new favorite spot!" },
    { title: "Cozy & Delicious", rating: 5, content: "Love this cafe! The coffee is amazing, the cakes are homemade, and the vibe is so welcoming. Perfect!" },
    { title: "Amazing Cafe", rating: 5, content: "Great coffee, wonderful staff, and a lovely ambiance. The perfect place to relax or work. Highly recommend!" },
    { title: "Love This Place", rating: 5, content: "Exceptional coffee and the most delicious croissants. The staff remembers your order. A true neighborhood gem!" },
    { title: "Best Coffee Ever", rating: 5, content: "The coffee here is outstanding. Beautiful interior, great music, and the pastries are to die for!" },
    { title: "Great Cafe", rating: 4, content: "Nice selection of coffee and tea. The cakes looked amazing and tasted even better. Cozy seating area." },
    { title: "Good Coffee", rating: 4, content: "Really enjoyed my latte here. Clean space, friendly service, and the wifi works great for working." },
    { title: "Lovely Spot", rating: 4, content: "A charming cafe with quality coffee and a good selection of snacks. Will definitely come back!" },
    { title: "Nice Atmosphere", rating: 4, content: "Pleasant cafe with good drinks and tasty treats. The staff was helpful and the prices were reasonable." },
    { title: "Cute Cafe", rating: 4, content: "Adorable decor and delicious drinks. The iced coffee was perfect. A great place to catch up with friends." },
  ],
  shop: [
    { title: "Excellent Shop!", rating: 5, content: "Great selection, fair prices, and the staff was incredibly helpful. Found exactly what I needed. Will be back!" },
    { title: "Amazing Service", rating: 5, content: "The staff went out of their way to help me find the perfect item. Quality products and great prices!" },
    { title: "Love This Store", rating: 5, content: "My favorite shop! Always have what I need and the staff is so knowledgeable and friendly." },
    { title: "Fantastic Experience", rating: 5, content: "Wonderful shopping experience. Clean store, organized displays, and helpful employees. Highly recommend!" },
    { title: "Best Shop in Town", rating: 5, content: "Great variety, competitive prices, and excellent customer service. This is my go-to store now!" },
    { title: "Great Store", rating: 4, content: "Good selection of products at reasonable prices. Staff was helpful and checkout was quick." },
    { title: "Nice Selection", rating: 4, content: "Found what I was looking for and more. The store is well-organized and the staff is friendly." },
    { title: "Helpful Staff", rating: 4, content: "The employees really know their products. Got great advice and found exactly what I needed." },
    { title: "Good Shop", rating: 4, content: "Clean store with a nice variety of products. Fair prices and friendly service. Would recommend!" },
    { title: "Worth Visiting", rating: 4, content: "Great little shop with quality items. The staff was patient and helped me make a good choice." },
  ],
  spa: [
    { title: "Pure Relaxation", rating: 5, content: "The most relaxing experience! The massage was incredible and the facilities were spotless. Heaven on earth!" },
    { title: "Amazing Spa", rating: 5, content: "Left feeling completely refreshed. The therapists were skilled and professional. Best spa treatment ever!" },
    { title: "Wonderful Treatment", rating: 5, content: "From the moment I walked in, I felt at peace. Excellent service, beautiful ambiance, and skilled staff." },
    { title: "Highly Recommend", rating: 5, content: "An oasis of calm. The treatments were top-quality and the staff made me feel so pampered. Will return!" },
    { title: "Perfect Experience", rating: 5, content: "Everything was perfect - the atmosphere, the treatment, the service. I've never felt so relaxed!" },
    { title: "Great Spa", rating: 4, content: "Really enjoyed my visit. The facilities were clean and modern, and my therapist was excellent." },
    { title: "Relaxing Visit", rating: 4, content: "A lovely spa with good treatments. Staff was professional and the prices were reasonable." },
    { title: "Nice Experience", rating: 4, content: "Had a wonderful massage and facial. The spa is well-maintained and the staff is friendly." },
    { title: "Good Treatment", rating: 4, content: "Felt so relaxed after my appointment. Clean facilities and skilled therapists. Would come back!" },
    { title: "Rejuvenating", rating: 4, content: "Great spa experience. The ambiance was peaceful and the treatment was very effective. Recommended!" },
  ],
  tour: [
    { title: "Incredible Tour!", rating: 5, content: "Our guide was fantastic! So knowledgeable and engaging. We learned so much and had an amazing time!" },
    { title: "Best Tour Ever", rating: 5, content: "Exceeded all expectations. Well-organized, informative, and fun. Our guide made history come alive!" },
    { title: "Unforgettable Experience", rating: 5, content: "This tour was the highlight of our trip! The guide was passionate and the sights were breathtaking." },
    { title: "Amazing Guide", rating: 5, content: "Our tour guide was exceptional - funny, knowledgeable, and so helpful. Highly recommend this tour!" },
    { title: "Perfect Day Out", rating: 5, content: "Everything was perfectly organized. Great pace, wonderful stops, and fascinating commentary. Loved it!" },
    { title: "Great Tour", rating: 4, content: "Really enjoyed this tour. Well-planned itinerary and our guide was very informative and friendly." },
    { title: "Highly Recommended", rating: 4, content: "A fantastic way to explore the area. Our guide shared interesting stories and hidden gems." },
    { title: "Wonderful Trip", rating: 4, content: "Had a great time on this tour. Good value for money and we saw some amazing places." },
    { title: "Informative Tour", rating: 4, content: "Learned so much on this tour! The guide was engaging and answered all our questions." },
    { title: "Fun Experience", rating: 4, content: "A well-organized tour with a great guide. Perfect for first-time visitors. Would recommend!" },
  ],
  default: [
    { title: "Excellent Experience!", rating: 5, content: "Absolutely wonderful! Everything exceeded my expectations. The staff was friendly and professional. Highly recommend!" },
    { title: "Highly Recommend", rating: 5, content: "Outstanding service from start to finish. I'll definitely be coming back and telling all my friends!" },
    { title: "Amazing!", rating: 5, content: "What a great experience! Everything was perfect. Thank you for the wonderful service!" },
    { title: "Fantastic Service", rating: 5, content: "The team really went above and beyond. Quality was excellent and the attention to detail was impressive." },
    { title: "Love It!", rating: 5, content: "Couldn't be happier with my experience. Professional, friendly, and high-quality. Five stars all around!" },
    { title: "Great Experience", rating: 4, content: "Really enjoyed my visit. Good service, fair prices, and a pleasant atmosphere. Would return!" },
    { title: "Very Good", rating: 4, content: "Had a positive experience. The staff was helpful and everything was well-organized. Recommended!" },
    { title: "Satisfied Customer", rating: 4, content: "Happy with the service I received. Good value and friendly team. Would definitely recommend." },
    { title: "Worth It", rating: 4, content: "Glad I chose this place. The quality was good and the staff made me feel welcome." },
    { title: "Recommended", rating: 4, content: "A solid experience all around. Professional service and good attention to detail. Would come back!" },
  ],
};

// Get template suggestions based on category name
function getTemplateSuggestions(categoryName: string): Array<{ title: string; content: string; rating: number }> {
  const lowerName = categoryName.toLowerCase();
  // Match category name to suggestions
  if (lowerName.includes("hotel") || lowerName.includes("accommodation") || lowerName.includes("lodge") || lowerName.includes("resort")) {
    return TEMPLATE_SUGGESTIONS.hotel;
  }
  if (lowerName.includes("restaurant") || lowerName.includes("dining") || lowerName.includes("food") || lowerName.includes("bistro")) {
    return TEMPLATE_SUGGESTIONS.restaurant;
  }
  if (lowerName.includes("cafe") || lowerName.includes("coffee") || lowerName.includes("bakery") || lowerName.includes("tea")) {
    return TEMPLATE_SUGGESTIONS.cafe;
  }
  if (lowerName.includes("shop") || lowerName.includes("store") || lowerName.includes("boutique") || lowerName.includes("retail")) {
    return TEMPLATE_SUGGESTIONS.shop;
  }
  if (lowerName.includes("spa") || lowerName.includes("wellness") || lowerName.includes("massage") || lowerName.includes("salon")) {
    return TEMPLATE_SUGGESTIONS.spa;
  }
  if (lowerName.includes("tour") || lowerName.includes("travel") || lowerName.includes("trip") || lowerName.includes("excursion")) {
    return TEMPLATE_SUGGESTIONS.tour;
  }
  return TEMPLATE_SUGGESTIONS.default;
}

// Review Templates Page
function TemplatesPage({ templates, categories, form, setForm, onSubmit, onBulkCreate, onToggle, onDelete, busy }: {
  templates: ReviewTemplate[];
  categories: Category[];
  form: { categoryId: string; title: string; content: string; rating: number };
  setForm: React.Dispatch<React.SetStateAction<{ categoryId: string; title: string; content: string; rating: number }>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onBulkCreate: (categoryId: string, templates: Array<{ title: string; content: string; rating: number }>) => Promise<void>;
  onToggle: (template: ReviewTemplate) => void;
  onDelete: (template: ReviewTemplate) => void;
  busy: boolean;
}) {
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [quickCategoryId, setQuickCategoryId] = useState("");
  
  const selectedCategory = categories.find((c) => c.id === quickCategoryId);
  const suggestions = selectedCategory ? getTemplateSuggestions(selectedCategory.name) : [];

  // Reset selections when category changes
  useEffect(() => {
    setSelectedSuggestions(new Set());
  }, [quickCategoryId]);

  function toggleSuggestion(index: number) {
    setSelectedSuggestions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }

  function selectAll() {
    setSelectedSuggestions(new Set(suggestions.map((_, i) => i)));
  }

  function deselectAll() {
    setSelectedSuggestions(new Set());
  }

  async function handleBulkCreate() {
    if (!quickCategoryId || selectedSuggestions.size === 0) return;
    const templatesToCreate = Array.from(selectedSuggestions).map((index) => suggestions[index]);
    await onBulkCreate(quickCategoryId, templatesToCreate);
    setSelectedSuggestions(new Set());
  }

  return (
    <>
      <PageIntro eyebrow="PRE-WRITTEN REVIEWS" title="Review Templates" description="Create pre-written review templates that customers can select when scanning a QR code." />
      
      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        {/* Left Column - Quick Add Templates */}
        <div className="space-y-5">
          {/* Quick Add Section - Main way to add templates */}
          <section className="border border-border bg-card">
            <PanelHeading 
              title="Quick add templates" 
              detail="Select a category, check templates, and add them instantly"
            />
            <div className="p-4 sm:p-5 border-b border-border">
              <Label htmlFor="quick-category" className="text-sm font-medium">Select Category</Label>
              <select 
                id="quick-category" 
                className={`${inputClass} mt-2 w-full rounded-md border px-3 text-[13px]`} 
                value={quickCategoryId} 
                onChange={(e) => setQuickCategoryId(e.target.value)}
              >
                <option value="">Choose a category...</option>
                {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>

            {/* Show suggestions when category selected */}
            {quickCategoryId && suggestions.length > 0 && (
              <>
                <div className="flex items-center justify-between px-4 py-2 bg-secondary/30 border-b border-border">
                  <p className="text-[11px] font-medium text-foreground">
                    {selectedSuggestions.size} of {suggestions.length} selected
                  </p>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[10px]" 
                    onClick={selectedSuggestions.size === suggestions.length ? deselectAll : selectAll}
                  >
                    {selectedSuggestions.size === suggestions.length ? "Deselect all" : "Select all"}
                  </Button>
                </div>
                <div className="max-h-[350px] overflow-y-auto divide-y divide-border">
                  {suggestions.map((suggestion, index) => {
                    const isSelected = selectedSuggestions.has(index);
                    return (
                      <label
                        key={index}
                        className={`flex w-full px-4 py-3 text-left cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-secondary/50"}`}
                      >
                        <div className="flex items-start gap-3 w-full">
                          <div className="pt-0.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSuggestion(index)}
                              className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className={`text-[12px] font-semibold truncate ${isSelected ? "text-primary" : ""}`}>{suggestion.title}</p>
                              <span className="text-[10px] text-amber-500">{"★".repeat(suggestion.rating)}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{suggestion.content}</p>
                          </div>
                          {isSelected && (
                            <div className="shrink-0">
                              <Check className="size-4 text-primary" />
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className="border-t border-border bg-primary/5 px-4 py-3">
                  <Button 
                    type="button" 
                    className="w-full"
                    disabled={busy || selectedSuggestions.size === 0}
                    onClick={() => void handleBulkCreate()}
                  >
                    <Plus className="size-4" />
                    Add {selectedSuggestions.size > 0 ? `${selectedSuggestions.size} templates` : "selected templates"}
                  </Button>
                </div>
              </>
            )}

            {/* No category selected */}
            {!quickCategoryId && categories.length > 0 && (
              <div className="p-8 text-center">
                <Sparkles className="mx-auto size-10 text-muted-foreground/50 mb-3" />
                <p className="text-[12px] font-medium text-muted-foreground">Select a category above</p>
                <p className="mt-1 text-[11px] text-muted-foreground/70">We'll show you 10 ready-made templates to choose from</p>
              </div>
            )}

            {/* No categories */}
            {categories.length === 0 && (
              <div className="p-8 text-center">
                <ClipboardCheck className="mx-auto size-10 text-muted-foreground/50 mb-3" />
                <p className="text-[12px] font-medium text-muted-foreground">No categories yet</p>
                <p className="mt-1 text-[11px] text-muted-foreground/70">Create a category first to add templates</p>
              </div>
            )}
          </section>

          {/* Custom Template Form - Collapsible */}
          <section className="border border-border bg-card">
            <button
              type="button"
              onClick={() => setShowCustomForm(!showCustomForm)}
              className="w-full flex items-center justify-between px-4 py-3 sm:px-5 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Pencil className="size-4 text-muted-foreground" />
                <span className="text-[13px] font-medium">Write custom template</span>
              </div>
              <ChevronDown className={`size-4 text-muted-foreground transition-transform ${showCustomForm ? "rotate-180" : ""}`} />
            </button>
            
            {showCustomForm && (
              <form className="space-y-4 p-4 sm:p-5 border-t border-border" onSubmit={(event) => void onSubmit(event)}>
                <Field label="Category" htmlFor="template-category">
                  <select id="template-category" required className={`${inputClass} w-full rounded-md border px-3 text-[13px]`} value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
                    <option value="">Select a category</option>
                    {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </Field>
                <Field label="Title" htmlFor="template-title">
                  <Input id="template-title" className={inputClass} required maxLength={150} placeholder="e.g. Great experience!" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
                </Field>
                <Field label="Review content" htmlFor="template-content">
                  <Textarea id="template-content" rows={4} required minLength={10} maxLength={1000} className="min-h-[100px] resize-y rounded-md border-border bg-background/60 text-[13px] leading-6" placeholder="Write the pre-written review text..." value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} />
                </Field>
                <Field label="Rating" htmlFor="template-rating">
                  <select id="template-rating" className={`${inputClass} w-full rounded-md border px-3 text-[13px]`} value={form.rating} onChange={(event) => setForm((current) => ({ ...current, rating: parseInt(event.target.value) }))}>
                    {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} Star{r > 1 ? "s" : ""}</option>)}
                  </select>
                </Field>
                <Button className="w-full" type="submit" disabled={busy || categories.length === 0}>
                  <Plus className="size-4" />Create custom template
                </Button>
              </form>
            )}
          </section>
        </div>

        {/* Right Column - Existing Templates */}
        <section className="border border-border bg-card h-fit">
          <PanelHeading title="Your templates" detail={`${templates.length} templates created`} />
          {templates.length === 0 ? (
            <EmptyState icon={FileImage} title="No templates yet" description="Select a category on the left, check the templates you want, and click 'Add templates'." />
          ) : (
            <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
              {templates.map((template) => {
                const category = categories.find((c) => c.id === template.category_id);
                return (
                  <div key={template.id} className="px-4 py-4 sm:px-5">
                    <div className="flex items-start gap-3">
                      <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                        <FileImage className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold">{template.title}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{category?.name || "Unknown"} · {"★".repeat(template.rating)}{"☆".repeat(5 - template.rating)}</p>
                        <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">{template.content}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <StatusPill status={template.is_active ? "active" : "inactive"} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => onToggle(template)}>
                          <Activity />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(template)}>
                          <Trash2 className="text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

// Submitted Reviews Page
function SubmittedReviewsPage({ reviews, categories, qrs, onUpdateStatus, onDelete }: {
  reviews: SubmittedReview[];
  categories: Category[];
  qrs: QrRow[];
  onUpdateStatus: (review: SubmittedReview, status: "approved" | "rejected") => void;
  onDelete: (review: SubmittedReview) => void;
}) {
  const [filterQr, setFilterQr] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Filter reviews
  const filteredReviews = reviews.filter((review) => {
    if (filterQr !== "all" && review.qr_code_id !== filterQr) return false;
    if (filterCategory !== "all" && review.category_id !== filterCategory) return false;
    if (filterStatus !== "all" && review.status !== filterStatus) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesName = review.reviewer_name?.toLowerCase().includes(search);
      const matchesEmail = review.reviewer_email?.toLowerCase().includes(search);
      const matchesText = review.review_text?.toLowerCase().includes(search);
      if (!matchesName && !matchesEmail && !matchesText) return false;
    }
    return true;
  });

  const pendingCount = reviews.filter((r) => r.status === "pending").length;
  const approvedCount = reviews.filter((r) => r.status === "approved").length;
  const rejectedCount = reviews.filter((r) => r.status === "rejected").length;

  return (
    <>
      <PageIntro eyebrow="CUSTOMER FEEDBACK" title="Submitted Reviews" description="View and manage reviews submitted by customers who scanned your QR codes." />
      
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Metric label="Total reviews" value={reviews.length} detail="All submitted" icon={Users} />
        <Metric label="Pending" value={pendingCount} detail="Awaiting review" icon={Bell} tone="teal" />
        <Metric label="Approved" value={approvedCount} detail="Published" icon={CheckCircle2} tone="green" />
        <Metric label="Rejected" value={rejectedCount} detail="Not published" icon={X} />
      </div>

      {/* Filters */}
      <div className="mb-5 border border-border bg-card p-4 rounded-md">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or review..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          {/* QR Code Filter */}
          <div className="min-w-[150px]">
            <select
              className={`${inputClass} w-full rounded-md border px-3 text-[13px]`}
              value={filterQr}
              onChange={(e) => setFilterQr(e.target.value)}
            >
              <option value="all">All QR Codes</option>
              {qrs.map((qr) => (
                <option key={qr.id} value={qr.id}>{qr.name}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="min-w-[150px]">
            <select
              className={`${inputClass} w-full rounded-md border px-3 text-[13px]`}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="min-w-[130px]">
            <select
              className={`${inputClass} w-full rounded-md border px-3 text-[13px]`}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Active filters summary */}
        {(filterQr !== "all" || filterCategory !== "all" || filterStatus !== "all" || searchTerm) && (
          <div className="mt-3 flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">Showing {filteredReviews.length} of {reviews.length} reviews</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-primary"
              onClick={() => {
                setFilterQr("all");
                setFilterCategory("all");
                setFilterStatus("all");
                setSearchTerm("");
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* Reviews List */}
      <section className="border border-border bg-card">
        <PanelHeading title="Reviews" detail={`${filteredReviews.length} reviews · sorted by newest`} />
        {filteredReviews.length === 0 ? (
          <EmptyState 
            icon={Users} 
            title={reviews.length === 0 ? "No reviews yet" : "No reviews match filters"} 
            description={reviews.length === 0 
              ? "Reviews will appear here when customers scan your QR codes and submit feedback." 
              : "Try adjusting your filters to see more reviews."
            } 
          />
        ) : (
          <div className="divide-y divide-border">
            {filteredReviews.map((review) => {
              const category = categories.find((c) => c.id === review.category_id);
              const qr = qrs.find((q) => q.id === review.qr_code_id);
              return (
                <div key={review.id} className="px-4 py-4 sm:px-5">
                  <div className="flex items-start gap-3">
                    <div className={`grid size-10 shrink-0 place-items-center rounded-full ${review.is_custom ? "bg-primary/15 text-primary" : "bg-accent text-accent-foreground"}`}>
                      <Users className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[12px] font-semibold">{review.reviewer_name}</p>
                        <span className="text-[10px] text-amber-500">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                        {review.is_custom && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[8px] font-medium text-primary">CUSTOM</span>}
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {review.reviewer_email && <span className="font-medium">{review.reviewer_email} · </span>}
                        {category?.name || "No category"} · {qr?.name || "Unknown QR"} · {formatDate(review.created_at)} · {review.device_category}
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-foreground">{review.review_text}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusPill status={review.status} />
                      <div className="flex items-center gap-1">
                        {review.status === "pending" && (
                          <>
                            <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] text-success" onClick={() => onUpdateStatus(review, "approved")}>
                              <Check className="size-3" />Approve
                            </Button>
                            <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] text-destructive" onClick={() => onUpdateStatus(review, "rejected")}>
                              <X className="size-3" />Reject
                            </Button>
                          </>
                        )}
                        {review.status !== "pending" && (
                          <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => onUpdateStatus(review, "pending" as "approved")}>
                            Reset
                          </Button>
                        )}
                        <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(review)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}