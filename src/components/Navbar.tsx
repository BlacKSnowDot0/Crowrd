"use client";

export type ActiveTab = "test" | "battle" | "price" | "crowd" | "runs";

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  crowdCount: number;
  runsCount: number;
}

export function Navbar({ activeTab, onTabChange, crowdCount, runsCount }: NavbarProps) {
  const navBtn = (tab: ActiveTab, label: string, shortLabel?: string, count?: number) => {
    const active = activeTab === tab;
    return (
      <button
        type="button"
        onClick={() => onTabChange(tab)}
        className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[12px] sm:text-[13px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
          active
            ? "bg-white/[0.09] text-white"
            : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]"
        }`}
      >
        <span className="sm:hidden">{shortLabel ?? label}</span>
        <span className="hidden sm:inline">{label}</span>
        {typeof count === "number" && count > 0 && (
          <span className={`hidden sm:inline text-[11px] tabular-nums ${active ? "text-zinc-300" : "text-zinc-500"}`}>
            {count.toLocaleString("fa-IR")}
          </span>
        )}
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#09090B]/92 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => onTabChange("test")}
          className="flex items-center gap-2 cursor-pointer group shrink-0"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 64 64"
            className="w-7 h-7 shrink-0 transition-transform group-hover:scale-105"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="nav-bg" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#18181F" />
                <stop offset="100%" stopColor="#09090B" />
              </linearGradient>
              <linearGradient id="nav-border" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.24" />
                <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#34D399" stopOpacity="0.3" />
              </linearGradient>
              <linearGradient id="nav-wave" x1="15" y1="22" x2="49" y2="46" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="52%" stopColor="#818CF8" />
                <stop offset="100%" stopColor="#34D399" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="60" height="60" rx="15" fill="url(#nav-bg)" />
            <rect x="2.75" y="2.75" width="58.5" height="58.5" rx="14.25" stroke="url(#nav-border)" strokeWidth="1.5" />
            <path
              d="M16.5 46V27.5C16.5 24.4 20.2 22.9 22.4 25.1L32 34.8L41.6 25.1C43.8 22.9 47.5 24.4 47.5 27.5V46"
              stroke="url(#nav-wave)"
              strokeWidth="5.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="21.5" cy="18.2" r="2.5" fill="#38BDF8" />
            <circle cx="42.5" cy="18.2" r="2.5" fill="#34D399" />
            <circle cx="32" cy="15.4" r="3.4" fill="#F8FAFC" />
          </svg>
          <span className="flex items-baseline gap-1.5">
            <span className="text-[16px] sm:text-[17px] font-bold text-white leading-none">مردم</span>
            <span className="text-zinc-700 text-xs select-none hidden sm:inline">/</span>
            <span className="text-[13px] sm:text-[14px] font-semibold text-sky-400 tracking-tight leading-none hidden sm:inline" dir="ltr">
              Mardom
            </span>
          </span>
        </button>

        <nav className="flex items-center gap-0.5 sm:gap-1 min-w-0">
          {navBtn("crowd", "جمعیت", "جمعیت", crowdCount)}
          {navBtn("test", "تست و تکامل", "تکامل")}
          {navBtn("battle", "نبرد سریع A/B", "نبرد")}
          {navBtn("price", "آزمایشگاه قیمت", "قیمت")}
          {navBtn("runs", "تاریخچه", "تاریخچه", runsCount)}
        </nav>
      </div>
    </header>
  );
}
