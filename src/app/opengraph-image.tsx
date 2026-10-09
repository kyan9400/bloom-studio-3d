import { ImageResponse } from "next/og";

export const alt = "Bloom Studio — Colour, mixed for your hands. A glass polish bottle and a fan of nail swatches.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FAN = [
  { r: -30, c: "#f3b6cf" },
  { r: -12, c: "#e58aab" },
  { r: 6, c: "#d9668f" },
  { r: 24, c: "#b2456f" },
  { r: 42, c: "#8c2457" },
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "radial-gradient(circle at 78% 40%, #fffaf6 0%, #f4e4de 45%, #e9c9c1 100%)",
          color: "#2a1b2d",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 80px", width: 640 }}>
          <div style={{ fontSize: 24, letterSpacing: 6, textTransform: "uppercase", color: "#8c2457", fontFamily: "sans-serif", fontWeight: 700 }}>
            Bloom Studio
          </div>
          <div style={{ fontSize: 88, lineHeight: 0.98, marginTop: 24, letterSpacing: -2 }}>Colour, mixed</div>
          <div style={{ fontSize: 88, lineHeight: 0.98, fontStyle: "italic", color: "#8c2457", letterSpacing: -2 }}>
            for your hands.
          </div>
          <div style={{ fontSize: 28, marginTop: 32, color: "#6b5868", fontFamily: "sans-serif" }}>
            Nail &amp; beauty studio · Shade Lab · Book a chair
          </div>
        </div>
        <div style={{ display: "flex", position: "relative", width: 560, height: 630 }}>
          {/* bottle */}
          <div style={{ position: "absolute", left: 120, top: 70, width: 84, height: 190, borderRadius: 26, background: "linear-gradient(90deg, #3b2740, #1d1220 40%, #120a14 80%, #2c1d31)" }} />
          <div style={{ position: "absolute", left: 92, top: 250, width: 140, height: 40, background: "rgba(255,255,255,0.45)", borderRadius: 10 }} />
          <div
            style={{
              position: "absolute",
              left: 50,
              top: 280,
              width: 224,
              height: 270,
              borderRadius: "70px 70px 36px 36px",
              background: "linear-gradient(115deg, #f0a5c3 0%, #d9668f 35%, #a7d8d0 62%, #c7a4e8 82%, #d9668f 100%)",
              boxShadow: "inset 0 0 0 10px rgba(255,255,255,0.45)",
            }}
          />
          <div style={{ position: "absolute", left: 76, top: 320, width: 18, height: 200, borderRadius: 9, background: "rgba(255,255,255,0.6)" }} />
          {/* fan */}
          {FAN.map((f) => (
            <div
              key={f.r}
              style={{
                position: "absolute",
                left: 330,
                top: 300,
                width: 84,
                height: 200,
                borderRadius: "50% 50% 46% 46% / 70% 70% 30% 30%",
                background: `linear-gradient(160deg, #ffffff 0%, ${f.c} 30%, ${f.c} 100%)`,
                transform: `rotate(${f.r}deg)`,
                transformOrigin: "50% 100%",
              }}
            />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
