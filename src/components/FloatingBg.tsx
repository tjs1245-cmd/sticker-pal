const CLOUDS = [
  { top: "6%", dur: 70, delay: -10, size: 56, x: "10vw" },
  { top: "22%", dur: 95, delay: -55, size: 44, x: "60vw" },
  { top: "48%", dur: 80, delay: -30, size: 64, x: "35vw" },
  { top: "72%", dur: 110, delay: -80, size: 48, x: "80vw" },
];

const STARS = [
  { top: "12%", left: "82%", dur: 3.2, delay: 0, size: 22 },
  { top: "30%", left: "8%", dur: 4.1, delay: -1, size: 18 },
  { top: "55%", left: "90%", dur: 3.6, delay: -2, size: 26 },
  { top: "68%", left: "14%", dur: 4.6, delay: -0.5, size: 20 },
  { top: "85%", left: "70%", dur: 3.9, delay: -1.5, size: 18 },
];

export default function FloatingBg() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {CLOUDS.map((c, i) => (
        <span
          key={i}
          className="bg-cloud"
          style={
            {
              top: c.top,
              fontSize: c.size,
              "--dur": `${c.dur}s`,
              "--delay": `${c.delay}s`,
              "--static-x": c.x,
            } as React.CSSProperties
          }
        >
          ☁️
        </span>
      ))}
      {STARS.map((s, i) => (
        <span
          key={i}
          className="bg-star"
          style={
            {
              top: s.top,
              left: s.left,
              fontSize: s.size,
              "--dur": `${s.dur}s`,
              "--delay": `${s.delay}s`,
            } as React.CSSProperties
          }
        >
          ⭐
        </span>
      ))}
    </div>
  );
}
