import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "مردم | Crowd — آزمایشگاه شبیه‌سازی و بهینه‌سازی تبلیغات ایران",
  description:
    "ارزیابی و بهینه‌سازی تکاملی تبلیغات فارسی روی جمعیت شبیه‌سازی‌شده ایران با Perplexity Decider v1.3 و DeepSeek",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} dark`}>
      <body className="min-h-screen bg-[#09090B] text-zinc-100 font-sans antialiased selection:bg-white/20 selection:text-white">
        {children}
      </body>
    </html>
  );
}
