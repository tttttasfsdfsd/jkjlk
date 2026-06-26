/**
 * Frontend Component Tests — P5-29
 * React Testing Library for extracted Home.tsx components.
 * Covers FileUploader, ChatWidget, InsightsPanel, ReportViewer.
 *
 * Run: npx vitest run tests/components.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// ── Mock heavy imports ────────────────────────────────────────────────
vi.mock("tesseract.js",            () => ({ recognize: vi.fn() }));
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({}));
vi.mock("@/lib/authStore", () => ({
  getCurrentUser:   vi.fn(() => null),
  getAccessToken:   vi.fn(() => "test-token"),
  upgradePlan:      vi.fn(),
}));

// ── FileUploader ──────────────────────────────────────────────────────
import FileUploader from "../src/components/home/FileUploader";

describe("FileUploader", () => {
  const defaultProps = {
    fileName:           "",
    companyName:        "",
    loading:            false,
    loadingStep:        0,
    isRTL:              false,
    t:                  { uploadTitle: "Upload" },
    onFile:             vi.fn(),
    onCompanyNameChange: vi.fn(),
    onLoadSample:       vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it("renders drag-and-drop zone", () => {
    render(<FileUploader {...defaultProps} />);
    expect(screen.getByRole("button", { name: /upload file/i })).toBeTruthy();
  });

  it("calls onFile when a file is dropped", async () => {
    const onFile = vi.fn();
    render(<FileUploader {...defaultProps} onFile={onFile} />);
    const zone = screen.getByRole("button", { name: /upload file/i });
    const file = new File(["a,b\n1,2"], "test.csv", { type: "text/csv" });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("calls onLoadSample when sample button clicked", async () => {
    const onLoadSample = vi.fn();
    render(<FileUploader {...defaultProps} onLoadSample={onLoadSample} />);
    const btn = screen.getByText(/sample data|بيانات تجريبية/i);
    fireEvent.click(btn);
    expect(onLoadSample).toHaveBeenCalled();
  });

  it("shows loading spinner when loading=true", () => {
    render(<FileUploader {...defaultProps} loading={true} loadingStep={2} />);
    // Should show progress indicator, not the drop zone
    expect(screen.queryByRole("button", { name: /upload file/i })).toBeFalsy();
  });

  it("renders in RTL mode", () => {
    const { container } = render(<FileUploader {...defaultProps} isRTL={true} />);
    const input = container.querySelector("input[type=text]");
    expect(input?.getAttribute("dir")).toBe("rtl");
  });
});

// ── ChatWidget ────────────────────────────────────────────────────────
import ChatWidget from "../src/components/home/ChatWidget";

describe("ChatWidget", () => {
  const baseProps = {
    messages:       [],
    input:          "",
    isLoading:      false,
    isRTL:          false,
    disabled:       false,
    onInputChange:  vi.fn(),
    onSend:         vi.fn(),
  };

  it("shows disabled state when disabled=true", () => {
    render(<ChatWidget {...baseProps} disabled={true} />);
    expect(screen.getByText(/upload a file|ارفع ملفاً/i)).toBeTruthy();
  });

  it("calls onSend when Enter pressed", async () => {
    const onSend = vi.fn();
    render(<ChatWidget {...baseProps} input="What is my revenue?" onSend={onSend} />);
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).toHaveBeenCalled();
  });

  it("does NOT call onSend on Shift+Enter", () => {
    const onSend = vi.fn();
    render(<ChatWidget {...baseProps} input="multi\nline" onSend={onSend} />);
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("renders messages with correct alignment", () => {
    const messages = [
      { role: "user" as const,      content: "Hello AI",     time: "09:00" },
      { role: "assistant" as const, content: "Hello user!",  time: "09:01" },
    ];
    render(<ChatWidget {...baseProps} messages={messages} />);
    expect(screen.getByText("Hello AI")).toBeTruthy();
    expect(screen.getByText("Hello user!")).toBeTruthy();
  });

  it("shows typing indicator when isLoading=true", () => {
    render(<ChatWidget {...baseProps} isLoading={true} />);
    // Loading dots are rendered as bouncing spans
    const dots = document.querySelectorAll(".animate-bounce");
    expect(dots.length).toBeGreaterThanOrEqual(3);
  });
});

// ── InsightsPanel ─────────────────────────────────────────────────────
import InsightsPanel from "../src/components/home/InsightsPanel";

describe("InsightsPanel", () => {
  const insights = [
    { type: "summary"        as const, title: "Summary",         text: "Overall health is good." },
    { type: "risk"           as const, title: "Key Risks",       text: "High debt ratio: 65%." },
    { type: "opportunity"    as const, title: "Opportunities",   text: "Room for growth." },
    { type: "recommendation" as const, title: "Recommendations", text: "Reduce debt." },
  ];

  it("renders all insight cards", () => {
    render(<InsightsPanel insights={insights} title="AI Insights" />);
    expect(screen.getByText("Summary")).toBeTruthy();
    expect(screen.getByText("Key Risks")).toBeTruthy();
    expect(screen.getByText("Opportunities")).toBeTruthy();
    expect(screen.getByText("Recommendations")).toBeTruthy();
  });

  it("renders insight text content", () => {
    render(<InsightsPanel insights={insights} title="AI Insights" />);
    expect(screen.getByText("High debt ratio: 65%.")).toBeTruthy();
  });

  it("renders title", () => {
    render(<InsightsPanel insights={insights} title="AI Insights" />);
    expect(screen.getByText("AI Insights")).toBeTruthy();
  });

  it("renders 0 cards for empty insights", () => {
    render(<InsightsPanel insights={[]} title="AI Insights" />);
    expect(screen.queryByText("Summary")).toBeFalsy();
  });
});

// ── AnalysisPanel ─────────────────────────────────────────────────────
import AnalysisPanel from "../src/components/home/AnalysisPanel";
import { TrendingUp } from "lucide-react";

describe("AnalysisPanel", () => {
  const metrics = [
    { icon: TrendingUp, color: "bg-blue-500/20 text-blue-400", label: "Revenue", value: "1.2M", sub: "+12%", subColor: "text-emerald-400" },
    { icon: TrendingUp, color: "bg-green-500/20 text-green-400", label: "Net Profit", value: "180K", sub: "15%", subColor: "text-emerald-400" },
  ];

  it("renders metric cards", () => {
    render(<AnalysisPanel metrics={metrics} isRTL={false} />);
    expect(screen.getByText("Revenue")).toBeTruthy();
    expect(screen.getByText("Net Profit")).toBeTruthy();
  });

  it("renders in RTL dir", () => {
    const { container } = render(<AnalysisPanel metrics={metrics} isRTL={true} />);
    expect(container.firstChild?.getAttribute("dir")).toBe("rtl");
  });

  it("returns null for empty metrics", () => {
    const { container } = render(<AnalysisPanel metrics={[]} isRTL={false} />);
    expect(container.firstChild).toBeFalsy();
  });
});
