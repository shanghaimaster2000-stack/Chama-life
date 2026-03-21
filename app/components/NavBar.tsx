"use client";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { icon: "🏠", label: "ホーム",  path: "/"          },
  { icon: "📅", label: "予定",    path: "/schedule"  },
  { icon: "📓", label: "メモ",    path: "/memo"      },
  { icon: "📊", label: "分析",    path: "/analyze"   },
  { icon: "🌏", label: "地図",    path: "/map"       },
];

export default function NavBar() {
  const pathname = usePathname();
  const router   = useRouter();

  return (
    <nav style={{
      position: "fixed",
      bottom: 0,
      left: "50%",
      transform: "translateX(-50%)",
      width: "100%",
      maxWidth: "420px",
      background: "white",
      borderTop: "1px solid #eee",
      display: "flex",
      justifyContent: "space-around",
      alignItems: "center",
      height: "60px",
      zIndex: 998,
      boxShadow: "0 -2px 8px rgba(0,0,0,0.06)",
    }}>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              height: "100%",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              gap: "2px",
              position: "relative",
            }}
          >
            <span style={{ fontSize: "22px", lineHeight: 1 }}>{item.icon}</span>
            <span style={{
              fontSize: "10px",
              color: isActive ? "#ff4d6d" : "#999",
              fontWeight: isActive ? "bold" : "normal",
            }}>
              {item.label}
            </span>
            {isActive && (
              <div style={{
                position: "absolute",
                bottom: 0,
                width: "30px",
                height: "3px",
                background: "#ff4d6d",
                borderRadius: "2px 2px 0 0",
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}
