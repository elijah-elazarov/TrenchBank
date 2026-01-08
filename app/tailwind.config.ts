import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        trench: {
          black: "#0a0a0f",
          darker: "#0d0d14",
          dark: "#12121a",
          card: "#16161f",
          border: "#1e1e2a",
          accent: "#00ff88",
          "accent-dim": "#00cc6a",
          purple: "#8b5cf6",
          pink: "#ec4899",
          cyan: "#06b6d4",
          warning: "#f59e0b",
          danger: "#ef4444",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        display: ["Instrument Sans", "sans-serif"],
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "gradient": "gradient 8s ease infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": {
            boxShadow: "0 0 20px rgba(0, 255, 136, 0.3)",
          },
          "50%": {
            boxShadow: "0 0 40px rgba(0, 255, 136, 0.6)",
          },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        gradient: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "grid-pattern":
          "linear-gradient(rgba(0, 255, 136, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 136, 0.03) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
export default config;

